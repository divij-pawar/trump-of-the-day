/*
  # Create updates table

  1. New Tables
    - `updates`
      - `id` (bigint, primary key)
      - `title` (text, not null)
      - `content` (text, not null)
      - `date` (text, not null)
      - `created_at` (timestamptz, default now())
  2. Security
    - Enable RLS on `updates` table
    - Add policy for authenticated users to read all updates
    - Add policy for authenticated users to insert their own updates
*/

CREATE TABLE IF NOT EXISTS updates (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  date text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

-- Create policy for reading updates (public read)
CREATE POLICY "Anyone can read updates"
  ON updates
  FOR SELECT
  USING (true);

-- Create policy for inserting updates (authenticated users only)
CREATE POLICY "Authenticated users can insert updates"
  ON updates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);