/*
  # Add Conversation Tracking Fields

  1. Changes to msgraph_conversations table
    - Add `viewed_at` (timestamptz) - Tracks when a user first opened/viewed the conversation
    - Add `first_message_at` (timestamptz) - Tracks the date of the first message in the conversation
    - Add `last_message_direction` (text) - Indicates if last message was 'inbound' or 'outbound'
    - Add `auto_extracted` (boolean) - Tracks if automatic extraction has been attempted
    
  2. Purpose
    - `viewed_at` allows showing "New" indicator for conversations not yet viewed
    - `first_message_at` shows when the conversation started
    - `last_message_direction` shows whether last interaction was from guest or hotel
    - `auto_extracted` prevents duplicate auto-extraction attempts
*/

-- Add new tracking fields to msgraph_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'msgraph_conversations' AND column_name = 'viewed_at'
  ) THEN
    ALTER TABLE msgraph_conversations ADD COLUMN viewed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'msgraph_conversations' AND column_name = 'first_message_at'
  ) THEN
    ALTER TABLE msgraph_conversations ADD COLUMN first_message_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'msgraph_conversations' AND column_name = 'last_message_direction'
  ) THEN
    ALTER TABLE msgraph_conversations ADD COLUMN last_message_direction text DEFAULT 'inbound';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'msgraph_conversations' AND column_name = 'auto_extracted'
  ) THEN
    ALTER TABLE msgraph_conversations ADD COLUMN auto_extracted boolean DEFAULT false;
  END IF;
END $$;