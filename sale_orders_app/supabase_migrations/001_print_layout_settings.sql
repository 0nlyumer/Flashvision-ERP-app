-- ==============================================================================
-- Migration: 001_print_layout_settings.sql
-- Description: Create print_layout_settings table for universal document layouts
-- Bounded Context: Print Settings & Universal Print Studio
-- References:
--   - src/components/settings/PrintSettings.jsx
--   - src/components/ui/UniversalPrintStudioModal.jsx
-- Primary Key: Composite (tenant_id, document_type)
-- ==============================================================================

-- 1. Create table `print_layout_settings`
CREATE TABLE IF NOT EXISTS public.print_layout_settings (
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    document_type TEXT NOT NULL,
    layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_print_layout_settings PRIMARY KEY (tenant_id, document_type)
);

-- 2. Index for tenant query optimization
CREATE INDEX IF NOT EXISTS idx_print_layout_settings_tenant 
    ON public.print_layout_settings (tenant_id);

-- 3. Document comments
COMMENT ON TABLE public.print_layout_settings IS 'Stores print studio and document layout customizations per tenant and document type.';
COMMENT ON COLUMN public.print_layout_settings.tenant_id IS 'Tenant or organization identifier (defaults to default_tenant for single-tenant mode).';
COMMENT ON COLUMN public.print_layout_settings.document_type IS 'Unique document identifier (e.g. sale_order, delivery_challan, tax_invoice, gate_pass).';
COMMENT ON COLUMN public.print_layout_settings.layout_config IS 'JSON document containing layout geometry, headers, columns, margins, and signature blocks.';
COMMENT ON COLUMN public.print_layout_settings.updated_at IS 'Timestamp of the last modification.';

-- 4. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_print_layout_settings_updated_at ON public.print_layout_settings;
CREATE TRIGGER trigger_print_layout_settings_updated_at
    BEFORE UPDATE ON public.print_layout_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.print_layout_settings ENABLE ROW LEVEL SECURITY;

-- 6. Open policies matching current erp_state / user_settings open policy configuration
-- Note: In Phase 2, these will be replaced with authenticated role checks once Supabase Auth is enabled.
CREATE POLICY "Allow public read on print_layout_settings" 
    ON public.print_layout_settings 
    FOR SELECT 
    USING (true);

CREATE POLICY "Allow public insert on print_layout_settings" 
    ON public.print_layout_settings 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public update on print_layout_settings" 
    ON public.print_layout_settings 
    FOR UPDATE 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow public delete on print_layout_settings" 
    ON public.print_layout_settings 
    FOR DELETE 
    USING (true);

-- 7. Grant access to public/authenticated/service roles
GRANT ALL ON TABLE public.print_layout_settings TO anon, authenticated, service_role;

-- 8. Add to Realtime Publication if active
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.print_layout_settings;
    END IF;
END $$;
