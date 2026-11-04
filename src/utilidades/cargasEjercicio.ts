import type { CargaSerie, DiscoPorLado, TipoCarga } from '../tipos';
import { calcularDiscosPorLado, calcularPesoTotalConDiscos } from './calculadoraFuerza';
import { leerLocal, escribirLocal } from './almacenamientoLocal';

export interface PreferenciaCargaEjercicio {
  tipo: TipoCarga;
  pesoBarra: number;
  pesoBase: number;
  kgPorPlaca: number | null;
  discosDisponibles: number[];
}

export type PreferenciasCargaPorEjercicio = Record<string, PreferenciaCargaEjercicio>;

export const DISCOS_DISPONIBLES_POR_DEFECTO = [25, 20, 15, 10, 5, 2.5, 1.25];
const SUFIJO_PREFERENCIAS_CARGA = 'preferencias_carga_ejercicio_v1';

export const PREFERENCIA_CARGA_POR_DEFECTO: PreferenciaCargaEjercicio = {
  tipo: 'kg',
  pesoBarra: 20,
  pesoBase: 0,
  kgPorPlaca: null,
  discosDisponibles: DISCOS_DISPONIBLES_POR_DEFECTO,
};

export function normalizarNombreParaPreferencia(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function esTipoCarga(valor: unknown): valor is TipoCarga {
  return valor === 'kg' || valor === 'placas' || valor === 'discos_barra' || valor === 'discos_maquina';
}

export function normalizarPreferenciaCarga(
  preferencia?: Partial<PreferenciaCargaEjercicio> | null
): PreferenciaCargaEjercicio {
  const disponibles = Array.isArray(preferencia?.discosDisponibles)
    ? preferencia.discosDisponibles
        .map(Number)
        .filter((peso) => Number.isFinite(peso) && peso > 0)
    : DISCOS_DISPONIBLES_POR_DEFECTO;
  const kgPorPlaca = Number(preferencia?.kgPorPlaca);
  return {
    tipo: esTipoCarga(preferencia?.tipo) ? preferencia.tipo : 'kg',
    pesoBarra: Number.isFinite(Number(preferencia?.pesoBarra)) && Number(preferencia?.pesoBarra) >= 0
      ? Number(preferencia?.pesoBarra)
      : 20,
    pesoBase: Number.isFinite(Number(preferencia?.pesoBase)) && Number(preferencia?.pesoBase) >= 0
      ? Number(preferencia?.pesoBase)
      : 0,
    kgPorPlaca: Number.isFinite(kgPorPlaca) && kgPorPlaca > 0 ? kgPorPlaca : null,
    discosDisponibles: [...new Set(disponibles)].sort((a, b) => b - a),
  };
}

export async function leerPreferenciasCarga(): Promise<PreferenciasCargaPorEjercicio> {
  const raw = await leerLocal(SUFIJO_PREFERENCIAS_CARGA);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([nombre, valor]) => [
        nombre,
        normalizarPreferenciaCarga(valor as Partial<PreferenciaCargaEjercicio>),
      ])
    );
  } catch {
    return {};
  }
}

export async function guardarPreferenciaCarga(
  nombreEjercicio: string,
  preferencia: PreferenciaCargaEjercicio
): Promise<void> {
  const claveNombre = normalizarNombreParaPreferencia(nombreEjercicio);
  if (!claveNombre) return;
  const preferencias = await leerPreferenciasCarga();
  preferencias[claveNombre] = normalizarPreferenciaCarga(preferencia);
  await escribirLocal(SUFIJO_PREFERENCIAS_CARGA, JSON.stringify(preferencias));
}

export function calcularKgDesdeCarga(
  carga: CargaSerie,
  preferencia: PreferenciaCargaEjercicio
): number | null {
  if (carga.tipo === 'kg') return null;
  if (carga.tipo === 'placas') {
    if (!preferencia.kgPorPlaca || !Number.isFinite(carga.placas)) return null;
    return Math.round((Math.max(0, carga.placas || 0) * preferencia.kgPorPlaca) * 100) / 100;
  }
  const pesoBase =
    carga.pesoBase ?? (carga.tipo === 'discos_barra' ? preferencia.pesoBarra : preferencia.pesoBase);
  return calcularPesoTotalConDiscos(carga.discosPorLado || [], pesoBase);
}

/**
 * Infiere la unidad de carga de un ejercicio a partir de sus series.
 * Es la fuente de verdad para sesiones antiguas que no guardaron `modoKg`.
 */
export function inferirTipoCargaDesdeSeries(
  series: { carga?: CargaSerie; cargaI?: CargaSerie }[]
): TipoCarga {
  const conteo = new Map<TipoCarga, number>();
  for (const serie of series) {
    for (const carga of [serie.carga, serie.cargaI]) {
      if (!carga?.tipo) continue;
      conteo.set(carga.tipo, (conteo.get(carga.tipo) || 0) + 1);
    }
  }
  const noKg = [...conteo.entries()].filter(([tipo]) => tipo !== 'kg');
  if (noKg.length === 0) return 'kg';
  return noKg.sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Convierte la carga de una serie al modo elegido sin perder el valor en kg
 * cuando existe una equivalencia. Las repeticiones, RIR y estados no se tocan.
 */
export function convertirCargaAModo(
  cargaActual: CargaSerie | undefined,
  tipoDestino: TipoCarga,
  pesoActual: string,
  preferencia: PreferenciaCargaEjercicio
): { carga?: CargaSerie; peso: string } {
  const pesoNumero = Number(pesoActual.replace(',', '.')) || 0;
  const calculadoActual = cargaActual ? calcularKgDesdeCarga(cargaActual, preferencia) : null;
  const kgActual = pesoNumero > 0 ? pesoNumero : calculadoActual && calculadoActual > 0 ? calculadoActual : 0;

  if (tipoDestino === 'kg') {
    return { carga: undefined, peso: kgActual > 0 ? String(kgActual) : '' };
  }

  if (tipoDestino === 'placas') {
    const placasPrevias =
      cargaActual?.tipo === 'placas' ? Math.max(0, Math.floor(cargaActual.placas || 0)) : 0;
    let placas = placasPrevias;
    if (placas === 0 && preferencia.kgPorPlaca && kgActual > 0) {
      placas = Math.max(0, Math.round(kgActual / preferencia.kgPorPlaca));
    }
    const kgPlacas = preferencia.kgPorPlaca
      ? Math.round(placas * preferencia.kgPorPlaca * 100) / 100
      : 0;
    return {
      carga: { tipo: 'placas', placas },
      peso: kgPlacas > 0 ? String(kgPlacas) : '',
    };
  }

  const base = tipoDestino === 'discos_barra' ? preferencia.pesoBarra : preferencia.pesoBase;
  let discos: DiscoPorLado[] =
    cargaActual?.tipo === tipoDestino
      ? (cargaActual.discosPorLado || []).map((item) => ({ ...item }))
      : [];

  // Si venimos de kg/placas, proponemos la combinación de discos más cercana.
  if (discos.length === 0 && kgActual > base && preferencia.discosDisponibles.length > 0) {
    const distribucion = calcularDiscosPorLado(kgActual, base, preferencia.discosDisponibles);
    discos = distribucion.discos.map((item) => ({ ...item }));
  }

  const carga: CargaSerie = { tipo: tipoDestino, pesoBase: base, discosPorLado: discos };
  if (kgActual <= 0) return { carga, peso: '' };
  const kgDiscos = calcularKgDesdeCarga(carga, preferencia);
  return { carga, peso: kgDiscos != null ? String(kgDiscos) : '' };
}

/**
 * Recalcula el total en kg de una carga ya registrada tras cambiar la
 * configuración del equipo (barra, base, kg por placa...).
 */
export function recalcularPesoDeCarga(
  carga: CargaSerie | undefined,
  preferencia: PreferenciaCargaEjercicio,
  pesoActual = ''
): { carga?: CargaSerie; peso: string } {
  if (!carga || carga.tipo === 'kg') return { carga: undefined, peso: pesoActual };
  const actualizada: CargaSerie = {
    ...carga,
    pesoBase:
      carga.tipo === 'discos_barra'
        ? preferencia.pesoBarra
        : carga.tipo === 'discos_maquina'
        ? preferencia.pesoBase
        : carga.pesoBase,
  };
  const kg = calcularKgDesdeCarga(actualizada, preferencia);
  return { carga: actualizada, peso: kg != null && kg > 0 ? String(kg) : '' };
}

export function formatearPreviaSerie(serie: {
  peso: string;
  reps: string;
  carga?: CargaSerie;
}): string | undefined {
  if (!serie.peso && !serie.reps && !serie.carga) return undefined;
  const reps = serie.reps || '—';
  if (serie.carga?.tipo === 'placas') {
    return `${Math.max(0, Math.floor(serie.carga.placas || 0))}pl × ${reps}`;
  }
  return `${serie.peso || '—'} × ${reps}`;
}

export function crearCargaDesdeValor(
  tipo: TipoCarga,
  valor: string,
  preferencia: PreferenciaCargaEjercicio,
  anterior?: CargaSerie
): CargaSerie {
  const numero = Number(valor.replace(',', '.'));
  if (tipo === 'placas') {
    return { tipo, placas: Number.isFinite(numero) ? Math.max(0, Math.floor(numero)) : 0 };
  }
  if (tipo === 'discos_barra' || tipo === 'discos_maquina') {
    return {
      tipo,
      pesoBase: tipo === 'discos_barra' ? preferencia.pesoBarra : preferencia.pesoBase,
      discosPorLado: anterior?.tipo === tipo ? anterior.discosPorLado || [] : [],
    };
  }
  return { tipo: 'kg' };
}

export function formatearComposicionDiscos(discos: readonly DiscoPorLado[] = []): string {
  const piezas = discos
    .filter((item) => item.cantidadPorLado > 0 && item.disco > 0)
    .slice()
    .sort((a, b) => b.disco - a.disco)
    .map((item) => (item.cantidadPorLado > 1 ? `${item.cantidadPorLado}×${item.disco}` : `${item.disco}`));
  return piezas.length > 0 ? `${piezas.join('+')} /lado` : 'Sin discos';
}

export function formatearDetalleCarga(carga?: CargaSerie | null): string {
  if (!carga) return '';
  if (carga.tipo === 'placas') {
    const cantidad = Math.max(0, Math.floor(carga.placas || 0));
    return `${cantidad} ${cantidad === 1 ? 'placa' : 'placas'}`;
  }
  if (carga.tipo === 'discos_barra' || carga.tipo === 'discos_maquina') {
    return formatearComposicionDiscos(carga.discosPorLado);
  }
  return '';
}

export function formatearCargaVisible(
  carga: CargaSerie | undefined,
  pesoKg?: number | null,
  preferencia?: PreferenciaCargaEjercicio
): { principal: string; unidad: string; detalle: string } {
  const detalle = formatearDetalleCarga(carga);
  if (pesoKg !== null && pesoKg !== undefined && Number.isFinite(pesoKg) && pesoKg > 0) {
    return { principal: `${pesoKg}`, unidad: 'kg', detalle };
  }
  if (carga?.tipo === 'placas') {
    const placas = Math.max(0, Math.floor(carga.placas || 0));
    return {
      principal: `${placas}`,
      unidad: 'placas',
      detalle,
    };
  }
  return { principal: '—', unidad: '', detalle };
}

