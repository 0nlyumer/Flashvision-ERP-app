-- ==============================================================================
-- Migration: 001_print_layout_settings.sql
-- Description: Universal Print Settings, Document Themes & Layout Engine
-- Bounded Context: Print Settings & Universal Print Studio
-- References:
--   - src/components/settings/PrintSettings.jsx
--   - src/components/ui/UniversalPrintStudioModal.jsx
--   - src/components/print/UnifiedPrintDocument.jsx
--   - src/utils/printThemeEngine.js
-- Primary Key: Composite (tenant_id, document_type)
-- ==============================================================================

-- 1. Create table `print_layout_settings`
CREATE TABLE IF NOT EXISTS public.print_layout_settings (
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    document_type TEXT NOT NULL,
    active_theme_id TEXT NOT NULL DEFAULT 'classic', -- 'classic' | 'modern' | 'industrial'
    layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    customizations JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT pk_print_layout_settings PRIMARY KEY (tenant_id, document_type)
);

-- Ensure columns exist if table was previously created without them
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'print_layout_settings' 
          AND column_name = 'active_theme_id'
    ) THEN
        ALTER TABLE public.print_layout_settings 
        ADD COLUMN active_theme_id TEXT NOT NULL DEFAULT 'classic';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'print_layout_settings' 
          AND column_name = 'customizations'
    ) THEN
        ALTER TABLE public.print_layout_settings 
        ADD COLUMN customizations JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Indexes for tenant and theme query optimization
CREATE INDEX IF NOT EXISTS idx_print_layout_settings_tenant 
    ON public.print_layout_settings (tenant_id);

CREATE INDEX IF NOT EXISTS idx_print_layout_settings_theme 
    ON public.print_layout_settings (active_theme_id);

-- 3. Document comments
COMMENT ON TABLE public.print_layout_settings IS 'Stores print studio and document layout customizations per tenant, document type, and certified theme.';
COMMENT ON COLUMN public.print_layout_settings.tenant_id IS 'Tenant or organization identifier (defaults to default_tenant for single-tenant mode).';
COMMENT ON COLUMN public.print_layout_settings.document_type IS 'Unique document identifier (e.g. sale_order, delivery_challan, tax_invoice, bom_master, attendance_sheet).';
COMMENT ON COLUMN public.print_layout_settings.active_theme_id IS 'Selected theme archetype: classic (Corporate Formal), modern (Minimalist Accent), or industrial (Shop-Floor B&W Compact).';
COMMENT ON COLUMN public.print_layout_settings.layout_config IS 'JSON document containing layout geometry, headers, columns, margins, and signature blocks.';
COMMENT ON COLUMN public.print_layout_settings.customizations IS 'Granular user style customizations (curated palette ID, logo positioning, floor checkboxes).';
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

-- 9. Seed Default Optimal Theme Layouts for Key Documents
INSERT INTO public.print_layout_settings (tenant_id, document_type, active_theme_id, layout_config, customizations)
VALUES
    -- Commercial Billing Documents (Default: Classic Corporate)
    ('default_tenant', 'sale_order', 'classic', '{"paperSize":"A4","orientation":"portrait","paletteId":"navy_enterprise","fontFamily":"Inter"}'::jsonb, '{"theme":"classic"}'::jsonb),
    ('default_tenant', 'sale_invoice', 'classic', '{"paperSize":"A4","orientation":"portrait","paletteId":"navy_enterprise","fontFamily":"Inter"}'::jsonb, '{"theme":"classic"}'::jsonb),
    ('default_tenant', 'purchase_order', 'classic', '{"paperSize":"A4","orientation":"portrait","paletteId":"navy_enterprise","fontFamily":"Inter"}'::jsonb, '{"theme":"classic"}'::jsonb),
    ('default_tenant', 'purchase_invoice', 'classic', '{"paperSize":"A4","orientation":"portrait","paletteId":"navy_enterprise","fontFamily":"Inter"}'::jsonb, '{"theme":"classic"}'::jsonb),

    -- Manufacturing & Shop-Floor Documents (Default: Industrial Shop-Floor Compact)
    ('default_tenant', 'bom_master', 'industrial', '{"paperSize":"A4","orientation":"portrait","paletteId":"industrial_steel","fontFamily":"Inter","enableFloorCheckboxes":true,"showMachineAllocation":true}'::jsonb, '{"theme":"industrial"}'::jsonb),
    ('default_tenant', 'batch_closing_history', 'industrial', '{"paperSize":"A4","orientation":"portrait","paletteId":"industrial_steel","fontFamily":"Inter","enableFloorCheckboxes":true}'::jsonb, '{"theme":"industrial"}'::jsonb),
    ('default_tenant', 'master_batch_record', 'industrial', '{"paperSize":"A4","orientation":"portrait","paletteId":"industrial_steel","fontFamily":"Inter","enableFloorCheckboxes":true}'::jsonb, '{"theme":"industrial"}'::jsonb),
    ('default_tenant', 'planning_history', 'industrial', '{"paperSize":"A4","orientation":"portrait","paletteId":"industrial_steel","fontFamily":"Inter","enableFloorCheckboxes":true,"showMachineAllocation":true}'::jsonb, '{"theme":"industrial"}'::jsonb),
    ('default_tenant', 'inventory_ledger', 'industrial', '{"paperSize":"A4","orientation":"portrait","paletteId":"industrial_steel","fontFamily":"Inter"}'::jsonb, '{"theme":"industrial"}'::jsonb),
    ('default_tenant', 'attendance_sheet', 'industrial', '{"paperSize":"A4","orientation":"portrait","paletteId":"industrial_steel","fontFamily":"Inter"}'::jsonb, '{"theme":"industrial"}'::jsonb),

    -- Logistics Documents (Default: Modern Minimalist)
    ('default_tenant', 'delivery_challan', 'modern', '{"paperSize":"A4","orientation":"portrait","paletteId":"royal_cobalt","fontFamily":"Inter"}'::jsonb, '{"theme":"modern"}'::jsonb),
    ('default_tenant', 'inward_gate_pass', 'modern', '{"paperSize":"A4","orientation":"portrait","paletteId":"royal_cobalt","fontFamily":"Inter"}'::jsonb, '{"theme":"modern"}'::jsonb),
    ('default_tenant', 'grn_note', 'modern', '{"paperSize":"A4","orientation":"portrait","paletteId":"navy_enterprise","fontFamily":"Inter"}'::jsonb, '{"theme":"modern"}'::jsonb)
ON CONFLICT (tenant_id, document_type) DO UPDATE
SET active_theme_id = EXCLUDED.active_theme_id,
    updated_at = timezone('utc'::text, now());
