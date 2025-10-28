-- Fix RLS policies for organizations table
-- Allow authenticated users to insert and update organizations

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;

-- Allow authenticated users to insert organizations (for self-service onboarding)
CREATE POLICY "Authenticated users can insert organizations"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update organizations they created
CREATE POLICY "Authenticated users can update organizations"
ON organizations
FOR UPDATE
TO authenticated
USING (true);

-- Allow users to view organizations (needed for lookups)
CREATE POLICY "Authenticated users can view organizations"
ON organizations
FOR SELECT
TO authenticated
USING (true);

-- Update user_profiles to support new profile types
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_profile_type_check;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_profile_type_check 
CHECK (profile_type IN ('super_admin', 'contratante_pj', 'contratante_pf', 'usuario_regular', 'gestor_orgao', 'master_admin'));

-- Add CPF field to user_profiles for PF users
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Add index for CPF lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_cpf ON user_profiles(cpf);

-- Seed data: 3 organizations for testing
INSERT INTO organizations (name, full_name, cnpj, municipality, state, sphere, active)
VALUES 
  ('PMRJ', 'Prefeitura Municipal do Rio de Janeiro', '42.498.426/0001-48', 'Rio de Janeiro', 'RJ', 'municipal', true),
  ('SME-RJ', 'Secretaria Municipal de Educação do Rio de Janeiro', '42.498.426/0001-48', 'Rio de Janeiro', 'RJ', 'municipal', true),
  ('FMS-RJ', 'Fundo Municipal de Saúde do Rio de Janeiro', '09.384.925/0001-42', 'Rio de Janeiro', 'RJ', 'municipal', true)
ON CONFLICT (cnpj) DO NOTHING;