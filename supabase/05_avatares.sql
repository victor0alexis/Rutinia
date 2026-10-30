-- ============================================================================
-- RUTINIA · STORAGE DE AVATARES DE USUARIOS
-- ============================================================================
-- Ejecuta este script UNA VEZ en el SQL Editor de Supabase (Dashboard -> SQL Editor).
--
-- Qué hace:
--   1. Crea el bucket público 'avatares' con límite de ~1 MB y tipos MIME permitidos
--      (image/jpeg, image/png, image/webp).
--   2. Configura políticas RLS idempotentes en storage.objects para que:
--      - Cualquier usuario pueda leer (SELECT) avatares públicamente.
--      - Los usuarios autenticados solo puedan INSERTAR, ACTUALIZAR y BORRAR
--        archivos dentro de su propia carpeta: <auth.uid()>/...
-- ============================================================================

-- 1. Crear o actualizar el bucket público 'avatares'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  true,
  1048576, -- 1 MB en bytes
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 2. Asegurar que RLS esté activo en storage.objects
alter table storage.objects enable row level security;

-- 3. Políticas RLS (Idempotentes con DROP POLICY IF EXISTS)

-- Lectura pública de avatares
drop policy if exists "Avatares publicos lectura" on storage.objects;
create policy "Avatares publicos lectura"
on storage.objects for select
using (bucket_id = 'avatares');

-- Insertar: solo usuario autenticado en su carpeta <uid>/...
drop policy if exists "Avatares insercion usuario" on storage.objects;
create policy "Avatares insercion usuario"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatares'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

-- Actualizar: solo usuario autenticado en su carpeta <uid>/...
drop policy if exists "Avatares actualizacion usuario" on storage.objects;
create policy "Avatares actualizacion usuario"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatares'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or split_part(name, '/', 1) = auth.uid()::text
  )
)
with check (
  bucket_id = 'avatares'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

-- Borrar: solo usuario autenticado en su carpeta <uid>/...
drop policy if exists "Avatares eliminacion usuario" on storage.objects;
create policy "Avatares eliminacion usuario"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatares'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or split_part(name, '/', 1) = auth.uid()::text
  )
);
