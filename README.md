# RutinIA

Aplicación móvil y web de alto rendimiento para la gestión integral de entrenamientos, rutinas, notas de progresión y analítica deportiva. Construida con **Expo SDK 57**, **React Native**, **react-native-web**, **React Native Reanimated**, **Shopify React Native Skia** y **Supabase**.

---

## 🚀 Puesta en marcha

### 1. Instalación y dependencias
```bash
npm install
```

### 2. Variables de entorno
Copia la plantilla de entorno:
```bash
# En Windows (PowerShell)
Copy-Item .env.example .env

# En Linux/macOS
cp .env.example .env
```

Configura tus credenciales de Supabase en `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
```

> ⚠️ **Seguridad:** Usa **únicamente** la clave `anon public`. La clave `service_role` ignora las políticas RLS y jamás debe incluirse en clientes web ni aplicaciones móviles.

### 3. Servidor de desarrollo
```bash
npx expo start
```
- Presiona `w` para abrir en el navegador web (con aceleración CanvasKit Skia).
- Presiona `a` para emulador Android o `i` para simulador iOS.

---

## 🗄️ Base de datos y Supabase

Los scripts de base de datos se encuentran en `supabase/` y deben ejecutarse en orden secuencial en el SQL Editor de tu panel de Supabase:

1. **`supabase/01_reset.sql`:** Inicialización y reseteo del esquema. Crea las tablas fundamentales (`planes_entrenamiento`, `rutinas`, `ejercicios_rutina`, `registros_entrenamiento`, `ejercicios_registro`, `ejercicios_catalogo`). *Destructivo en bases existentes.*
2. **`supabase/02_multicuenta.sql`:** Habilita el aislamiento multicuenta con `usuario_id`, Row Level Security (RLS) en todas las entidades, catálogos predeterminados y el RPC `eliminar_mi_cuenta()`.
3. **`supabase/03_listas_biblioteca.sql`:** Esquema y políticas para la gestión de ejercicios favoritos y colecciones personalizadas (`listas_biblioteca`, `favoritos_biblioteca`).
4. **`supabase/04_notas.sql`:** Tabla de libreta de notas (`notas`), índices de búsqueda por etiquetas/categorías y políticas RLS asociadas.
5. **`supabase/05_avatares.sql`:** Creación del bucket público `avatares` (límite de 1 MB, tipos MIME permitidos: `image/jpeg`, `image/png`, `image/webp`) y políticas RLS en `storage.objects` con aislamiento por usuario (`<uid>/avatar.jpg`).

### Autenticación y Correos de Confirmación
El servidor SMTP por defecto de Supabase está limitado a miembros del proyecto. Para producción con usuarios externos:
1. Configura tu proveedor SMTP en **Authentication → Emails → SMTP Settings** (Resend, Brevo, AWS SES, etc.).
2. En **Authentication → URL Configuration**, configura `Site URL` y `Redirect URLs` con tu dominio web o scheme móvil (`rutinia://`).

### Inicio de sesión con Google (OAuth PKCE)
Rutinia soporta autenticación mediante Google en Web (PWA), iOS y Android sin exponer secretos en el cliente:

1. **Google Cloud Console:**
   - Configura la **Pantalla de consentimiento de OAuth** (marca en estado de producción o añade usuarios de prueba).
   - Crea un **ID de cliente de OAuth 2.0** de tipo *Aplicación web*.
   - Añade a **URIs de redireccionamiento autorizados**:
     ```
     https://<TU-REF-SUPABASE>.supabase.co/auth/v1/callback
     ```
2. **Supabase Dashboard:**
   - Activa el proveedor en **Authentication → Providers → Google**.
   - Ingresa el *Client ID* y *Client Secret* generados por Google Cloud.
   - *Nota de seguridad:* El `Client Secret` vive únicamente en Supabase y **jamás** debe incluirse en la app, variables `EXPO_PUBLIC_` ni en el repositorio.
3. **Configuración de URLs en Supabase (Authentication → URL Configuration):**
   - **Site URL:**
     ```
     https://rutinia-victoralexis.vercel.app
     ```
   - **Redirect URLs:**
     ```
     https://rutinia-victoralexis.vercel.app/**
     http://localhost:8081/**
     exp://**
     rutinia://**
     ```
4. **Flujo de Navegación:**
   - En **Web / PWA (iOS y escritorio)**: Se utiliza redirección de página completa con intercambio de código PKCE y sincronización instantánea al volver a la app, evitando popups bloqueados por el navegador.
   - En **Móvil (Expo Go / Dev Client)**: Se abre mediante `WebBrowser.openAuthSessionAsync` usando deep linking seguro (`rutinia://auth/callback` o `exp://`).

### 👤 Foto de perfil y almacenamiento de avatares

Rutinia permite a los usuarios personalizar su avatar eligiendo una foto desde la biblioteca de su dispositivo o usando la foto de su proveedor (Google).

#### Configuración del Storage en Supabase
Ejecuta el script `supabase/05_avatares.sql` en el SQL Editor de tu panel de Supabase. Este script:
- Crea el bucket público de almacenamiento `avatares`.
- Aplica un límite de tamaño por archivo de 1 MB y restringe los tipos MIME a `image/jpeg`, `image/png` e `image/webp`.
- Establece políticas RLS sobre `storage.objects`:
  - **Lectura:** Pública para cualquier avatar del bucket.
  - **Inserción, Actualización y Eliminación:** Permitida exclusivamente si el primer segmento de la ruta del archivo coincide con el identificador del usuario autenticado (`auth.uid()::text`), bajo el patrón `<uid>/avatar.jpg`.

#### Procesamiento y optimización
- **Selección:** Utiliza `expo-image-picker` y `expo-image-manipulator` respetando permisos en español tanto en plataformas nativas como en web/PWA.
- **Validación de origen:** Límite máximo de ~5 MB para la imagen seleccionada con rechazo amigable en caso de excederlo.
- **Redimensionamiento:** Se recorta centrado en cuadrado 1:1 y se escala a 512×512 píxeles con compresión JPEG (calidad 0.8), garantizando archivos ligeros (< 150 KB) de carga veloz.

#### Modo Nube vs Modo Local
- **Cuentas en la Nube (Correo / Google):** La imagen procesada se sube a Supabase Storage en `avatares/<uid>/avatar.jpg` (upsert). La URL pública versionada (`?v=timestamp`) se persiste en `user_metadata.avatar_url`. Al eliminar la cuenta mediante `eliminarCuentaActual`, el archivo del avatar se borra del bucket antes de invocar el RPC. Para cuentas Google sin foto personalizada, se utiliza su foto oficial (`user_metadata.picture`) por defecto.
- **Perfil Local / Invitado:** Sin cuenta en la nube, se genera una miniatura ultraligera de 256×256 px en formato data URL base64 (< 80 KB) persistida en `AsyncStorage` bajo el namespace local.

---

## 📁 Estructura del Proyecto

El código fuente está rigurosamente organizado por función, con nombres en español y arquitectura desacoplada:

```
Rutinia/
├── assets/                     # Assets nativos móviles (iconos, splash screens, imágenes estáticas)
├── docs/                       # Documentación visual, especificaciones y mockups
│   └── diseno/                 # Diseños de alta fidelidad, paletas y logo final
├── public/                     # Archivos estáticos servidos en Web (manifest, favicons, PWA icons)
├── scripts/                    # Scripts de build, optimización y testing
│   ├── qa/                     # Scripts de pruebas automatizadas y capturas de regresión visual
│   ├── setup-canvaskit.js      # Descarga y provisión del binario CanvasKit WASM para Web
│   └── post-export.js          # Inyección de assets y optimizaciones tras la exportación web
├── src/                        # Código fuente de la aplicación
│   ├── app/                    # Rutas de navegación (Expo Router basado en el sistema de archivos)
│   ├── biblioteca/             # Instancias base y configuración de clientes (Supabase)
│   ├── componentes/            # Componentes de UI organizados por dominio funcional
│   ├── constantes/             # Tokens de diseño, tipografías, temas y colores
│   ├── hooks/                  # Hooks personalizados de React
│   ├── servicios/              # Capa de datos, consultas a Supabase y lógica de negocio
│   ├── tipos/                  # Definiciones de tipos e interfaces TypeScript
│   └── utilidades/             # Funciones utilitarias puras (haptics, cronómetros, offline)
├── supabase/                   # Scripts SQL versionados y ordenados
├── vercel.json                 # Configuración de despliegue y cabeceras SPA para Vercel
├── app.json                    # Manifiesto y configuración de Expo SDK 57
└── package.json                # Dependencias y scripts de ejecución
```

---

## 🗺️ Mapa de Rutas (`src/app/`)

Rutinia utiliza **Expo Router** para la navegación. Los nombres dentro de `src/app/` definen las URLs del enrutador:

| Archivo de Ruta | URL / Propósito | Descripción |
| :--- | :--- | :--- |
| `src/app/_layout.tsx` | Stack Raíz | Configuración global del Stack de navegación, temas y proveedores. |
| `src/app/+html.tsx` | Plantilla Web | HTML head, inyección de fuentes Google Fonts, meta tags y CanvasKit Skia. |
| `src/app/+not-found.tsx` | Fallback 404 | Pantalla mostrada ante rutas no existentes con redirección a inicio. |
| `src/app/(tabs)/_layout.tsx` | Tab Navigator | Barra de navegación inferior flotante con efecto spotlight (`BarraPestanasSpotlight`). |
| `src/app/(tabs)/index.tsx` | `/` (Hoy / Semana) | Pantalla principal. Carrusel 3D de la semana, rutina activa del día y accesos a sesiones. |
| `src/app/(tabs)/rutinas.tsx` | `/rutinas` | Catálogo de rutinas, creador interactivo, gestor de planes y selector de ejercicios. |
| `src/app/(tabs)/notas.tsx` | `/notas` | Libreta de notas de entrenamiento con filtrado de categorías y búsqueda. |
| `src/app/(tabs)/calendario.tsx` | `/calendario` | Historial de entrenamientos completados, mapa de consistencia y calendario interactivo. |
| `src/app/(tabs)/progreso.tsx` | `/progreso` | Analítica deportiva: heatmap muscular, cálculo de 1RM, evolución de volumen y récords personales (PRs). |

---

## 🧩 Desglose de `src/`

### 1. Componentes (`src/componentes/`)
Los componentes de interfaz están clasificados por contexto funcional en PascalCase:
- **`comunes/`**: Componentes visuales genéricos (`FondoPantalla`, `EncabezadoEditorial`, `EncabezadoSeccion`, `BotonBrillo`, `PanelBrillo`).
- **`navegacion/`**: Componentes de navegación y pestañas (`BarraPestanasSpotlight`, `DockPrincipal`, `PestanasSegmentadasSpotlight`).
- **`semana/`**: Componentes del tablero semanal (`TarjetaDiaPrincipal`, `CarruselSemana3D`, `DiaDetalleModal`, `CarruselEjerciciosHeader`).
- **`rutinas/`**: Componentes de gestión de rutinas (`TarjetaRutinaEnVivo`, `GestionarRutinaModal`, `GestionarPlanModal`).
- **`entrenamiento/`**: Modales de ejecución de sesión en vivo, tracking de descansos y feedback (`EjecutarEntrenamientoModal`, `ResumenEntrenamientoModal`, `HistorialEjercicioModal`, `HeroEjercicioActivo`, `TablaSeriesFocus`).
- **`biblioteca/`**: Selector y explorador de ejercicios (`SelectorBibliotecaModal`, `CrearListaSheet`, `TecladoTextoInteligente`).
- **`progreso/`**: Bloques modulares y primitivas visuales de analítica (`PrimitivasProgreso`).
- **`notas/`**: Elementos de notas (`RielCategoriasNotas`, `TarjetaNotaBiblioteca`).
- **`cuenta/`**: Modal de gestión de perfiles e inicio de sesión (`MenuOpcionesModal`).
- **`modales/`**: Diálogos globales (`ConfirmModalGlobal`).
- **`efectos/`**: Shaders y efectos avanzados de Skia/Reanimated (`BotonMetalLiquido`, `BotonYoungNewt`, `TextoBrillante`, `TextoGradiente`, `RutiniaLogo`, shaders en `boton-radiante/` y `metal-liquido/`).
- **`depuracion/`**: Utilidades de telemetría y viewport overlay (`DebugViewportOverlay`).

### 2. Servicios de Datos (`src/servicios/`)
Encapsulan las consultas a Supabase y la lógica transaccional:

| Archivo de Servicio | Tablas de Supabase Afectadas | Responsabilidad Principal |
| :--- | :--- | :--- |
| `rutinas.ts` | `rutinas`, `ejercicios_rutina`, `registros_entrenamiento`, `ejercicios_registro` | Carga, creación, duplicación, ordenamiento y asignación de rutinas. |
| `registros.ts` | `registros_entrenamiento`, `ejercicios_registro` | Guardado de sesiones en vivo, series, pesos, repeticiones y cálculo de PRs. |
| `planes.ts` | `planes_entrenamiento`, `rutinas`, `ejercicios_rutina`, `registros_entrenamiento`, `ejercicios_registro` | Gestión de planes integrales de entrenamiento a medio/largo plazo. |
| `notas.ts` | `notas` | CRUD de notas de texto enriquecido, categorías y fijación de elementos. |
| `favoritosBiblioteca.ts` | `favoritos_biblioteca`, `listas_biblioteca` | Marcado de ejercicios favoritos y colecciones personalizadas. |
| `catalogo.ts` | `ejercicios_catalogo` | Sincronización del catálogo base de ejercicios del sistema. |
| `cuentas.ts` | RPC `eliminar_mi_cuenta` | Sincronización de perfiles locales/nube y baja de cuenta. |
| `progreso.ts` | *(Cálculos en memoria)* | Algoritmos de estimación de 1RM (Epley/Brzycki), balance de volumen y fatiga muscular. |
| `bibliotecaEjercicios.ts` | *(Catálogo estático/tipos)* | Filtros por equipamiento, nivel, grupo muscular primario y secundario. |
| `ejerciciosGifs.ts` | *(Resolución de media)* | Mapeo y provisión de URLs de animaciones demostrativas de ejercicios. |

### 3. Biblioteca (`src/biblioteca/`)
- `supabase.ts`: Inicialización del cliente oficial `@supabase/supabase-js` con persistencia en `AsyncStorage` y detección de plataforma.

### 4. Utilidades (`src/utilidades/`)
- `almacenamientoLocal.ts`: Persistencia de borradores de entrenamiento y caché offline.
- `temporizador.ts`: Motores de cronómetro y temporizadores de descanso.
- `hapticos.ts`: Wrappers unificados de retroalimentación háptica adaptados para Móvil y Web.
- `calculadoraFuerza.ts`: Fórmulas de cálculo de tonelaje y 1RM.
- `fechas.ts`: Formateo y utilidades de fechas (días de la semana, ISO, marcas temporales).
- `errores.ts`: Manejador centralizado de errores de red y base de datos.
- `sesionActiva.ts`: Control de borrador y sesión en curso.
- `sincronizacion.ts`: Cola de sincronización para operaciones pendientes sin conexión.
- `notasSesion.ts`: Helpers para notas vinculadas a ejercicios durante la sesión.
- `usuario.ts`: Identificación y resolución de identificador de usuario activo.

### 5. Constantes (`src/constantes/`)
- `colores.ts`: Sistema de diseño con la paleta Obsidian Noir (`noir`), contrastes y tokens cromáticos.
- `tema.ts`: Configuraciones de espaciado, elevaciones y bordes redondeados.
- `entrenamiento.ts`: Tipos de series (calentamiento, efectiva, fallo, drop-set).
- `notas.ts`: Lista de categorías predeterminadas de notas.
- `noir.ts`: Tokens semánticos de modo oscuro y metales.

### 6. Tipos (`src/tipos/`)
- `index.ts`: Definición completa de tipos de datos (`Rutina`, `Ejercicio`, `SerieRegistro`, `Registro`, `Nota`, `PlanEntrenamiento`, `PerfilUsuario`).

---

## ☁️ Despliegue en Vercel

RutinIA está optimizada para desplegarse en **Vercel** como una Progressive Web Application (PWA) estática:

### Configuración en Vercel:
- **Framework Preset:** `Other`
- **Build Command:** `npm run build:web`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Pipeline de compilación:
1. `node scripts/setup-canvaskit.js`: Asegura que el archivo `canvaskit.wasm` necesario para Skia esté disponible en los assets de compilación.
2. `npx expo export -p web`: Exporta las 12 rutas de Expo Router en HTML estático y empaqueta los bundles de JS/CSS con optimización de producción.
3. `node scripts/post-export.js`: Copia los manifiestos, favicons y configura los títulos base.
4. `vercel.json`: Gestiona las rutas SPA para que cualquier refresco en rutas profundas (`/rutinas`, `/progreso`) sea resuelto correctamente por Expo Router.

---

## 📏 Convenciones del Proyecto

- **Nombres en Español:** Todos los módulos, carpetas y componentes deben nombrarse en español.
- **Convención de Nombres de Archivo:**
  - Componentes: `PascalCase.tsx` (ej. `TarjetaRutinaEnVivo.tsx`).
  - Estilos de componentes extraídos: `<NombreComponente>.estilos.ts` (ej. `TarjetaRutinaEnVivo.estilos.ts`).
  - Utilidades, servicios, hooks y constantes: `camelCase.ts` (ej. `hapticos.ts`, `catalogo.ts`, `useLayout.ts`).
  - Extensiones de plataforma: `*.web.tsx` para web y `*.native.tsx` para móvil.
- **Expo Router:**
  - Las rutas viven exclusivamente en `src/app/`.
  - No crear archivos que no sean pantallas dentro de `src/app/` (los componentes deben colocarse en `src/componentes/`).
- **Verificación:** Antes de cada commit, debe validarse que el proyecto compila sin errores:
  ```bash
  npx tsc --noEmit    # Typecheck
  npx expo lint       # Linter
  npm run build:web   # Exportación estática web
  ```
