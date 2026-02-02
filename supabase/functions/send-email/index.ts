import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendEmailRequest {
  reservationId: string;
  conversationId?: string;
  toRecipients: string[];
  ccRecipients?: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  templateId?: string;
  attachmentIds?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { reservationId, conversationId, toRecipients, ccRecipients, subject, bodyHtml, bodyText, templateId, attachmentIds }: SendEmailRequest = await req.json();

    if (!toRecipients || toRecipients.length === 0) {
      throw new Error("At least one recipient is required");
    }

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("msgraph_client_id, msgraph_client_secret, msgraph_tenant_id, mailbox_address")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      throw new Error("Settings not found");
    }

    const { msgraph_tenant_id, msgraph_client_id, msgraph_client_secret, mailbox_address } = settings;

    if (!msgraph_tenant_id || !msgraph_client_id || !msgraph_client_secret || !mailbox_address) {
      throw new Error("Microsoft Graph credentials not configured");
    }

    // Get the OAuth token from the database
    const { data: tokenData, error: tokenError } = await supabase
      .from("msgraph_oauth_tokens")
      .select("*")
      .eq("mailbox_address", mailbox_address)
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error("OAuth token not found. Please authenticate first.");
    }

    // Check if token is expired and refresh if needed
    let access_token = tokenData.access_token;
    const isExpired = new Date(tokenData.token_expires_at) < new Date();

    if (isExpired && tokenData.refresh_token) {
      const refreshResponse = await fetch(
        `https://login.microsoftonline.com/${msgraph_tenant_id}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: msgraph_client_id,
            client_secret: msgraph_client_secret,
            refresh_token: tokenData.refresh_token,
            grant_type: "refresh_token",
          }),
        }
      );

      if (!refreshResponse.ok) {
        throw new Error("Failed to refresh access token");
      }

      const newTokens = await refreshResponse.json();
      access_token = newTokens.access_token;

      // Update the token in the database
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
    }

    const emailMessage: any = {
      message: {
        subject,
        body: {
          contentType: bodyHtml ? "HTML" : "Text",
          content: bodyHtml || bodyText,
        },
        toRecipients: toRecipients.map(email => ({
          emailAddress: {
            address: email,
          },
        })),
      },
      saveToSentItems: true,
    };

    if (ccRecipients && ccRecipients.length > 0) {
      emailMessage.message.ccRecipients = ccRecipients.map(email => ({
        emailAddress: {
          address: email,
        },
      }));
    }

    if (attachmentIds && attachmentIds.length > 0) {
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from("template_attachments")
        .select("*")
        .in("id", attachmentIds);

      if (!attachmentsError && attachmentsData && attachmentsData.length > 0) {
        const attachments = [];

        for (const attachment of attachmentsData) {
          let base64Content = "";

          if (attachment.storage_path.startsWith("data:")) {
            base64Content = attachment.storage_path.split(",")[1];
          } else {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from("template-attachments")
              .download(attachment.storage_path);

            if (downloadError) {
              console.error(`Error downloading attachment ${attachment.filename}:`, downloadError);
              continue;
            }

            // Convert blob to base64 properly for binary files
            const arrayBuffer = await fileData.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.slice(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            base64Content = btoa(binary);
          }

          attachments.push({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: attachment.filename,
            contentType: attachment.content_type,
            contentBytes: base64Content,
          });
        }

        if (attachments.length > 0) {
          emailMessage.message.attachments = attachments;
        }
      }
    }

    let sendResponse;
    let sentMessageId: string | null = null;
    let conversationUuid: string | null = null;

    // If we have a conversationId, get the most recent message and use reply endpoint
    if (conversationId) {
      const { data: conversationData } = await supabase
        .from("msgraph_conversations")
        .select("id")
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (conversationData) {
        conversationUuid = conversationData.id;

        const { data: latestMessage } = await supabase
          .from("msgraph_messages")
          .select("msgraph_message_id")
          .eq("conversation_uuid", conversationData.id)
          .order("received_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMessage) {
          // Use the createReply/send two-step approach to maintain conversation thread
          // This gives us the message ID immediately for better tracking
          // IMPORTANT: Do not include subject - Graph handles threading automatically
          const replyMessage: any = {
            body: emailMessage.message.body,
            toRecipients: emailMessage.message.toRecipients,
          };

          if (emailMessage.message.ccRecipients) {
            replyMessage.ccRecipients = emailMessage.message.ccRecipients;
          }

          if (emailMessage.message.attachments) {
            replyMessage.attachments = emailMessage.message.attachments;
          }

          // Step 1: Create the reply (this returns the message object)
          const createReplyResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${latestMessage.msgraph_message_id}/createReply`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!createReplyResponse.ok) {
            const errorText = await createReplyResponse.text();
            throw new Error(`Failed to create reply: ${errorText}`);
          }

          const draftReply = await createReplyResponse.json();
          sentMessageId = draftReply.id;

          // Step 2: Update the draft with body and recipients (but NOT attachments)
          const updatePayload: any = {
            body: replyMessage.body,
            toRecipients: replyMessage.toRecipients,
          };

          if (replyMessage.ccRecipients) {
            updatePayload.ccRecipients = replyMessage.ccRecipients;
          }

          const updateResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${draftReply.id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update reply: ${errorText}`);
          }

          // Step 2.5: Add attachments separately if present
          if (replyMessage.attachments && replyMessage.attachments.length > 0) {
            for (const attachment of replyMessage.attachments) {
              const addAttachmentResponse = await fetch(
                `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${draftReply.id}/attachments`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${access_token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(attachment),
                }
              );

              if (!addAttachmentResponse.ok) {
                const errorText = await addAttachmentResponse.text();
                console.error(`Failed to add attachment ${attachment.name}:`, errorText);
                // Continue with other attachments instead of failing completely
              }
            }
          }

          // Step 3: Send the reply
          sendResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${draftReply.id}/send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          // Check if send was successful before recording the message
          if (!sendResponse.ok) {
            const errorText = await sendResponse.text();
            // Delete the draft if send failed
            await fetch(
              `https://graph.microsoft.com/v1.0/users/${mailbox_address}/messages/${draftReply.id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${access_token}`,
                },
              }
            ).catch(() => {/* Ignore delete errors */});
            throw new Error(`Failed to send email: ${errorText}`);
          }
        }
      }
    }

    // If no conversationId or reply failed, use regular sendMail
    if (!sendResponse) {
      sendResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${mailbox_address}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailMessage),
        }
      );
    }

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    // Note: We don't insert the message locally here because MS Graph assigns a different
    // message ID when the draft is sent vs. when it appears in Sent Items. This would create
    // duplicates. Instead, we let the MS Graph sync handle adding the message naturally.

    // Record attachments that were sent with this message
    if (attachmentIds && attachmentIds.length > 0) {
      const messageAttachmentRecords = attachmentIds.map(attachmentId => ({
        reservation_id: reservationId,
        attachment_id: attachmentId,
        message_type: 'outbound',
        sent_at: new Date().toISOString(),
      }));

      const { error: attachmentError } = await supabase
        .from("message_attachments")
        .insert(messageAttachmentRecords);

      if (attachmentError) {
        console.error("Failed to record message attachments:", attachmentError);
      }
    }

    const { error: updateError } = await supabase
      .from("reservations")
      .update({ last_email_sent_at: new Date().toISOString() })
      .eq("id", reservationId);

    if (updateError) {
      console.error("Failed to update last_email_sent_at:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
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
