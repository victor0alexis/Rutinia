# REFACTOR_PENDIENTES.md

Registro de decisiones técnicas, deuda de arquitectura y sugerencias de refactorización profunda para RutinIA.  
Actualizado tras la ejecución del refactor estructural (`refactor/estructura`).

---

## 1. Pantallas de Rutas con Estado Fuertemente Entrelazado

> **Regla de oro de Expo Router:**  
> Las rutas en `src/app/` representan pantallas de navegación. En Fase 4 se mantuvieron intactas para garantizar cero riesgo de regresión en reactividad, sincronización de estado y montajes de Expo Router.

| Ruta | Líneas aprox. | Responsabilidades y Motivo de Aplazamiento |
| :--- | :--- | :--- |
| `src/app/(tabs)/rutinas.tsx` | ~3 280 | Pantalla de catálogo y gestión de rutinas. Tiene fuertemente entrelazados: estado de filtros, arrastrar y reordenar días/ejercicios, apertura de múltiples modales (edición, duplicación, cambio de plan), buscador interactivo y tarjeta de rutina activa. Separar lógica requiere un hook o store de estado (`useGestionRutinas`). |
| `src/app/(tabs)/progreso.tsx` | ~2 010 | Pantalla analítica de progreso. Agrupa gráficos de volumen, cálculo dinámico de 1RM, heatmaps de grupos musculares, selector de rangos de fecha y lista de PRs recientes. Mantenerlo íntegro previno desincronizaciones en el renderizado web/móvil. |
| `src/app/(tabs)/notas.tsx` | ~1 170 | Libreta de notas de entrenamiento con filtrado por categorías, búsqueda en tiempo real, edición inline y confirmaciones de borrado. |

### Propuesta de Refactorización Futura:
1. **Desacoplar el Estado de las Pantallas:**
   - Crear un hook contenedor para cada pantalla: `usePantallaRutinas.ts` y `usePantallaProgreso.ts` dentro de `src/hooks/`.
2. **Dividir en Subcomponentes Dedicados:**
   - Extraer secciones visuales a `src/componentes/rutinas/` (ej. `FiltrosCategoriasRutinas.tsx`, `SeccionRutinaActiva.tsx`) y `src/componentes/progreso/` (ej. `MapaCalorMuscular.tsx`, `GraficoVolumenSemanal.tsx`).
3. **Extraer Estilos de Rutas:**
   - Una vez desacoplados los componentes, extraer los bloques de estilos a archivos independientes o usar el sistema de tokens común.

---

## 2. Modales Gigantes de Entrenamiento (Estilos Ya Extraídos)

> En la **Fase 4**, los bloques de `StyleSheet.create` de estos componentes fueron exitosamente extraídos a archivos `.estilos.ts`, reduciendo entre 700 y 1 400 líneas por archivo. La lógica interna de negocio permanece funcionalmente idéntica.

| Componente | Líneas Lógica | Estilos Extraídos | Estado Interno Entrelazado |
| :--- | :--- | :--- | :--- |
| `EjecutarEntrenamientoModal.tsx` | ~2 620 | `EjecutarEntrenamientoModal.estilos.ts` (1 369 lín.) | Cronómetro en vivo de descanso, cálculo de placas (plate calculator), registro de RPE/RIR por serie, persistencia de borrador local, audio cues y shaders de Skia. |
| `SelectorBibliotecaModal.tsx` | ~2 015 | `SelectorBibliotecaModal.estilos.ts` (1 027 lín.) | Catálogo con categorización multi-músculo, pestañas de búsqueda, modal secundario para crear ejercicios personalizados y vista previa de animaciones. |
| `GestionarRutinaModal.tsx` | ~1 550 | `GestionarRutinaModal.estilos.ts` (720 lín.) | Edición en vivo de bloques de entrenamiento, asignación semanal y target sets. |

### Propuesta de Refactorización Futura:
- **Hook de Sesión Activa:** Migrar el estado de entrenamiento a un hook desacoplado `useSesionEntrenamiento.ts` para separar la máquina de estados de las series de la capa de presentación.
- **Micro-componentes de Entrenamiento:** Descomponer `EjecutarEntrenamientoModal` en `BarraControlTiempo.tsx`, `SelectorDiscosCalculadora.tsx` y `FilaSerieEntrenamiento.tsx`.

---

## 3. Componentes de Depuración

- `src/componentes/depuracion/DebugViewportOverlay.tsx`:  
  Componente auxiliar utilizado para monitorear en tiempo real las dimensiones del viewport, insets de SafeArea, orientación y ratio de escala en Web y Móvil.
  - **Acción recomendada:** Mantener en desarrollo. Desactivar o retirar antes del lanzamiento final de producción.

---

## 4. Auditoría de Dependencias (`package.json`)

Se recomienda validar periódicamente la necesidad de los siguientes paquetes en futuras versiones del SDK de Expo:
- `expo-device`: Evaluar si las detecciones de plataforma y hardware pueden simplificarse con las APIs nativas de `Platform.OS` y `react-native`.
- `react-native-worklets`: Gestionado como dependencia interna de `react-native-reanimated`.
- `expo-glass-effect`: Validar adopción completa en los componentes de liquid metal y glassmorphism.

---

## 5. Fase 1: Limpieza de Código y Duplicados

### Archivos y símbolos eliminados

- `src/servicios/catalogo.ts`: no tenía importadores estáticos, dinámicos ni referencias por cadena. Sus tipos asociados (`EjercicioCatalogo`) también se eliminaron.
- `duplicarRutina` (`src/servicios/rutinas.ts`): duplicaba la responsabilidad de `duplicarRutinaEnPlan` (`src/servicios/planes.ts`) y no se usaba.
- `buscarEjercicioPorNombre` (`src/servicios/bibliotecaEjercicios.ts`), `restaurarPlan` y `obtenerUltimoPlanUsadoId` (`src/servicios/planes.ts`), `alternarEjercicio` (`src/servicios/registros.ts`) y `cerrarModalGlobal` (`src/utilidades/errores.ts`): sin referencias.
- Se retiraron exports sin consumidores y se conservaron como locales los símbolos que seguían usándose internamente.

### Duplicados consolidados

- `normalizar` de `src/servicios/ejerciciosGifs.ts` y `normalizarTextoBiblioteca` de `src/servicios/bibliotecaEjercicios.ts` eran idénticos. Ahora ambos usan `normalizarTexto` en `src/utilidades/texto.ts`.
- `src/constantes/notas.ts` usa los micro-acentos de `noir` (`platinum`, `mint`, `lavender`, `champagne`, `info`) en lugar de repetir sus hexadecimales.
- `COLORES_PLANES` en `src/constantes/colores.ts` usa `tema.fondo.auroraCarmesi` y `tema.colores.violeta` para los dos colores que ya existían como tokens.

### Duplicados pendientes (no consolidados)

- `normalizarNombreEjercicio` existe en `src/servicios/rutinas.ts` y `src/servicios/registros.ts`, pero tienen semánticas distintas: rutinas usa `parsearEjercicioInfo`; registros elimina tildes y plurales simples. Unificarlos requiere pruebas de regresión de búsqueda y herencia.
- `calcular1RMEstimado` (`src/utilidades/calculadoraFuerza.ts`) y `calcularE1RM` (`src/servicios/registros.ts`) aplican fórmulas y topes diferentes. Mantener separados hasta validar una única fórmula de producto.
- `formatearTiempo` y `formatearTiempoTexto` (`src/utilidades/temporizador.ts`) tienen formatos distintos (`mm:ss` frente a texto humano). No son duplicados reales.
- `formatearFecha` está definido localmente en `src/componentes/entrenamiento/HistorialEjercicioModal.tsx`; candidato a moverse a `src/utilidades/fechas.ts` si se reutiliza.
- `obtenerTemaNota` en `src/componentes/semana/TarjetaDiaPrincipal.tsx` repite hexadecimales de `noir`; se puede migrar a tokens cuando se revise esa tarjeta.
- `noir.text`/`noir.pearl` comparten el mismo hexadecimal, y `tema` repite `#2BD598` y `#22D3EE` en tokens distintos. No se tocaron para no introducir referencias circulares dentro de los objetos de tokens.

### Auditoría de `src/componentes/efectos/`

Todas las variantes tienen consumidor real y se conservaron:

- `boton-radiante/index.tsx` (nativo), `index.web.tsx` (web), `boton-radiante-skia.tsx` (nativo y web) y `boton-radiante-fallback.web.tsx` (web y red de seguridad).
- `metal-liquido/ShaderMetalLiquido.tsx` (nativo) y `.web.tsx` (web).
- `metal-liquido/metal/index.tsx` (nativo), `index.web.tsx` (web) y `metal-skia.tsx` (implementación compartida).
- `TextoBrillante.tsx`/`.web.tsx` y `TextoGradiente.tsx`/`.web.tsx`, junto con sus CSS.

Solo se retiraron re-exports y defaults sin consumidores; no se eliminó ninguna implementación por plataforma.
