// supabase/functions/extract-reservation/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * CORS
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ExtractRequest = {
  emailContent: string;
  reservationId?: string;
};

type ReservationRow = {
  arrival_date: string | null;
  departure_date: string | null;
  guest_name: string | null;
  guest_email: string | null;
  adults: number | null;
  children: number | null;
  additional_info: string | null;
};

type ReservationData = {
  arrival_date: string | null;
  departure_date: string | null;
  guest_name: string | null;
  guest_email: string | null;
  adult_count: number | null;
  child_count: number | null;
  room_count: number | null;
  additional_info: string | null;
};

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(extraHeaders ?? {}) },
  });
}

function buildSystemPrompt(missingHint?: string[]): string {
  return [
    "You are a hotel reservation assistant.",
    "",
    "Your job is to read reservation enquiry emails or email threads and extract structured reservation data.",
    "",
    "You MUST return ONLY a single valid JSON object.",
    "Do NOT include markdown.",
    "Do NOT include explanations.",
    "Do NOT include extra keys.",
    "Do NOT wrap JSON in text.",
    "",
    "The JSON must contain EXACTLY these keys:",
    "arrival_date",
    "departure_date",
    "guest_name",
    "guest_email",
    "adult_count",
    "child_count",
    "room_count",
    "additional_info",
    "",
    "--------------------------------",
    "FIELD DEFINITIONS",
    "--------------------------------",
    "",
    "arrival_date:",
    "Check-in date.",
    "Format: YYYY-MM-DD",
    "If unknown -> null",
    "",
    "departure_date:",
    "Check-out date.",
    "Format: YYYY-MM-DD",
    "If unknown -> null",
    "",
    "guest_name:",
    "Primary guest or first named occupant.",
    "If multiple guests listed -> use the first name listed.",
    "If no name -> null",
    "",
    "guest_email:",
    "Guest or sender email if present.",
    "Else null.",
    "",
    "adult_count:",
    "Total number of adults travelling or staying.",
    "Infer from:",
    "- Explicit counts",
    "- Number of named occupants",
    "Else null.",
    "",
    "child_count:",
    "Number of children.",
    "If not mentioned -> null.",
    "",
    "room_count:",
    "Number of rooms requested or implied.",
    "Infer from:",
    "- '2 rooms'",
    "- '2 single rooms'",
    "- Number of room lines",
    "Else null.",
    "",
    "additional_info:",
    "Short summary (1-3 sentences max) including:",
    "- Board basis (BB, HB, etc)",
    "- Event or travel purpose",
    "- Payment responsibility",
    "- Special requests",
    "Else null.",
    "",
    "--------------------------------",
    "CRITICAL EXTRACTION RULES",
    "--------------------------------",
    "",
    "GENERAL:",
    "- NEVER guess.",
    "- If unsure -> null.",
    "- Convert written numbers to integers.",
    "- Ignore ages of children.",
    "",
    "--------------------------------",
    "DATE PARSING",
    "--------------------------------",
    "",
    "Recognize formats:",
    "- 09-12 FEB",
    "- 9-12 Feb 2026",
    "- 3 to 6 March",
    "- 03/04/2026 - 07/04/2026",
    "",
    "Rules:",
    "arrival_date = first date",
    "departure_date = second date",
    "",
    "If month written once -> apply to both.",
    "If year missing -> infer most likely future date.",
    "",
    "--------------------------------",
    "ROOM COUNT RULES",
    "--------------------------------",
    "",
    "If email says:",
    "'2 rooms'",
    "'2 single rooms'",
    "'two double rooms'",
    "-> room_count = 2",
    "",
    "If room lines exist:",
    "Room 1: Name",
    "Room 2: Name",
    "-> room_count = number of room lines",
    "",
    "--------------------------------",
    "ROOMING LIST / NAME RULES",
    "--------------------------------",
    "",
    "If email lists occupants like:",
    "",
    "Room 1: John Smith",
    "Room 2: Mary Jones",
    "",
    "OR",
    "",
    "Guests:",
    "John Smith",
    "Mary Jones",
    "",
    "Then:",
    "adult_count = number of named people (unless explicit adult count overrides)",
    "guest_name = FIRST listed person",
    "",
    "--------------------------------",
    "PAYMENT & BOARD BASIS",
    "--------------------------------",
    "",
    "Detect and add to additional_info:",
    "",
    "Board:",
    "BB / Bed & Breakfast",
    "HB / Half Board",
    "FB / Full Board",
    "",
    "Payment:",
    "Credit card",
    "Company pay",
    "Agent pay",
    "Direct bill",
    "",
    "--------------------------------",
    "EVENT / PURPOSE",
    "--------------------------------",
    "",
    "If email mentions:",
    "Conference",
    "Wedding",
    "Mining Indaba",
    "Safari",
    "Holiday",
    "Business trip",
    "-> Add short summary to additional_info.",
    "",
    "--------------------------------",
    "MULTIPLE SIGNAL PRIORITY",
    "--------------------------------",
    "",
    "If conflicting signals:",
    "1) Explicit numbers win",
    "2) Then room lines",
    "3) Then name counts",
    "",
    "--------------------------------",
    "OUTPUT REQUIREMENTS",
    "--------------------------------",
    "",
    "Return ONLY JSON.",
    "No commentary.",
    "No markdown.",
    ...(missingHint && missingHint.length
      ? [
          "",
          "Important: this extraction is being re-run because some fields are missing.",
          `Prioritize finding these fields if present: ${missingHint.join(", ")}.`,
        ]
      : []),
  ].join("\n");
}

function getMissingHint(existing: ReservationRow): string[] {
  const missing: string[] = [];
  if (!existing.arrival_date) missing.push("arrival_date");
  if (!existing.departure_date) missing.push("departure_date");
  if (!existing.guest_name) missing.push("guest_name");
  if (!existing.guest_email) missing.push("guest_email");
  if (existing.adults === null) missing.push("adult_count");
  if (existing.children === null) missing.push("child_count");
  if (!existing.additional_info) missing.push("additional_info");
  // room_count not in reservations row, so don't include it here
  return missing;
}

function isReservationKeyDataComplete(existing: ReservationRow): boolean {
  // Define “complete” as: both dates + guest name + at least adults/children (not null) + additional_info present.
  // Tweak as needed.
  const datesOk = Boolean(existing.arrival_date && existing.departure_date);
  const guestOk = Boolean(existing.guest_name);
  const countsOk = existing.adults !== null && existing.children !== null;
  const infoOk = Boolean(existing.additional_info);
  return datesOk && guestOk && countsOk && infoOk;
}

function ensureReservationDataShape(x: any): ReservationData {
  const toNull = (v: any) => (v === undefined ? null : v);

  // Coerce integer-ish values safely
  const toIntOrNull = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number" && Number.isInteger(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    }
    return null;
  };

  const toStrOrNull = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v;
    return null;
  };

  return {
    arrival_date: toStrOrNull(toNull(x?.arrival_date)),
    departure_date: toStrOrNull(toNull(x?.departure_date)),
    guest_name: toStrOrNull(toNull(x?.guest_name)),
    guest_email: toStrOrNull(toNull(x?.guest_email)),
    adult_count: toIntOrNull(toNull(x?.adult_count)),
    child_count: toIntOrNull(toNull(x?.child_count)),
    room_count: toIntOrNull(toNull(x?.room_count)),
    additional_info: toStrOrNull(toNull(x?.additional_info)),
  };
}

/**
 * Best-effort extraction of the Responses API "output_text".
 * - Some responses include `output_text` directly.
 * - Others contain `output` array blocks.
 */
function getResponsesApiOutputText(openaiData: any): string {
  if (!openaiData) return "";
  if (typeof openaiData.output_text === "string") return openaiData.output_text;

  // Try to find a text block in output[].content[]
  const out = openaiData.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        // common shapes: {type:"output_text", text:"..."} or {type:"text", text:"..."}
        const t = c?.text;
        if (typeof t === "string" && t.trim()) return t;
      }
    }
  }

  return "";
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  console.log("extract-reservation invoked", { method: req.method, url: req.url });

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    // --- Parse request body
    let payload: ExtractRequest;
    try {
      payload = (await req.json()) as ExtractRequest;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const emailContent = payload?.emailContent?.trim() ?? "";
    const reservationId = payload?.reservationId?.trim();

    if (!emailContent) {
      return jsonResponse({ error: "emailContent is required" }, 400);
    }

    // --- Create Supabase client (service role)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing env vars", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return jsonResponse(
        { error: "Supabase env vars missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
        500
      );
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // --- If reservationId provided, check existing reservation to decide skip / hint
    let missingHint: string[] | undefined;

    if (reservationId) {
      const { data: existingReservation, error: existingErr } = await supabaseClient
        .from("reservations")
        .select("arrival_date, departure_date, guest_name, guest_email, adults, children, additional_info")
        .eq("id", reservationId)
        .maybeSingle<ReservationRow>();

      if (existingErr) {
        console.warn("Failed to read existing reservation; proceeding anyway", {
          reservationId,
          message: existingErr.message,
        });
      } else if (existingReservation) {
        if (isReservationKeyDataComplete(existingReservation)) {
          console.log("Key fields already present; skipping re-extraction", { reservationId });

          const mapped: ReservationData = ensureReservationDataShape({
            arrival_date: existingReservation.arrival_date ?? null,
            departure_date: existingReservation.departure_date ?? null,
            guest_name: existingReservation.guest_name ?? null,
            guest_email: existingReservation.guest_email ?? null,
            adult_count: existingReservation.adults ?? null,
            child_count: existingReservation.children ?? null,
            room_count: null, // not stored in reservations row
            additional_info: existingReservation.additional_info ?? null,
          });

          return jsonResponse(
            {
              data: mapped,
              skipped: true,
              reason: "Reservation key fields already present",
            },
            200
          );
        }

        missingHint = getMissingHint(existingReservation);
        console.log("Reservation incomplete; will re-run extraction", { reservationId, missingHint });
      }
    }

    // --- Read OpenAI API key from settings table
    const { data: settings, error: settingsErr } = await supabaseClient
      .from("settings")
      .select("openai_api_key")
      .maybeSingle<{ openai_api_key: string | null }>();

    if (settingsErr) {
      console.error("Failed to read settings", { message: settingsErr.message });
      return jsonResponse({ error: "Failed to read settings" }, 500);
    }

    const apiKey = settings?.openai_api_key ?? null;
    if (!apiKey) {
      return jsonResponse(
        { error: "OpenAI API key not configured. Please add it in Admin Settings." },
        400
      );
    }

    // --- Call OpenAI Responses API with strict JSON schema
    const sysPrompt = buildSystemPrompt(missingHint);

    console.log("Calling OpenAI Responses API", { model: "gpt-4.1-mini" });

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.1,
        input: [
          { role: "system", content: [{ type: "input_text", text: sysPrompt }] },
          { role: "user", content: [{ type: "input_text", text: emailContent }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "reservation_enquiry_extract",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                arrival_date: { type: ["string", "null"] },
                departure_date: { type: ["string", "null"] },
                guest_name: { type: ["string", "null"] },
                guest_email: { type: ["string", "null"] },
                adult_count: { type: ["integer", "null"] },
                child_count: { type: ["integer", "null"] },
                room_count: { type: ["integer", "null"] },
                additional_info: { type: ["string", "null"] },
              },
              required: [
                "arrival_date",
                "departure_date",
                "guest_name",
                "guest_email",
                "adult_count",
                "child_count",
                "room_count",
                "additional_info",
              ],
            },
          },
        },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error", { status: openaiResponse.status, errorText });
      return jsonResponse(
        { error: "Failed to extract data from OpenAI", details: errorText },
        500
      );
    }

    const openaiData = await openaiResponse.json();
    const extractedText = getResponsesApiOutputText(openaiData);

    console.log("OpenAI extraction received", { length: extractedText?.length ?? 0 });

    if (!extractedText) {
      console.error("OpenAI returned empty output_text", { openaiData });
      return jsonResponse(
        { error: "OpenAI returned empty extraction", details: openaiData },
        500
      );
    }

    const parsed = safeJsonParse(extractedText);
    if (!parsed) {
      console.error("Failed to parse OpenAI JSON", { extractedText });
      return jsonResponse(
        { error: "Failed to parse extracted data", rawResponse: extractedText },
        500
      );
    }

    const reservationData: ReservationData = ensureReservationDataShape(parsed);

    console.log("Returning successful response", reservationData);

    return jsonResponse({ data: reservationData }, 200);
  } catch (error) {
    console.error("Error in extract-reservation function:", error);
    return jsonResponse(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});
