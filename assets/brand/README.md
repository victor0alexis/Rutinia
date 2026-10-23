# Rutinia — Sistema Meridiano

Kit de identidad visual. La marca ordena el movimiento de la app: una R con peso, plata fría y un único punto carmesí.

## La idea

- **Meridiano** — la R y su punto. El símbolo funciona solo, sin el nombre.
- **Órbita** — el anillo fino que aparece **solo** en el icono de la app.
- **Traza** — el sistema de wordmark: `RUTINIA` en Outfit 600, mayúsculas, tracking `0.18 em`, convertido a curvas.

El wordmark ya está trazado a curvas: el logo no depende de que Outfit esté instalada. Outfit se distribuye bajo SIL Open Font License.

## Archivos

### Símbolo
| Archivo | Uso |
| --- | --- |
| `rutinia-simbolo.svg` | Versión principal, para fondos oscuros |
| `rutinia-simbolo-1024.png` | PNG transparente, para splash o composición |
| `rutinia-simbolo-tinta.svg` | Versión para fondos claros |
| `rutinia-simbolo-blanco.svg` | Monocromo blanco, para estampado o un solo color |

### Wordmark
| Archivo | Uso |
| --- | --- |
| `rutinia-wordmark.svg` | Wordmark vectorial, plata |
| `rutinia-wordmark.png` | PNG transparente 1372 × 300 |
| `rutinia-wordmark-tinta.svg` | Versión para fondos claros |

### Lockups
| Archivo | Uso |
| --- | --- |
| `rutinia-lockup-horizontal.svg` / `.png` | Marca principal horizontal |
| `rutinia-lockup-vertical.svg` / `.png` | Versión apilada, para splash o formatos cuadrados |

### Icono de app
| Archivo | Uso |
| --- | --- |
| `rutinia-icono-app.svg` | Icono maestro con la órbita |
| `rutinia-icono-app-1024.png` | Icono de app 1024 × 1024 |
| `rutinia-icono-app-512.png` | Web / Android |
| `rutinia-icono-app-192.png` | Web |
| `rutinia-icono-app-180.png` | Apple touch icon |
| `rutinia-icono-app-64.png` | Favicon / accesos |
| `rutinia-icono-app-32.png` | Favicon |

### Presentación
| Archivo | Uso |
| --- | --- |
| `brand-sheet.html` | Hoja de marca autocontenida (fuentes embebidas) |
| `rutinia-brand-sheet.png` | Hoja de marca exportada |

## Reglas

1. **Un solo punto carmesí.** Vive únicamente en el contador de la R y en el icono. Nunca dos puntos.
2. **Nunca un fondo rojo.** El carmesí no se usa como superficie, botón, etiqueta ni bloque de color.
3. **La R manda.** El símbolo debe leerse solo desde 20 px. El wordmark no compite con él.
4. **Plata, no gris.** Mantener el degradado frío y el brillo puntual; no sustituirlo por gris plano.
5. **La órbita es solo del icono.** No añadir el anillo al símbolo, al lockup ni al wordmark.
6. **El color vuelve al dato.** Verde, ámbar y violeta son semánticos dentro de la app; no forman parte de la marca.
7. **El wordmark no lleva punto.** El acento pertenece al símbolo.

## Tamaños mínimos

| Pieza | Mínimo |
| --- | --- |
| Símbolo | 20 px de alto |
| Lockup horizontal | 140 px de ancho |
| Lockup vertical | 120 px de ancho |
| Icono de app | 32 px |

**Espacio de respeto:** 25 % de la altura del símbolo alrededor de la marca. No invadir con texto, bordes ni otros elementos.

## Paleta

| Token | Valor |
| --- | --- |
| Obsidiana | `#050608` |
| Obsidiana elevada | `#10141C` |
| Plata alta | `#F8FBFF` |
| Plata media | `#A9BAD0` |
| Plata baja | `#7B8CA4` |
| Carmesí | `#C2243D` |

El carmesí del punto puede reproducirse con el token `#C2243D`. El resto de la marca se construye con la escala de plata.

## No hacer

- No duplicar el punto ni usar otro color de acento en la marca.
- No poner la marca sobre rojo, carmesí o un fondo que compita con el punto.
- No aplicar la órbita al símbolo ni al lockup.
- No deformar, rotar, inclinar ni añadir sombras, biseles o contornos.
- No sustituir el degradado por plateado plano.
- No separar la R del punto en el símbolo.
- No usar el wordmark como botón o fondo.

## Integración en la app (cuando se apruebe)

- `assets/images/icon.png` ← `rutinia-icono-app-1024.png`
- `assets/images/splash-icon.png` ← `rutinia-simbolo-1024.png`, fondo `#050608`
- `public/icon-192.png` ← `rutinia-icono-app-192.png`
- `public/icon-512.png` ← `rutinia-icono-app-512.png`
- `public/apple-touch-icon.png` ← `rutinia-icono-app-180.png`
- `public/favicon.png` ← `rutinia-icono-app-64.png`

No editar `ios/` ni `android/` a mano: la configuración nativa va en `app.json` y en los config plugins de Expo.
