/*
  # Create Room Types Table

  1. New Tables
    - `room_types`
      - `id` (uuid, primary key) - Unique identifier for each room type
      - `code` (text, unique) - Short code for the room type (e.g., "CR", "CMT")
      - `name` (text) - Full descriptive name of the room type (e.g., "Classic Room", "Classic Mountain Twin")
      - `is_active` (boolean) - Whether this room type is currently available for selection
      - `created_at` (timestamptz) - When the room type was created

  2. Security
    - Enable RLS on `room_types` table
    - Add policy for public read access (anyone can view available room types)

  3. Initial Data
    - Seed with common room types:
      - CR: Classic Room
      - CMT: Classic Mountain Twin
      - CD: Classic Double
      - DR: Deluxe Room
      - DMT: Deluxe Mountain Twin
      - DD: Deluxe Double
      - SR: Suite Room
      - FS: Family Suite
*/

CREATE TABLE IF NOT EXISTS room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active room types"
  ON room_types
  FOR SELECT
  USING (is_active = true);

INSERT INTO room_types (code, name) VALUES
  ('CR', 'Classic Room'),
  ('CMT', 'Classic Mountain Twin'),
  ('CD', 'Classic Double'),
  ('DR', 'Deluxe Room'),
  ('DMT', 'Deluxe Mountain Twin'),
  ('DD', 'Deluxe Double'),
  ('SR', 'Suite Room'),
  ('FS', 'Family Suite')
ON CONFLICT (code) DO NOTHING;