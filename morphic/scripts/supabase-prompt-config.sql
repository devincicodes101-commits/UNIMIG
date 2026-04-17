-- Create prompt_config table
CREATE TABLE IF NOT EXISTS public.prompt_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    behavior TEXT NOT NULL,
    tone TEXT NOT NULL,
    num_replies INTEGER NOT NULL DEFAULT 3,
    additional_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create row level security policies
ALTER TABLE public.prompt_config ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users with admin role
CREATE POLICY "Admin users can read prompt_config" 
ON public.prompt_config FOR SELECT 
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin users can insert prompt_config" 
ON public.prompt_config FOR INSERT 
TO authenticated
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Insert default configuration
INSERT INTO public.prompt_config (behavior, tone, num_replies, additional_instructions)
VALUES ('Professional', 'Friendly', 3, 'Always be helpful and provide value to the sales representatives.')
ON CONFLICT DO NOTHING; 