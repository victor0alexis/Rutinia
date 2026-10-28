# Rutinia

Aplicación móvil de rutinas, hábitos y progreso construida con Expo, React Native (Expo Router) y Supabase.

## Puesta en marcha

```bash
npm install
Copy-Item .env.example .env   # PowerShell
npx expo start
```

Rellena `.env` con los datos de tu proyecto de Supabase (Settings → API):

```env
EXPO_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
```

> **Importante:** usa siempre la clave **anon public**. La `service_role` ignora RLS y permite leer o borrar los datos de todas las cuentas; nunca debe incluirse en una app móvil. Si alguna vez se usó, rótala en Supabase y actualiza `.env`.

## Base de datos

- **Proyecto nuevo o de pruebas:** ejecuta `supabase_reset.sql` una sola vez en el SQL Editor. Es destructivo: borra y recrea el esquema.
- **Proyecto con datos existentes:** ejecuta `supabase_multicuenta.sql`. Añade `usuario_id`, rellena las filas hijas, activa RLS con políticas por cuenta, ajusta el catálogo de ejercicios y crea el RPC `eliminar_mi_cuenta()`.
- **Datos antiguos de una sola cuenta:** al final de `supabase_multicuenta.sql` hay un bloque opcional para reivindicarlos. Sustituye `<UUID>` por el ID de `auth.users` y ejecútalo por separado. No incluye el catálogo base.

Sin ejecutar `supabase_multicuenta.sql`, el botón «Eliminar mi cuenta» no puede borrar la cuenta y el aislamiento real entre cuentas no está garantizado.

## Cuentas

- El **perfil local/invitado** funciona sin iniciar sesión y está siempre disponible.
- Se pueden añadir varias cuentas de Supabase y cambiar entre ellas desde **Menú & Ajustes → Cuentas**.
- Al cambiar de cuenta se restaura la sesión guardada. Si el token caducó o fue revocado, la app pide la contraseña en lugar de mostrar un error técnico.
- **Cerrar sesión** cierra solo esta instalación, olvida el token local y deja la cuenta en la lista para volver a entrar.
- **Quitar del dispositivo** elimina la cuenta del selector y su caché local, pero no toca los datos en la nube.
- **Eliminar mi cuenta** borra permanentemente la cuenta de Auth y todos sus datos mediante `eliminar_mi_cuenta()`.

Los datos de cada cuenta se filtran por propietario y se guardan en cachés con espacio de nombres propio; RLS es la última barrera. Las filas del invitado se almacenan en la nube con `usuario_id IS NULL` y son accesibles con el rol `anon`: **no son privadas entre dispositivos**.

## Seguridad

- Los tokens de sesión por cuenta se guardan en AsyncStorage. Para producción, considera migrarlos a `expo-secure-store`.
- RLS debe estar activo y la app debe usar la clave anon. Comprueba ambas cosas antes de publicar.
- Si la `service_role` estuvo expuesta en un bundle o repositorio, considérala comprometida y rótala.

## Comandos útiles

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo start       # servidor de desarrollo
npx expo-doctor      # diagnóstico de dependencias y configuración
```
