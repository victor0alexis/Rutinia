-- ============================================================================
-- RUTINIA - SCRIPT SQL COMPLETO DE RESTABLECIMIENTO Y CONFIGURACIÓN (SUPABASE)
-- ============================================================================
-- Instrucciones:
-- 1. Copia todo este código.
-- 2. Ve a tu proyecto en Supabase (https://supabase.com/dashboard)
-- 3. Abre el SQL Editor en la barra lateral izquierda.
-- 4. Pega este código en una nueva consulta y haz clic en "Run".
-- 5. ⚠️  IMPORTANTE: usa la ANON PUBLIC KEY en tu .env (NUNCA la service_role):
--       Settings → API → "anon public" → copia el valor
--       EXPO_PUBLIC_SUPABASE_ANON_KEY=<pega aquí la anon public key>
--    La service_role key ignora RLS y permite leer los datos de TODAS las cuentas.
--    Si alguna vez la pegaste en la app, rótala en Settings → API.
-- 6. Después de este script ejecuta `supabase_multicuenta.sql`: añade las
--    políticas RLS por cuenta, los índices de propietario y el RPC para
--    eliminar la cuenta y todos sus datos.

-- ----------------------------------------------------------------------------
-- 1. ELIMINACIÓN EN CASCADA DE TABLAS EXISTENTES
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.notas CASCADE;
DROP TABLE IF EXISTS public.ejercicios_registro CASCADE;
DROP TABLE IF EXISTS public.registros_entrenamiento CASCADE;
DROP TABLE IF EXISTS public.ejercicios_rutina CASCADE;
DROP TABLE IF EXISTS public.rutinas CASCADE;

-- ----------------------------------------------------------------------------
-- 2. EXTENSIÓN DE GENERACIÓN DE UUID
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 3. CREACIÓN DE TABLAS CON RELACIONES CASCADE / SET NULL
-- ----------------------------------------------------------------------------

-- Tabla de Notas Estandarizadas
CREATE TABLE public.notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL DEFAULT '',
    categoria TEXT NOT NULL DEFAULT 'General',
    contenido TEXT NOT NULL DEFAULT '',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_id UUID NULL
);

-- Tabla principal de Rutinas
CREATE TABLE public.rutinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_id UUID NULL
);

-- Ejercicios pertenecientes a una Rutina (ON DELETE CASCADE)
CREATE TABLE public.ejercicios_rutina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rutina_id UUID NOT NULL REFERENCES public.rutinas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    series INTEGER NULL,
    repeticiones INTEGER NULL,
    peso NUMERIC NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    usuario_id UUID NULL,
    detalles_json TEXT NULL
);

-- Registros diarios de entrenamiento / Actividad (ON DELETE SET NULL para desvincular rutinas)
CREATE TABLE public.registros_entrenamiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    rutina_id UUID NULL REFERENCES public.rutinas(id) ON DELETE SET NULL,
    completado BOOLEAN NOT NULL DEFAULT false,
    notas TEXT NULL,
    usuario_id UUID NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ejercicios o notas del registro diario (ON DELETE CASCADE)
CREATE TABLE public.ejercicios_registro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registro_id UUID NOT NULL REFERENCES public.registros_entrenamiento(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    series INTEGER NULL,
    repeticiones INTEGER NULL,
    peso NUMERIC NULL,
    completado BOOLEAN NOT NULL DEFAULT false,
    usuario_id UUID NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. ÍNDICES DE RENDIMIENTO PARA CONSULTAS RÁPIDAS
-- ----------------------------------------------------------------------------
CREATE INDEX idx_notas_creado_en ON public.notas(creado_en);
CREATE INDEX idx_ejercicios_rutina_rutina_id ON public.ejercicios_rutina(rutina_id);
CREATE INDEX idx_registros_entrenamiento_fecha ON public.registros_entrenamiento(fecha);
CREATE INDEX idx_registros_entrenamiento_rutina_id ON public.registros_entrenamiento(rutina_id);
CREATE INDEX idx_ejercicios_registro_registro_id ON public.ejercicios_registro(registro_id);

-- ----------------------------------------------------------------------------
-- 5. RLS ACTIVADO (LAS POLÍTICAS SE CREAN EN supabase_multicuenta.sql)
-- ----------------------------------------------------------------------------
-- Se activa RLS de inmediato para que, si algo falla, las tablas queden
-- cerradas en lugar de expuestas. Ejecuta supabase_multicuenta.sql justo
-- después para crear las políticas por cuenta y el modo invitado.
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios_rutina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_entrenamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios_registro ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. PERMISOS BASE (RLS limita las filas; los grants solo abren la tabla)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rutinas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ejercicios_rutina TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_entrenamiento TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ejercicios_registro TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
