/*
  # Add room details to reservations

  1. Changes
    - Add `room_details` JSONB column to `reservations` table to store detailed room information
    - This will store an array of objects with: code, name, quantity, nightly_rate for each room
    
  2. Notes
    - Existing `room_types` field is kept for backward compatibility
    - The new `room_details` field provides richer information including quantities and per-room rates
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'room_details'
  ) THEN
    ALTER TABLE reservations ADD COLUMN room_details JSONB DEFAULT '[]'::JSONB;
  END IF;
END $$;