# REFACTOR_PENDIENTES.md

Archivos y decisiones pendientes de acción futura.  
Generado durante `refactor/estructura`.

---

## Archivos con lógica entrelazada (no divididos en Fase 4)

> Estos archivos superan las ~1 500 líneas pero se dejan sin dividir
> hasta confirmar que las fases anteriores están verdes y se puede
> hacer revisión manual de cada pantalla afectada.

| Archivo | Líneas aprox. | Motivo de aplazamiento |
|---------|--------------|------------------------|
| `src/app/(tabs)/rutinas.tsx` | ~3 300 | Pantalla de rutinas muy acoplada; dividir requiere refactorizar estado local |
| `src/app/(tabs)/progreso.tsx` | ~2 000 | Gráficos y datos muy entrelazados |

---

## Componentes con nombre en inglés no renombrados (Fase 3b pendiente)

> Acordado: la Fase 3 solo reorganiza carpetas.
> El renombrado de archivos individuales queda aquí para una Fase 3b opcional.

| Nombre actual | Nombre propuesto | Ubicación |
|---------------|-----------------|-----------|
| `MainDayCard.tsx` | `TarjetaDiaPrincipal.tsx` | `componentes/semana/` |
| `SpotlightTabBar.tsx` | `BarraPestanasSpotlight.tsx` | `componentes/navegacion/` |
| `SpotlightSegmentedTabs.tsx` | `PestanasSegmentadas.tsx` | `componentes/navegacion/` |
| `EditorialHeader.tsx` | `EncabezadoEditorial.tsx` | `componentes/comunes/` |
| `GlowButton.tsx` | `BotonBrillo.tsx` | `componentes/efectos/` |
| `GlowPanel.tsx` | `PanelBrillo.tsx` | `componentes/efectos/` |
| `ScreenBackground.tsx` | `FondoPantalla.tsx` | `componentes/comunes/` |
| `SmartWorkoutKeyboard.tsx` | `TecladoInteligente.tsx` | `componentes/entrenamiento/` |
| `NotesCategoryRail.tsx` | `RielCategoriasNotas.tsx` | `componentes/notas/` |
| `Semana3DCarousel.tsx` | `CarruselSemana3D.tsx` | `componentes/semana/` |
| `LiquidMetalButton.tsx` | `BotonMetalLiquido.tsx` | `componentes/efectos/` |
| `YoungNewtButton.tsx` | `BotonYoungNewt.tsx` | `componentes/efectos/` |
| `YoungNewtButton.web.tsx` | `BotonYoungNewt.web.tsx` | `componentes/efectos/` |
| `DockPrincipal.tsx` | Ya en español | — |
| `liquid-metal/metal/` | `metal/` (ya movido) | `componentes/efectos/metal/` |
| `base/radiant-button/` | `base/boton-radiante/` | `componentes/efectos/` |
| `ProgressPrimitives.tsx` | `PrimitivasProgreso.tsx` | `componentes/progreso/` |
| `CarruselEjerciciosHeader.tsx` | Ya en español | — |
| `TablaSeriesFocus.tsx` | Ya en español | — |
| `HeroEjercicioActivo.tsx` | Ya en español | — |
| `HistorialEjercicioModal.tsx` | Ya en español | — |

---

## DebugViewportOverlay

Movido a `src/components/depuracion/DebugViewportOverlay.tsx`.  
Se elimina definitivamente después de la resolución del viewport (tarea del usuario).

---

## Dependencias en package.json no verificadas

Las siguientes dependencias no se buscaron en src/ de forma exhaustiva.
Verificar antes de desinstalar:

- `react-native-worklets` — usado internamente por react-native-reanimated
- `expo-glass-effect` — verificar si algún componente lo usa
- `expo-device` — posiblemente usado en useLayout o condiciones de plataforma

---

## artifacts/ en la raíz

Los siguientes archivos temporales se encuentran en `artifacts/` y se consideran
candidatos a eliminación en una limpieza futura:

- `artifacts/*.tmp` (rutinas-prefix.tmp, rutinas-return.tmp, rutinas-styles.tmp)
- `artifacts/splice-rutinas.mjs` — script temporal de edición
- Todas las capturas PNG/JSON de QA (`qa-*.png`, `qa-*.json`)
- GIFs de prueba (`cable-bar-lateral-pulldown.gif`)
