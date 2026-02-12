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
          `Prioritize finding these fields if present: ${missingHint.join(', ')}.`,
        ]
      : []),
  ].join("\n");
}

function getMissingHint(existingReservation: {
  arrival_date: string | null;
  departure_date: string | null;
  guest_name: string | null;
  guest_email: string | null;
  adults: number | null;
  children: number | null;
  additional_info: string | null;
}): string[] {
  const missing: string[] = [];

  if (!existingReservation.arrival_date) missing.push("arrival_date");
  if (!existingReservation.departure_date) missing.push("departure_date");
  if (!existingReservation.guest_name) missing.push("guest_name");
  if (!existingReservation.guest_email) missing.push("guest_email");
  if (existingReservation.adults === null) missing.push("adult_count");
  if (existingReservation.children === null) missing.push("child_count");
  if (!existingReservation.additional_info) missing.push("additional_info");

  return missing;
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

    // Check if we have an existing reservation with complete data
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
        } else {
          missingHint = getMissingHint(existingReservation);
          console.log("Reservation data incomplete, proceeding with extraction", { missingHint });
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
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(missingHint)
          },
          {
            role: "user",
            content: emailContent
          }
        ],
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
