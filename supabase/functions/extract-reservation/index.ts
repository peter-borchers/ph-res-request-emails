import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractRequest {
  emailContent: string;
}

interface ReservationData {
  arrival_date: string | null;
  departure_date: string | null;
  guest_name: string | null;
  guest_email: string | null;
  adult_count: number | null;
  child_count: number | null;
  room_count: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { emailContent }: ExtractRequest = await req.json();

    if (!emailContent) {
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

    const { data: settings } = await supabaseClient
      .from("settings")
      .select("openai_api_key")
      .maybeSingle();

    const apiKey = settings?.openai_api_key;

    if (!apiKey) {
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
            content: [
              "You extract structured reservation enquiry data from an email.",
              "Return ONLY valid JSON (no markdown, no commentary, no surrounding text).",
              "",
              "Extract these fields (use null if missing/unknown):",
              "- arrival_date: string in ISO format YYYY-MM-DD, or null",
              "- departure_date: string in ISO format YYYY-MM-DD, or null",
              "- guest_name: string, or null",
              "- guest_email: string (email), or null",
              "- adult_count: integer, or null",
              "- child_count: integer, or null",
              "- room_count: integer, or null",
              "",
              "Rules:",
              "1) Output must be a single JSON object with EXACTLY these keys and no others.",
              "2) If the email provides a date range like '3–6 March 2026', set arrival_date=2026-03-03 and departure_date=2026-03-06.",
              "3) If only nights are given without a departure date, leave departure_date as null.",
              "4) If counts are written in words (e.g. 'two adults'), convert to integers.",
              "5) If children ages are given, ignore ages; only extract child_count.",
              "6) Do not guess; if unsure, use null."
            ].join("\n")
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
      console.error("OpenAI API error:", errorText);
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

    const openaiData = await openaiResponse.json();
    const extractedText = (openaiData.choices[0]?.message?.content || "{}").trim();

    let reservationData: ReservationData;
    try {
      reservationData = JSON.parse(extractedText);
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
