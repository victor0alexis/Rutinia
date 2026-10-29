# RutinIA

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

Los scripts SQL se encuentran en la carpeta `supabase/` y se ejecutan en orden:

- **`supabase/01_reset.sql`:** ejecuta una sola vez en el SQL Editor para un proyecto nuevo o de pruebas. Es destructivo: borra y recrea el esquema base.
- **`supabase/02_multicuenta.sql`:** añade `usuario_id`, rellena las filas hijas, activa RLS con políticas por cuenta, ajusta el catálogo de ejercicios y crea el RPC `eliminar_mi_cuenta()`.
  - **Datos antiguos de una sola cuenta:** al final de este script hay un bloque opcional para reivindicarlos. Sustituye `<UUID>` por el ID de `auth.users` y ejecútalo por separado.
- **`supabase/03_listas_biblioteca.sql`:** crea las tablas para listas y favoritos de la biblioteca de ejercicios.
- **`supabase/04_notas.sql`:** estructura y políticas para la tabla de notas.

Sin ejecutar `supabase/02_multicuenta.sql`, el botón «Eliminar mi cuenta» no puede borrar la cuenta y el aislamiento real entre cuentas no está garantizado.

### Correos de confirmación

El servicio SMTP integrado de Supabase **solo entrega correos a miembros del equipo del proyecto** y está limitado a **2 correos por hora**. Por eso un registro con un correo normal puede completarse en la app pero nunca recibir el enlace.

Para que lleguen a cualquier usuario:

1. Configura un SMTP propio en **Authentication → Emails → SMTP Settings** (Resend, Brevo, Postmark, SES…).
2. Revisa **Authentication → URL Configuration**: `Site URL` y `Redirect URLs` deben apuntar a una URL válida (por ejemplo, `rutinia://` en la app o el dominio web).
3. Comprueba los logs en **Authentication → Logs** si el correo sigue sin llegar.
4. Para pruebas locales puedes desactivar temporalmente **Confirm email** en **Authentication → Providers → Email**, pero vuelve a activarlo antes de publicar.

La app incluye «Reenviar confirmación» en la pantalla de inicio de sesión.

### Migrar el progreso anterior

Las filas creadas antes del multicuenta tienen `usuario_id IS NULL` y siguen existiendo como datos del perfil invitado. **No se borran al crear una cuenta**, pero una cuenta nueva no las ve porque su espacio es independiente.

Para pasarlas a una cuenta concreta, ejecuta el bloque opcional de `supabase/02_multicuenta.sql` con el UUID de esa cuenta. El bloque **mueve** las filas (no las copia): después dejarán de aparecer en el perfil invitado. Haz una copia de seguridad antes. Si quieres conservar ambas copias, pide una migración basada en duplicar filas.

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
