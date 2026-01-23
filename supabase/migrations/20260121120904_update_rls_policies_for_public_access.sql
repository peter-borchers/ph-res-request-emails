/*
  # Update RLS Policies for Public Access

  This migration updates the Row Level Security policies to allow public access
  for the reservation assistant app, which is an internal tool for the team.

  1. Changes
    - Drop existing restrictive policies that require authentication
    - Add new policies that allow public access (anon role)
    - Maintain RLS enabled for security, but allow broader access

  2. Security Notes
    - This is appropriate for internal team tools
    - For production, consider adding authentication if needed
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all access to emails for authenticated users" ON emails;
DROP POLICY IF EXISTS "Allow all access to reservations for authenticated users" ON reservations;
DROP POLICY IF EXISTS "Allow read access to templates for authenticated users" ON email_templates;
DROP POLICY IF EXISTS "Allow insert access to templates for authenticated users" ON email_templates;
DROP POLICY IF EXISTS "Allow update access to templates for authenticated users" ON email_templates;
DROP POLICY IF EXISTS "Allow delete access to templates for authenticated users" ON email_templates;
DROP POLICY IF EXISTS "Allow all access to conversations for authenticated users" ON email_conversations;

-- Create new policies allowing public access (anon role)
CREATE POLICY "Allow public read access to emails"
  ON emails FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to emails"
  ON emails FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to emails"
  ON emails FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to emails"
  ON emails FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to reservations"
  ON reservations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to reservations"
  ON reservations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to reservations"
  ON reservations FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to reservations"
  ON reservations FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to templates"
  ON email_templates FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to templates"
  ON email_templates FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to templates"
  ON email_templates FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to templates"
  ON email_templates FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to conversations"
  ON email_conversations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to conversations"
  ON email_conversations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to conversations"
  ON email_conversations FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to conversations"
  ON email_conversations FOR DELETE
  TO anon
  USING (true);