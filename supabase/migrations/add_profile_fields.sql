-- Add profile fields for user preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('erkek', 'kadın', 'belirtmek_istemiyorum'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year SMALLINT CHECK (birth_year >= 1950 AND birth_year <= 2010);

-- Policy: users can read/update their own profile
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT TO authenticated USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','editor')));

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND (role IS NULL OR role = (SELECT role FROM profiles WHERE id = auth.uid())));
