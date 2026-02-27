-- Create canvases table
CREATE TABLE IF NOT EXISTS public.canvases (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create persons table
CREATE TABLE IF NOT EXISTS public.persons (
    id BIGSERIAL PRIMARY KEY,
    canvas_id BIGINT NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sex TEXT CHECK (sex IN ('L', 'P')),
    birth_date DATE,
    position JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create relationships table
CREATE TABLE IF NOT EXISTS public.relationships (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id BIGINT NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    child_id BIGINT NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'child', -- 'child' or 'partner'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_relationship UNIQUE (parent_id, child_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

-- Create policies for canvases table
CREATE POLICY "Users can view their own canvases"
    ON public.canvases
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own canvases"
    ON public.canvases
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canvases"
    ON public.canvases
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canvases"
    ON public.canvases
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create policies for persons table
CREATE POLICY "Users can view their own persons"
    ON public.persons
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own persons"
    ON public.persons
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own persons"
    ON public.persons
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own persons"
    ON public.persons
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create policies for relationships table
CREATE POLICY "Users can view their own relationships"
    ON public.relationships
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own relationships"
    ON public.relationships
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own relationships"
    ON public.relationships
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own relationships"
    ON public.relationships
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_canvases_user_id ON public.canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_persons_canvas_id ON public.persons(canvas_id);
CREATE INDEX IF NOT EXISTS idx_persons_user_id ON public.persons(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_user_id ON public.relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_parent_id ON public.relationships(parent_id);
CREATE INDEX IF NOT EXISTS idx_relationships_child_id ON public.relationships(child_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_persons_updated_at
    BEFORE UPDATE ON public.persons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
