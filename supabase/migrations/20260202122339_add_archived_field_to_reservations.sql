/*
  # Add archived field to reservations

  1. Changes
    - Add `archived` boolean column to `reservations` table
    - Defaults to `false` for new reservations
    - Existing reservations will be set to `false` (active)

  2. Purpose
    - Allow users to archive completed or inactive enquiries
    - Keep inbox clean by filtering archived items
    - Non-destructive archiving (can be unarchived)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'archived'
  ) THEN
    ALTER TABLE reservations ADD COLUMN archived boolean DEFAULT false NOT NULL;
  END IF;
END $$;