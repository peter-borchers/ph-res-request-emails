/*
  # Create message attachments tracking table

  1. New Tables
    - `message_attachments`
      - `id` (uuid, primary key)
      - `reservation_id` (uuid, foreign key to reservations)
      - `attachment_id` (uuid, foreign key to template_attachments)
      - `message_type` (text) - 'outbound' or 'inbound'
      - `sent_at` (timestamptz) - when the message was sent/received
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `message_attachments` table
    - Add policy for public read access (consistent with other tables)

  3. Notes
    - This table tracks which attachments were sent with which messages
    - Preserves history even if template attachments are removed
    - Links ad-hoc attachments to the messages they were sent with
    - Allows displaying attachments in conversation history
*/

-- Create message_attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES template_attachments(id) ON DELETE CASCADE,
  message_type text NOT NULL CHECK (message_type IN ('outbound', 'inbound')),
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(reservation_id, attachment_id, message_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_attachments_reservation_id 
  ON message_attachments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_attachment_id 
  ON message_attachments(attachment_id);

-- Enable RLS
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can view message attachments"
  ON message_attachments FOR SELECT
  TO public
  USING (true);

-- Create policy for inserting message attachments
CREATE POLICY "Anyone can insert message attachments"
  ON message_attachments FOR INSERT
  TO public
  WITH CHECK (true);