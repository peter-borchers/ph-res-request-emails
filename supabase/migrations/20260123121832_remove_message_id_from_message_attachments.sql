/*
  # Remove message_id from message_attachments table

  1. Changes
    - Drop the unique index that includes message_id
    - Drop the unique constraint that includes message_id
    - Drop the index on message_id
    - Remove the message_id column
    - Restore the original unique constraint on (reservation_id, attachment_id, message_type)

  2. Notes
    - This reverts the table structure back to before message_id tracking was added
    - Safely handles the removal of indexes and constraints before dropping the column
*/

-- Drop the unique index that includes message_id (from latest migration)
DROP INDEX IF EXISTS idx_message_attachments_unique;

-- Drop the unique constraint that includes message_id (from earlier migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'message_attachments_unique_per_message'
  ) THEN
    ALTER TABLE message_attachments 
    DROP CONSTRAINT message_attachments_unique_per_message;
  END IF;
END $$;

-- Drop the index on message_id
DROP INDEX IF EXISTS idx_message_attachments_message_id;

-- Drop the message_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_attachments' AND column_name = 'message_id'
  ) THEN
    ALTER TABLE message_attachments DROP COLUMN message_id;
  END IF;
END $$;

-- Restore the original unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'message_attachments_reservation_id_attachment_id_message_type_key'
  ) THEN
    ALTER TABLE message_attachments 
    ADD CONSTRAINT message_attachments_reservation_id_attachment_id_message_type_key
    UNIQUE(reservation_id, attachment_id, message_type);
  END IF;
END $$;