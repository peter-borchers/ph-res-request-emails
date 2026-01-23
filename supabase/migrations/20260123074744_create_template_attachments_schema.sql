/*
  # Template Attachments Schema

  ## Overview
  Adds support for file attachments to email templates. Allows templates to include
  PDFs, images, and other documents that will be attached to outgoing emails.

  ## New Tables
  
  ### `template_attachments`
  Stores metadata about uploaded attachment files
  - `id` (uuid, primary key) - Unique identifier
  - `filename` (text) - Original filename
  - `display_name` (text) - Optional friendly name for display
  - `file_size` (bigint) - Size in bytes
  - `content_type` (text) - MIME type (e.g., application/pdf)
  - `storage_path` (text) - Path in Supabase Storage
  - `description` (text, optional) - Optional description
  - `created_at` (timestamptz) - When uploaded
  - `updated_at` (timestamptz) - Last modified

  ### `email_template_attachments`
  Junction table linking templates to attachments (many-to-many)
  - `id` (uuid, primary key) - Unique identifier
  - `template_id` (uuid, foreign key) - References email_templates
  - `attachment_id` (uuid, foreign key) - References template_attachments
  - `order_index` (integer) - Order of attachment in template
  - `created_at` (timestamptz) - When linked

  ## Storage
  Creates a storage bucket `template-attachments` for storing files

  ## Security
  - Enable RLS on both tables
  - Public read access for authenticated operations
  - Public write access for creating/managing attachments
  - Storage policies for authenticated users to upload/download
*/

-- Create template_attachments table
CREATE TABLE IF NOT EXISTS template_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  display_name text,
  file_size bigint NOT NULL,
  content_type text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create email_template_attachments junction table
CREATE TABLE IF NOT EXISTS email_template_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES template_attachments(id) ON DELETE CASCADE,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, attachment_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_template_attachments_template_id 
  ON email_template_attachments(template_id);
CREATE INDEX IF NOT EXISTS idx_template_attachments_attachment_id 
  ON email_template_attachments(attachment_id);

-- Enable RLS
ALTER TABLE template_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for template_attachments
CREATE POLICY "Anyone can view attachments"
  ON template_attachments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create attachments"
  ON template_attachments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update attachments"
  ON template_attachments FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete attachments"
  ON template_attachments FOR DELETE
  USING (true);

-- RLS Policies for email_template_attachments
CREATE POLICY "Anyone can view template attachments"
  ON email_template_attachments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create template attachments"
  ON email_template_attachments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update template attachments"
  ON email_template_attachments FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete template attachments"
  ON email_template_attachments FOR DELETE
  USING (true);

-- Create storage bucket for template attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-attachments', 'template-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for template-attachments bucket
CREATE POLICY "Anyone can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'template-attachments');

CREATE POLICY "Anyone can view attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-attachments');

CREATE POLICY "Anyone can update attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'template-attachments')
  WITH CHECK (bucket_id = 'template-attachments');

CREATE POLICY "Anyone can delete attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'template-attachments');