import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OAuthCallbackRequest {
  code: string;
  mailbox_address: string;
}

interface SyncRequest {
  mailbox_address: string;
}

interface ConversationRequest {
  conversation_id: string;
}

interface ReplyRequest {
  message_id: string;
  body: string;
}

interface MarkReadRequest {
  message_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/msgraph", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    switch (path) {
      case "/oauth/initiate": {
        return handleOAuthInitiate(req, supabase);
      }

      case "/oauth/callback": {
        return handleOAuthCallback(req, supabase);
      }

      case "/sync": {
        return handleSync(req, supabase);
      }

      case "/sync-conversation": {
        return handleSyncConversation(req, supabase);
      }

      case "/conversations": {
        return handleGetConversations(req, supabase);
      }

      case "/messages": {
        return handleGetMessages(req, supabase);
      }

      case "/reply": {
        return handleReply(req, supabase);
      }

      case "/mark-read": {
        return handleMarkRead(req, supabase);
      }

      case "/auth/status": {
        return handleAuthStatus(req, supabase);
      }

      default: {
        return new Response(
          JSON.stringify({ error: "Endpoint not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleOAuthInitiate(req: Request, supabase: any) {
  const url = new URL(req.url);
  let mailbox_address = url.searchParams.get("mailbox_address");

  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("msgraph_client_id, msgraph_tenant_id, mailbox_address")
    .maybeSingle();

  if (!mailbox_address && settings?.mailbox_address) {
    mailbox_address = settings.mailbox_address;
  }

  if (!mailbox_address) {
    return new Response(
      JSON.stringify({ error: "mailbox_address is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (settingsError || !settings?.msgraph_client_id || !settings?.msgraph_tenant_id) {
    return new Response(
      JSON.stringify({ error: "Microsoft Graph credentials not configured" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/msgraph/oauth/callback`;
  const scope = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite offline_access";

  const authUrl = `https://login.microsoftonline.com/${settings.msgraph_tenant_id}/oauth2/v2.0/authorize?` +
    `client_id=${settings.msgraph_client_id}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(mailbox_address)}` +
    `&prompt=select_account` +
    `&login_hint=${encodeURIComponent(mailbox_address)}`;

  return new Response(
    JSON.stringify({ auth_url: authUrl }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleOAuthCallback(req: Request, supabase: any) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const mailbox_address = url.searchParams.get("state");

  if (!code || !mailbox_address) {
    return new Response(
      JSON.stringify({ error: "Missing code or state parameter" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("msgraph_client_id, msgraph_client_secret, msgraph_tenant_id")
    .maybeSingle();

  if (settingsError || !settings) {
    return new Response(
      JSON.stringify({ error: "Microsoft Graph credentials not configured" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/msgraph/oauth/callback`;

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${settings.msgraph_tenant_id}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: settings.msgraph_client_id,
        client_secret: settings.msgraph_client_secret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    }
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", errorText);
    console.error("Redirect URI used:", redirectUri);
    console.error("Tenant ID:", settings.msgraph_tenant_id);

    let errorDetails;
    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = { raw_error: errorText };
    }

    return new Response(
      JSON.stringify({
        error: "Failed to exchange authorization code for tokens",
        details: errorDetails,
        redirect_uri: redirectUri
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const tokens = await tokenResponse.json();
  const token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const userProfileResponse = await fetch(
    "https://graph.microsoft.com/v1.0/me",
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }
  );

  let actualMailbox = mailbox_address;
  if (userProfileResponse.ok) {
    const userProfile = await userProfileResponse.json();
    actualMailbox = userProfile.mail || userProfile.userPrincipalName || mailbox_address;
  }

  const { data, error } = await supabase
    .from("msgraph_oauth_tokens")
    .upsert({
      mailbox_address: actualMailbox,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'mailbox_address'
    })
    .select()
    .maybeSingle();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const appUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/functions.*/, '') || 'http://localhost:5173';

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem 2.5rem;
      border-radius: 1rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
    }
    .success {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: scaleIn 0.5s ease-out;
    }
    .success svg {
      width: 48px;
      height: 48px;
      stroke: white;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      animation: checkmark 0.5s ease-out 0.3s forwards;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
    }
    h1 {
      color: #111827;
      margin: 0 0 0.5rem 0;
      font-size: 1.75rem;
      font-weight: 700;
    }
    p {
      color: #6b7280;
      margin: 0;
      font-size: 1rem;
    }
    @keyframes scaleIn {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    @keyframes checkmark {
      to {
        stroke-dashoffset: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">
      <svg viewBox="0 0 52 52">
        <polyline points="14 27 22 35 38 19"/>
      </svg>
    </div>
    <h1>Authentication Successful</h1>
    <p>Closing window...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth_success' }, '*');
      setTimeout(() => window.close(), 1500);
    } else {
      window.location.href = '${appUrl}';
    }
  </script>
</body>
</html>`,
    {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

function replacePlaceholders(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key === 'missing_details') {
      const missing = [];
      if (!data.arrival_date) missing.push('Check-in date');
      if (!data.departure_date) missing.push('Check-out date');
      if (!data.guest_name) missing.push('Guest name');
      if (!data.guest_email) missing.push('Contact email');
      return missing.length > 0 ? missing.map(item => `- ${item}`).join('\n') : 'N/A';
    }
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
  });
}

async function autoExtractReservation(supabase: any, conversationUuid: string, conversationId: string, allMessages: any[]) {
  try {
    const { data: settings } = await supabase
      .from("settings")
      .select("openai_api_key, missing_details_template_id")
      .maybeSingle();

    if (!settings?.openai_api_key) {
      console.log("OpenAI API key not configured, skipping auto-extraction");
      await supabase
        .from("msgraph_conversations")
        .update({ auto_extracted: true })
        .eq("id", conversationUuid);
      return;
    }

    const firstMessage = allMessages[0];

    const emailContent = allMessages.map((msg, idx) => `
Message ${idx + 1}:
Subject: ${msg.subject || ""}
From: ${msg.from?.emailAddress?.name || ""} <${msg.from?.emailAddress?.address || ""}>
Date: ${msg.receivedDateTime || msg.sentDateTime || ""}
Body: ${msg.bodyPreview || msg.body?.content || ""}
---
    `.trim()).join('\n\n');

    const extractResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-reservation`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emailContent }),
    });

    if (!extractResponse.ok) {
      console.error("Extract reservation failed:", await extractResponse.text());
      await supabase
        .from("msgraph_conversations")
        .update({ auto_extracted: true })
        .eq("id", conversationUuid);
      return;
    }

    const extractResult = await extractResponse.json();
    const reservationData = extractResult.data;

    if (!reservationData) {
      await supabase
        .from("msgraph_conversations")
        .update({ auto_extracted: true })
        .eq("id", conversationUuid);
      return;
    }

    const { data: existingReservation } = await supabase
      .from("reservations")
      .select("id, arrival_date, departure_date, guest_name, guest_email")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    const guestEmail = reservationData.guest_email || firstMessage.from?.emailAddress?.address || "";

    let targetReservation;

    if (existingReservation) {
      const needsUpdate = !existingReservation.arrival_date ||
                         !existingReservation.departure_date ||
                         !existingReservation.guest_name ||
                         !existingReservation.guest_email;

      if (!needsUpdate) {
        console.log(`Reservation for ${conversationId} is already complete, skipping`);
        await supabase
          .from("msgraph_conversations")
          .update({ auto_extracted: true })
          .eq("id", conversationUuid);
        return;
      }

      console.log(`Updating incomplete reservation ${existingReservation.id} with new data`);

      const updateData: any = {};
      if (reservationData.arrival_date && !existingReservation.arrival_date) {
        updateData.arrival_date = reservationData.arrival_date;
      }
      if (reservationData.departure_date && !existingReservation.departure_date) {
        updateData.departure_date = reservationData.departure_date;
      }
      if (reservationData.guest_name && !existingReservation.guest_name) {
        updateData.guest_name = reservationData.guest_name;
      }
      if (guestEmail && !existingReservation.guest_email) {
        updateData.guest_email = guestEmail;
      }
      if (reservationData.adult_count) {
        updateData.adults = reservationData.adult_count;
      }
      if (reservationData.child_count) {
        updateData.children = reservationData.child_count;
      }
      if (reservationData.additional_info) {
        updateData.additional_info = reservationData.additional_info;
      }

      const { data: updatedReservation, error: updateError } = await supabase
        .from("reservations")
        .update(updateData)
        .eq("id", existingReservation.id)
        .select()
        .single();

      if (updateError) {
        console.error("Failed to update reservation:", updateError);
        return;
      }

      targetReservation = updatedReservation;
    } else {
      const { data: newReservation, error: insertError } = await supabase
        .from("reservations")
        .insert({
          conversation_id: conversationId,
          guest_name: reservationData.guest_name || "",
          guest_email: guestEmail,
          arrival_date: reservationData.arrival_date || null,
          departure_date: reservationData.departure_date || null,
          adults: reservationData.adult_count || 0,
          children: reservationData.child_count || 0,
          room_types: [],
          nightly_rate_currency: "ZAR",
          nightly_rate_amount: 0,
          additional_info: reservationData.additional_info || null,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to insert reservation:", insertError);
        await supabase
          .from("msgraph_conversations")
          .update({ auto_extracted: true })
          .eq("id", conversationUuid);
        return;
      }

      targetReservation = newReservation;
    }

    // Check if reservation data is incomplete
    const isIncomplete = !targetReservation.arrival_date ||
                        !targetReservation.departure_date ||
                        !targetReservation.guest_name ||
                        !targetReservation.guest_email;

    if (isIncomplete && targetReservation) {
      console.log(`Reservation data incomplete for ${conversationId}, checking for existing draft...`);

      const { data: existingDraft } = await supabase
        .from("email_drafts")
        .select("id")
        .eq("reservation_id", targetReservation.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingDraft) {
        console.log(`Draft already exists for reservation ${targetReservation.id}, skipping creation`);
      } else {
        let templateId = null;
        let subject: string;
        let bodyText: string;
        let bodyHtml: string | null = null;

        // Prepare data for placeholder replacement
        const templateData = {
          guest_name: targetReservation.guest_name || guestEmail.split('@')[0] || 'Guest',
          guest_email: targetReservation.guest_email || guestEmail,
          arrival_date: targetReservation.arrival_date || 'Not provided',
          departure_date: targetReservation.departure_date || 'Not provided',
          adults: targetReservation.adults || 0,
          children: targetReservation.children || 0,
          missing_details: true,
        };

        // Try to use the missing_details_template_id from settings
        if (settings?.missing_details_template_id) {
          const { data: template } = await supabase
            .from("email_templates")
            .select("id, subject_template, body_template, html_body_template")
            .eq("id", settings.missing_details_template_id)
            .eq("is_active", true)
            .maybeSingle();

          if (template) {
            templateId = template.id;
            subject = replacePlaceholders(template.subject_template, templateData);

            if (template.html_body_template) {
              bodyHtml = replacePlaceholders(template.html_body_template, templateData);
              bodyText = '';
            } else {
              bodyText = replacePlaceholders(template.body_template, templateData);
            }

            console.log(`Using template ${templateId} for missing details draft`);
          } else {
            console.log(`Template ${settings.missing_details_template_id} not found or inactive, using default message`);
            subject = `Re: ${firstMessage.subject || "Reservation Inquiry"}`;
            bodyText = `Thank you for your inquiry. To assist you better, we need some additional information:\n\n${
              !targetReservation.arrival_date ? "- Check-in date\n" : ""
            }${
              !targetReservation.departure_date ? "- Check-out date\n" : ""
            }${
              !targetReservation.guest_name ? "- Guest name\n" : ""
            }${
              !targetReservation.guest_email ? "- Contact email\n" : ""
            }\nPlease provide these details so we can prepare your personalized offer.`;
          }
        } else {
          console.log(`No missing_details_template_id configured, using default message`);
          subject = `Re: ${firstMessage.subject || "Reservation Inquiry"}`;
          bodyText = `Thank you for your inquiry. To assist you better, we need some additional information:\n\n${
            !targetReservation.arrival_date ? "- Check-in date\n" : ""
          }${
            !targetReservation.departure_date ? "- Check-out date\n" : ""
          }${
            !targetReservation.guest_name ? "- Guest name\n" : ""
          }${
            !targetReservation.guest_email ? "- Contact email\n" : ""
          }\nPlease provide these details so we can prepare your personalized offer.`;
        }

        await supabase
          .from("email_drafts")
          .insert({
            reservation_id: targetReservation.id,
            conversation_id: conversationId,
            template_id: templateId,
            to_recipients: [targetReservation.guest_email || guestEmail].filter(Boolean),
            cc_recipients: [],
            subject: subject,
            body_text: bodyText,
            body_html: bodyHtml,
            status: "pending",
            attempt_count: 0,
          });

        console.log(`Draft created for incomplete reservation ${targetReservation.id}`);
      }
    }

    await supabase
      .from("msgraph_conversations")
      .update({ auto_extracted: true })
      .eq("id", conversationUuid);

    console.log(`Auto-extracted reservation for conversation ${conversationId}`);
  } catch (error) {
    console.error("Error in autoExtractReservation:", error);
    await supabase
      .from("msgraph_conversations")
      .update({ auto_extracted: true })
      .eq("id", conversationUuid);
  }
}

async function getAccessToken(supabase: any, mailbox_address: string) {
  const { data: tokenData, error: tokenError } = await supabase
    .from("msgraph_oauth_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("mailbox_address", mailbox_address)
    .maybeSingle();

  if (tokenError || !tokenData) {
    throw new Error("No authentication tokens found");
  }

  const isExpired = new Date(tokenData.token_expires_at) < new Date();

  if (isExpired && tokenData.refresh_token) {
    const { data: settings } = await supabase
      .from("settings")
      .select("msgraph_client_id, msgraph_client_secret, msgraph_tenant_id")
      .maybeSingle();

    if (!settings) {
      throw new Error("Microsoft Graph credentials not configured");
    }

    const refreshResponse = await fetch(
      `https://login.microsoftonline.com/${settings.msgraph_tenant_id}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: settings.msgraph_client_id,
          client_secret: settings.msgraph_client_secret,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      }
    );

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh access token");
    }

    const newTokens = await refreshResponse.json();
    const token_expires_at = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    await supabase
      .from("msgraph_oauth_tokens")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || tokenData.refresh_token,
        token_expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("mailbox_address", mailbox_address);

    return newTokens.access_token;
  }

  return tokenData.access_token;
}

async function handleSync(req: Request, supabase: any) {
  try {
    const body = await req.json();
    const mailbox_address = body.mailbox_address;

    if (!mailbox_address) {
      return new Response(
        JSON.stringify({ error: "mailbox_address is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = await getAccessToken(supabase, mailbox_address);

    const inboxResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=50&$orderby=receivedDateTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!inboxResponse.ok) {
      const errorText = await inboxResponse.text();
      console.error("Failed to fetch inbox messages:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages from Microsoft Graph", details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inboxData = await inboxResponse.json();
    const inboxMessages = inboxData.value || [];

    const sentItemsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$top=50&$orderby=sentDateTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    let sentMessages = [];
    if (sentItemsResponse.ok) {
      const sentData = await sentItemsResponse.json();
      sentMessages = sentData.value || [];
    }

    const allMessages = [...inboxMessages, ...sentMessages];
    const conversationMap = new Map();

    for (const msg of allMessages) {
      const convId = msg.conversationId;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, []);
      }
      conversationMap.get(convId).push(msg);
    }

    const syncedMessages = [];
    const newConversations = [];

    for (const [convId, messages] of conversationMap.entries()) {
      messages.sort((a: any, b: any) => {
        const dateA = new Date(a.receivedDateTime || a.sentDateTime).getTime();
        const dateB = new Date(b.receivedDateTime || b.sentDateTime).getTime();
        return dateA - dateB;
      });

      const firstMsg = messages[0];
      const lastMsg = messages[messages.length - 1];
      const firstMessageAt = firstMsg.receivedDateTime || firstMsg.sentDateTime;
      const lastMessageAt = lastMsg.receivedDateTime || lastMsg.sentDateTime;

      const lastFromEmail = lastMsg.from?.emailAddress?.address || "";
      const lastMessageDirection = lastFromEmail.toLowerCase().includes(mailbox_address.toLowerCase())
        ? 'outbound'
        : 'inbound';

      const { data: existingConv } = await supabase
        .from("msgraph_conversations")
        .select("id, auto_extracted")
        .eq("conversation_id", convId)
        .maybeSingle();

      const isNew = !existingConv;

      const convResult = await supabase
        .from("msgraph_conversations")
        .upsert({
          conversation_id: convId,
          subject: firstMsg.subject || "(No Subject)",
          first_message_at: firstMessageAt,
          last_message_at: lastMessageAt,
          last_message_direction: lastMessageDirection,
          participants: [
            firstMsg.from?.emailAddress?.address,
            ...firstMsg.toRecipients.map((r: any) => r.emailAddress.address),
          ].filter(Boolean),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'conversation_id'
        })
        .select()
        .maybeSingle();

      if (!convResult.error && convResult.data) {
        for (const msg of messages) {
          const msgResult = await supabase
            .from("msgraph_messages")
            .upsert({
              msgraph_message_id: msg.id,
              conversation_uuid: convResult.data.id,
              subject: msg.subject || "(No Subject)",
              from_email: msg.from?.emailAddress?.address || "",
              from_name: msg.from?.emailAddress?.name || "",
              to_emails: msg.toRecipients.map((r: any) => r.emailAddress.address),
              body_preview: msg.bodyPreview || "",
              body_content: msg.body?.content || "",
              received_at: msg.receivedDateTime || msg.sentDateTime,
              is_read: msg.isRead || true,
              has_attachments: msg.hasAttachments || false,
              importance: msg.importance || "normal",
              raw_message: msg,
            })
            .select()
            .maybeSingle();

          if (!msgResult.error) {
            syncedMessages.push(msgResult.data);
          }
        }

        if (isNew || !existingConv?.auto_extracted) {
          newConversations.push({
            conversationId: convId,
            conversationUuid: convResult.data.id,
            allMessages: messages
          });
        }
      }
    }

    for (const conv of newConversations) {
      try {
        await autoExtractReservation(supabase, conv.conversationUuid, conv.conversationId, conv.allMessages);
      } catch (error) {
        console.error(`Failed to auto-extract for conversation ${conv.conversationId}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedMessages.length,
        messages: syncedMessages,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in handleSync:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error in sync"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function handleSyncConversation(req: Request, supabase: any) {
  try {
    const body = await req.json();
    const { mailbox_address, conversation_id } = body;

    if (!mailbox_address) {
      return new Response(
        JSON.stringify({ error: "mailbox_address is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = await getAccessToken(supabase, mailbox_address);

    const inboxResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${conversation_id}'`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!inboxResponse.ok) {
      const errorText = await inboxResponse.text();
      console.error("Failed to fetch conversation messages:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages from Microsoft Graph", details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inboxData = await inboxResponse.json();
    const inboxMessages = inboxData.value || [];

    const sentItemsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$filter=conversationId eq '${conversation_id}'`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    let sentMessages = [];
    if (sentItemsResponse.ok) {
      const sentData = await sentItemsResponse.json();
      sentMessages = sentData.value || [];
    }

    const allMessages = [...inboxMessages, ...sentMessages];

    if (allMessages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced_count: 0,
          message: "No messages found for this conversation"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    allMessages.sort((a: any, b: any) => {
      const dateA = new Date(a.receivedDateTime || a.sentDateTime).getTime();
      const dateB = new Date(b.receivedDateTime || b.sentDateTime).getTime();
      return dateA - dateB;
    });

    const firstMsg = allMessages[0];
    const lastMsg = allMessages[allMessages.length - 1];
    const firstMessageAt = firstMsg.receivedDateTime || firstMsg.sentDateTime;
    const lastMessageAt = lastMsg.receivedDateTime || lastMsg.sentDateTime;

    const lastFromEmail = lastMsg.from?.emailAddress?.address || "";
    const lastMessageDirection = lastFromEmail.toLowerCase().includes(mailbox_address.toLowerCase())
      ? 'outbound'
      : 'inbound';

    const convResult = await supabase
      .from("msgraph_conversations")
      .upsert({
        conversation_id: conversation_id,
        subject: firstMsg.subject || "(No Subject)",
        first_message_at: firstMessageAt,
        last_message_at: lastMessageAt,
        last_message_direction: lastMessageDirection,
        participants: [
          firstMsg.from?.emailAddress?.address,
          ...firstMsg.toRecipients.map((r: any) => r.emailAddress.address),
        ].filter(Boolean),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'conversation_id'
      })
      .select()
      .maybeSingle();

    if (convResult.error || !convResult.data) {
      return new Response(
        JSON.stringify({ error: "Failed to update conversation" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const syncedMessages = [];

    for (const msg of allMessages) {
      const msgResult = await supabase
        .from("msgraph_messages")
        .upsert({
          msgraph_message_id: msg.id,
          conversation_uuid: convResult.data.id,
          subject: msg.subject || "(No Subject)",
          from_email: msg.from?.emailAddress?.address || "",
          from_name: msg.from?.emailAddress?.name || "",
          to_emails: msg.toRecipients.map((r: any) => r.emailAddress.address),
          body_preview: msg.bodyPreview || "",
          body_content: msg.body?.content || "",
          received_at: msg.receivedDateTime || msg.sentDateTime,
          is_read: msg.isRead || true,
          has_attachments: msg.hasAttachments || false,
          importance: msg.importance || "normal",
          raw_message: msg,
        })
        .select()
        .maybeSingle();

      if (!msgResult.error && msgResult.data) {
        syncedMessages.push(msgResult.data);
      }
    }

    try {
      await autoExtractReservation(supabase, convResult.data.id, conversation_id, allMessages);
    } catch (error) {
      console.error(`Failed to auto-extract for conversation ${conversation_id}:`, error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedMessages.length,
        messages: syncedMessages,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in handleSyncConversation:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error in sync conversation"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function handleGetConversations(req: Request, supabase: any) {
  const { data, error } = await supabase
    .from("msgraph_conversations")
    .select(`
      *,
      msgraph_messages(count)
    `)
    .order("last_message_at", { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ conversations: data }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleGetMessages(req: Request, supabase: any) {
  const url = new URL(req.url);
  const conversation_id = url.searchParams.get("conversation_id");

  if (!conversation_id) {
    return new Response(
      JSON.stringify({ error: "conversation_id is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const convResult = await supabase
    .from("msgraph_conversations")
    .select("id")
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  if (convResult.error || !convResult.data) {
    return new Response(
      JSON.stringify({ error: "Conversation not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data, error } = await supabase
    .from("msgraph_messages")
    .select("*")
    .eq("conversation_uuid", convResult.data.id)
    .order("received_at", { ascending: true });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ messages: data }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleReply(req: Request, supabase: any) {
  const { message_id, body, is_html, mailbox_address }: ReplyRequest & { mailbox_address: string; is_html?: boolean } = await req.json();

  if (!mailbox_address) {
    return new Response(
      JSON.stringify({ error: "mailbox_address is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const accessToken = await getAccessToken(supabase, mailbox_address);

  const originalMessageResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${message_id}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!originalMessageResponse.ok) {
    throw new Error("Failed to fetch original message");
  }

  const originalMessage = await originalMessageResponse.json();
  const conversationId = originalMessage.conversationId;

  const isHtmlBody = is_html || body.trim().startsWith('<');

  const replyResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${message_id}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        isHtmlBody
          ? {
              message: {
                body: {
                  contentType: "HTML",
                  content: body,
                },
              },
            }
          : {
              comment: body,
            }
      ),
    }
  );

  if (!replyResponse.ok) {
    const errorText = await replyResponse.text();
    console.error("Failed to send reply:", errorText);
    throw new Error("Failed to send reply via Microsoft Graph");
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("Fetching sent message from conversation:", conversationId);

  const sentItemsResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox_address}/mailFolders/SentItems/messages?$top=50&$orderby=sentDateTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (sentItemsResponse.ok) {
    const sentData = await sentItemsResponse.json();
    console.log(`Found ${sentData.value?.length || 0} sent items`);

    const sentMsg = sentData.value?.find((msg: any) => msg.conversationId === conversationId);

    if (sentMsg) {
      console.log("Found matching sent message:", sentMsg.id);

      const convResult = await supabase
        .from("msgraph_conversations")
        .select("id")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (convResult.data) {
        const insertResult = await supabase
          .from("msgraph_messages")
          .upsert({
            msgraph_message_id: sentMsg.id,
            conversation_uuid: convResult.data.id,
            subject: sentMsg.subject || "(No Subject)",
            from_email: sentMsg.from?.emailAddress?.address || mailbox_address,
            from_name: sentMsg.from?.emailAddress?.name || "",
            to_emails: sentMsg.toRecipients.map((r: any) => r.emailAddress.address),
            body_preview: sentMsg.bodyPreview || "",
            body_content: sentMsg.body?.content || "",
            received_at: sentMsg.sentDateTime,
            is_read: true,
            has_attachments: sentMsg.hasAttachments || false,
            importance: sentMsg.importance || "normal",
            raw_message: sentMsg,
          })
          .select();

        if (insertResult.error) {
          console.error("Failed to save sent message:", insertResult.error);
        } else {
          console.log("Sent message saved successfully:", insertResult.data);
        }
      } else {
        console.error("Conversation not found for ID:", conversationId);
      }
    } else {
      console.log("No matching sent message found in conversation:", conversationId);
    }
  } else {
    console.error("Failed to fetch sent items:", await sentItemsResponse.text());
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Reply sent successfully",
      sentDateTime: new Date().toISOString(),
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleMarkRead(req: Request, supabase: any) {
  const { message_id, mailbox_address }: MarkReadRequest & { mailbox_address: string } = await req.json();

  if (!mailbox_address) {
    return new Response(
      JSON.stringify({ error: "mailbox_address is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const accessToken = await getAccessToken(supabase, mailbox_address);

  const markReadResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${message_id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isRead: true,
      }),
    }
  );

  if (!markReadResponse.ok) {
    const errorText = await markReadResponse.text();
    console.error("Failed to mark message as read:", errorText);
    throw new Error("Failed to mark message as read via Microsoft Graph");
  }

  const { data, error } = await supabase
    .from("msgraph_messages")
    .update({ is_read: true })
    .eq("msgraph_message_id", message_id)
    .select()
    .maybeSingle();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Message marked as read",
      data,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleAuthStatus(req: Request, supabase: any) {
  const url = new URL(req.url);
  let mailbox_address = url.searchParams.get("mailbox_address");

  if (!mailbox_address) {
    const { data: settings } = await supabase
      .from("settings")
      .select("mailbox_address")
      .maybeSingle();

    if (settings?.mailbox_address) {
      mailbox_address = settings.mailbox_address;
    }
  }

  if (!mailbox_address) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        message: "No mailbox address configured"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data, error } = await supabase
    .from("msgraph_oauth_tokens")
    .select("mailbox_address, token_expires_at, created_at")
    .eq("mailbox_address", mailbox_address)
    .maybeSingle();

  if (error || !data) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        message: "No OAuth tokens found. Please authenticate."
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const isExpired = new Date(data.token_expires_at) < new Date();

  return new Response(
    JSON.stringify({
      authenticated: !isExpired,
      mailbox_address: data.mailbox_address,
      token_expires_at: data.token_expires_at,
      needs_refresh: isExpired
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
