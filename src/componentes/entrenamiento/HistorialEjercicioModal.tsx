import { styles } from './HistorialEjercicioModal.estilos';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { noir } from '../../constantes/colores';
import { useLayout } from '../../hooks/useLayout';
import {
  formatearDetalleCarga,
  leerPreferenciasCarga,
  normalizarNombreParaPreferencia,
} from '../../utilidades/cargasEjercicio';
import { vibrarBoton } from '../../utilidades/hapticos';
import {
  SesionHistorialEjercicio,
  SerieHistorialEjercicio,
  obtenerHistorialEjercicio,
} from '../../servicios/registros';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  nombreEjercicio: string;
  registroActualId?: string | null;
  onClose: () => void;
  onUsarSesion?: (sesion: SesionHistorialEjercicio) => void;
};

type MetricaGrafica = 'e1rm' | 'peso' | 'volumen' | 'reps' | 'totalReps';

const METRICAS: {
  id: MetricaGrafica;
  etiqueta: string;
  titulo: string;
  unidad: 'kg' | 'reps';
}[] = [
  {
    id: 'e1rm',
    etiqueta: '1RM',
    titulo: '1RM estimado',
    unidad: 'kg',
  },
  {
    id: 'peso',
    etiqueta: 'Peso',
    titulo: 'Peso máximo',
    unidad: 'kg',
  },
  {
    id: 'volumen',
    etiqueta: 'Vol.',
    titulo: 'Volumen total',
    unidad: 'kg',
  },
  {
    id: 'reps',
    etiqueta: 'Reps',
    titulo: 'Repeticiones máximas',
    unidad: 'reps',
  },
  {
    id: 'totalReps',
    etiqueta: 'Total',
    titulo: 'Repeticiones totales',
    unidad: 'reps',
  },
];

function fechaComoDate(fecha: string): Date {
  return new Date(`${fecha}T12:00:00`);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearFecha(fecha: string): string {
  try {
    return capitalizar(
      format(fechaComoDate(fecha), 'EEE d MMM yyyy', { locale: es })
    );
  } catch {
    return fecha;
  }
}

function formatearFechaCorta(fecha: string): string {
  try {
    return format(fechaComoDate(fecha), 'd MMM', { locale: es });
  } catch {
    return fecha;
  }
}

function textoDiasRelativo(fecha: string): string {
  try {
    const dias = differenceInCalendarDays(new Date(), fechaComoDate(fecha));
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Ayer · Hace 1 día';
    return `Hace ${dias} días`;
  } catch {
    return '';
  }
}

function formatearNumero(valor: number, decimales = 1): string {
  if (!Number.isFinite(valor)) return '—';
  const redondeado = Math.round(valor * 10 ** decimales) / 10 ** decimales;
  return Number.isInteger(redondeado)
    ? String(redondeado)
    : redondeado.toFixed(decimales).replace('.', ',');
}

function formatearKg(valor: number, decimales = 1): string {
  return valor > 0 ? formatearNumero(valor, decimales) : '—';
}

function formatearCompacto(valor: number): string {
  if (valor <= 0) return '—';
  if (valor >= 1000) return `${formatearNumero(valor / 1000, 1)}k`;
  return formatearNumero(valor, 0);
}

function formatearSerie(kg: number, reps: number): string {
  if (kg > 0 && reps > 0) return `${formatearKg(kg)} kg × ${reps}`;
  if (reps > 0) return `${reps} reps`;
  if (kg > 0) return `${formatearKg(kg)} kg`;
  return '—';
}

function valorMetrica(
  sesion: SesionHistorialEjercicio,
  metrica: MetricaGrafica
): number {
  if (metrica === 'peso') return sesion.mejorPeso;
  if (metrica === 'volumen') return sesion.volumenKg;
  if (metrica === 'reps') return sesion.mejorReps;
  if (metrica === 'totalReps') return sesion.totalReps;
  return sesion.mejorE1RM;
}

function mejorMarcaTexto(sesion: SesionHistorialEjercicio): string {
  if (sesion.mejorPeso > 0 && sesion.repsMejorPeso > 0) {
    return `${formatearKg(sesion.mejorPeso)} kg × ${sesion.repsMejorPeso}`;
  }
  if (sesion.mejorPeso > 0) {
    return `${formatearKg(sesion.mejorPeso)} kg`;
  }
  const maxReps = sesion.series.reduce(
    (maximo, serie) => Math.max(maximo, serie.repsD, serie.repsI),
    0
  );
  return maxReps > 0 ? `${maxReps} reps` : '—';
}

// ── Gráfico de Evolución Compacto y Profesional ─────────────────────────────
function GraficoEvolucion({
  sesiones,
  metrica,
  unidad,
}: {
  sesiones: SesionHistorialEjercicio[];
  metrica: MetricaGrafica;
  unidad: 'kg' | 'reps';
}) {
  const [ancho, setAncho] = useState(0);
  const alto = 120;
  const puntos = useMemo(
    () =>
      sesiones
        .map((sesion) => ({
          fecha: sesion.fecha,
          valor: valorMetrica(sesion, metrica),
        }))
        .filter((punto) => punto.valor > 0),
    [sesiones, metrica]
  );

  if (puntos.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Ionicons name="analytics-outline" size={18} color={noir.muted2} />
        <Text style={styles.chartEmptyText}>
          Aún no hay registros de{' '}
          {metrica === 'volumen' ? 'volumen' : 'carga'} para mostrar la curva.
        </Text>
      </View>
    );
  }

  const valores = puntos.map((punto) => punto.valor);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const rango = maximo - minimo;
  const paddingX = 10;
  const paddingY = 12;

  const x = (indice: number) => {
    if (puntos.length === 1) return ancho / 2;
    return paddingX + (indice / (puntos.length - 1)) * (ancho - paddingX * 2);
  };

  const y = (valor: number) => {
    if (rango <= 0) return alto / 2;
    return paddingY + (1 - (valor - minimo) / rango) * (alto - paddingY * 2);
  };

  const linePath = puntos
    .map(
      (punto, indice) =>
        `${indice === 0 ? 'M' : 'L'} ${x(indice)} ${y(punto.valor)}`
    )
    .join(' ');

  const areaPath =
    puntos.length > 1
      ? `${linePath} L ${x(puntos.length - 1)} ${alto - 2} L ${x(
          0
        )} ${alto - 2} Z`
      : '';

  return (
    <View>
      <View style={styles.chartScaleRow}>
        <Text style={styles.chartScaleText}>
          MÁX {formatearCompacto(maximo)} {unidad}
        </Text>
        <Text style={styles.chartScaleText}>
          MÍN {formatearCompacto(minimo)} {unidad}
        </Text>
      </View>
      <View
        style={{ height: alto }}
        onLayout={(event) => setAncho(event.nativeEvent.layout.width)}
      >
        {ancho > 0 && (
          <Svg width={ancho} height={alto}>
            <Defs>
              <SvgLinearGradient
                id="historialArea"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0" stopColor={noir.info} stopOpacity={0.25} />
                <Stop offset="1" stopColor={noir.info} stopOpacity={0.01} />
              </SvgLinearGradient>
            </Defs>
            {[0, 0.5, 1].map((posicion) => (
              <Line
                key={`grid-${posicion}`}
                x1={paddingX}
                y1={paddingY + posicion * (alto - paddingY * 2)}
                x2={ancho - paddingX}
                y2={paddingY + posicion * (alto - paddingY * 2)}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={1}
              />
            ))}
            {areaPath ? (
              <Path d={areaPath} fill="url(#historialArea)" />
            ) : null}
            {puntos.length > 1 && (
              <Path
                d={linePath}
                fill="none"
                stroke={noir.info}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {puntos.map((punto, indice) => {
              const esUltimo = indice === puntos.length - 1;
              return (
                <Circle
                  key={`punto-${punto.fecha}-${indice}`}
                  cx={x(indice)}
                  cy={y(punto.valor)}
                  r={esUltimo ? 4.5 : 2.6}
                  fill={esUltimo ? noir.mint : noir.info}
                  stroke={esUltimo ? noir.bg : 'transparent'}
                  strokeWidth={esUltimo ? 2 : 0}
                />
              );
            })}
          </Svg>
        )}
      </View>
      <View style={styles.chartDateRow}>
        <Text style={styles.chartDateText}>
          {formatearFechaCorta(puntos[0].fecha)}
        </Text>
        {puntos.length > 1 && (
          <Text style={styles.chartDateText}>
            {formatearFechaCorta(puntos[puntos.length - 1].fecha)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Etiqueta compacta de serie ──────────────────────────────────────────────
function EtiquetaSerie({
  texto,
  icono,
  color = noir.muted,
  borde = 'rgba(255, 255, 255, 0.08)',
  fondo = 'rgba(255, 255, 255, 0.035)',
}: {
  texto: string;
  icono?: IoniconName;
  color?: string;
  borde?: string;
  fondo?: string;
}) {
  return (
    <View style={[styles.serieTag, { borderColor: borde, backgroundColor: fondo }]}>
      {icono && <Ionicons name={icono} size={8} color={color} />}
      <Text style={[styles.serieTagText, { color }]}>{texto}</Text>
    </View>
  );
}

// ── Fila de Serie ───────────────────────────────────────────────────────────
function FilaSerie({
  serie,
  esUnilateral,
  convertirPlacasKg,
  kgPorPlaca,
}: {
  serie: SerieHistorialEjercicio;
  esUnilateral: boolean;
  convertirPlacasKg: boolean;
  kgPorPlaca: number | null;
}) {
  const formatoLado = (
    peso: number,
    reps: number,
    carga?: SerieHistorialEjercicio['carga']
  ) =>
    carga?.tipo === 'placas' && convertirPlacasKg && kgPorPlaca
      ? `${formatearNumero((carga.placas || 0) * kgPorPlaca)} kg × ${reps || '—'}`
      : carga?.tipo === 'placas' && peso <= 0
      ? `${carga.placas || 0} pl × ${reps || '—'}`
      : formatearSerie(peso, reps);

  return (
    <View style={styles.serieRow}>
      <View
        style={[
          styles.serieNumBadge,
          serie.completado && styles.serieNumBadgeDone,
        ]}
      >
        <Text
          style={[
            styles.serieNumText,
            serie.completado && styles.serieNumTextDone,
          ]}
        >
          {String(serie.setNum).padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.serieValuesWrap}>
        {esUnilateral ? (
          <>
            <Text style={styles.serieBrandValue}>
              D: {formatoLado(serie.pesoD, serie.repsD, serie.carga)}
            </Text>
            <Text style={styles.serieSeparator}>·</Text>
            <Text style={styles.serieBrandValue}>
              I: {formatoLado(serie.pesoI, serie.repsI, serie.cargaI)}
            </Text>
          </>
        ) : (
          <Text style={styles.serieBrandValue}>
            {formatoLado(serie.pesoD, serie.repsD, serie.carga)}
          </Text>
        )}
        {serie.rir !== null && (
          <EtiquetaSerie texto={`RIR ${serie.rir}`} />
        )}
        {serie.estado === 'fallo' && (
          <EtiquetaSerie
            texto="FALLO"
            icono="flame"
            color={noir.champagne}
            borde="rgba(255,209,102,0.25)"
            fondo="rgba(255,209,102,0.08)"
          />
        )}
        {serie.estado === 'no_hecha' && (
          <EtiquetaSerie
            texto="NO HECHA"
            color={noir.muted}
            borde="rgba(255,255,255,0.08)"
            fondo="rgba(255,255,255,0.03)"
          />
        )}
        {Boolean(serie.repsMin && serie.repsMax) && (
          <EtiquetaSerie
            texto={`Obj ${serie.repsMin}${
              serie.repsMax === serie.repsMin ? '' : `–${serie.repsMax}`
            }`}
            color={noir.info}
          />
        )}
        {serie.repsParciales > 0 && (
          <EtiquetaSerie
            texto={`+${serie.repsParciales}p`}
            color={noir.champagne}
            borde="rgba(255, 209, 102, 0.2)"
            fondo="rgba(255, 209, 102, 0.065)"
          />
        )}
        {serie.esDropset && (
          <EtiquetaSerie
            texto="DROP"
            color={noir.info}
            borde="rgba(92, 200, 255, 0.2)"
            fondo="rgba(92, 200, 255, 0.065)"
          />
        )}
        {(serie.carga || serie.cargaI) && (
          <Text style={{ color: noir.muted, fontSize: 9.5, width: '100%' }}>
            {formatearDetalleCarga(serie.carga)}
            {serie.cargaI ? ` · I: ${formatearDetalleCarga(serie.cargaI)}` : ''}
          </Text>
        )}
        {serie.drops.length > 0 && (
          <Text style={styles.serieDrops}>
            Drops:{' '}
            {serie.drops
              .map(
                (drop) =>
                  `${formatearSerie(drop.kg, drop.reps)}${
                    drop.rir !== null ? ` (RIR ${drop.rir})` : ''
                  }`
              )
              .join(' → ')}
          </Text>
        )}
        {Boolean(serie.nota) && (
          <Text style={styles.serieNote}>“{serie.nota}”</Text>
        )}
      </View>
      <Ionicons
        name={
          serie.estado === 'no_hecha'
            ? 'remove-circle-outline'
            : serie.completado
            ? 'checkmark-circle'
            : 'ellipse-outline'
        }
        size={13}
        color={
          serie.estado === 'no_hecha'
            ? noir.muted
            : serie.completado
            ? noir.mint
            : noir.muted2
        }
      />
    </View>
  );
}

// ── Tarjeta de Sesión en la lista ───────────────────────────────────────────
function TarjetaSesion({
  sesion,
  esUltima,
  esRecord,
  deltaProgreso,
  unidadProgreso,
  onUsar,
  convertirPlacasKg,
  kgPorPlaca,
  onToggleConversion,
}: {
  sesion: SesionHistorialEjercicio;
  esUltima: boolean;
  esRecord: boolean;
  deltaProgreso: number | null;
  unidadProgreso: 'kg' | 'reps';
  onUsar?: (sesion: SesionHistorialEjercicio) => void;
  convertirPlacasKg: boolean;
  kgPorPlaca: number | null;
  onToggleConversion: () => void;
}) {
  const rutinaNombre = sesion.rutinaNombre?.trim() || 'Sesión libre';
  const tieneCarga = sesion.mejorE1RM > 0;
  const tieneVolumen = sesion.volumenKg > 0;

  const deltaColor =
    deltaProgreso === null || Math.abs(deltaProgreso) < 0.05
      ? noir.muted
      : deltaProgreso > 0
      ? noir.mint
      : '#FF7A90';

  const deltaIcon: IoniconName =
    deltaProgreso === null || Math.abs(deltaProgreso) < 0.05
      ? 'remove-outline'
      : deltaProgreso > 0
      ? 'trending-up'
      : 'trending-down';

  const deltaTexto =
    deltaProgreso === null
      ? ''
      : Math.abs(deltaProgreso) < 0.05
      ? `Sin variación de ${
          unidadProgreso === 'kg' ? '1RM' : 'reps'
        } frente a la sesión anterior`
      : `${deltaProgreso > 0 ? '+' : '-'}${formatearNumero(
          Math.abs(deltaProgreso),
          unidadProgreso === 'kg' ? 1 : 0
        )} ${
          unidadProgreso === 'kg' ? 'kg de 1RM' : 'reps'
        } frente a la sesión anterior`;

  return (
    <View style={styles.sessionCard}>
      {/* Cabecera de la sesión */}
      <View style={styles.sessionHeader}>
        <View style={styles.sessionDateBox}>
          <Text style={styles.sessionDateTitle}>
            {formatearFecha(sesion.fecha)}
          </Text>
          <View style={styles.sessionRelativeRow}>
            <Ionicons name="time-outline" size={10} color={noir.mint} />
            <Text style={styles.sessionRelativeText}>
              {textoDiasRelativo(sesion.fecha)}
            </Text>
          </View>
        </View>

        <View style={styles.sessionBadgesRow}>
          {/* Chip de Rutina */}
          <View style={styles.routineBadge}>
            <Ionicons name="barbell-outline" size={9} color="#D8C7FF" />
            <Text style={styles.routineBadgeText} numberOfLines={1}>
              {rutinaNombre}
            </Text>
          </View>

          {esUltima && (
            <View style={[styles.badgePill, styles.badgeLatest]}>
              <Text style={[styles.badgeText, { color: noir.info }]}>
                ÚLTIMA
              </Text>
            </View>
          )}

          {esRecord && (
            <View style={[styles.badgePill, styles.badgeRecord]}>
              <Ionicons name="trophy" size={8} color={noir.champagne} />
              <Text style={[styles.badgeText, { color: noir.champagne }]}>
                PR
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* KPIs resumidos de la sesión */}
      <View style={styles.sessionKpisRow}>
        <View style={styles.sessionKpiCol}>
          <Text style={styles.sessionKpiLabel}>MEJOR SERIE</Text>
          <Text style={styles.sessionKpiValue} numberOfLines={1}>
            {mejorMarcaTexto(sesion)}
          </Text>
        </View>
        <View style={styles.sessionKpiDivider} />
        <View style={styles.sessionKpiCol}>
          <Text style={styles.sessionKpiLabel}>
            {tieneCarga ? '1RM ESTIMADO' : 'MEJOR REPS'}
          </Text>
          <Text style={styles.sessionKpiValue} numberOfLines={1}>
            {tieneCarga
              ? `${formatearKg(sesion.mejorE1RM, 0)} kg`
              : sesion.mejorReps > 0
              ? `${sesion.mejorReps} reps`
              : '—'}
          </Text>
        </View>
        <View style={styles.sessionKpiDivider} />
        <View style={styles.sessionKpiCol}>
          <Text style={styles.sessionKpiLabel}>
            {tieneVolumen ? 'VOLUMEN' : 'TOTAL REPS'}
          </Text>
          <Text style={styles.sessionKpiValue} numberOfLines={1}>
            {tieneVolumen
              ? `${formatearCompacto(sesion.volumenKg)} kg`
              : sesion.totalReps > 0
              ? `${sesion.totalReps} reps`
              : '—'}
          </Text>
        </View>
      </View>

      {/* Delta frente a sesión anterior */}
      {deltaProgreso !== null && (
        <View style={styles.deltaRow}>
          <Ionicons name={deltaIcon} size={11} color={deltaColor} />
          <Text style={[styles.deltaText, { color: deltaColor }]}>
            {deltaTexto}
          </Text>
        </View>
      )}

      {/* Desglose de series (marcas completadas) */}
      <View style={styles.seriesContainer}>
        <View style={styles.seriesContainerHeader}>
          <Text style={styles.seriesContainerTitle}>SERIES REALIZADAS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {kgPorPlaca && (
              <Pressable onPress={onToggleConversion} hitSlop={6}>
                <Text style={{ color: noir.info, fontSize: 9, fontFamily: 'font-bold' }}>
                  {convertirPlacasKg ? 'Ver placas' : 'En kg'}
                </Text>
              </Pressable>
            )}
            <Text style={styles.seriesContainerCount}>
              {sesion.seriesCompletadas}/{sesion.series.length} completadas
            </Text>
          </View>
        </View>
        {sesion.series.map((serie) => (
          <FilaSerie
            key={`${sesion.id}-serie-${serie.setNum}`}
            serie={serie}
            esUnilateral={sesion.esUnilateral}
            convertirPlacasKg={convertirPlacasKg}
            kgPorPlaca={kgPorPlaca}
          />
        ))}
      </View>

      {/* Notas de la sesión o del ejercicio */}
      {Boolean(sesion.notaSesion) && (
        <View
          style={[
            styles.exerciseNote,
            {
              backgroundColor: 'rgba(92, 200, 255, 0.035)',
              borderColor: 'rgba(92, 200, 255, 0.12)',
            },
          ]}
        >
          <Ionicons name="document-text-outline" size={11} color={noir.info} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.exerciseNoteLabel, { color: noir.info }]}>
              NOTA DE SESIÓN
            </Text>
            <Text style={styles.exerciseNoteText} numberOfLines={3}>
              {sesion.notaSesion}
            </Text>
          </View>
        </View>
      )}

      {Boolean(sesion.notaEjercicio) && (
        <View style={styles.exerciseNote}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={11}
            color={noir.champagne}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseNoteLabel}>NOTA DEL EJERCICIO</Text>
            <Text style={styles.exerciseNoteText}>{sesion.notaEjercicio}</Text>
          </View>
        </View>
      )}

      {/* Botón para cargar marcas de esta sesión */}
      {onUsar && (
        <Pressable
          onPress={() => onUsar(sesion)}
          style={({ pressed }) => [
            styles.useButton,
            pressed && { opacity: 0.75, transform: [{ scale: 0.995 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Usar series del ${formatearFecha(sesion.fecha)}`}
        >
          <Ionicons name="copy-outline" size={13} color={noir.mint} />
          <Text style={styles.useButtonText}>
            {esUltima ? 'Repetir estas series' : 'Cargar estas series hoy'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={12}
            color={noir.muted}
            style={{ marginLeft: 'auto' }}
          />
        </Pressable>
      )}
    </View>
  );
}

// ── COMPONENTE PRINCIPAL MODAL ──────────────────────────────────────────────
export default function HistorialEjercicioModal({
  visible,
  nombreEjercicio,
  registroActualId,
  onClose,
  onUsarSesion,
}: Props) {
  const { topInset, barBottomPadding, gutter, contentMaxWidth } = useLayout();
  const [sesiones, setSesiones] = useState<SesionHistorialEjercicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [metrica, setMetrica] = useState<MetricaGrafica>('e1rm');
  const [kgPorPlaca, setKgPorPlaca] = useState<number | null>(null);
  const [convertirPlacasKg, setConvertirPlacasKg] = useState(false);

  useEffect(() => {
    let activo = true;
    leerPreferenciasCarga()
      .then((preferencias) => {
        const equivalencia =
          preferencias[normalizarNombreParaPreferencia(nombreEjercicio)]
            ?.kgPorPlaca || null;
        if (activo) {
          setKgPorPlaca(equivalencia);
          setConvertirPlacasKg(false);
        }
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [nombreEjercicio]);

  useEffect(() => {
    if (!visible || !nombreEjercicio.trim()) return;
    let cancelado = false;
    const cargar = async () => {
      try {
        const historial = await obtenerHistorialEjercicio(
          nombreEjercicio,
          registroActualId
        );
        if (!cancelado) setSesiones(historial);
      } catch (err: unknown) {
        if (cancelado) return;
        setSesiones([]);
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el historial del ejercicio.'
        );
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [visible, nombreEjercicio, registroActualId, recarga]);

  const sesionesDesc = useMemo(
    () =>
      [...sesiones].sort((a, b) => {
        const porFecha = b.fecha.localeCompare(a.fecha);
        return porFecha !== 0 ? porFecha : b.creadoEn.localeCompare(a.creadoEn);
      }),
    [sesiones]
  );

  const sesionesAsc = useMemo(() => [...sesionesDesc].reverse(), [sesionesDesc]);

  // Rutinas únicas en las que se ha realizado
  const rutinasUnicas = useMemo(() => {
    const conjunto = new Set<string>();
    sesionesDesc.forEach((s) => {
      const r = s.rutinaNombre?.trim();
      if (r) conjunto.add(r);
    });
    return Array.from(conjunto);
  }, [sesionesDesc]);

  // Resumen métrico global
  const resumen = useMemo(() => {
    const mejorPeso = sesionesDesc.reduce(
      (maximo, sesion) => Math.max(maximo, sesion.mejorPeso),
      0
    );
    const mejorE1RM = sesionesDesc.reduce(
      (maximo, sesion) => Math.max(maximo, sesion.mejorE1RM),
      0
    );
    const mejorReps = sesionesDesc.reduce(
      (maximo, sesion) => Math.max(maximo, sesion.mejorReps),
      0
    );
    const mejorTotalReps = sesionesDesc.reduce(
      (maximo, sesion) => Math.max(maximo, sesion.totalReps),
      0
    );
    const volumenTotal = sesionesDesc.reduce(
      (total, sesion) => total + sesion.volumenKg,
      0
    );
    const volumenMedio =
      sesionesDesc.length > 0 ? volumenTotal / sesionesDesc.length : 0;
    const totalRepsTotal = sesionesDesc.reduce(
      (total, sesion) => total + sesion.totalReps,
      0
    );
    const totalRepsMedio =
      sesionesDesc.length > 0 ? totalRepsTotal / sesionesDesc.length : 0;
    const usaCarga = mejorPeso > 0;

    const valorProgreso = (sesion: SesionHistorialEjercicio) =>
      usaCarga ? sesion.mejorE1RM : sesion.mejorReps;

    const primera = sesionesAsc[0] || null;
    const ultima = sesionesAsc[sesionesAsc.length - 1] || null;

    const sesionesConMarca = sesionesAsc.filter(
      (sesion) => valorProgreso(sesion) > 0
    );
    const primeraMarca = sesionesConMarca[0] || null;
    const ultimaMarca = sesionesConMarca[sesionesConMarca.length - 1] || null;

    const deltaProgreso =
      primeraMarca && ultimaMarca
        ? valorProgreso(ultimaMarca) - valorProgreso(primeraMarca)
        : null;

    const deltaPct =
      deltaProgreso !== null &&
      primeraMarca &&
      valorProgreso(primeraMarca) > 0
        ? (deltaProgreso / valorProgreso(primeraMarca)) * 100
        : null;

    const sesionMejorPeso = sesionesDesc.find(
      (sesion) => sesion.mejorPeso === mejorPeso
    );

    return {
      mejorPeso,
      repsMejorPeso: sesionMejorPeso?.repsMejorPeso || 0,
      mejorE1RM,
      mejorReps,
      mejorTotalReps,
      volumenMedio,
      totalRepsMedio,
      usaCarga,
      unidadProgreso: (usaCarga ? 'kg' : 'reps') as 'kg' | 'reps',
      primera,
      ultima,
      primeraMarca,
      deltaProgreso,
      deltaPct,
    };
  }, [sesionesAsc, sesionesDesc]);

  // Sesión con el récord histórico
  const sesionRecord = useMemo(() => {
    if (sesionesDesc.length === 0) return null;
    if (resumen.usaCarga) {
      return sesionesDesc.reduce((max, s) => {
        if (!max) return s;
        if (s.mejorE1RM > max.mejorE1RM) return s;
        if (s.mejorE1RM === max.mejorE1RM && s.mejorPeso > max.mejorPeso) return s;
        return max;
      }, sesionesDesc[0]);
    }
    return sesionesDesc.reduce((max, s) => {
      if (!max) return s;
      return s.mejorReps > max.mejorReps ? s : max;
    }, sesionesDesc[0]);
  }, [sesionesDesc, resumen.usaCarga]);

  const metricasDisponibles = resumen.usaCarga
    ? METRICAS.filter(
        (item) =>
          item.id === 'e1rm' || item.id === 'peso' || item.id === 'volumen'
      )
    : METRICAS.filter((item) => item.id === 'reps' || item.id === 'totalReps');

  const metricaActiva =
    metricasDisponibles.find((item) => item.id === metrica) ||
    metricasDisponibles[0] ||
    METRICAS[0];

  const deltaPct = resumen.deltaPct;

  const cerrar = () => {
    vibrarBoton(8);
    onClose();
  };

  const usarSesion = (sesion: SesionHistorialEjercicio) => {
    vibrarBoton(14);
    onUsarSesion?.(sesion);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={cerrar}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <LinearGradient
          colors={['#0B0E14', noir.bg, '#050608']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Cabecera Superior */}
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(topInset, 12),
              paddingHorizontal: gutter,
            },
          ]}
        >
          <View
            style={[
              styles.headerInner,
              { maxWidth: contentMaxWidth, width: '100%' },
            ]}
          >
            <View style={styles.headerCopy}>
              <View style={styles.headerKickerRow}>
                <Text style={styles.headerKicker}>PREVIA DEL EJERCICIO</Text>
                {sesionesDesc.length > 0 && (
                  <>
                    <View style={styles.headerKickerDot} />
                    <Text style={styles.headerKickerBadge}>
                      {sesionesDesc.length}{' '}
                      {sesionesDesc.length === 1 ? 'sesión' : 'sesiones'}
                    </Text>
                  </>
                )}
              </View>
              <Text style={styles.headerTitle} numberOfLines={2}>
                {nombreEjercicio}
              </Text>
            </View>

            <Pressable
              onPress={cerrar}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cerrar previa de ejercicio"
            >
              <Ionicons name="close" size={20} color={noir.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: gutter,
              paddingBottom: Math.max(barBottomPadding, 18) + 34,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.content,
              { maxWidth: contentMaxWidth, width: '100%' },
            ]}
          >
            {cargando ? (
              <View style={styles.loadingCard}>
                <View style={styles.loadingOrb}>
                  <ActivityIndicator color={noir.info} size="small" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadingTitle}>Cargando evolución</Text>
                  <Text style={styles.loadingText}>
                    Consultando registros previos…
                  </Text>
                </View>
              </View>
            ) : error ? (
              <View style={styles.emptyCard}>
                <View style={[styles.emptyIcon, styles.errorIcon]}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={24}
                    color="#FF7A90"
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  No pudimos cargar el historial
                </Text>
                <Text style={styles.emptyText}>
                  Revisa tu conexión e inténtalo de nuevo.
                </Text>
                <Text style={styles.errorDetail} numberOfLines={3}>
                  {error}
                </Text>
                <Pressable
                  onPress={() => {
                    setError(null);
                    setCargando(true);
                    setRecarga((valor) => valor + 1);
                  }}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Ionicons name="refresh" size={13} color={noir.info} />
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : sesionesDesc.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="barbell-outline"
                    size={25}
                    color={noir.info}
                  />
                </View>
                <Text style={styles.emptyTitle}>Aún no hay registros</Text>
                <Text style={styles.emptyText}>
                  Cuando completes una sesión con{' '}
                  <Text style={styles.emptyStrong}>{nombreEjercicio}</Text>,
                  aquí verás tu récord, en cuáles rutinas se realiza y el gráfico
                  de progreso.
                </Text>
                <View style={styles.emptyHint}>
                  <Ionicons
                    name="information-circle-outline"
                    size={12}
                    color={noir.muted}
                  />
                  <Text style={styles.emptyHintText}>
                    Aparecerá automáticamente al finalizar tu entrenamiento.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {/* ── SECCIÓN A: STAT CARDS HERO (Frecuencia, Rutinas, Mejor Registro) ── */}
                <View style={styles.heroSection}>
                  <View style={styles.statCardsGrid}>
                    {/* CARD 1: Total de veces realizado y en cuáles rutinas */}
                    <View style={styles.statCardHero}>
                      <View style={styles.statCardTop}>
                        <Text style={styles.statCardLabel}>TOTAL REALIZADO</Text>
                        <View
                          style={[
                            styles.statCardIconBox,
                            {
                              backgroundColor: 'rgba(92, 200, 255, 0.08)',
                              borderColor: 'rgba(92, 200, 255, 0.2)',
                            },
                          ]}
                        >
                          <Ionicons
                            name="layers-outline"
                            size={14}
                            color={noir.info}
                          />
                        </View>
                      </View>

                      <View>
                        <Text style={styles.statCardMainValue}>
                          {sesionesDesc.length}{' '}
                          <Text style={styles.statCardUnit}>
                            {sesionesDesc.length === 1 ? 'sesión' : 'sesiones'}
                          </Text>
                        </Text>
                      </View>

                      <View style={styles.statCardDetailBox}>
                        <Text style={styles.statCardDetailTitle}>
                          {rutinasUnicas.length === 0
                            ? 'Sesiones libres'
                            : 'En rutinas:'}
                        </Text>
                        {rutinasUnicas.length > 0 && (
                          <View style={styles.statCardRoutinesWrap}>
                            {rutinasUnicas.slice(0, 3).map((rutina) => (
                              <View key={rutina} style={styles.routineMiniTag}>
                                <Text
                                  style={styles.routineMiniTagText}
                                  numberOfLines={1}
                                >
                                  {rutina}
                                </Text>
                              </View>
                            ))}
                            {rutinasUnicas.length > 3 && (
                              <View style={styles.routineMiniTag}>
                                <Text style={styles.routineMiniTagText}>
                                  +{rutinasUnicas.length - 3}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    </View>

                    {/* CARD 2: Mejor Registro histórico (PR) */}
                    <View style={styles.statCardHero}>
                      <View style={styles.statCardTop}>
                        <Text style={styles.statCardLabel}>MEJOR REGISTRO</Text>
                        <View
                          style={[
                            styles.statCardIconBox,
                            {
                              backgroundColor: 'rgba(255, 209, 102, 0.08)',
                              borderColor: 'rgba(255, 209, 102, 0.22)',
                            },
                          ]}
                        >
                          <Ionicons
                            name="trophy"
                            size={14}
                            color={noir.champagne}
                          />
                        </View>
                      </View>

                      <View>
                        <Text style={styles.statCardMainValue} numberOfLines={1}>
                          {resumen.usaCarga ? (
                            <>
                              {formatearKg(resumen.mejorPeso)}{' '}
                              <Text style={styles.statCardUnit}>
                                kg
                                {resumen.repsMejorPeso > 0
                                  ? ` × ${resumen.repsMejorPeso}`
                                  : ''}
                              </Text>
                            </>
                          ) : (
                            <>
                              {resumen.mejorReps}{' '}
                              <Text style={styles.statCardUnit}>reps</Text>
                            </>
                          )}
                        </Text>
                      </View>

                      <View style={styles.statCardDetailBox}>
                        <Text style={styles.statCardDetailTitle} numberOfLines={1}>
                          {resumen.usaCarga && resumen.mejorE1RM > 0 ? (
                            <>
                              1RM est:{' '}
                              <Text style={styles.statCardDetailHighlight}>
                                {formatearKg(resumen.mejorE1RM, 0)} kg
                              </Text>
                            </>
                          ) : (
                            'Máximo en una serie'
                          )}
                        </Text>
                        {sesionRecord && (
                          <Text
                            style={[styles.statCardDetailTitle, { fontSize: 8.5 }]}
                            numberOfLines={1}
                          >
                            {textoDiasRelativo(sesionRecord.fecha)}
                            {sesionRecord.rutinaNombre
                              ? ` · ${sesionRecord.rutinaNombre}`
                              : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Píldora de Progreso (Limpia y concisa) */}
                  {deltaPct !== null && (
                    <View style={styles.trendPill}>
                      <View
                        style={[
                          styles.trendPillIcon,
                          deltaPct < 0 && {
                            backgroundColor: 'rgba(255, 122, 144, 0.12)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={deltaPct >= 0 ? 'trending-up' : 'trending-down'}
                          size={12}
                          color={deltaPct >= 0 ? noir.mint : '#FF7A90'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.trendPillText,
                          deltaPct < 0 && { color: '#FF7A90' },
                        ]}
                      >
                        {deltaPct > 0 ? '+' : ''}
                        {formatearNumero(deltaPct, 1)}%{' '}
                        {resumen.usaCarga ? 'en 1RM estimado' : 'en reps'}
                      </Text>
                      <Text style={styles.trendPillSub}>vs. primera marca</Text>
                    </View>
                  )}
                </View>

                {/* ── SECCIÓN C: GRÁFICO DE PROGRESO ── */}
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <View style={styles.chartTitleBlock}>
                      <Text style={styles.chartKicker}>PROGRESO</Text>
                      <Text style={styles.chartTitle}>
                        {metricaActiva.titulo}
                      </Text>
                    </View>

                    <View style={styles.metricTabs}>
                      {metricasDisponibles.map((item) => {
                        const activa = item.id === metricaActiva.id;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => {
                              vibrarBoton(4);
                              setMetrica(item.id);
                            }}
                            style={[
                              styles.metricTab,
                              activa && styles.metricTabActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.metricTabText,
                                activa && styles.metricTabTextActive,
                              ]}
                            >
                              {item.etiqueta}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <GraficoEvolucion
                    sesiones={sesionesAsc}
                    metrica={metricaActiva.id}
                    unidad={metricaActiva.unidad}
                  />

                  <View style={styles.chartFooter}>
                    <Text style={styles.chartFooterText}>
                      {sesionesAsc.length}{' '}
                      {sesionesAsc.length === 1 ? 'sesión' : 'sesiones'} registradas
                    </Text>
                    {resumen.usaCarga && resumen.volumenMedio > 0 && (
                      <Text style={styles.chartFooterText}>
                        Media {formatearCompacto(resumen.volumenMedio)} kg / sesión
                      </Text>
                    )}
                    {!resumen.usaCarga && resumen.totalRepsMedio > 0 && (
                      <Text style={styles.chartFooterText}>
                        Media {formatearCompacto(resumen.totalRepsMedio)} reps / sesión
                      </Text>
                    )}
                  </View>
                </View>

                {/* ── SECCIÓN B: TODAS LAS SESIONES DE REALIZACIÓN ── */}
                <View style={styles.listHeader}>
                  <View style={styles.listTitleRow}>
                    <Text style={styles.listTitle}>Todas las sesiones</Text>
                    <View style={styles.listCountBadge}>
                      <Text style={styles.listCountText}>
                        {sesionesDesc.length}
                      </Text>
                    </View>
                  </View>
                </View>

                {sesionesDesc.map((sesion, indice) => {
                  const anterior = sesionesDesc[indice + 1] || null;
                  const valorSesion = resumen.usaCarga
                    ? sesion.mejorE1RM
                    : sesion.mejorReps;
                  const valorAnterior = anterior
                    ? resumen.usaCarga
                      ? anterior.mejorE1RM
                      : anterior.mejorReps
                    : 0;
                  const delta =
                    anterior && valorAnterior > 0 && valorSesion > 0
                      ? valorSesion - valorAnterior
                      : null;
                  const valorRecord = resumen.usaCarga
                    ? resumen.mejorE1RM
                    : resumen.mejorReps;

                  return (
                    <TarjetaSesion
                      key={sesion.id}
                      sesion={sesion}
                      esUltima={indice === 0}
                      esRecord={
                        valorRecord > 0 &&
                        Math.abs(valorSesion - valorRecord) < 0.01
                      }
                      deltaProgreso={delta}
                      unidadProgreso={resumen.unidadProgreso}
                      kgPorPlaca={kgPorPlaca}
                      convertirPlacasKg={convertirPlacasKg}
                      onToggleConversion={() =>
                        setConvertirPlacasKg((value) => !value)
                      }
                      onUsar={onUsarSesion ? usarSesion : undefined}
                    />
                  );
                })}

                <View style={styles.footerNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={12}
                    color={noir.muted2}
                  />
                  <Text style={styles.footerNoteText}>
                    Historial cronológico ordenado por fecha de entrenamiento.
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
