-- ============================================================================
-- RUTINIA - TABLAS PARA LISTAS Y FAVORITOS DE LA BIBLIOTECA DE EJERCICIOS
-- ============================================================================
-- Instrucciones:
-- 1. Ve a tu proyecto en Supabase (https://supabase.com/dashboard)
-- 2. Abre el SQL Editor en la barra lateral izquierda.
-- 3. Pega este código y haz clic en "Run".
-- ============================================================================

-- 1. Tabla de Listas Personalizadas de la Biblioteca
CREATE TABLE IF NOT EXISTS public.listas_biblioteca (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    grupo_muscular TEXT NOT NULL DEFAULT 'todos',
    ejercicio_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    creada_en BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    actualizada_en BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    usuario_id UUID NULL
);

-- 2. Tabla para Favoritos y Recientes de la biblioteca
CREATE TABLE IF NOT EXISTS public.favoritos_biblioteca (
    id TEXT PRIMARY KEY DEFAULT 'default',
    favoritos JSONB NOT NULL DEFAULT '[]'::jsonb,
    recientes JSONB NOT NULL DEFAULT '[]'::jsonb,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_id UUID NULL
);

-- 3. Deshabilitar RLS (App con service_role / acceso directo)
ALTER TABLE public.listas_biblioteca DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.favoritos_biblioteca DISABLE ROW LEVEL SECURITY;

-- 4. Permisos para anon, authenticated y service_role
GRANT ALL PRIVILEGES ON public.listas_biblioteca TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON public.favoritos_biblioteca TO anon, authenticated, service_role;

-- 5. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_listas_biblioteca_actualizada_en ON public.listas_biblioteca(actualizada_en DESC);
