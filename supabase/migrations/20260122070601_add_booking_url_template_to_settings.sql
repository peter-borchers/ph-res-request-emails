/*
  # Add booking URL template to settings

  1. Changes
    - Add `booking_url_template` column to `settings` table with a default URL template
  
  2. Notes
    - The URL template supports placeholders: {{adultCount}}, {{arrivalDate}}, {{departureDate}}, {{childCount}}, {{roomCount}}
    - This allows customization of the online booking system URL
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'booking_url_template'
  ) THEN
    ALTER TABLE settings 
    ADD COLUMN booking_url_template text DEFAULT 'https://be.synxis.com/?adult={{adultCount}}&arrive={{arrivalDate}}&chain=10237&child={{childCount}}&currency=ZAR&depart={{departureDate}}&hotel=9357&level=hotel&locale=en-US&productcurrency=ZAR&rooms={{roomCount}}';
  END IF;
END $$;