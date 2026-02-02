/*
  # Create Email Drafts Table

  ## Purpose
  Separate table for managing draft emails that have not yet been sent.
  This keeps msgraph_messages as a clean mirror of Microsoft Graph data.

  ## Tables Created
  - email_drafts
    - id (uuid, primary key)
    - reservation_id (uuid, foreign key) - Links to reservation
    - conversation_id (text) - MS Graph conversation ID for threading
    - template_id (uuid, foreign key) - Template used to generate draft
    - to_recipients (jsonb) - Array of email addresses
    - cc_recipients (jsonb) - Array of CC email addresses
    - subject (text) - Email subject line
    - body_html (text) - HTML body content
    - body_text (text) - Plain text body content
    - status (text) - Status: pending, sending, sent, failed
    - error_message (text) - Error details if failed
    - attempt_count (integer) - Number of send attempts
    - created_at (timestamptz) - When draft was created
    - updated_at (timestamptz) - Last update time
    - sent_at (timestamptz) - When successfully sent

  ## Security
  - Enable RLS on email_drafts table
  - Add policies for public access (will be restricted in production)

  ## Important Notes
  - Drafts are created when reservation data is incomplete
  - Once sent, draft should be deleted (Graph will have the real message)
  - Failed drafts stay in table for retry or manual intervention
  - This separates "pending actions" from "synced data"
*/

-- Create email_drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  to_recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
  cc_recipients jsonb DEFAULT '[]'::jsonb,
  subject text DEFAULT '' NOT NULL,
  body_html text,
  body_text text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  error_message text,
  attempt_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  sent_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_drafts_reservation_id ON email_drafts(reservation_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_conversation_id ON email_drafts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at ON email_drafts(created_at DESC);

-- Enable RLS
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_drafts
CREATE POLICY "Allow public read access to email drafts"
  ON email_drafts FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to email drafts"
  ON email_drafts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to email drafts"
  ON email_drafts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to email drafts"
  ON email_drafts FOR DELETE
  USING (true);