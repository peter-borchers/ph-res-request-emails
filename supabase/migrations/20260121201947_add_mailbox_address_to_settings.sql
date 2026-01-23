/*
  # Add Mailbox Address to Settings

  1. Changes
    - Add `mailbox_address` column to `settings` table
    - This allows dynamic configuration of the mailbox to sync (test vs production)
  
  2. Notes
    - Default value is 'reservations@mycompany.com' for backwards compatibility
    - Can be changed to test mailbox like 'restest@NETORG3219281.onmicrosoft.com'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'mailbox_address'
  ) THEN
    ALTER TABLE settings ADD COLUMN mailbox_address text DEFAULT 'reservations@mycompany.com';
  END IF;
END $$;
