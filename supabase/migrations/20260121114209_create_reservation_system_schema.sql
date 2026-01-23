/*
  # Create Reservation Assistant System Schema

  1. New Tables
    - `emails`
      - `id` (uuid, primary key)
      - `guest_name` (text)
      - `guest_email` (text)
      - `subject` (text)
      - `body` (text)
      - `received_at` (timestamptz)
      - `is_read` (boolean)
      - `message_count` (integer) - number of messages in thread
      - `created_at` (timestamptz)
      
    - `reservations`
      - `id` (uuid, primary key)
      - `email_id` (uuid, foreign key)
      - `guest_name` (text)
      - `arrival_date` (date)
      - `departure_date` (date)
      - `adults` (integer)
      - `children` (integer)
      - `room_types` (text array)
      - `nightly_rate_currency` (text)
      - `nightly_rate_amount` (numeric)
      - `status` (text) - pending, proposal_sent, confirmed, etc.
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `email_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Proposal, Follow UP, etc.
      - `tone` (text) - Professional Tone, Friendly, etc.
      - `subject_template` (text)
      - `body_template` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      
    - `email_conversations`
      - `id` (uuid, primary key)
      - `email_id` (uuid, foreign key)
      - `sender` (text)
      - `message` (text)
      - `sent_at` (timestamptz)
      - `is_outgoing` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
*/

-- Create emails table
CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  received_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  message_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  arrival_date date NOT NULL,
  departure_date date NOT NULL,
  adults integer DEFAULT 1,
  children integer DEFAULT 0,
  room_types text[] DEFAULT '{}',
  nightly_rate_currency text DEFAULT 'GMT',
  nightly_rate_amount numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tone text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, tone)
);

-- Create email conversations table
CREATE TABLE IF NOT EXISTS email_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
  sender text NOT NULL,
  message text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  is_outgoing boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for emails
CREATE POLICY "Allow all access to emails for authenticated users"
  ON emails FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for reservations
CREATE POLICY "Allow all access to reservations for authenticated users"
  ON reservations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for email templates
CREATE POLICY "Allow read access to templates for authenticated users"
  ON email_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert access to templates for authenticated users"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update access to templates for authenticated users"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete access to templates for authenticated users"
  ON email_templates FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for email conversations
CREATE POLICY "Allow all access to conversations for authenticated users"
  ON email_conversations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default email templates
INSERT INTO email_templates (name, tone, subject_template, body_template) VALUES
('Proposal', 'Professional Tone', 'Re: Reservation Request - {{guest_name}}', 'Dear {{guest_name}},

Thank you for your reservation inquiry. Please find our proposal attached below:

Check-in: {{arrival_date}}
Check-out: {{departure_date}}
Guests: {{adults}} Adults, {{children}} Children
Room Types: {{room_types}}
Nightly Rate: {{nightly_rate_currency}} {{nightly_rate_amount}}

We look forward to hosting you.

Best regards,
Reservations Team'),

('Proposal', 'Friendly', 'Your Stay with Us - {{guest_name}}!', 'Hi {{guest_name}}!

We are excited about your upcoming visit! Here is what we have lined up for you:

Check-in: {{arrival_date}}
Check-out: {{departure_date}}
Guests: {{adults}} Adults, {{children}} Children
Room Types: {{room_types}}
Nightly Rate: {{nightly_rate_currency}} {{nightly_rate_amount}}

Can''t wait to see you!

Cheers,
Reservations Team'),

('Follow UP', 'Professional Tone', 'Following Up - Reservation Request', 'Dear {{guest_name}},

I wanted to follow up on our previous correspondence regarding your reservation request.

Please let me know if you have any questions or if you would like to proceed with the booking.

Best regards,
Reservations Team'),

('Follow UP', 'Friendly', 'Just Checking In!', 'Hi {{guest_name}}!

Just wanted to check in and see if you had any questions about the proposal we sent over!

Let me know how we can help make your stay perfect.

Cheers,
Reservations Team')
ON CONFLICT (name, tone) DO NOTHING;

-- Insert sample emails for demonstration
INSERT INTO emails (guest_name, guest_email, subject, body, received_at, message_count, is_read) VALUES
('Peter Borchers', 'peter@example.com', 'Reservation Request', 'Hi, I would like to book 2 rooms from April 23, 2026 to May 25, 2026. We will have 2 adults and 1 child. Looking for CMT and STU rooms. What are your rates?', '2026-02-20 07:24:00', 4, false),
('Sarah Johnson', 'sarah@example.com', 'Group Booking Inquiry', 'Hello, we need accommodation for our team from March 15 to March 20, 2026. 5 adults, no children. Please quote for CR and MAB rooms.', '2026-02-19 14:30:00', 2, false),
('Michael Chen', 'michael@example.com', 'Weekend Stay', 'Looking to book a weekend getaway from Feb 28 to March 2, 2026. 2 adults, 2 children. Prefer FS or STU rooms.', '2026-02-18 10:15:00', 1, false)
ON CONFLICT DO NOTHING;