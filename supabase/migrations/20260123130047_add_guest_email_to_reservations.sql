/*
  # Add guest_email column to reservations table

  ## Overview
  Adds the missing guest_email field to store the guest's contact email address.
  This field is needed for the auto-extraction process to properly create reservations.

  ## Changes
  
  ### `reservations` table modifications
  - Add `guest_email` column (text, nullable)
  
  ## Notes
  - This column was referenced in the application code but missing from the schema
  - Making it nullable to support existing records and cases where email isn't available
*/

-- Add guest_email column to reservations table
ALTER TABLE reservations 
  ADD COLUMN IF NOT EXISTS guest_email text;