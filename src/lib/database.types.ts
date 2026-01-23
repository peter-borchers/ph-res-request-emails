export interface Database {
  public: {
    Tables: {
      emails: {
        Row: {
          id: string;
          guest_name: string;
          guest_email: string;
          subject: string;
          body: string;
          received_at: string;
          is_read: boolean;
          message_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['emails']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['emails']['Insert']>;
      };
      reservations: {
        Row: {
          id: string;
          email_id: string | null;
          guest_name: string;
          arrival_date: string;
          departure_date: string;
          adults: number;
          children: number;
          room_types: string[];
          room_details: Array<{
            code: string;
            name: string;
            quantity: number;
            nightly_rate: number;
          }> | null;
          nightly_rate_currency: string;
          nightly_rate_amount: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reservations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['reservations']['Insert']>;
      };
      email_templates: {
        Row: {
          id: string;
          name: string;
          tone: string;
          subject_template: string;
          body_template: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['email_templates']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['email_templates']['Insert']>;
      };
      email_conversations: {
        Row: {
          id: string;
          email_id: string;
          sender: string;
          message: string;
          sent_at: string;
          is_outgoing: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['email_conversations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['email_conversations']['Insert']>;
      };
      room_types: {
        Row: {
          id: string;
          code: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['room_types']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['room_types']['Insert']>;
      };
      settings: {
        Row: {
          id: string;
          openai_api_key: string | null;
          msgraph_client_id: string | null;
          msgraph_client_secret: string | null;
          msgraph_tenant_id: string | null;
          mailbox_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          openai_api_key?: string | null;
          msgraph_client_id?: string | null;
          msgraph_client_secret?: string | null;
          msgraph_tenant_id?: string | null;
          mailbox_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          openai_api_key?: string | null;
          msgraph_client_id?: string | null;
          msgraph_client_secret?: string | null;
          msgraph_tenant_id?: string | null;
          mailbox_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      msgraph_oauth_tokens: {
        Row: {
          id: string;
          mailbox_address: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mailbox_address: string;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mailbox_address?: string;
          access_token?: string;
          refresh_token?: string;
          token_expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      msgraph_conversations: {
        Row: {
          id: string;
          conversation_id: string;
          subject: string;
          last_message_at: string;
          participants: any[];
          reservation_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          subject?: string;
          last_message_at?: string;
          participants?: any[];
          reservation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          subject?: string;
          last_message_at?: string;
          participants?: any[];
          reservation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      msgraph_messages: {
        Row: {
          id: string;
          msgraph_message_id: string;
          conversation_uuid: string | null;
          subject: string;
          from_email: string;
          from_name: string;
          to_emails: any[];
          body_preview: string;
          body_content: string;
          received_at: string;
          is_read: boolean;
          has_attachments: boolean;
          importance: string;
          raw_message: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          msgraph_message_id: string;
          conversation_uuid?: string | null;
          subject?: string;
          from_email: string;
          from_name?: string;
          to_emails?: any[];
          body_preview?: string;
          body_content?: string;
          received_at?: string;
          is_read?: boolean;
          has_attachments?: boolean;
          importance?: string;
          raw_message?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          msgraph_message_id?: string;
          conversation_uuid?: string | null;
          subject?: string;
          from_email?: string;
          from_name?: string;
          to_emails?: any[];
          body_preview?: string;
          body_content?: string;
          received_at?: string;
          is_read?: boolean;
          has_attachments?: boolean;
          importance?: string;
          raw_message?: any;
          created_at?: string;
        };
      };
    };
  };
}
