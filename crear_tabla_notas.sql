-- ============================================================================
-- RUTINIA - CREACIÓN DE TABLA DE NOTAS EN SUPABASE (SIN PERDER DATOS EXISTENTES)
-- ============================================================================
-- Instrucciones:
-- 1. Copia este código.
-- 2. Ve a tu proyecto en Supabase (https://supabase.com/dashboard)
-- 3. Abre el SQL Editor en la barra lateral izquierda.
-- 4. Pega este código y haz clic en "Run".
--    Este script NO borra ninguna tabla existente, solo crea la tabla 'notas'.

CREATE TABLE IF NOT EXISTS public.notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    contenido TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_notas_creado_en ON public.notas(creado_en);

-- Permisos totales para app de usuario único
ALTER TABLE public.notas DISABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON public.notas TO anon, authenticated, service_role;
