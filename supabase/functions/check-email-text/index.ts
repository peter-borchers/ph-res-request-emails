import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { emailText } = await req.json();

    if (!emailText) {
      return new Response(
        JSON.stringify({ error: "Email text is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get OpenAI API key from settings table
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("openai_api_key")
      .maybeSingle();

    if (settingsError || !settings?.openai_api_key) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured in settings" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const openaiApiKey = settings.openai_api_key;

    const prompt = `You are a careful copy editor for outbound guest emails.

Task:
- Correct spelling, grammar, punctuation, and obvious typos only.
- Keep the exact meaning, tone, and intent. Do NOT rewrite for style.
- Do NOT add new information or remove any information.
- Do NOT change phrasing unless it is required to fix a clear grammatical error.
- Keep the same level of formality and warmth.
- Preserve proper nouns, names, dates, prices, and reference numbers exactly as written.
- Preserve the structure and formatting (line breaks, paragraphs, bullet points, greeting, signature).
- If the text is already correct, return it unchanged.

Output rules:
- Return ONLY the corrected email text.
- No explanations, no notes, no markup, no quotes.

Email to correct:
---
${emailText}
---`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to check email text" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const data = await response.json();
    const correctedText = data.choices[0].message.content.trim();

    return new Response(
      JSON.stringify({ correctedText }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in check-email-text function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
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
