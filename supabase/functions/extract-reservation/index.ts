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
  console.log("extract-reservation function invoked", { method: req.method, url: req.url });

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("Creating Supabase client");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Parsing request body");
    const { emailContent, reservationId }: ExtractRequest = await req.json();
    console.log("Email content received, length:", emailContent?.length || 0);
    console.log("Reservation ID:", reservationId || "none");

    if (!emailContent) {
      console.log("Error: Email content is missing");
      return new Response(
        JSON.stringify({ error: "Email content is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if we have an existing reservation with complete data
    let missingHint: string[] | undefined;
    if (reservationId) {
      console.log("Checking existing reservation data for ID:", reservationId);
      const { data: existingReservation } = await supabaseClient
        .from("reservations")
        .select("arrival_date, departure_date, guest_name, guest_email, adults, children, additional_info")
        .eq("id", reservationId)
        .maybeSingle();

      if (existingReservation) {
        console.log("Found existing reservation:", existingReservation);

        // Check if all key fields are populated
        const isComplete =
          existingReservation.arrival_date !== null &&
          existingReservation.departure_date !== null &&
          existingReservation.guest_name !== null &&
          existingReservation.adults !== null &&
          existingReservation.children !== null &&
          existingReservation.additional_info !== null;

        if (isComplete) {
          console.log("Reservation data is complete, skipping re-extraction");
          return new Response(
            JSON.stringify({
              data: existingReservation,
              skipped: true,
              reason: "Reservation data already complete"
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        } else {
          missingHint = getMissingHint(existingReservation);
          console.log("Reservation data incomplete, proceeding with extraction", { missingHint });
        }
      }
    }

    console.log("Fetching OpenAI API key from settings");
    const { data: settings } = await supabaseClient
      .from("settings")
      .select("openai_api_key")
      .maybeSingle();

    const apiKey = settings?.openai_api_key;

    if (!apiKey) {
      console.log("Error: OpenAI API key not configured");
      return new Response(
        JSON.stringify({
          error: "OpenAI API key not configured. Please add it in Admin Settings."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("Calling OpenAI API to extract reservation data");
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", { status: openaiResponse.status, error: errorText });
      return new Response(
        JSON.stringify({
          error: "Failed to extract data from OpenAI",
          details: errorText
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("OpenAI API call successful");
    const openaiData = await openaiResponse.json();
    const extractedText = (openaiData.choices[0]?.message?.content || "{}").trim();
    console.log("Extracted text from OpenAI:", extractedText);

    let reservationData: ReservationData;
    try {
      reservationData = JSON.parse(extractedText);
      console.log("Successfully parsed reservation data:", reservationData);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", extractedText);
      return new Response(
        JSON.stringify({
          error: "Failed to parse extracted data",
          rawResponse: extractedText
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("Returning successful response");
    return new Response(
      JSON.stringify({ data: reservationData }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error in extract-reservation function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
