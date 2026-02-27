-- Migration: Add sex column to persons table
-- Run this if your persons table already exists and doesn't have the sex column

-- Add sex column with constraint
ALTER TABLE public.persons 
ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('L', 'P'));

-- Update existing records to have a default value (optional)
-- UPDATE public.persons SET sex = 'L' WHERE sex IS NULL;
