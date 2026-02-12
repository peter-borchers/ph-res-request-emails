import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractRequest {
  emailContent: string;
  reservationId?: string;
}

interface ReservationData {
  arrival_date: string | null;
  departure_date: string | null;
  guest_name: string | null;
  guest_email: string | null;
  adult_count: number | null;
  child_count: number | null;
  room_count: number | null;
  additional_info: string | null;
}

const EMPTY_RESULT: ReservationData = {
  arrival_date: null,
  departure_date: null,
  guest_name: null,
  guest_email: null,
  adult_count: null,
  child_count: null,
  room_count: null,
  additional_info: null,
};

function safeTrimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function ensureReservationDataShape(obj: any): ReservationData {
  // Guarantees exact keys with null defaults (stable for calling code)
  const out: ReservationData = { ...EMPTY_RESULT };
  if (!obj || typeof obj !== "object") return out;

  out.arrival_date = typeof obj.arrival_date === "string" ? obj.arrival_date : null;
  out.departure_date = typeof obj.departure_date === "string" ? obj.departure_date : null;

  out.guest_name = safeTrimOrNull(obj.guest_name);
  out.guest_email = safeTrimOrNull(obj.guest_email);

  out.adult_count = Number.isInteger(obj.adult_count) ? obj.adult_count : null;
  out.child_count = Number.isInteger(obj.child_count) ? obj.child_count : null;
  out.room_count = Number.isInteger(obj.room_count) ? obj.room_count : null;

  out.additional_info = safeTrimOrNull(obj.additional_info);

  return out;
}

/**
 * Decide whether we can skip re-extraction.
 * - Do NOT require additional_info to be present.
 * - Guest identity is satisfied by guest_name OR guest_email.
 * - Adults/children are helpful but not always present in first email; treat as non-blocking if you want.
 *
 * Adjust this “completeness” logic to match your real downstream requirements.
 */
function isReservationKeyDataComplete(existing: any): boolean {
  const hasArrival = existing?.arrival_date != null;
  const hasDeparture = existing?.departure_date != null;

  const hasGuestIdentity =
    (typeof existing?.guest_name === "string" && existing.guest_name.trim().length > 0) ||
    (typeof existing?.guest_email === "string" && existing.guest_email.trim().length > 0);

  return Boolean(hasArrival && hasDeparture && hasGuestIdentity);
}

function missingKeyFields(existing: any): string[] {
  const missing: string[] = [];
  if (existing?.arrival_date == null) missing.push("arrival_date");
  if (existing?.departure_date == null) missing.push("departure_date");

  const hasName = typeof existing?.guest_name === "string" && existing.guest_name.trim().length > 0;
  const hasEmail = typeof existing?.guest_email === "string" && existing.guest_email.trim().length > 0;
  if (!hasName && !hasEmail) missing.push("guest_name/guest_email");

  // Optional: include these as hints for the model
  if (existing?.adults == null) missing.push("adult_count");
  if (existing?.children == null) missing.push("child_count");

  return missing;
}

function buildSystemPrompt(missingHint?: string[]): string {
  return [
    "You are a reservation assistant for a hotel.",
    "Your task is to read a reservation enquiry email (or email thread) and extract a fixed set of fields.",
    "",
    "You must return ONLY a single valid JSON object (no markdown, no surrounding text).",
    "The JSON object MUST contain EXACTLY these keys and no others:",
    "arrival_date, departure_date, guest_name, guest_email, adult_count, child_count, room_count, additional_info",
    "",
    "Field definitions (use null if missing/unknown):",
    "- arrival_date: The intended check-in/arrival date. Output as YYYY-MM-DD or null.",
    "- departure_date: The intended check-out/departure date. Output as YYYY-MM-DD or null.",
    "- guest_name: The guest's full name (or the person making the enquiry) or null.",
    "- guest_email: The guest's email address (if present) or null.",
    "- adult_count: Number of adults staying/travelling (integer) or null.",
    "- child_count: Number of children staying/travelling (integer) or null.",
    "- room_count: Number of rooms requested (integer) or null.",
    "- additional_info: Concise context such as trip purpose, event names, special requests (views, accessibility, late arrival), or other relevant constraints. 1–3 sentences max. Or null.",
    "",
    "Extraction rules:",
    "1) Do NOT guess. If unsure, use null.",
    "2) Convert written numbers to integers (e.g., 'two adults' -> 2).",
    "3) If a date range is given (e.g., '3–6 March 2026'), set arrival_date=2026-03-03 and departure_date=2026-03-06.",
    "4) If only nights are given and no clear checkout date is stated, set arrival_date if known and leave departure_date as null.",
    "5) Ignore children ages; only extract child_count.",
    "",
    ...(missingHint && missingHint.length
      ? [
          "Important: This extraction is being re-run because some fields are missing or incomplete.",
          `Prioritize finding these fields if present: ${missingHint.join(", ")}.`,
        ]
      : []),
  ].join("\n");
}

/**
 * Extract output_text from Responses API response.
 */
function getResponsesApiOutputText(openaiData: any): string {
  const text =
    openaiData?.output
      ?.flatMap((o: any) => o?.content ?? [])
      ?.filter((c: any) => c?.type === "output_text")
      ?.map((c: any) => c?.text)
      ?.join("") ?? "";
  return String(text).trim();
}

Deno.serve(async (req: Request) => {
  console.log("extract-reservation invoked", { method: req.method, url: req.url });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing env vars", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return new Response(
        JSON.stringify({ error: "Supabase env vars missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const { emailContent, reservationId }: ExtractRequest = await req.json();

    console.log("Request parsed", {
      emailLen: emailContent?.length || 0,
      reservationId: reservationId || "none",
    });

    if (!emailContent || typeof emailContent !== "string" || emailContent.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Email content is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If reservation exists and key data complete: skip
    let missingHint: string[] | undefined;

    if (reservationId) {
      const { data: existingReservation, error: existingErr } = await supabaseClient
        .from("reservations")
        .select("arrival_date, departure_date, guest_name, guest_email, adults, children, additional_info")
        .eq("id", reservationId)
        .maybeSingle();

      if (existingErr) {
        console.warn("Failed to read existing reservation; proceeding anyway", existingErr);
      } else if (existingReservation) {
        if (isReservationKeyDataComplete(existingReservation)) {
          console.log("Key fields already present; skipping re-extraction", { reservationId });

          // Keep return shape: { data: ... } plus skipped fields
          // Map existing fields into the ReservationData interface
          const mapped: ReservationData = ensureReservationDataShape({
            arrival_date: existingReservation.arrival_date ?? null,
            departure_date: existingReservation.departure_date ?? null,
            guest_name: existingReservation.guest_name ?? null,
            guest_email: existingReservation.guest_email ?? null,
            adult_count: existingReservation.adults ?? null,
            child_count: existingReservation.children ?? null,
            room_count: null, // not stored on reservation row in your query
            additional_info: existingReservation.additional_info ?? null,
          });

          return new Response(
            JSON.stringify({
              data: mapped,
              skipped: true,
              reason: "Reservation key fields already present",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        missingHint = missingKeyFields(existingReservation);
        console.log("Reservation incomplete; will re-run extraction", { reservationId, missingHint });
      }
    }

    // Fetch OpenAI API key
    const { data: settings, error: settingsErr } = await supabaseClient
      .from("settings")
      .select("openai_api_key")
      .maybeSingle();

    if (settingsErr) {
      console.error("Failed to read settings", settingsErr);
      return new Response(JSON.stringify({ error: "Failed to read settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = settings?.openai_api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured. Please add it in Admin Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call OpenAI (Responses API) with strict JSON schema
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
      return new Response(JSON.stringify({ error: "Failed to extract data from OpenAI", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json();
    const extractedText = getResponsesApiOutputText(openaiData);

    console.log("OpenAI extraction received", { length: extractedText.length });

    if (!extractedText) {
      console.error("OpenAI returned empty output_text", { openaiData });
      return new Response(JSON.stringify({ error: "OpenAI returned empty extraction", details: openaiData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(extractedText);
    } catch {
      console.error("Failed to parse OpenAI JSON", { extractedText });
      return new Response(JSON.stringify({ error: "Failed to parse extracted data", rawResponse: extractedText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reservationData: ReservationData = ensureReservationDataShape(parsed);

    console.log("Returning successful response", reservationData);

    // MUST match current return type/shape:
    return new Response(JSON.stringify({ data: reservationData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-reservation function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
