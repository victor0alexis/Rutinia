-- ============================================================================
-- RUTINIA - ACTUALIZAR TABLA DE NOTAS EN SUPABASE (AGREGAR COLUMNAS FALTANTES)
-- ============================================================================
-- Instrucciones:
-- 1. Copia todo este código.
-- 2. Ve a tu proyecto en Supabase (https://supabase.com/dashboard)
-- 3. Abre el SQL Editor en la barra lateral izquierda.
-- 4. Pega este código y haz clic en "Run".
--    Este script agrega las columnas 'titulo' y 'categoria' si no existen,
--    preservando cualquier dato anterior y asegurando compatibilidad total.

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL DEFAULT '',
    categoria TEXT NOT NULL DEFAULT 'General',
    contenido TEXT NOT NULL DEFAULT '',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_id UUID NULL
);

-- Asegurar que las columnas existan si la tabla ya había sido creada anteriormente con otra estructura
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS contenido TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS usuario_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_notas_creado_en ON public.notas(creado_en);

-- Permisos totales para app de usuario único
ALTER TABLE public.notas DISABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON public.notas TO anon, authenticated, service_role;
