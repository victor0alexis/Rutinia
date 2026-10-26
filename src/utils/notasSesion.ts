/**
 * Notas de sesión y notas por ejercicio.
 *
 * La nota general de la sesión se guarda en `registros_entrenamiento.notas`.
 * Como esa columna es la única persistente del registro (sin depender del
 * almacenamiento local del dispositivo), ahí mismo añadimos un marcador
 * invisible con la duración real de la sesión.
 *
 * Las notas de cada ejercicio se guardan como filas 📌 dentro de
 * `ejercicios_registro`, de modo que la nota siempre viaja con el nombre del
 * ejercicio al que pertenece y se puede mostrar en Inicio y en el resumen.
 */

export const PREFIJO_OBSERVACIONES = '📌 [OBSERVACIONES] ';
export const PREFIJO_NOTA_EJERCICIO = '📌 [ENTRENAMIENTO] ';

const REGEX_DURACION = /\[\[RUTINIA_DURACION:(\d+)\]\]/g;

export type NotaSesionParseada = {
  nota: string;
  duracionSegundos: number;
};

/** Separa la nota visible del marcador interno de duración. */
export function parsearNotasSesion(raw?: string | null): NotaSesionParseada {
  if (!raw) return { nota: '', duracionSegundos: 0 };

  const match = raw.match(/\[\[RUTINIA_DURACION:(\d+)\]\]/);
  const duracionSegundos = match ? Number(match[1]) : 0;
  const nota = raw.replace(REGEX_DURACION, '').trim();

  return { nota, duracionSegundos };
}

/** Serializa la nota y la duración en el formato persistido en la BD. */
export function serializarNotasSesion(
  nota?: string | null,
  duracionSegundos?: number | null
): string | null {
  const texto = (nota || '').trim();
  const segundos = Math.max(0, Math.round(Number(duracionSegundos) || 0));
  const marcador = segundos > 0 ? `[[RUTINIA_DURACION:${segundos}]]` : '';

  if (!texto && !marcador) return null;
  return [texto, marcador].filter(Boolean).join('\n\n');
}

/** Título visible de una nota de ejercicio (sin caracteres que rompan el parser). */
function nombreVisibleEjercicio(nombre: string): string {
  return nombre.replace(/\s*:\s*/g, ' · ').trim();
}

export function formatearNotaEjercicio(nombreEjercicio: string, nota: string): string {
  return `${PREFIJO_NOTA_EJERCICIO}${nombreVisibleEjercicio(nombreEjercicio)}: ${nota.trim()}`;
}

export function parsearNotaEjercicio(fila: {
  nombre: string;
  ejercicio_nombre?: string | null;
}): { nombreEjercicio: string; nota: string } | null {
  if (!fila.nombre.startsWith(PREFIJO_NOTA_EJERCICIO)) return null;

  const contenido = fila.nombre.slice(PREFIJO_NOTA_EJERCICIO.length);
  if (fila.ejercicio_nombre) {
    const prefijo = `${nombreVisibleEjercicio(fila.ejercicio_nombre)}:`;
    const nota = contenido.startsWith(prefijo)
      ? contenido.slice(prefijo.length).trim()
      : contenido.split(': ').slice(1).join(': ').trim();
    return { nombreEjercicio: fila.ejercicio_nombre, nota };
  }

  const separador = contenido.indexOf(': ');
  if (separador < 0) {
    return { nombreEjercicio: contenido.trim(), nota: '' };
  }

  return {
    nombreEjercicio: contenido.slice(0, separador).trim(),
    nota: contenido.slice(separador + 2).trim(),
  };
}

export function esNotaDeEjercicio(nombre?: string | null): boolean {
  return Boolean(nombre && nombre.startsWith(PREFIJO_NOTA_EJERCICIO));
}
