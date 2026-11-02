import type { CargaSerie, DiscoPorLado, TipoCarga } from '../tipos';
import { calcularPesoTotalConDiscos } from './calculadoraFuerza';
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

