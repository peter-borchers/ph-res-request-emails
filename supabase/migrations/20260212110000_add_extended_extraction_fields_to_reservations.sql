-- Add extended reservation extraction support fields
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS nights integer,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS rooms integer,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS travel_agent_company text,
  ADD COLUMN IF NOT EXISTS property_id text,
  ADD COLUMN IF NOT EXISTS confirmation_no text,
  ADD COLUMN IF NOT EXISTS extracted_json jsonb,
  ADD COLUMN IF NOT EXISTS extra jsonb,
  ADD COLUMN IF NOT EXISTS last_extraction_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_extracted_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_extraction_error text,
  ADD COLUMN IF NOT EXISTS extraction_version text,
  ADD COLUMN IF NOT EXISTS extraction_confidence jsonb;
