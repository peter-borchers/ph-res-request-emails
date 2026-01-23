/*
  # Add conversation_id to reservations table

  1. Changes
    - Add `conversation_id` column to `reservations` table to link with Microsoft Graph conversations
    - Make the column nullable to support existing reservations
    - Add index for faster lookups
  
  2. Notes
    - This allows reservations to be linked to Outlook conversations instead of the old emails table
    - Existing reservations with email_id can still function
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN conversation_id text;
    CREATE INDEX IF NOT EXISTS idx_reservations_conversation_id ON reservations(conversation_id);
  END IF;
END $$;
