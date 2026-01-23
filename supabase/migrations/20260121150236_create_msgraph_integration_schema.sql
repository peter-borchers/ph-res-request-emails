/*
  Microsoft Graph Integration Schema

  1. New Tables
    - msgraph_oauth_tokens
      Stores OAuth tokens for Microsoft Graph API access
      - id (uuid, primary key)
      - mailbox_address (text) - The email address (e.g., reservations@mycompany.com)
      - access_token (text, encrypted) - Current access token
      - refresh_token (text, encrypted) - Refresh token
      - token_expires_at (timestamptz) - When the access token expires
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - msgraph_conversations
      Stores email conversation metadata from MS Graph
      - id (uuid, primary key)
      - conversation_id (text) - MS Graph conversation ID
      - subject (text)
      - last_message_at (timestamptz)
      - participants (jsonb) - Array of email addresses
      - reservation_id (uuid, foreign key) - Link to reservation
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - msgraph_messages
      Stores individual email messages from MS Graph
      - id (uuid, primary key)
      - msgraph_message_id (text, unique) - MS Graph message ID
      - conversation_uuid (uuid, foreign key) - Link to msgraph_conversations
      - subject (text)
      - from_email (text)
      - from_name (text)
      - to_emails (jsonb) - Array of recipients
      - body_preview (text)
      - body_content (text)
      - received_at (timestamptz)
      - is_read (boolean)
      - has_attachments (boolean)
      - importance (text) - normal, high, low
      - raw_message (jsonb) - Full MS Graph message object
      - created_at (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (will be restricted in production)

  3. Important Notes
    - OAuth tokens are sensitive and should be encrypted at rest in production
    - This schema supports syncing emails from Microsoft Graph API
    - Conversations are linked to reservations for tracking
    - Table names prefixed with msgraph to avoid conflicts with existing email tables
*/

-- Create msgraph_oauth_tokens table
CREATE TABLE IF NOT EXISTS msgraph_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_address text UNIQUE NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create msgraph_conversations table
CREATE TABLE IF NOT EXISTS msgraph_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text UNIQUE NOT NULL,
  subject text DEFAULT '',
  last_message_at timestamptz DEFAULT now(),
  participants jsonb DEFAULT '[]'::jsonb,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create msgraph_messages table
CREATE TABLE IF NOT EXISTS msgraph_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  msgraph_message_id text UNIQUE NOT NULL,
  conversation_uuid uuid REFERENCES msgraph_conversations(id) ON DELETE CASCADE,
  subject text DEFAULT '',
  from_email text NOT NULL,
  from_name text DEFAULT '',
  to_emails jsonb DEFAULT '[]'::jsonb,
  body_preview text DEFAULT '',
  body_content text DEFAULT '',
  received_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  has_attachments boolean DEFAULT false,
  importance text DEFAULT 'normal',
  raw_message jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_msgraph_conversations_reservation_id ON msgraph_conversations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_msgraph_conversations_conversation_id ON msgraph_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msgraph_messages_conversation_uuid ON msgraph_messages(conversation_uuid);
CREATE INDEX IF NOT EXISTS idx_msgraph_messages_received_at ON msgraph_messages(received_at DESC);

-- Enable RLS
ALTER TABLE msgraph_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE msgraph_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE msgraph_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for msgraph_oauth_tokens
CREATE POLICY "Allow public read access to oauth tokens"
  ON msgraph_oauth_tokens FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to oauth tokens"
  ON msgraph_oauth_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to oauth tokens"
  ON msgraph_oauth_tokens FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policies for msgraph_conversations
CREATE POLICY "Allow public read access to msgraph conversations"
  ON msgraph_conversations FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to msgraph conversations"
  ON msgraph_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to msgraph conversations"
  ON msgraph_conversations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to msgraph conversations"
  ON msgraph_conversations FOR DELETE
  USING (true);

-- RLS Policies for msgraph_messages
CREATE POLICY "Allow public read access to msgraph messages"
  ON msgraph_messages FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to msgraph messages"
  ON msgraph_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to msgraph messages"
  ON msgraph_messages FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to msgraph messages"
  ON msgraph_messages FOR DELETE
  USING (true);