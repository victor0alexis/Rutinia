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
import { fuentes, noir } from '../../constants/colores';
import { useLayout } from '../../hooks/useLayout';
import { vibrarBoton } from '../../utils/haptics';
import {
  SesionHistorialEjercicio,
  SerieHistorialEjercicio,
  obtenerHistorialEjercicio,
} from '../../services/registros';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  nombreEjercicio: string;
  registroActualId?: string | null;
  onClose: () => void;
  onUsarSesion?: (sesion: SesionHistorialEjercicio) => void;
};

type MetricaGrafica =
  | 'e1rm'
  | 'peso'
  | 'volumen'
  | 'reps'
  | 'totalReps';

const METRICAS: {
  id: MetricaGrafica;
  etiqueta: string;
  titulo: string;
  descripcion: string;
  unidad: 'kg' | 'reps';
}[] = [
  {
    id: 'e1rm',
    etiqueta: '1RM',
    titulo: '1RM estimado',
    descripcion: 'Mejor serie de cada sesión · fórmula de Epley',
    unidad: 'kg',
  },
  {
    id: 'peso',
    etiqueta: 'Peso',
    titulo: 'Peso máximo',
    descripcion: 'Carga más alta registrada en cada sesión',
    unidad: 'kg',
  },
  {
    id: 'volumen',
    etiqueta: 'Vol.',
    titulo: 'Volumen de trabajo',
    descripcion: 'Kg totales movidos, incluyendo dropsets',
    unidad: 'kg',
  },
  {
    id: 'reps',
    etiqueta: 'Reps',
    titulo: 'Repeticiones máximas',
    descripcion: 'Máximo de reps en una sola serie de cada sesión',
    unidad: 'reps',
  },
  {
    id: 'totalReps',
    etiqueta: 'Total',
    titulo: 'Repeticiones totales',
    descripcion: 'Reps completadas en toda la sesión, incluyendo dropsets',
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
      format(fechaComoDate(fecha), "EEE d MMM yyyy", { locale: es })
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

function formatearMes(fecha: string): string {
  try {
    return capitalizar(
      format(fechaComoDate(fecha), 'MMM yyyy', { locale: es })
    );
  } catch {
    return fecha;
  }
}

function fechaRelativa(fecha: string): string {
  try {
    const dias = differenceInCalendarDays(new Date(), fechaComoDate(fecha));
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;
    if (dias < 30) {
      const semanas = Math.floor(dias / 7);
      return `Hace ${semanas} sem`;
    }
    if (dias < 365) {
      const meses = Math.floor(dias / 30);
      return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }
    const anios = Math.floor(dias / 365);
    return `Hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
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

function contextoDeSesion(sesion: SesionHistorialEjercicio): string {
  const rutina = sesion.rutinaNombre?.trim();
  const plan =
    sesion.planNombre?.trim() && sesion.planNombre !== rutina
      ? sesion.planNombre.trim()
      : null;
  return [rutina, plan].filter(Boolean).join(' · ');
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

function IconoMetrica({
  icono,
  color,
}: {
  icono: IoniconName;
  color: string;
}) {
  return (
    <View
      style={[
        styles.statIcon,
        { backgroundColor: `${color}14`, borderColor: `${color}2E` },
      ]}
    >
      <Ionicons name={icono} size={14} color={color} />
    </View>
  );
}

function StatCard({
  icono,
  label,
  valor,
  detalle,
  color = noir.info,
}: {
  icono: IoniconName;
  label: string;
  valor: string;
  detalle?: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <IconoMetrica icono={icono} color={color} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {valor}
      </Text>
      {Boolean(detalle) && (
        <Text style={styles.statDetail} numberOfLines={1}>
          {detalle}
        </Text>
      )}
    </View>
  );
}

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
  const alto = 132;

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
        <Ionicons name="analytics-outline" size={19} color={noir.muted2} />
        <Text style={styles.chartEmptyText}>
          Aún no hay datos de{' '}
          {metrica === 'volumen'
            ? 'volumen'
            : metrica === 'reps' || metrica === 'totalReps'
              ? 'repeticiones'
              : 'carga'}{' '}
          registrados para este ejercicio.
        </Text>
      </View>
    );
  }

  const valores = puntos.map((punto) => punto.valor);
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const rango = maximo - minimo;
  const paddingX = 8;
  const paddingY = 12;

  const x = (indice: number) => {
    if (puntos.length === 1) return ancho / 2;
    return paddingX + (indice / (puntos.length - 1)) * (ancho - paddingX * 2);
  };

  const y = (valor: number) => {
    if (rango <= 0) return alto / 2;
    return (
      paddingY +
      (1 - (valor - minimo) / rango) * (alto - paddingY * 2)
    );
  };

  const linePath = puntos
    .map(
      (punto, indice) =>
        `${indice === 0 ? 'M' : 'L'} ${x(indice)} ${y(punto.valor)}`
    )
    .join(' ');

  const areaPath =
    puntos.length > 1
      ? `${linePath} L ${x(puntos.length - 1)} ${alto - 4} L ${x(
          0
        )} ${alto - 4} Z`
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
                <Stop offset="0" stopColor={noir.info} stopOpacity={0.26} />
                <Stop offset="1" stopColor={noir.info} stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>

            {[0, 0.5, 1].map((posicion) => (
              <Line
                key={`grid-${posicion}`}
                x1={paddingX}
                y1={paddingY + posicion * (alto - paddingY * 2)}
                x2={ancho - paddingX}
                y2={paddingY + posicion * (alto - paddingY * 2)}
                stroke="rgba(255, 255, 255, 0.06)"
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
                strokeWidth={2}
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
                  r={esUltimo ? 4.5 : 2.8}
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

function EtiquetaSerie({
  texto,
  color = noir.muted,
  borde = 'rgba(255, 255, 255, 0.1)',
  fondo = 'rgba(255, 255, 255, 0.045)',
}: {
  texto: string;
  color?: string;
  borde?: string;
  fondo?: string;
}) {
  return (
    <View
      style={[
        styles.serieTag,
        { borderColor: borde, backgroundColor: fondo },
      ]}
    >
      <Text style={[styles.serieTagText, { color }]}>{texto}</Text>
    </View>
  );
}

function FilaSerie({
  serie,
  esUnilateral,
}: {
  serie: SerieHistorialEjercicio;
  esUnilateral: boolean;
}) {
  return (
    <View style={styles.serieRow}>
      <View
        style={[
          styles.serieNumber,
          serie.completado && styles.serieNumberDone,
        ]}
      >
        <Text
          style={[
            styles.serieNumberText,
            serie.completado && styles.serieNumberTextDone,
          ]}
        >
          S{serie.setNum}
        </Text>
      </View>

      <View style={styles.serieBody}>
        <View style={styles.serieValues}>
          {esUnilateral ? (
            <>
              <Text style={styles.serieValue}>
                D {formatearSerie(serie.pesoD, serie.repsD)}
              </Text>
              <Text style={styles.serieSeparator}>·</Text>
              <Text style={styles.serieValue}>
                I {formatearSerie(serie.pesoI, serie.repsI)}
              </Text>
            </>
          ) : (
            <Text style={styles.serieValue}>
              {formatearSerie(serie.pesoD, serie.repsD)}
            </Text>
          )}

          {serie.rir !== null && (
            <EtiquetaSerie texto={`RIR ${serie.rir}`} />
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
        </View>

        {serie.drops.length > 0 && (
          <Text style={styles.serieDrops}>
            Drops:{' '}
            {serie.drops
              .map(
                (drop) =>
                  `${formatearSerie(drop.kg, drop.reps)}${
                    drop.rir !== null ? ` · RIR ${drop.rir}` : ''
                  }`
              )
              .join('  →  ')}
          </Text>
        )}

        {Boolean(serie.nota) && (
          <Text style={styles.serieNote}>“{serie.nota}”</Text>
        )}
      </View>

      <Ionicons
        name={serie.completado ? 'checkmark-circle' : 'ellipse-outline'}
        size={13}
        color={serie.completado ? noir.mint : noir.muted2}
      />
    </View>
  );
}

function TarjetaSesion({
  sesion,
  esUltima,
  esRecord,
  deltaProgreso,
  unidadProgreso,
  onUsar,
}: {
  sesion: SesionHistorialEjercicio;
  esUltima: boolean;
  esRecord: boolean;
  deltaProgreso: number | null;
  unidadProgreso: 'kg' | 'reps';
  onUsar?: (sesion: SesionHistorialEjercicio) => void;
}) {
  const contexto = contextoDeSesion(sesion);
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
        ? `Sin cambios de ${
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
      <View style={styles.sessionHeader}>
        <View style={styles.sessionDateBlock}>
          <Text style={styles.sessionDate}>
            {formatearFecha(sesion.fecha)}
          </Text>
          <Text style={styles.sessionContext} numberOfLines={1}>
            {fechaRelativa(sesion.fecha)}
            {contexto ? ` · ${contexto}` : ''}
          </Text>
        </View>

        <View style={styles.sessionBadges}>
          {esUltima && (
            <View style={[styles.badge, styles.badgeLatest]}>
              <Text style={[styles.badgeText, { color: noir.info }]}>
                ÚLTIMA
              </Text>
            </View>
          )}
          {esRecord && (
            <View style={[styles.badge, styles.badgeRecord]}>
              <Ionicons name="trophy" size={8} color={noir.champagne} />
              <Text style={[styles.badgeText, { color: noir.champagne }]}>
                RÉCORD
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.sessionStats}>
        <View style={styles.sessionStat}>
          <Text style={styles.sessionStatLabel}>MEJOR SERIE</Text>
          <Text style={styles.sessionStatValue}>
            {mejorMarcaTexto(sesion)}
          </Text>
        </View>
        <View style={styles.sessionStatDivider} />
        <View style={styles.sessionStat}>
          <Text style={styles.sessionStatLabel}>
            {tieneCarga ? '1RM EST.' : 'MEJOR REPS'}
          </Text>
          <Text style={styles.sessionStatValue}>
            {tieneCarga
              ? `${formatearKg(sesion.mejorE1RM, 0)} kg`
              : sesion.mejorReps > 0
                ? `${sesion.mejorReps} reps`
                : '—'}
          </Text>
        </View>
        <View style={styles.sessionStatDivider} />
        <View style={styles.sessionStat}>
          <Text style={styles.sessionStatLabel}>
            {tieneVolumen ? 'VOLUMEN' : 'REPS TOTALES'}
          </Text>
          <Text style={styles.sessionStatValue}>
            {tieneVolumen
              ? `${formatearCompacto(sesion.volumenKg)} kg`
              : sesion.totalReps > 0
                ? `${sesion.totalReps} reps`
                : '—'}
          </Text>
        </View>
      </View>

      {deltaProgreso !== null && (
        <View style={styles.deltaRow}>
          <Ionicons name={deltaIcon} size={12} color={deltaColor} />
          <Text style={[styles.deltaText, { color: deltaColor }]}>
            {deltaTexto}
          </Text>
        </View>
      )}

      <View style={styles.seriesBox}>
        <View style={styles.seriesBoxHeader}>
          <Text style={styles.seriesBoxTitle}>SERIES REGISTRADAS</Text>
          <Text style={styles.seriesBoxCount}>
            {sesion.seriesCompletadas}/{sesion.series.length} completadas
          </Text>
        </View>
        {sesion.series.map((serie) => (
          <FilaSerie
            key={`${sesion.id}-serie-${serie.setNum}`}
            serie={serie}
            esUnilateral={sesion.esUnilateral}
          />
        ))}
      </View>

      {Boolean(sesion.notaSesion) && (
        <View
          style={[
            styles.exerciseNote,
            {
              backgroundColor: 'rgba(92, 200, 255, 0.03)',
              borderColor: 'rgba(92, 200, 255, 0.12)',
            },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={12}
            color={noir.info}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.exerciseNoteLabel, { color: noir.info }]}>
              NOTA DE LA SESIÓN
            </Text>
            <Text style={styles.exerciseNoteText} numberOfLines={4}>
              {sesion.notaSesion}
            </Text>
          </View>
        </View>
      )}

      {Boolean(sesion.notaEjercicio) && (
        <View style={styles.exerciseNote}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={12}
            color={noir.champagne}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseNoteLabel}>NOTA DEL EJERCICIO</Text>
            <Text style={styles.exerciseNoteText}>{sesion.notaEjercicio}</Text>
          </View>
        </View>
      )}

      {onUsar && (
        <Pressable
          onPress={() => onUsar(sesion)}
          style={({ pressed }) => [
            styles.useButton,
            pressed && { opacity: 0.78, transform: [{ scale: 0.995 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Usar las series del ${formatearFecha(
            sesion.fecha
          )}`}
        >
          <Ionicons name="copy-outline" size={14} color={noir.mint} />
          <Text style={styles.useButtonText}>
            {esUltima ? 'Repetir esta sesión' : 'Usar esta sesión'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={13}
            color={noir.muted}
            style={{ marginLeft: 'auto' }}
          />
        </Pressable>
      )}
    </View>
  );
}

export default function HistorialEjercicioModal({
  visible,
  nombreEjercicio,
  registroActualId,
  onClose,
  onUsarSesion,
}: Props) {
  const { topInset, bottomInset, gutter, contentMaxWidth } = useLayout();
  const [sesiones, setSesiones] = useState<SesionHistorialEjercicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [metrica, setMetrica] = useState<MetricaGrafica>('e1rm');

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

    // Para calcular la evolución usamos la primera y la última sesión que
    // tengan una marca válida. Así una sesión antigua a peso corporal no
    // rompe la tendencia cuando después se incorporó carga externa.
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

    let frecuenciaDias: number | null = null;
    if (sesionesAsc.length > 1) {
      const intervalos: number[] = [];
      for (let i = 1; i < sesionesAsc.length; i += 1) {
        intervalos.push(
          differenceInCalendarDays(
            fechaComoDate(sesionesAsc[i].fecha),
            fechaComoDate(sesionesAsc[i - 1].fecha)
          )
        );
      }
      const promedio =
        intervalos.reduce((total, dias) => total + dias, 0) / intervalos.length;
      if (Number.isFinite(promedio) && promedio > 0) {
        frecuenciaDias = Math.round(promedio);
      }
    }

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
      frecuenciaDias,
    };
  }, [sesionesAsc, sesionesDesc]);

  const metricasDisponibles = resumen.usaCarga
    ? METRICAS.filter(
        (item) =>
          item.id === 'e1rm' || item.id === 'peso' || item.id === 'volumen'
      )
    : METRICAS.filter(
        (item) => item.id === 'reps' || item.id === 'totalReps'
      );
  const metricaActiva =
    metricasDisponibles.find((item) => item.id === metrica) ||
    metricasDisponibles[0] ||
    METRICAS[0];

  const deltaPct = resumen.deltaPct;
  const progresoColor =
    deltaPct === null || Math.abs(deltaPct) < 0.05
      ? noir.muted
      : deltaPct > 0
        ? noir.mint
        : '#FF7A90';
  const progresoIcon: IoniconName =
    deltaPct === null || Math.abs(deltaPct) < 0.05
      ? 'remove-outline'
      : deltaPct > 0
        ? 'trending-up'
        : 'trending-down';

  const insightTitulo =
    deltaPct === null
      ? 'Primera referencia registrada'
      : Math.abs(deltaPct) < 0.05
        ? resumen.usaCarga
          ? 'Tu 1RM se mantiene'
          : 'Tus repeticiones se mantienen'
        : `${deltaPct > 0 ? '+' : ''}${formatearNumero(
            deltaPct,
            1
          )}% en ${resumen.usaCarga ? '1RM estimado' : 'reps máximas'}`;

  const deltaValor = resumen.deltaProgreso ?? 0;
  const signoDelta =
    deltaValor > 0 ? '+' : deltaValor < 0 ? '-' : '';
  const insightDetalle =
    deltaPct === null
      ? 'Necesitas al menos dos sesiones para medir una tendencia.'
      : `${signoDelta}${formatearNumero(
          Math.abs(deltaValor),
          resumen.usaCarga ? 1 : 0
        )} ${resumen.usaCarga ? 'kg' : 'reps'} desde ${formatearMes(
          resumen.primeraMarca?.fecha || ''
        )}.${
          resumen.frecuenciaDias
            ? ` Frecuencia media: cada ~${resumen.frecuenciaDias} días.`
            : ''
        }`;

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
              <Text style={styles.headerKicker}>PREVIA · EVOLUCIÓN</Text>
              <Text style={styles.headerTitle} numberOfLines={2}>
                {nombreEjercicio}
              </Text>
              <Text style={styles.headerSubtitle}>
                {cargando
                  ? 'Leyendo tus registros…'
                  : sesionesDesc.length > 0
                    ? `${sesionesDesc.length} ${
                        sesionesDesc.length === 1
                          ? 'sesión registrada'
                          : 'sesiones registradas'
                      }${
                        resumen.primera
                          ? ` · desde ${formatearMes(resumen.primera.fecha)}`
                          : ''
                      }`
                    : 'Historial de sesiones finalizadas'}
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
              accessibilityLabel="Cerrar historial"
            >
              <Ionicons name="close" size={21} color={noir.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: gutter,
              paddingBottom: Math.max(bottomInset, 18) + 34,
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
                  <Text style={styles.loadingTitle}>Cargando tu evolución</Text>
                  <Text style={styles.loadingText}>
                    Buscando todas las sesiones finalizadas de este ejercicio…
                  </Text>
                </View>
              </View>
            ) : error ? (
              <View style={styles.emptyCard}>
                <View style={[styles.emptyIcon, styles.errorIcon]}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={25}
                    color="#FF7A90"
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  No pudimos cargar el historial
                </Text>
                <Text style={styles.emptyText}>
                  Revisa tu conexión e inténtalo de nuevo. Tus registros siguen
                  guardados.
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
                  <Ionicons name="refresh" size={14} color={noir.info} />
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : sesionesDesc.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="analytics-outline"
                    size={27}
                    color={noir.info}
                  />
                </View>
                <Text style={styles.emptyTitle}>Aún no hay historial</Text>
                <Text style={styles.emptyText}>
                  Cuando finalices una sesión con{' '}
                  <Text style={styles.emptyStrong}>{nombreEjercicio}</Text>,
                  aquí verás todas sus fechas, series, récords y tu evolución a
                  lo largo del tiempo.
                </Text>
                <View style={styles.emptyHint}>
                  <Ionicons
                    name="information-circle-outline"
                    size={13}
                    color={noir.muted}
                  />
                  <Text style={styles.emptyHintText}>
                    Solo se muestran entrenamientos finalizados.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.summaryCard}>
                  <View style={styles.summaryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryKicker}>TU HISTORIAL</Text>
                      <Text style={styles.summaryTitle}>
                        Evolución de {nombreEjercicio}
                      </Text>
                    </View>
                    <View style={styles.summaryIcon}>
                      <Ionicons
                        name="pulse-outline"
                        size={17}
                        color={noir.mint}
                      />
                    </View>
                  </View>

                  <View style={styles.statsGrid}>
                    <StatCard
                      icono="layers-outline"
                      label="SESIONES"
                      valor={String(sesionesDesc.length)}
                      detalle={
                        resumen.primera
                          ? `Desde ${formatearMes(resumen.primera.fecha)}`
                          : undefined
                      }
                    />
                    <StatCard
                      icono={resumen.usaCarga ? 'barbell-outline' : 'repeat'}
                      label={resumen.usaCarga ? 'MEJOR PESO' : 'MEJOR SERIE'}
                      valor={
                        resumen.usaCarga
                          ? `${formatearKg(resumen.mejorPeso)} kg`
                          : resumen.mejorReps > 0
                            ? `${resumen.mejorReps} reps`
                            : '—'
                      }
                      detalle={
                        resumen.usaCarga
                          ? `${resumen.repsMejorPeso} reps`
                          : 'Máximo en una serie'
                      }
                      color={noir.champagne}
                    />
                    <StatCard
                      icono="trending-up"
                      label={
                        resumen.usaCarga ? '1RM ESTIMADO' : 'REPS TOTALES'
                      }
                      valor={
                        resumen.usaCarga
                          ? `${formatearKg(resumen.mejorE1RM, 0)} kg`
                          : resumen.mejorTotalReps > 0
                            ? `${resumen.mejorTotalReps} reps`
                            : '—'
                      }
                      detalle={
                        resumen.usaCarga
                          ? 'Mejor marca estimada'
                          : 'Mejor sesión completada'
                      }
                      color={noir.mint}
                    />
                    <StatCard
                      icono={progresoIcon}
                      label="PROGRESO"
                      valor={
                        deltaPct === null
                          ? '—'
                          : `${deltaPct > 0 ? '+' : ''}${formatearNumero(
                              deltaPct,
                              1
                            )}%`
                      }
                      detalle={
                        deltaPct === null
                          ? 'Falta otra sesión'
                          : resumen.usaCarga
                            ? '1RM vs. primera marca'
                            : 'Reps vs. primera marca'
                      }
                      color={progresoColor}
                    />
                  </View>

                  <View style={styles.insightRow}>
                    <View
                      style={[
                        styles.insightIcon,
                        {
                          backgroundColor: `${progresoColor}14`,
                          borderColor: `${progresoColor}2E`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={progresoIcon}
                        size={15}
                        color={progresoColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insightTitle}>{insightTitulo}</Text>
                      <Text style={styles.insightText}>{insightDetalle}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chartKicker}>EVOLUCIÓN</Text>
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

                  <Text style={styles.chartDescription}>
                    {metricaActiva.descripcion}
                  </Text>

                  <GraficoEvolucion
                    sesiones={sesionesAsc}
                    metrica={metricaActiva.id}
                    unidad={metricaActiva.unidad}
                  />

                  <View style={styles.chartFooter}>
                    <Text style={styles.chartFooterText}>
                      {sesionesAsc.length}{' '}
                      {sesionesAsc.length === 1 ? 'sesión' : 'sesiones'}
                    </Text>
                    {resumen.usaCarga && resumen.volumenMedio > 0 && (
                      <Text style={styles.chartFooterText}>
                        Media {formatearCompacto(resumen.volumenMedio)} kg por
                        sesión
                      </Text>
                    )}
                    {!resumen.usaCarga && resumen.totalRepsMedio > 0 && (
                      <Text style={styles.chartFooterText}>
                        Media {formatearCompacto(resumen.totalRepsMedio)} reps
                        por sesión
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.listHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listKicker}>REGISTROS</Text>
                    <Text style={styles.listTitle}>Todas las sesiones</Text>
                  </View>
                  <View style={styles.listCount}>
                    <Text style={styles.listCountText}>
                      {sesionesDesc.length}
                    </Text>
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
                      onUsar={onUsarSesion ? usarSesion : undefined}
                    />
                  );
                })}

                <View style={styles.footerNote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={13}
                    color={noir.muted2}
                  />
                  <Text style={styles.footerNoteText}>
                    Historial construido con tus sesiones finalizadas. Los
                    registros se ordenan por fecha real de entrenamiento.
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: noir.bg,
  },
  header: {
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.075)',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerKicker: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.7,
    marginTop: 4,
  },
  headerSubtitle: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    alignItems: 'center',
  },
  content: {
    gap: 14,
  },
  summaryCard: {
    backgroundColor: 'rgba(16, 19, 27, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.085)',
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryKicker: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 15,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  summaryIcon: {
    width: 33,
    height: 33,
    borderRadius: 11,
    backgroundColor: 'rgba(63, 242, 176, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 132,
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  statValue: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 20,
    letterSpacing: -0.5,
    marginTop: 3,
  },
  statDetail: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 8.5,
    lineHeight: 11,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.022)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  insightIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 11.5,
    letterSpacing: -0.1,
  },
  insightText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9,
    lineHeight: 12.5,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: 'rgba(16, 19, 27, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.085)',
    padding: 14,
    gap: 10,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  chartKicker: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chartTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 15,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  chartDescription: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9,
    lineHeight: 12,
    marginTop: -3,
  },
  metricTabs: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricTab: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  metricTabActive: {
    backgroundColor: 'rgba(92, 200, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.2)',
  },
  metricTabText: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 8,
    letterSpacing: 0.2,
  },
  metricTabTextActive: {
    color: '#C9EEFF',
  },
  chartScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  chartScaleText: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 7.5,
    letterSpacing: 0.25,
  },
  chartDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  chartDateText: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 8,
  },
  chartEmpty: {
    minHeight: 116,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.09)',
    backgroundColor: 'rgba(255, 255, 255, 0.017)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 7,
  },
  chartEmptyText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    lineHeight: 13,
    textAlign: 'center',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.055)',
  },
  chartFooterText: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 8,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  listKicker: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  listTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 16,
    letterSpacing: -0.25,
    marginTop: 2,
  },
  listCount: {
    minWidth: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.17)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  listCountText: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 10,
  },
  sessionCard: {
    backgroundColor: 'rgba(16, 19, 27, 0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(92, 200, 255, 0.28)',
    padding: 12,
    gap: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sessionDateBlock: {
    flex: 1,
    minWidth: 0,
  },
  sessionDate: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  sessionContext: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 2,
  },
  sessionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeLatest: {
    backgroundColor: 'rgba(92, 200, 255, 0.065)',
    borderColor: 'rgba(92, 200, 255, 0.17)',
  },
  badgeRecord: {
    backgroundColor: 'rgba(255, 209, 102, 0.06)',
    borderColor: 'rgba(255, 209, 102, 0.17)',
  },
  badgeText: {
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.55,
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.055)',
    paddingVertical: 8,
  },
  sessionStat: {
    flex: 1,
    paddingHorizontal: 8,
    gap: 2,
  },
  sessionStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginVertical: 2,
  },
  sessionStatLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 6.5,
    letterSpacing: 0.55,
  },
  sessionStatValue: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 10.5,
    letterSpacing: -0.1,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deltaText: {
    fontFamily: fuentes.medium,
    fontSize: 8.5,
    lineHeight: 11,
    flex: 1,
  },
  seriesBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.018)',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 7,
  },
  seriesBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.055)',
  },
  seriesBoxTitle: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 7,
    letterSpacing: 0.7,
  },
  seriesBoxCount: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 7.5,
  },
  serieRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  serieNumber: {
    width: 25,
    height: 21,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  serieNumberDone: {
    backgroundColor: 'rgba(63, 242, 176, 0.07)',
    borderColor: 'rgba(63, 242, 176, 0.18)',
  },
  serieNumberText: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 7,
  },
  serieNumberTextDone: {
    color: noir.mint,
  },
  serieBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  serieValues: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  serieValue: {
    color: noir.platinum,
    fontFamily: fuentes.medium,
    fontSize: 10,
    letterSpacing: -0.1,
  },
  serieSeparator: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10,
  },
  serieTag: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  serieTagText: {
    fontFamily: fuentes.bold,
    fontSize: 6.5,
    letterSpacing: 0.25,
  },
  serieDrops: {
    color: noir.info,
    fontFamily: fuentes.regular,
    fontSize: 8,
    lineHeight: 11,
  },
  serieNote: {
    color: noir.champagne,
    fontFamily: fuentes.regular,
    fontSize: 8,
    lineHeight: 11,
    fontStyle: 'italic',
  },
  exerciseNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(255, 209, 102, 0.035)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  exerciseNoteLabel: {
    color: noir.champagne,
    fontFamily: fuentes.bold,
    fontSize: 6.5,
    letterSpacing: 0.55,
    marginBottom: 2,
  },
  exerciseNoteText: {
    color: noir.platinum,
    fontFamily: fuentes.regular,
    fontSize: 9,
    lineHeight: 12,
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.18)',
    backgroundColor: 'rgba(63, 242, 176, 0.045)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  useButtonText: {
    color: noir.mint,
    fontFamily: fuentes.bold,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  footerNoteText: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 8,
    lineHeight: 11.5,
    flex: 1,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(16, 19, 27, 0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    padding: 18,
    minHeight: 110,
  },
  loadingOrb: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(92, 200, 255, 0.065)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  loadingText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: 'rgba(16, 19, 27, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 9,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(92, 200, 255, 0.065)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  errorIcon: {
    backgroundColor: 'rgba(255, 122, 144, 0.065)',
    borderColor: 'rgba(255, 122, 144, 0.16)',
  },
  emptyTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 16,
    letterSpacing: -0.25,
    textAlign: 'center',
  },
  emptyText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 10,
    lineHeight: 14.5,
    textAlign: 'center',
    maxWidth: 360,
  },
  emptyStrong: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyHintText: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 8,
  },
  errorDetail: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 8,
    lineHeight: 11,
    textAlign: 'center',
    maxWidth: 320,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.22)',
    backgroundColor: 'rgba(92, 200, 255, 0.07)',
  },
  retryButtonText: {
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
  },
});
