/*
  # Add additional_info field to reservations

  1. Changes
    - Add `additional_info` column to `reservations` table
      - Stores contextual information like trip purpose, event names, special requests
      - Extracted from email content by LLM
      - Nullable to allow gradual population

  2. Notes
    - This field captures unstructured details that don't fit other fields
    - Examples: "Mining Indaba weekend", "wedding party", "conference attendance"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'additional_info'
  ) THEN
    ALTER TABLE reservations ADD COLUMN additional_info TEXT;
  END IF;
END $$;
