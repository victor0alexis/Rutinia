-- ============================================================================
-- RUTINIA · MULTICUENTA, AISLAMIENTO DE DATOS Y ELIMINACIÓN DE CUENTA
-- ============================================================================
-- Ejecuta este script UNA VEZ en el SQL Editor de Supabase.
--
-- Qué hace:
--   1. Añade `usuario_id` a todas las tablas de datos (si faltaba) y lo
--      rellena automáticamente con `auth.uid()` en las filas nuevas.
--   2. Activa RLS y crea políticas para que cada cuenta autenticada solo vea
--      y modifique sus propias filas.
--   3. Mantiene el modo invitado/local: las filas con `usuario_id IS NULL`
--      siguen siendo accesibles sin sesión (rol `anon`).
--   4. Crea el RPC `eliminar_mi_cuenta()` que borra la cuenta de Auth y todos
--      sus datos. Es lo que usa el botón «Eliminar mi cuenta» de la app.
--
-- Requisito imprescindible:
--   La app debe usar la ANON PUBLIC KEY en `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
--   Si usas la service_role key, RLS se ignora por completo y cualquier
--   persona con la clave puede leer todas las cuentas. La service_role key
--   NUNCA debe viajar en una app móvil.
--
-- Nota sobre el catálogo:
--   `ejercicios_catalogo` incluye filas globales con `usuario_id IS NULL`
--   (catálogo base) y filas propias de cada cuenta. Las cuentas autenticadas
--   pueden LEER ambas, pero solo crear/modificar/borrar las suyas.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. COLUMNA DE PROPIETARIO EN TODAS LAS TABLAS DE DATOS
-- ----------------------------------------------------------------------------
do $$
declare
  tabla text;
  tablas text[] := array[
    'notas',
    'rutinas',
    'ejercicios_rutina',
    'registros_entrenamiento',
    'ejercicios_registro',
    'planes_entrenamiento',
    'ejercicios_catalogo',
    'listas_biblioteca',
    'favoritos_biblioteca'
  ];
begin
  foreach tabla in array tablas loop
    if to_regclass('public.' || tabla) is not null then
      execute format(
        'alter table public.%I add column if not exists usuario_id uuid',
        tabla
      );
      execute format(
        'alter table public.%I alter column usuario_id drop not null',
        tabla
      );
      execute format(
        'alter table public.%I alter column usuario_id set default auth.uid()',
        tabla
      );
      execute format(
        'create index if not exists idx_%s_usuario_id on public.%I (usuario_id)',
        tabla,
        tabla
      );
    else
      raise notice 'Rutinia: la tabla public.% no existe; se omite.', tabla;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 1b. HEREDAR EL PROPIETARIO EN FILAS HIJAS ANTIGUAS
-- ----------------------------------------------------------------------------
-- Las filas creadas antes de esta migración pueden tener `usuario_id` NULL en
-- los hijos aunque su rutina/registro ya pertenezca a una cuenta. Sin este
-- relleno, RLS las ocultaría y la eliminación de cuenta las dejaría huérfanas.
do $$
begin
  if to_regclass('public.registros_entrenamiento') is not null
     and to_regclass('public.rutinas') is not null then
    execute '
      update public.registros_entrenamiento as reg
         set usuario_id = r.usuario_id
        from public.rutinas as r
       where reg.rutina_id = r.id
         and reg.usuario_id is null
         and r.usuario_id is not null';
  end if;

  if to_regclass('public.ejercicios_rutina') is not null
     and to_regclass('public.rutinas') is not null then
    execute '
      update public.ejercicios_rutina as er
         set usuario_id = r.usuario_id
        from public.rutinas as r
       where er.rutina_id = r.id
         and er.usuario_id is null
         and r.usuario_id is not null';
  end if;

  if to_regclass('public.ejercicios_registro') is not null
     and to_regclass('public.registros_entrenamiento') is not null then
    execute '
      update public.ejercicios_registro as ej
         set usuario_id = reg.usuario_id
        from public.registros_entrenamiento as reg
       where ej.registro_id = reg.id
         and ej.usuario_id is null
         and reg.usuario_id is not null';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1c. MIGRACIÓN DE LA FILA DE FAVORITOS DEL MODO INVITADO
-- ----------------------------------------------------------------------------
-- La versión anterior guardaba una única fila `default`. Ahora cada cuenta
-- tiene su propia fila y el invitado usa `invitado`; conservamos los datos.
do $$
begin
  if to_regclass('public.favoritos_biblioteca') is not null then
    if exists (
      select 1 from public.favoritos_biblioteca
       where id = 'default' and usuario_id is null
    ) and not exists (
      select 1 from public.favoritos_biblioteca
       where id = 'invitado'
    ) then
      execute $migracion$
        update public.favoritos_biblioteca
           set id = 'invitado'
         where id = 'default'
           and usuario_id is null
      $migracion$;
    end if;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. PERMISOS BASE (RLS sigue siendo la capa que limita las filas)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

do $$
declare
  tabla text;
  tablas text[] := array[
    'notas',
    'rutinas',
    'ejercicios_rutina',
    'registros_entrenamiento',
    'ejercicios_registro',
    'planes_entrenamiento',
    'ejercicios_catalogo',
    'listas_biblioteca',
    'favoritos_biblioteca'
  ];
begin
  foreach tabla in array tablas loop
    if to_regclass('public.' || tabla) is not null then
      execute format(
        'grant select, insert, update, delete on public.%I to anon, authenticated',
        tabla
      );
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. RLS PARA LAS TABLAS DE DATOS PERSONALES
-- ----------------------------------------------------------------------------
-- Cada usuario autenticado solo accede a filas con su propio `usuario_id`.
-- El rol anónimo (perfil local) solo accede a filas con `usuario_id IS NULL`.
do $$
declare
  tabla text;
  tablas text[] := array[
    'notas',
    'rutinas',
    'ejercicios_rutina',
    'registros_entrenamiento',
    'ejercicios_registro',
    'planes_entrenamiento',
    'listas_biblioteca',
    'favoritos_biblioteca'
  ];
begin
  foreach tabla in array tablas loop
    if to_regclass('public.' || tabla) is not null then
      execute format('alter table public.%I enable row level security', tabla);

      execute format(
        'drop policy if exists "rutinia_propietario" on public.%I',
        tabla
      );
      execute format(
        'create policy "rutinia_propietario" on public.%I ' ||
        'for all to authenticated ' ||
        'using (usuario_id = (select auth.uid())) ' ||
        'with check (usuario_id = (select auth.uid()))',
        tabla
      );

      execute format(
        'drop policy if exists "rutinia_invitado" on public.%I',
        tabla
      );
      execute format(
        'create policy "rutinia_invitado" on public.%I ' ||
        'for all to anon ' ||
        'using (usuario_id is null) ' ||
        'with check (usuario_id is null)',
        tabla
      );
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. RLS ESPECIAL DEL CATÁLOGO DE EJERCICIOS
-- ----------------------------------------------------------------------------
-- El catálogo base (usuario_id NULL) es de lectura para todos, pero cada
-- cuenta solo puede modificar sus ejercicios personalizados.
do $$
begin
  if to_regclass('public.ejercicios_catalogo') is not null then
    execute 'alter table public.ejercicios_catalogo enable row level security';

    -- Estas dos políticas se crearon en el bloque 3 y son demasiado amplias
    -- para el catálogo: permitirían al invitado editar/borrar el catálogo base.
    execute 'drop policy if exists "rutinia_propietario" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_invitado" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_catalogo_propietario" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_catalogo_lectura" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_catalogo_insercion" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_catalogo_edicion" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_catalogo_borrado" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_catalogo_invitado_lectura" on public.ejercicios_catalogo';
    execute 'drop policy if exists "rutinia_catalogo_invitado_insercion" on public.ejercicios_catalogo';

    -- Lectura: catálogo base + ejercicios propios.
    execute 'create policy "rutinia_catalogo_lectura" on public.ejercicios_catalogo ' ||
            'for select to authenticated ' ||
            'using (usuario_id is null or usuario_id = (select auth.uid()))';

    -- Escritura: solo filas propias.
    execute 'create policy "rutinia_catalogo_insercion" on public.ejercicios_catalogo ' ||
            'for insert to authenticated ' ||
            'with check (usuario_id = (select auth.uid()))';

    execute 'create policy "rutinia_catalogo_edicion" on public.ejercicios_catalogo ' ||
            'for update to authenticated ' ||
            'using (usuario_id = (select auth.uid())) ' ||
            'with check (usuario_id = (select auth.uid()))';

    execute 'create policy "rutinia_catalogo_borrado" on public.ejercicios_catalogo ' ||
            'for delete to authenticated ' ||
            'using (usuario_id = (select auth.uid()))';

    -- Invitado: puede leer el catálogo base y crear ejercicios propios
    -- (quedan con usuario_id NULL, como en el modo local actual).
    execute 'create policy "rutinia_catalogo_invitado_lectura" on public.ejercicios_catalogo ' ||
            'for select to anon ' ||
            'using (usuario_id is null)';

    execute 'create policy "rutinia_catalogo_invitado_insercion" on public.ejercicios_catalogo ' ||
            'for insert to anon ' ||
            'with check (usuario_id is null)';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. ELIMINACIÓN COMPLETA DE LA CUENTA
-- ----------------------------------------------------------------------------
-- La app llama a `supabase.rpc('eliminar_mi_cuenta')`. La función usa el
-- `auth.uid()` de la sesión, así que un usuario no puede borrar a otro.
-- SECURITY DEFINER permite borrar de auth.users sin exponer esa capacidad
-- al cliente.
create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  tabla text;
  -- Orden importante: primero hijos, después padres.
  tablas text[] := array[
    'ejercicios_registro',
    'ejercicios_rutina',
    'registros_entrenamiento',
    'rutinas',
    'planes_entrenamiento',
    'listas_biblioteca',
    'favoritos_biblioteca',
    'notas',
    'ejercicios_catalogo'
  ];
begin
  if uid is null then
    raise exception 'No hay una sesión activa para eliminar.';
  end if;

  foreach tabla in array tablas loop
    if to_regclass('public.' || tabla) is not null then
      execute format('delete from public.%I where usuario_id = $1', tabla)
        using uid;
    end if;
  end loop;

  -- Borra la identidad, correo, sesiones y tokens de Supabase Auth.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.eliminar_mi_cuenta() from public;
revoke all on function public.eliminar_mi_cuenta() from anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

commit;

-- ============================================================================
-- OPCIONAL: REIVINDICAR LOS DATOS ANTIGUOS DE UNA SOLA CUENTA
-- ============================================================================
-- Si esta base de datos se usó antes del multicuenta con UNA sola cuenta y
-- quieres que las filas antiguas (creadas sin `usuario_id`) pasen a esa
-- cuenta, ejecuta el bloque siguiente por separado y sustituye <UUID> por el
-- id real de auth.users. Haz una copia de seguridad antes.
--
-- ¡Cuidado! También asignaría al usuario las filas del modo invitado actual.
-- No lo ejecutes si quieres conservar datos de invitado separados.
--
-- do $$
-- declare
--   uid uuid := '<UUID>';
--   tabla text;
--   tablas text[] := array[
--     'notas', 'rutinas', 'ejercicios_rutina', 'registros_entrenamiento',
--     'ejercicios_registro', 'planes_entrenamiento',
--     'listas_biblioteca', 'favoritos_biblioteca'
--   ];
-- begin
--   foreach tabla in array tablas loop
--     if to_regclass('public.' || tabla) is not null then
--       execute format('update public.%I set usuario_id = $1 where usuario_id is null', tabla)
--         using uid;
--     end if;
--   end loop;
-- end $$;

-- ============================================================================
-- VERIFICACIÓN (opcional, ejecuta por separado después del script)
-- ============================================================================
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;
--
-- select schemaname, tablename, policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
-- ============================================================================
