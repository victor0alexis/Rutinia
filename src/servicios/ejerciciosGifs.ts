import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizarTexto } from '../utilidades/texto';

export interface EjercicioGifInfo {
  id: string;
  slug: string;
  name: string;
  muscle: string;
  bodyPart: string;
  equipment: string;
  instructions: string[];
  gifUrl: string;
  thumbUrl: string;
}

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0';
const STORAGE_KEY = '@rutinia_gym_gifs_cache_v2';

/**
 * Mapeo curado de alta prioridad para ejercicios comunes en Rutinia.
 * Garantiza respuesta inmediata (<1ms) y 100% precisa incluso offline.
 */
const DICCIONARIO_POPULARES: Record<string, Partial<EjercicioGifInfo>> = {
  'elevaciones laterales': {
    id: 'delts/dumbbell-lateral-raise',
    slug: 'dumbbell-lateral-raise',
    name: 'Elevaciones Laterales con Mancuerna',
    muscle: 'delts',
    bodyPart: 'shoulders',
    equipment: 'dumbbell',
    instructions: [
      'De pie, con las mancuernas a los lados y el torso ligeramente inclinado hacia adelante.',
      'Eleva los brazos hacia los laterales manteniendo una leve flexión de codos hasta la altura de los hombros.',
      'Aguanta un instante en el punto de máxima contracción sintiendo los deltoides laterales.',
      'Baja de manera controlada resistiendo la fase excéntrica.',
    ],
  },
  'isquio horizontal': {
    id: 'hamstrings/lever-lying-leg-curl',
    slug: 'lever-lying-leg-curl',
    name: 'Curl Femoral Acostado (Isquio Horizontal)',
    muscle: 'hamstrings',
    bodyPart: 'legs',
    equipment: 'lever',
    instructions: [
      'Acuéstate boca abajo con el rodillo acolchado justo encima de los talones.',
      'Sujeta las agarraderas y mantén la pelvis firmemente apoyada contra el banco.',
      'Flexiona las rodillas subiendo los talones hacia los glúteos de forma potente.',
      'Controla la bajada en 2-3 segundos sin dejar que el peso descanse por completo.',
    ],
  },
  'sentadilla smith': {
    id: 'quads/smith-squat',
    slug: 'smith-squat',
    name: 'Sentadilla en Máquina Smith',
    muscle: 'quads',
    bodyPart: 'legs',
    equipment: 'smith',
    instructions: [
      'Coloca la barra sobre los trapecios y desengánchala rotando las muñecas.',
      'Coloca los pies al ancho de hombros ligeramente adelantados respecto a la barra.',
      'Desciende de forma profunda flexionando rodillas y cadera manteniendo el pecho erguido.',
      'Empuja el suelo con fuerza desde los talones hasta regresar arriba sin bloquear rodillas.',
    ],
  },
  'extension cuadriceps': {
    id: 'quads/lever-leg-extension',
    slug: 'lever-leg-extension',
    name: 'Extensión de Cuádriceps en Máquina',
    muscle: 'quads',
    bodyPart: 'legs',
    equipment: 'lever',
    instructions: [
      'Ajusta el respaldo para que la parte trasera de las rodillas coincida con el eje de giro.',
      'Coloca la almohadilla sobre la espinilla baja, justo encima de los tobillos.',
      'Extiende las piernas completamente contrayendo los cuádriceps en el punto alto.',
      'Desciende con cadencia lenta y controlada.',
    ],
  },
  'abductor': {
    id: 'abductors/lever-seated-hip-abduction',
    slug: 'lever-seated-hip-abduction',
    name: 'Abductores en Máquina (Sentado)',
    muscle: 'abductors',
    bodyPart: 'legs',
    equipment: 'lever',
    instructions: [
      'Siéntate con la espalda apoyada y los cojines colocados en la parte exterior de los muslos.',
      'Abre las piernas separando los muslos contra la resistencia de las placas.',
      'Haz una pausa de 1 segundo en máxima apertura sintiendo el glúteo medio.',
      'Cierra despacio resistiendo la fase excéntrica.',
    ],
  },
  'pantorrillas': {
    id: 'calves/standing-calf-raise',
    slug: 'standing-calf-raise',
    name: 'Elevación de Talones de Pie (Pantorrillas)',
    muscle: 'calves',
    bodyPart: 'legs',
    equipment: 'bodyweight',
    instructions: [
      'Apoya la punta de los pies en un escalón con los talones colgando en el aire.',
      'Deja caer los talones para estirar profundamente el gemelo y tendón de Aquiles.',
      'Eleva el cuerpo sobre la punta de los dedos apretando al máximo arriba.',
      'Baja despacio manteniendo el control en todo el rango de movimiento.',
    ],
  },
  'press banca': {
    id: 'pectorals/barbell-bench-press',
    slug: 'barbell-bench-press',
    name: 'Press de Banca con Barra',
    muscle: 'pectorals',
    bodyPart: 'chest',
    equipment: 'barbell',
    instructions: [
      'Túmbate en el banco con los ojos debajo de la barra y retracción escapular activa.',
      'Desengancha la barra y bájala controlada hacia el esternón medio.',
      'Empuja la barra con fuerza hacia arriba extendiendo los brazos sin perder el arco.',
    ],
  },
  'press militar': {
    id: 'delts/barbell-standing-overhead-press',
    slug: 'barbell-standing-overhead-press',
    name: 'Press Militar con Barra',
    muscle: 'delts',
    bodyPart: 'shoulders',
    equipment: 'barbell',
    instructions: [
      'Barra a la altura de las clavículas con codos debajo de las muñecas.',
      'Aprieta glúteos y abdomen, y empuja la barra verticalmente por encima de la cabeza.',
      'Bloquea arriba con la cabeza pasando ligeramente hacia adelante.',
    ],
  },
  'dominadas': {
    id: 'lats/pull-up',
    slug: 'pull-up',
    name: 'Dominadas Pronas (Pull-ups)',
    muscle: 'lats',
    bodyPart: 'back',
    equipment: 'pull-up bar',
    instructions: [
      'Agarre más ancho que los hombros con palmas hacia afuera.',
      'Inicia el tirón deprimiendo las escápulas y llevando el pecho hacia la barra.',
      'Supera la barra con la barbilla y desciende controlando hasta el estiramiento completo.',
    ],
  },
  'curl biceps': {
    id: 'biceps/dumbbell-bicep-curl',
    slug: 'dumbbell-bicep-curl',
    name: 'Curl de Bíceps con Mancuerna',
    muscle: 'biceps',
    bodyPart: 'arms',
    equipment: 'dumbbell',
    instructions: [
      'De pie, con las mancuernas a los lados y codos pegados a los costados.',
      'Flexiona los brazos supinando la muñeca hasta apretar al máximo el bíceps arriba.',
      'Baja despacio estirando completamente el bíceps.',
    ],
  },
};

/** Cache en memoria del catálogo completo */
let catalogoCompleto: EjercicioGifInfo[] | null = null;
let peticionEnCurso: Promise<EjercicioGifInfo[]> | null = null;

/**
 * Carga el catálogo completo de 1,323 ejercicios en segundo plano
 */
async function cargarCatalogoCompleto(): Promise<EjercicioGifInfo[]> {
  if (catalogoCompleto) return catalogoCompleto;
  if (peticionEnCurso) return peticionEnCurso;

  peticionEnCurso = (async () => {
    try {
      // 1. Intentar leer de AsyncStorage primero
      const guardado = await AsyncStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado) as EjercicioGifInfo[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          catalogoCompleto = parsed.map((ex) => ({
            ...ex,
            gifUrl: ex.gifUrl || `${CDN_BASE}/${ex.id}.gif`,
            thumbUrl: ex.thumbUrl || `${CDN_BASE}/${ex.id}.thumb.webp`,
          }));
          return catalogoCompleto;
        }
      }

      // 2. Si no está en storage, consultar CDN de jsDelivr
      const res = await fetch(`${CDN_BASE}/api/es/exercises.json`);
      if (res.ok) {
        const data = await res.json();
        const listaRaw = (data.exercises || []) as any[];
        if (listaRaw.length > 0) {
          const lista: EjercicioGifInfo[] = listaRaw.map((ex) => ({
            id: ex.id,
            slug: ex.slug || ex.id.split('/')[1] || ex.id,
            name: ex.name,
            muscle: ex.muscle,
            bodyPart: ex.bodyPart || ex.muscle,
            equipment: ex.equipment || 'bodyweight',
            instructions: Array.isArray(ex.instructions) ? ex.instructions : [],
            gifUrl: ex.gifUrl || `${CDN_BASE}/${ex.id}.gif`,
            thumbUrl: ex.thumbUrl || ex.gifUrl || `${CDN_BASE}/${ex.id}.gif`,
          }));
          catalogoCompleto = lista;
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista)).catch(() => {});
          return catalogoCompleto;
        }
      }
    } catch {
      // Fallback silencioso si no hay conexión
    }

    return [];
  })();

  const resultado = await peticionEnCurso;
  peticionEnCurso = null;
  return resultado;
}

// Iniciar precarga en segundo plano al importar
cargarCatalogoCompleto().catch(() => {});

/**
 * Obtiene la información anatómica, GIF y miniaturas de un ejercicio por su nombre.
 * Respuesta instantánea sincrónica respaldada por el diccionario curado + búsqueda difusa.
 */
export function obtenerGifEjercicio(nombreEjercicio: string): EjercicioGifInfo {
  const norm = normalizarTexto(nombreEjercicio);

  // 1. Verificación directa en el diccionario curado
  for (const [clave, datos] of Object.entries(DICCIONARIO_POPULARES)) {
    if (norm.includes(normalizarTexto(clave)) || normalizarTexto(clave).includes(norm)) {
      const id = datos.id || 'delts/dumbbell-lateral-raise';
      return {
        id,
        slug: datos.slug || id.split('/')[1] || id,
        name: datos.name || nombreEjercicio,
        muscle: datos.muscle || 'delts',
        bodyPart: datos.bodyPart || 'shoulders',
        equipment: datos.equipment || 'dumbbell',
        instructions: datos.instructions || [
          'Ejecuta el ejercicio con postura controlada y rango completo.',
          'Mantén la tensión en el músculo objetivo durante la fase concéntrica y excéntrica.',
        ],
        gifUrl: `${CDN_BASE}/${id}.gif`,
        thumbUrl: `${CDN_BASE}/${id}.gif`,
      };
    }
  }

  // 2. Búsqueda en el catálogo completo si ya está cargado en memoria
  if (catalogoCompleto && catalogoCompleto.length > 0) {
    const palabras = norm.split(' ').filter((p) => p.length > 3);

    // Coincidencia exacta o por palabras clave
    let mejorMatch: EjercicioGifInfo | null = null;
    let mejorPuntuacion = 0;

    for (const ex of catalogoCompleto) {
      const nEx = normalizarTexto(ex.name);
      let puntuacion = 0;

      if (nEx === norm) {
        puntuacion += 100;
      }

      for (const p of palabras) {
        if (nEx.includes(p)) puntuacion += 10;
        if (ex.id.includes(p)) puntuacion += 15;
      }

      if (puntuacion > mejorPuntuacion) {
        mejorPuntuacion = puntuacion;
        mejorMatch = ex;
      }
    }

    if (mejorMatch && mejorPuntuacion > 10) {
      return {
        ...mejorMatch,
        gifUrl: mejorMatch.gifUrl || `${CDN_BASE}/${mejorMatch.id}.gif`,
        thumbUrl: mejorMatch.thumbUrl || mejorMatch.gifUrl || `${CDN_BASE}/${mejorMatch.id}.gif`,
      };
    }
  }

  // 3. Fallback inteligente por grupo muscular según palabras clave
  let fallbackId = 'delts/dumbbell-lateral-raise';
  let muscle = 'shoulders';
  if (norm.includes('pecho') || norm.includes('banca') || norm.includes('chest') || norm.includes('apertura')) {
    fallbackId = 'pectorals/barbell-bench-press';
    muscle = 'chest';
  } else if (norm.includes('espalda') || norm.includes('remo') || norm.includes('jalon') || norm.includes('dominada')) {
    fallbackId = 'lats/pull-up';
    muscle = 'back';
  } else if (norm.includes('pierna') || norm.includes('cuadricep') || norm.includes('sentadilla') || norm.includes('squat') || norm.includes('prensa')) {
    fallbackId = 'quads/smith-squat';
    muscle = 'legs';
  } else if (norm.includes('femoral') || norm.includes('isquio') || norm.includes('muerto')) {
    fallbackId = 'hamstrings/lever-lying-leg-curl';
    muscle = 'hamstrings';
  } else if (norm.includes('bicep') || norm.includes('brazo')) {
    fallbackId = 'biceps/dumbbell-bicep-curl';
    muscle = 'arms';
  } else if (norm.includes('tricep') || norm.includes('fondo')) {
    fallbackId = 'triceps/cable-pushdown';
    muscle = 'triceps';
  }

  return {
    id: fallbackId,
    slug: fallbackId.split('/')[1] || fallbackId,
    name: nombreEjercicio,
    muscle,
    bodyPart: muscle,
    equipment: 'machine',
    instructions: [
      'Mantén la columna neutra y el core activo durante todo el recorrido.',
      'Controla la fase excéntrica (bajada) en 2 a 3 segundos.',
      'Aplica fuerza continua en la fase concéntrica (subida).',
    ],
    gifUrl: `${CDN_BASE}/${fallbackId}.gif`,
    thumbUrl: `${CDN_BASE}/${fallbackId}.gif`,
  };
}
