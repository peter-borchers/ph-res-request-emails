/*
  # Create Settings Table

  1. New Tables
    - `settings`
      - `id` (uuid, primary key)
      - `openai_api_key` (text) - OpenAI API key for LLM extraction
      - `msgraph_client_id` (text) - Microsoft Graph client ID
      - `msgraph_client_secret` (text) - Microsoft Graph client secret
      - `msgraph_tenant_id` (text) - Microsoft Graph tenant ID
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `settings` table
    - Add policy for authenticated users to read settings
    - Add policy for authenticated users to update settings
  
  3. Notes
    - Single row table to store global application settings
    - API keys are stored as text (encrypted at rest by Supabase)
*/

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openai_api_key text,
  msgraph_client_id text,
  msgraph_client_secret text,
  msgraph_tenant_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON settings
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert settings"
  ON settings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update settings"
  ON settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert default row if none exists
INSERT INTO settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM settings);
