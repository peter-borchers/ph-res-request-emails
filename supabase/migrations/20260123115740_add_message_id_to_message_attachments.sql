/*
  # Add message_id to message_attachments table

  1. Changes
    - Add `message_id` (text) column to `message_attachments` table
      - Stores the Microsoft Graph message ID where the attachment was located
      - Nullable to support existing records and future flexibility
      - Indexed for faster lookups

  2. Notes
    - This allows tracking which specific email message contained each attachment
    - Useful for linking attachments to their source messages in the conversation thread
    - Supports both outbound (sent) and inbound (received) message tracking
*/

-- Add message_id column to message_attachments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_attachments' AND column_name = 'message_id'
  ) THEN
    ALTER TABLE message_attachments ADD COLUMN message_id text;
  END IF;
END $$;

-- Create index for faster message_id lookups
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id 
  ON message_attachments(message_id);
