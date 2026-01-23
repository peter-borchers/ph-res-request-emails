/*
  # Make reservation dates nullable

  ## Overview
  Allows reservations to be created without dates initially. This enables the system
  to create reservation records immediately when emails arrive, then populate dates
  later through extraction or manual entry.

  ## Changes
  
  ### `reservations` table modifications
  - Make `arrival_date` nullable (currently NOT NULL)
  - Make `departure_date` nullable (currently NOT NULL)
  - Make `guest_name` nullable to handle cases where sender name isn't available

  ## Notes
  - Existing records are unaffected (they already have dates)
  - New reservations can be created without dates
  - UI should handle and display reservations with missing dates appropriately
*/

-- Make arrival_date nullable
ALTER TABLE reservations 
  ALTER COLUMN arrival_date DROP NOT NULL;

-- Make departure_date nullable
ALTER TABLE reservations 
  ALTER COLUMN departure_date DROP NOT NULL;

-- Make guest_name nullable (for cases where sender name isn't available)
ALTER TABLE reservations 
  ALTER COLUMN guest_name DROP NOT NULL;