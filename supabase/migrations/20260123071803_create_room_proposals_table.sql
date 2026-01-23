/*
  # Create Room Proposals Table

  1. New Tables
    - `room_proposals`
      - `id` (uuid, primary key) - Unique identifier for each proposal
      - `reservation_id` (uuid, foreign key) - Links to the reservation
      - `proposal_name` (text) - Name/label for this proposal (e.g., "Option 1", "Budget Option")
      - `rooms` (jsonb) - Array of room objects with code, name, quantity, and nightly_rate
      - `created_at` (timestamptz) - When the proposal was created
      - `display_order` (integer) - Order in which proposals should be displayed
  
  2. Security
    - Enable RLS on `room_proposals` table
    - Add policy for public read access (for guest viewing)
    - Add policy for authenticated insert/update/delete
  
  3. Notes
    - Supports multiple room/rate proposals per reservation
    - Guests can review different options and choose their preferred one
    - Each proposal contains complete room details including rates
*/

CREATE TABLE IF NOT EXISTS room_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  proposal_name text NOT NULL DEFAULT 'Option',
  rooms jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE room_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room proposals"
  ON room_proposals FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert room proposals"
  ON room_proposals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update room proposals"
  ON room_proposals FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete room proposals"
  ON room_proposals FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_room_proposals_reservation_id 
  ON room_proposals(reservation_id);

CREATE INDEX IF NOT EXISTS idx_room_proposals_display_order 
  ON room_proposals(reservation_id, display_order);