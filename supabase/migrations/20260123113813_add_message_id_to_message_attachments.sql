/*
  # Add message_id to message_attachments table

  1. Changes
    - Add `message_id` column to link attachments to specific messages
    - Add foreign key constraint to msgraph_messages table
    - Create index for faster lookups
    - Update unique constraint to include message_id

  2. Notes
    - This allows attachments to be linked to specific messages in the conversation
    - Existing records will have NULL message_id (but there shouldn't be any yet)
*/

-- Add message_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_attachments' AND column_name = 'message_id'
  ) THEN
    ALTER TABLE message_attachments ADD COLUMN message_id uuid REFERENCES msgraph_messages(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id 
  ON message_attachments(message_id);

-- Drop old unique constraint and create new one with message_id
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'message_attachments_reservation_id_attachment_id_message_type_key'
  ) THEN
    ALTER TABLE message_attachments 
    DROP CONSTRAINT message_attachments_reservation_id_attachment_id_message_type_key;
  END IF;
  
  -- Add new unique constraint including message_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'message_attachments_unique_per_message'
  ) THEN
    ALTER TABLE message_attachments 
    ADD CONSTRAINT message_attachments_unique_per_message 
    UNIQUE(reservation_id, attachment_id, message_id);
  END IF;
END $$;