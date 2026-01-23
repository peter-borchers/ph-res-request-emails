/*
  # Add HTML body template support to email templates

  1. Changes
    - Add `html_body_template` column to `email_templates` table
    - This column will store HTML versions of email templates
    - Nullable to support gradual migration from text-only templates
  
  2. Notes
    - Existing templates will have NULL for html_body_template
    - Templates can have both text and HTML versions
    - When html_body_template is provided, it will be used for sending emails
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'html_body_template'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN html_body_template text;
  END IF;
END $$;