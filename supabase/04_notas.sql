-- ============================================================================
-- RUTINIA - PERMITIR NOTAS SIN USUARIO (REMOVER NOT NULL DE usuario_id)
-- ============================================================================
-- Instrucciones:
-- 1. Copia todo este código.
-- 2. Ve a tu proyecto en Supabase (https://supabase.com/dashboard)
-- 3. Abre el SQL Editor en la barra lateral izquierda.
-- 4. Pega este código y haz clic en "Run".

-- 1. Remover la restricción NOT NULL de usuario_id para permitir usuario único sin login
ALTER TABLE public.notas ALTER COLUMN usuario_id DROP NOT NULL;

-- 2. Asegurar que existan todas las columnas requeridas
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS contenido TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS usuario_id UUID NULL;

-- 3. Deshabilitar RLS y otorgar permisos totales (app de usuario único)
ALTER TABLE public.notas DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON public.notas TO anon, authenticated, service_role;
