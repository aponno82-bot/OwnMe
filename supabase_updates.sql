-- 1. Update Messages table for delivery and seen status
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'; -- 'sent', 'delivered', 'seen'

-- 2. Create Chat Settings table for Archive and Mute functionality (per user)
CREATE TABLE IF NOT EXISTS chat_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_partner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chat_partner_id)
);

-- Enable RLS for chat_settings
ALTER TABLE chat_settings ENABLE ROW LEVEL SECURITY;

-- Policies for chat_settings
DROP POLICY IF EXISTS "Users can manage their own chat settings" ON chat_settings;
CREATE POLICY "Users can manage their own chat settings" 
ON chat_settings FOR ALL 
USING (auth.uid() = user_id);

-- 3. Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_settings_updated_at
    BEFORE UPDATE ON chat_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
