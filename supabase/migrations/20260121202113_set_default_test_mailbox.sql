/*
  # Set Default Test Mailbox Address

  1. Changes
    - Update the settings table to set mailbox_address to test mailbox
    - This ensures the system is ready for testing with restest@NETORG3219281.onmicrosoft.com
  
  2. Notes
    - Only updates if mailbox_address is null or default value
    - Can be changed later via the Admin UI
*/

UPDATE settings
SET mailbox_address = 'restest@NETORG3219281.onmicrosoft.com'
WHERE mailbox_address IS NULL OR mailbox_address = 'reservations@mycompany.com';
