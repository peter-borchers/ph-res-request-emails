/*
  # Update message_attachments unique constraint
  
  1. Changes
    - Drop the old unique constraint on (reservation_id, attachment_id, message_type)
    - Add new unique constraint including message_id to allow same attachment across different messages
  
  2. Reasoning
    - With message_id tracking, the same attachment can appear in multiple messages
    - The unique constraint should prevent duplicate entries for the same attachment on the same message
    - Makes the constraint (reservation_id, attachment_id, message_type, message_id) to be more accurate
*/

-- Drop the old unique constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'message_attachments_reservation_id_attachment_id_message_type_key'
  ) THEN
    ALTER TABLE message_attachments 
    DROP CONSTRAINT message_attachments_reservation_id_attachment_id_message_type_key;
  END IF;
END $$;

-- Add new unique constraint that includes message_id
-- This allows the same attachment to be in multiple messages but prevents duplicates within the same message
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_attachments_unique 
  ON message_attachments(reservation_id, attachment_id, message_type, COALESCE(message_id, '00000000-0000-0000-0000-000000000000'));
