import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EjercicioBiblioteca {
  id: string;
  slug: string;
  name: string;
  muscle: string;
  muscleLabel: string;
  bodyPart: string;
  equipment: string;
  equipmentLabel: string;
  category: string;
  secondaryMuscles: string[];
  instructions: string[];
  gifUrl: string;
}

export interface GrupoMuscularItem {
  id: string;
  nombre: string;
  icono: string;
  subtitulo: string;
}

export interface EquipamientoItem {
  id: string;
  nombre: string;
}

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0';
const STORAGE_KEY_BIBLIOTECA = '@rutinia_biblioteca_ejercicios_v1';
const STORAGE_KEY_TIMESTAMP = '@rutinia_biblioteca_timestamp_v1';

// Mapeo amigable de grupos musculares con iconos de Ionicons y etiquetas en español
export const GRUPOS_MUSCULARES: GrupoMuscularItem[] = [
  { id: 'todos', nombre: 'Todos', icono: 'grid-outline', subtitulo: 'Catálogo completo' },
  { id: 'pectorals', nombre: 'Pecho', icono: 'barbell-outline', subtitulo: 'Pectoral mayor y menor' },
  { id: 'delts', nombre: 'Hombros', icono: 'fitness-outline', subtitulo: 'Deltoides anterior, lateral y posterior' },
  { id: 'lats', nombre: 'Dorsales', icono: 'body-outline', subtitulo: 'Dorsal ancho y espalda media' },
  { id: 'upper-back', nombre: 'Espalda Alta', icono: 'body-outline', subtitulo: 'Romboides y trapecio medio' },
  { id: 'traps', nombre: 'Trapecios', icono: 'triangle-outline', subtitulo: 'Trapecio superior y cuello' },
  { id: 'biceps', nombre: 'Bíceps', icono: 'fitness-outline', subtitulo: 'Braquial y bíceps braquial' },
  { id: 'triceps', nombre: 'Tríceps', icono: 'flash-outline', subtitulo: 'Cabeza lateral, larga y medial' },
  { id: 'forearms', nombre: 'Antebrazos', icono: 'hand-left-outline', subtitulo: 'Flexores y extensores de muñeca' },
  { id: 'quads', nombre: 'Cuádriceps', icono: 'walk-outline', subtitulo: 'Recto femoral y vastos' },
  { id: 'hamstrings', nombre: 'Isquios', icono: 'walk-outline', subtitulo: 'Femorales y semitendinoso' },
  { id: 'glutes', nombre: 'Glúteos', icono: 'ellipse-outline', subtitulo: 'Glúteo mayor, medio y menor' },
  { id: 'calves', nombre: 'Gemelos', icono: 'footsteps-outline', subtitulo: 'Gastrocnemio y sóleo' },
  { id: 'abs', nombre: 'Abdomen', icono: 'shield-outline', subtitulo: 'Recto abdominal y oblicuos' },
  { id: 'spine', nombre: 'Lumbar', icono: 'body-outline', subtitulo: 'Erectores espinales' },
  { id: 'abductors', nombre: 'Abductores', icono: 'expand-outline', subtitulo: 'Separadores de cadera' },
  { id: 'adductors', nombre: 'Aductores', icono: 'contract-outline', subtitulo: 'Aproximadores de muslos' },
  { id: 'cardio', nombre: 'Cardio', icono: 'heart-outline', subtitulo: 'Acondicionamiento y resistencia' },
];

export const MAPA_GRUPOS: Record<string, string> = {
  pectorals: 'Pecho',
  delts: 'Hombros',
  lats: 'Dorsales',
  'upper-back': 'Espalda Alta',
  traps: 'Trapecios',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  quads: 'Cuádriceps',
  hamstrings: 'Isquios',
  glutes: 'Glúteos',
  calves: 'Gemelos',
  abs: 'Abdomen',
  spine: 'Lumbar',
  abductors: 'Abductores',
  adductors: 'Aductores',
  cardio: 'Cardio',
  'serratus-anterior': 'Serratos',
  'levator-scapulae': 'Cuello / Escápula',
};

export const MAPA_EQUIPOS: Record<string, string> = {
  dumbbell: 'Mancuerna',
  barbell: 'Barra',
  cable: 'Polea',
  lever: 'Máquina',
  machine: 'Máquina',
  smith: 'Máquina Smith',
  bodyweight: 'Peso Corporal',
  band: 'Banda Elástica',
  kettlebell: 'Pesa Rusa',
  'ez-bar': 'Barra Z',
  sled: 'Trineo',
  other: 'Otro',
};

export const LISTA_EQUIPAMIENTOS: EquipamientoItem[] = [
  { id: 'todos', nombre: 'Todo el equipo' },
  { id: 'dumbbell', nombre: 'Mancuernas' },
  { id: 'barbell', nombre: 'Barra' },
  { id: 'cable', nombre: 'Polea' },
  { id: 'lever', nombre: 'Máquina' },
  { id: 'smith', nombre: 'Smith' },
  { id: 'bodyweight', nombre: 'Peso Corporal' },
  { id: 'band', nombre: 'Banda' },
  { id: 'kettlebell', nombre: 'Kettlebell' },
  { id: 'ez-bar', nombre: 'Barra Z' },
];

/** Acentos visuales por grupo muscular. Se usan en chips, listas y tarjetas. */
export const COLORES_GRUPO: Record<string, string> = {
  todos: '#5CC8FF',
  pectorals: '#FF6B8A',
  delts: '#FFC15C',
  lats: '#5CC8FF',
  'upper-back': '#7FA6FF',
  traps: '#B394FF',
  biceps: '#5CE1B9',
  triceps: '#3FF2B0',
  forearms: '#A3E635',
  quads: '#FF9E7A',
  hamstrings: '#F7A8B8',
  glutes: '#FF8AD8',
  calves: '#7CF3FF',
  abs: '#FFD166',
  spine: '#A8B8D8',
  abductors: '#C4B5FD',
  adductors: '#F0A6CA',
  cardio: '#FF7A7A',
};

export function colorDeGrupo(grupo?: string): string {
  return (grupo && COLORES_GRUPO[grupo]) || COLORES_GRUPO.todos;
}

export type OrdenBiblioteca =
  | 'inteligente'
  | 'favoritos'
  | 'recientes'
  | 'az'
  | 'za';

export interface OpcionOrdenBiblioteca {
  id: OrdenBiblioteca;
  nombre: string;
  descripcion: string;
  icono: string;
}

export const ORDENES_BIBLIOTECA: OpcionOrdenBiblioteca[] = [
  {
    id: 'inteligente',
    nombre: 'Para ti',
    descripcion: 'Prioriza tus grupos y ejercicios habituales',
    icono: 'sparkles-outline',
  },
  {
    id: 'favoritos',
    nombre: 'Favoritos',
    descripcion: 'Tus ejercicios guardados primero',
    icono: 'heart-outline',
  },
  {
    id: 'recientes',
    nombre: 'Recientes',
    descripcion: 'Lo último que has consultado',
    icono: 'time-outline',
  },
  {
    id: 'az',
    nombre: 'A-Z',
    descripcion: 'Orden alfabético ascendente',
    icono: 'arrow-down-outline',
  },
  {
    id: 'za',
    nombre: 'Z-A',
    descripcion: 'Orden alfabético descendente',
    icono: 'arrow-up-outline',
  },
];

/** Alias cotidianos para que la búsqueda entienda cómo habla el usuario. */
const SINONIMOS_BUSQUEDA: Record<string, string[]> = {
  pecho: ['pectorals', 'pectoral', 'chest', 'banca', 'bench'],
  pectoral: ['pecho', 'pectorals', 'chest'],
  espalda: ['back', 'lats', 'dorsal', 'upper-back', 'traps'],
  dorsal: ['lats', 'espalda', 'back'],
  hombro: ['delts', 'deltoides', 'shoulder'],
  deltoide: ['delts', 'hombro', 'shoulder'],
  biceps: ['biceps', 'braquial'],
  triceps: ['triceps'],
  pierna: ['quads', 'hamstrings', 'glutes', 'calves', 'legs', 'piernas'],
  cuadriceps: ['quads', 'quadriceps'],
  femoral: ['hamstrings', 'isquios'],
  isquio: ['hamstrings', 'femoral'],
  gluteo: ['glutes', 'gluteos'],
  abdomen: ['abs', 'core', 'abdominales'],
  core: ['abs', 'abdomen'],
  mancuerna: ['dumbbell', 'mancuernas'],
  mancuernas: ['dumbbell', 'mancuerna'],
  barra: ['barbell', 'ez-bar'],
  polea: ['cable'],
  maquina: ['lever', 'machine', 'smith'],
  smith: ['smith', 'maquina'],
  peso: ['bodyweight', 'corporal'],
  corporal: ['bodyweight', 'peso'],
  banda: ['band', 'elastica'],
  elastica: ['band', 'banda'],
  kettlebell: ['kettlebell', 'rusa'],
  empuje: ['press', 'empuje'],
  jalon: ['pulldown'],
  dominada: ['pull-up', 'pullup'],
  sentadilla: ['squat'],
  curl: ['curl'],
};

/** Semilla inicial offline de alta frecuencia para respuesta inmediata sin red */
const EJERCICIOS_OFFLINE_BASE: EjercicioBiblioteca[] = [
  {
    id: 'pectorals/barbell-bench-press',
    slug: 'barbell-bench-press',
    name: 'Press de banca con barra',
    muscle: 'pectorals',
    muscleLabel: 'Pecho',
    bodyPart: 'chest',
    equipment: 'barbell',
    equipmentLabel: 'Barra',
    category: 'strength',
    secondaryMuscles: ['triceps', 'delts'],
    instructions: [
      'Túmbate en el banco con los ojos debajo de la barra y retracción escapular activa.',
      'Desengancha la barra y bájala controlada hacia el esternón medio.',
      'Empuja la barra con fuerza hacia arriba extendiendo los brazos sin perder el arco.',
    ],
    gifUrl: `${CDN_BASE}/pectorals/barbell-bench-press.gif`,
  },
  {
    id: 'delts/dumbbell-lateral-raise',
    slug: 'dumbbell-lateral-raise',
    name: 'Elevaciones laterales con mancuerna',
    muscle: 'delts',
    muscleLabel: 'Hombros',
    bodyPart: 'shoulders',
    equipment: 'dumbbell',
    equipmentLabel: 'Mancuerna',
    category: 'strength',
    secondaryMuscles: ['traps'],
    instructions: [
      'De pie, con las mancuernas a los lados y el torso ligeramente inclinado hacia adelante.',
      'Eleva los brazos hacia los laterales manteniendo una leve flexión de codos hasta la altura de los hombros.',
      'Aguanta un instante en el punto de máxima contracción sintiendo los deltoides laterales.',
      'Baja de manera controlada resistiendo la fase excéntrica.',
    ],
    gifUrl: `${CDN_BASE}/delts/dumbbell-lateral-raise.gif`,
  },
  {
    id: 'lats/pull-up',
    slug: 'pull-up',
    name: 'Dominadas pronas',
    muscle: 'lats',
    muscleLabel: 'Dorsales',
    bodyPart: 'back',
    equipment: 'bodyweight',
    equipmentLabel: 'Peso Corporal',
    category: 'strength',
    secondaryMuscles: ['biceps'],
    instructions: [
      'Agarre más ancho que los hombros con palmas hacia afuera.',
      'Inicia el tirón deprimiendo las escápulas y llevando el pecho hacia la barra.',
      'Supera la barra con la barbilla y desciende controlando hasta el estiramiento completo.',
    ],
    gifUrl: `${CDN_BASE}/lats/pull-up.gif`,
  },
  {
    id: 'quads/smith-squat',
    slug: 'smith-squat',
    name: 'Sentadilla en máquina Smith',
    muscle: 'quads',
    muscleLabel: 'Cuádriceps',
    bodyPart: 'legs',
    equipment: 'smith',
    equipmentLabel: 'Máquina Smith',
    category: 'strength',
    secondaryMuscles: ['glutes'],
    instructions: [
      'Coloca la barra sobre los trapecios y desengánchala rotando las muñecas.',
      'Coloca los pies al ancho de hombros ligeramente adelantados.',
      'Desciende de forma profunda flexionando rodillas y cadera manteniendo el pecho erguido.',
      'Empuja el suelo con fuerza desde los talones hasta regresar arriba.',
    ],
    gifUrl: `${CDN_BASE}/quads/smith-squat.gif`,
  },
  {
    id: 'hamstrings/lever-lying-leg-curl',
    slug: 'lever-lying-leg-curl',
    name: 'Curl femoral acostado en máquina',
    muscle: 'hamstrings',
    muscleLabel: 'Isquios',
    bodyPart: 'legs',
    equipment: 'lever',
    equipmentLabel: 'Máquina',
    category: 'strength',
    secondaryMuscles: ['calves'],
    instructions: [
      'Acuéstate boca abajo con el rodillo acolchado justo encima de los talones.',
      'Sujeta las agarraderas y mantén la pelvis firmemente apoyada contra el banco.',
      'Flexiona las rodillas subiendo los talones hacia los glúteos de forma potente.',
      'Controla la bajada en 2-3 segundos sin dejar que el peso descanse por completo.',
    ],
    gifUrl: `${CDN_BASE}/hamstrings/lever-lying-leg-curl.gif`,
  },
  {
    id: 'quads/lever-leg-extension',
    slug: 'lever-leg-extension',
    name: 'Extensión de cuádriceps en máquina',
    muscle: 'quads',
    muscleLabel: 'Cuádriceps',
    bodyPart: 'legs',
    equipment: 'lever',
    equipmentLabel: 'Máquina',
    category: 'strength',
    secondaryMuscles: [],
    instructions: [
      'Ajusta el respaldo para que la parte trasera de las rodillas coincida con el eje de giro.',
      'Coloca la almohadilla sobre la espinilla baja, justo encima de los tobillos.',
      'Extiende las piernas completamente contrayendo los cuádriceps en el punto alto.',
      'Desciende con cadencia lenta y controlada.',
    ],
    gifUrl: `${CDN_BASE}/quads/lever-leg-extension.gif`,
  },
  {
    id: 'biceps/dumbbell-bicep-curl',
    slug: 'dumbbell-bicep-curl',
    name: 'Curl de bíceps con mancuerna',
    muscle: 'biceps',
    muscleLabel: 'Bíceps',
    bodyPart: 'arms',
    equipment: 'dumbbell',
    equipmentLabel: 'Mancuerna',
    category: 'strength',
    secondaryMuscles: ['forearms'],
    instructions: [
      'De pie, con las mancuernas a los lados y codos pegados a los costados.',
      'Flexiona los brazos supinando la muñeca hasta apretar al máximo el bíceps arriba.',
      'Baja despacio estirando completamente el bíceps.',
    ],
    gifUrl: `${CDN_BASE}/biceps/dumbbell-bicep-curl.gif`,
  },
  {
    id: 'triceps/cable-pushdown',
    slug: 'cable-pushdown',
    name: 'Extensión de tríceps en polea alta',
    muscle: 'triceps',
    muscleLabel: 'Tríceps',
    bodyPart: 'arms',
    equipment: 'cable',
    equipmentLabel: 'Polea',
    category: 'strength',
    secondaryMuscles: [],
    instructions: [
      'Coloca los codos pegados a los costados y el torso ligeramente inclinado hacia adelante.',
      'Empuja la barra o cuerda hacia abajo bloqueando los codos al final del movimiento.',
      'Regresa lentamente hasta que los antebrazos superen la horizontal.',
    ],
    gifUrl: `${CDN_BASE}/triceps/cable-pushdown.gif`,
  },
];

// Estado en memoria para búsquedas instantáneas
let memoriaCatalogo: EjercicioBiblioteca[] = [...EJERCICIOS_OFFLINE_BASE];
let inicializado = false;
let promesaCarga: Promise<EjercicioBiblioteca[]> | null = null;

export function normalizarTextoBiblioteca(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

const normalizarTexto = normalizarTextoBiblioteca;

/**
 * Carga el catálogo completo de 1.323 ejercicios desde jsDelivr
 * o desde la caché local en AsyncStorage.
 */
export async function cargarBibliotecaEjercicios(): Promise<EjercicioBiblioteca[]> {
  if (inicializado && memoriaCatalogo.length > 50) {
    return memoriaCatalogo;
  }

  if (promesaCarga) {
    return promesaCarga;
  }

  promesaCarga = (async () => {
    try {
      // 1. Intentar leer de AsyncStorage primero (respuesta ultra rápida <5ms)
      const guardado = await AsyncStorage.getItem(STORAGE_KEY_BIBLIOTECA);
      if (guardado) {
        const parsed = JSON.parse(guardado) as EjercicioBiblioteca[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoriaCatalogo = parsed;
          inicializado = true;
          // Actualización en segundo plano silenciosa si pasó más de 7 días
          verificarActualizacionEnSegundoPlano();
          return memoriaCatalogo;
        }
      }

      // 2. Si no está en storage, consultar CDN de jsDelivr
      const res = await fetch(`${CDN_BASE}/api/es/exercises.json`);
      if (res.ok) {
        const data = await res.json();
        const listaRaw = (data.exercises || []) as any[];

        if (listaRaw.length > 0) {
          const procesados: EjercicioBiblioteca[] = listaRaw.map((ex) => {
            const muscleKey = ex.muscle || 'other';
            const equipKey = ex.equipment || 'other';
            const gifUrl = ex.gifUrl || `${CDN_BASE}/${ex.id}.gif`;

            return {
              id: ex.id || `${muscleKey}/${ex.slug}`,
              slug: ex.slug || '',
              name: ex.name || 'Ejercicio',
              muscle: muscleKey,
              muscleLabel: MAPA_GRUPOS[muscleKey] || muscleKey,
              bodyPart: ex.bodyPart || '',
              equipment: equipKey,
              equipmentLabel: MAPA_EQUIPOS[equipKey] || equipKey,
              category: ex.category || 'strength',
              secondaryMuscles: ex.secondaryMuscles || [],
              instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
              gifUrl,
            };
          });

          memoriaCatalogo = procesados;
          inicializado = true;

          AsyncStorage.setItem(STORAGE_KEY_BIBLIOTECA, JSON.stringify(procesados)).catch(() => {});
          AsyncStorage.setItem(STORAGE_KEY_TIMESTAMP, Date.now().toString()).catch(() => {});

          return memoriaCatalogo;
        }
      }
    } catch (err) {
      console.warn('[BibliotecaEjercicios] No se pudo cargar catálogo remoto, usando base local:', err);
    }

    inicializado = true;
    return memoriaCatalogo;
  })();

  const res = await promesaCarga;
  promesaCarga = null;
  return res;
}

/** Comprueba en segundo plano si hay actualización de versión sin bloquear la app */
async function verificarActualizacionEnSegundoPlano() {
  try {
    const timestampStr = await AsyncStorage.getItem(STORAGE_KEY_TIMESTAMP);
    const ahora = Date.now();
    const sieteDiasMs = 7 * 24 * 60 * 60 * 1000;

    if (!timestampStr || ahora - Number(timestampStr) > sieteDiasMs) {
      const res = await fetch(`${CDN_BASE}/api/es/exercises.json`);
      if (res.ok) {
        const data = await res.json();
        const listaRaw = (data.exercises || []) as any[];
        if (listaRaw.length > 0) {
          const procesados: EjercicioBiblioteca[] = listaRaw.map((ex) => {
            const muscleKey = ex.muscle || 'other';
            const equipKey = ex.equipment || 'other';
            return {
              id: ex.id || `${muscleKey}/${ex.slug}`,
              slug: ex.slug || '',
              name: ex.name || 'Ejercicio',
              muscle: muscleKey,
              muscleLabel: MAPA_GRUPOS[muscleKey] || muscleKey,
              bodyPart: ex.bodyPart || '',
              equipment: equipKey,
              equipmentLabel: MAPA_EQUIPOS[equipKey] || equipKey,
              category: ex.category || 'strength',
              secondaryMuscles: ex.secondaryMuscles || [],
              instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
              gifUrl: ex.gifUrl || `${CDN_BASE}/${ex.id}.gif`,
            };
          });
          memoriaCatalogo = procesados;
          await AsyncStorage.setItem(STORAGE_KEY_BIBLIOTECA, JSON.stringify(procesados));
          await AsyncStorage.setItem(STORAGE_KEY_TIMESTAMP, ahora.toString());
        }
      }
    }
  } catch {
    // Silencioso
  }
}

// Iniciar precarga perezosa
cargarBibliotecaEjercicios().catch(() => {});

interface IndiceBusquedaBiblioteca {
  nombre: string;
  musculo: string;
  musculoId: string;
  equipo: string;
  equipoId: string;
  id: string;
  secundarios: string;
}

const cacheIndices = new WeakMap<EjercicioBiblioteca, IndiceBusquedaBiblioteca>();

function obtenerIndiceBusqueda(item: EjercicioBiblioteca): IndiceBusquedaBiblioteca {
  const cacheado = cacheIndices.get(item);
  if (cacheado) return cacheado;

  const indice: IndiceBusquedaBiblioteca = {
    nombre: normalizarTexto(item.name),
    musculo: normalizarTexto(item.muscleLabel),
    musculoId: normalizarTexto(item.muscle),
    equipo: normalizarTexto(item.equipmentLabel),
    equipoId: normalizarTexto(item.equipment),
    id: normalizarTexto(item.id),
    secundarios: item.secondaryMuscles
      .map((musculo) => normalizarTexto(MAPA_GRUPOS[musculo] || musculo))
      .join(' '),
  };

  cacheIndices.set(item, indice);
  return indice;
}

function expandirPalabra(palabra: string): string[] {
  const alias = SINONIMOS_BUSQUEDA[palabra] || [];
  return Array.from(new Set([palabra, ...alias.map((a) => normalizarTexto(a))]));
}

function puntuarCoincidencia(item: EjercicioBiblioteca, palabras: string[]): number {
  const indice = obtenerIndiceBusqueda(item);
  const frase = palabras.join(' ');
  let puntuacion = 0;

  for (const palabra of palabras) {
    let mejor = 0;

    for (const variante of expandirPalabra(palabra)) {
      if (indice.nombre === variante) {
        mejor = Math.max(mejor, 90);
      } else if (indice.nombre.startsWith(variante)) {
        mejor = Math.max(mejor, 48);
      } else if (indice.nombre.includes(variante)) {
        mejor = Math.max(mejor, 32);
      }

      if (indice.musculo.includes(variante)) mejor = Math.max(mejor, 20);
      if (indice.musculoId.includes(variante)) mejor = Math.max(mejor, 19);
      if (indice.secundarios.includes(variante)) mejor = Math.max(mejor, 12);
      if (indice.equipo.includes(variante)) mejor = Math.max(mejor, 14);
      if (indice.equipoId.includes(variante)) mejor = Math.max(mejor, 13);
      if (indice.id.includes(variante)) mejor = Math.max(mejor, 8);
    }

    // Cada palabra debe encontrar alguna coincidencia (nombre, grupo, equipo o alias).
    if (mejor === 0) return 0;
    puntuacion += mejor;
  }

  if (frase.length > 0 && indice.nombre.includes(frase)) {
    puntuacion += 36;
  }

  return puntuacion;
}

function coincideEquipo(item: EjercicioBiblioteca, equipo: string): boolean {
  if (equipo === 'lever' || equipo === 'machine') {
    return item.equipment === 'lever' || item.equipment === 'machine';
  }
  if (equipo === 'smith') {
    return item.equipment === 'smith';
  }
  return item.equipment === equipo;
}

function calcularAfinidad(
  item: EjercicioBiblioteca,
  favoritosSet: Set<string>,
  gruposFavoritos: Map<string, number>,
  indiceReciente: Map<string, number>
): number {
  let afinidad = 0;

  if (favoritosSet.has(item.id)) afinidad += 48;

  afinidad += (gruposFavoritos.get(item.muscle) || 0) * 14;
  for (const secundario of item.secondaryMuscles) {
    afinidad += (gruposFavoritos.get(secundario) || 0) * 4;
  }

  const reciente = indiceReciente.get(item.id);
  if (reciente !== undefined) {
    afinidad += Math.max(6, 34 - reciente * 3);
  }

  return afinidad;
}

export interface FiltroBibliotecaParams {
  catalogo?: EjercicioBiblioteca[];
  busqueda?: string;
  /** Compatibilidad con la API anterior: un único grupo. */
  grupoMuscular?: string;
  /** Compatibilidad con la API anterior: un único equipo. */
  equipamiento?: string;
  gruposMusculares?: string[];
  equipamientos?: string[];
  soloFavoritos?: boolean;
  favoritos?: string[];
  recientes?: string[];
  orden?: OrdenBiblioteca;
  limite?: number;
}

/**
 * Filtra y ordena el catálogo combinando búsqueda difusa, varios grupos,
 * varios equipamientos, favoritos y señales de uso reciente.
 */
export function filtrarEjerciciosBiblioteca(params: FiltroBibliotecaParams): EjercicioBiblioteca[] {
  const lista = params.catalogo ?? memoriaCatalogo;
  const q = normalizarTexto(params.busqueda || '');
  const palabras = q.split(' ').filter((p) => p.length > 0);

  const grupos = new Set(
    [
      ...(params.gruposMusculares || []),
      ...(params.grupoMuscular ? [params.grupoMuscular] : []),
    ].filter((grupo) => grupo && grupo !== 'todos')
  );

  const equipos = new Set(
    [
      ...(params.equipamientos || []),
      ...(params.equipamiento ? [params.equipamiento] : []),
    ].filter((equipo) => equipo && equipo !== 'todos')
  );

  const favoritosSet = new Set(params.favoritos || []);
  const soloFavoritos = Boolean(params.soloFavoritos);
  const orden: OrdenBiblioteca = params.orden || 'inteligente';

  // Afinidad "Para ti": grupos que más aparecen en favoritos.
  const mapaCatalogo = new Map(lista.map((item) => [item.id, item]));
  const gruposFavoritos = new Map<string, number>();
  for (const id of params.favoritos || []) {
    const item = mapaCatalogo.get(id);
    if (!item) continue;
    gruposFavoritos.set(item.muscle, (gruposFavoritos.get(item.muscle) || 0) + 1);
  }

  const indiceReciente = new Map<string, number>();
  (params.recientes || []).forEach((id, index) => {
    if (!indiceReciente.has(id)) indiceReciente.set(id, index);
  });

  const resultados: {
    item: EjercicioBiblioteca;
    puntuacion: number;
    afinidad: number;
    posicion: number;
  }[] = [];

  lista.forEach((item, posicion) => {
    if (soloFavoritos && !favoritosSet.has(item.id)) return;

    if (grupos.size > 0) {
      const coincideGrupo =
        grupos.has(item.muscle) ||
        item.secondaryMuscles.some((secundario) => grupos.has(secundario));
      if (!coincideGrupo) return;
    }

    if (equipos.size > 0) {
      const coincideAlguno = Array.from(equipos).some((equipo) =>
        coincideEquipo(item, equipo)
      );
      if (!coincideAlguno) return;
    }

    const puntuacion = palabras.length > 0 ? puntuarCoincidencia(item, palabras) : 0;
    if (palabras.length > 0 && puntuacion === 0) return;

    resultados.push({
      item,
      puntuacion,
      afinidad: calcularAfinidad(
        item,
        favoritosSet,
        gruposFavoritos,
        indiceReciente
      ),
      posicion,
    });
  });

  resultados.sort((a, b) => {
    if (orden === 'az' || orden === 'za') {
      const comparacion = a.item.name.localeCompare(b.item.name, 'es', {
        sensitivity: 'base',
      });
      return orden === 'az' ? comparacion : -comparacion;
    }

    if (orden === 'recientes') {
      const posA = indiceReciente.get(a.item.id);
      const posB = indiceReciente.get(b.item.id);
      if (posA !== undefined && posB !== undefined) return posA - posB;
      if (posA !== undefined) return -1;
      if (posB !== undefined) return 1;
    }

    if (orden === 'favoritos') {
      const favA = favoritosSet.has(a.item.id) ? 1 : 0;
      const favB = favoritosSet.has(b.item.id) ? 1 : 0;
      if (favA !== favB) return favB - favA;
    }

    if (orden === 'inteligente' || orden === 'favoritos' || orden === 'recientes') {
      if (palabras.length > 0 && b.puntuacion !== a.puntuacion) {
        return b.puntuacion - a.puntuacion;
      }
      if (b.afinidad !== a.afinidad) return b.afinidad - a.afinidad;
    }

    // Con búsqueda activa, la relevancia manda incluso en órdenes manuales
    // cuando no hay un criterio alternativo que desempate.
    if (palabras.length > 0 && b.puntuacion !== a.puntuacion) {
      return b.puntuacion - a.puntuacion;
    }

    return a.posicion - b.posicion;
  });

  const fin =
    typeof params.limite === 'number' && params.limite > 0
      ? params.limite
      : resultados.length;

  return resultados.slice(0, fin).map((resultado) => resultado.item);
}

/**
 * Busca el ejercicio más representativo para un nombre dado (ej: para vincular con GIF)
 */
export function buscarEjercicioPorNombre(nombre: string): EjercicioBiblioteca | null {
  if (!nombre) return null;
  const norm = normalizarTexto(nombre);

  // Coincidencia exacta
  const exacto = memoriaCatalogo.find((e) => normalizarTexto(e.name) === norm);
  if (exacto) return exacto;

  // Coincidencia difusa
  const palabras = norm.split(' ').filter((p) => p.length > 2);
  let mejor: EjercicioBiblioteca | null = null;
  let maxCoincidencias = 0;

  for (const ex of memoriaCatalogo) {
    const exNorm = normalizarTexto(ex.name);
    let pts = 0;
    for (const p of palabras) {
      if (exNorm.includes(p)) pts += 1;
    }
    if (pts > maxCoincidencias) {
      maxCoincidencias = pts;
      mejor = ex;
    }
  }

  return maxCoincidencias >= 1 ? mejor : null;
}
