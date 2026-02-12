export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      reservations: {
        Row: {
          id: string
          conversation_id: string
          guest_name: string
          guest_email: string | null
          arrival_date: string | null
          departure_date: string | null
          nights: number | null
          phone: string | null
          adults: number
          children: number
          rooms: number | null
          source_channel: string | null
          travel_agent_company: string | null
          property_id: string | null
          confirmation_no: string | null
          extracted_json: Json | null
          extra: Json | null
          extraction_confidence: Json | null
          last_extraction_attempted_at: string | null
          last_extracted_message_at: string | null
          last_extraction_error: string | null
          extraction_version: string | null
          room_types: string[]
          room_details: Json | null
          nightly_rate_currency: string
          nightly_rate_amount: number
          additional_info: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          guest_name: string
          guest_email?: string | null
          arrival_date?: string | null
          departure_date?: string | null
          nights?: number | null
          phone?: string | null
          adults?: number
          children?: number
          rooms?: number | null
          source_channel?: string | null
          travel_agent_company?: string | null
          property_id?: string | null
          confirmation_no?: string | null
          extracted_json?: Json | null
          extra?: Json | null
          extraction_confidence?: Json | null
          last_extraction_attempted_at?: string | null
          last_extracted_message_at?: string | null
          last_extraction_error?: string | null
          extraction_version?: string | null
          room_types?: string[]
          room_details?: Json | null
          nightly_rate_currency?: string
          nightly_rate_amount?: number
          additional_info?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          guest_name?: string
          guest_email?: string | null
          arrival_date?: string | null
          departure_date?: string | null
          nights?: number | null
          phone?: string | null
          adults?: number
          children?: number
          rooms?: number | null
          source_channel?: string | null
          travel_agent_company?: string | null
          property_id?: string | null
          confirmation_no?: string | null
          extracted_json?: Json | null
          extra?: Json | null
          extraction_confidence?: Json | null
          last_extraction_attempted_at?: string | null
          last_extracted_message_at?: string | null
          last_extraction_error?: string | null
          extraction_version?: string | null
          room_types?: string[]
          room_details?: Json | null
          nightly_rate_currency?: string
          nightly_rate_amount?: number
          additional_info?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      email_templates: {
        Row: {
          id: string
          name: string
          tone: string
          subject_template: string
          body_template: string
          html_body_template: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          tone: string
          subject_template: string
          body_template: string
          html_body_template?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          tone?: string
          subject_template?: string
          body_template?: string
          html_body_template?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      msgraph_conversations: {
        Row: {
          id: string
          conversation_id: string
          subject: string
          last_message_at: string
          has_unread: boolean
          viewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          subject: string
          last_message_at: string
          has_unread?: boolean
          viewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          subject?: string
          last_message_at?: string
          has_unread?: boolean
          viewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      msgraph_messages: {
        Row: {
          id: string
          conversation_uuid: string
          msgraph_message_id: string
          subject: string
          from_email: string
          from_name: string
          to_emails: Json
          received_at: string
          body_preview: string
          body_content: string | null
          is_read: boolean
          has_attachments: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conversation_uuid: string
          msgraph_message_id: string
          subject: string
          from_email: string
          from_name: string
          to_emails?: Json
          received_at: string
          body_preview: string
          body_content?: string | null
          is_read?: boolean
          has_attachments?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          conversation_uuid?: string
          msgraph_message_id?: string
          subject?: string
          from_email?: string
          from_name?: string
          to_emails?: Json
          received_at?: string
          body_preview?: string
          body_content?: string | null
          is_read?: boolean
          has_attachments?: boolean
          created_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          openai_api_key: string | null
          msgraph_client_id: string | null
          msgraph_client_secret: string | null
          msgraph_tenant_id: string | null
          mailbox_address: string | null
          booking_url_template: string | null
          missing_details_template_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          openai_api_key?: string | null
          msgraph_client_id?: string | null
          msgraph_client_secret?: string | null
          msgraph_tenant_id?: string | null
          mailbox_address?: string | null
          booking_url_template?: string | null
          missing_details_template_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          openai_api_key?: string | null
          msgraph_client_id?: string | null
          msgraph_client_secret?: string | null
          msgraph_tenant_id?: string | null
          mailbox_address?: string | null
          booking_url_template?: string | null
          missing_details_template_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      room_types: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      room_proposals: {
        Row: {
          id: string
          reservation_id: string
          proposal_name: string
          rooms: Json
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          proposal_name: string
          rooms: Json
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          proposal_name?: string
          rooms?: Json
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      template_attachments: {
        Row: {
          id: string
          filename: string
          display_name: string
          file_size: number
          content_type: string
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          filename: string
          display_name: string
          file_size: number
          content_type: string
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          filename?: string
          display_name?: string
          file_size?: number
          content_type?: string
          storage_path?: string
          created_at?: string
        }
      }
      email_template_attachments: {
        Row: {
          id: string
          template_id: string
          attachment_id: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          attachment_id: string
          order_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          attachment_id?: string
          order_index?: number
          created_at?: string
        }
      }
      message_attachments: {
        Row: {
          id: string
          reservation_id: string
          attachment_id: string
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          attachment_id: string
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          attachment_id?: string
          created_at?: string
        }
      }
      email_drafts: {
        Row: {
          id: string
          reservation_id: string
          conversation_id: string
          template_id: string | null
          to_recipients: Json
          cc_recipients: Json
          subject: string
          body_html: string | null
          body_text: string | null
          status: string
          error_message: string | null
          attempt_count: number
          created_at: string
          updated_at: string
          sent_at: string | null
        }
        Insert: {
          id?: string
          reservation_id: string
          conversation_id: string
          template_id?: string | null
          to_recipients?: Json
          cc_recipients?: Json
          subject: string
          body_html?: string | null
          body_text?: string | null
          status?: string
          error_message?: string | null
          attempt_count?: number
          created_at?: string
          updated_at?: string
          sent_at?: string | null
        }
        Update: {
          id?: string
          reservation_id?: string
          conversation_id?: string
          template_id?: string | null
          to_recipients?: Json
          cc_recipients?: Json
          subject?: string
          body_html?: string | null
          body_text?: string | null
          status?: string
          error_message?: string | null
          attempt_count?: number
          created_at?: string
          updated_at?: string
          sent_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
