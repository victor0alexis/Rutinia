import React, { useEffect, useState, useMemo } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Canvas,
  Box,
  BoxShadow,
  rect,
  rrect,
} from '@shopify/react-native-skia';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colores, fuentes, noir } from '../constants/colores';
import { Registro } from '../types';
import {
  SesionActivaInfo,
  obtenerBorradorSesion,
  limpiarSesionActiva,
  BorradorSesion,
} from '../utils/sesionActiva';
import { formatearTiempo, formatearTiempoTexto } from '../utils/timer';
import { vibrarBoton } from '../utils/haptics';
import { confirmarAccion } from '../utils/errores';
import { parsearEjercicioInfo } from '../utils/ejercicios';

export interface RutinaLiveCardProps {
  registro: Registro;
  sesionActivaInfo?: SesionActivaInfo | null;
  onIniciar: (registro: Registro) => void;
  onReanudar: (registro: Registro) => void;
  onVerResumen: (registro: Registro) => void;
  onDesvincular?: (registro: Registro) => void;
  onDescartar?: (registro: Registro) => void;
  permitirDesplegarEjercicios?: boolean;
  conEfectoGlowBlanco?: boolean;
  /** La variante `home` usa Noir Pearl sin alterar el estilo del modal. */
  variant?: 'default' | 'home';
}

export default function RutinaLiveCard({
  registro,
  sesionActivaInfo,
  onIniciar,
  onReanudar,
  onVerResumen,
  onDesvincular,
  onDescartar,
  permitirDesplegarEjercicios = false,
  conEfectoGlowBlanco = false,
  variant = 'default',
}: RutinaLiveCardProps) {
  const esHome = variant === 'home';
  const [ejerciciosDesplegados, setEjerciciosDesplegados] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const isWeb = Platform.OS === 'web';
  const estaEnProceso = Boolean(
    sesionActivaInfo && sesionActivaInfo.registroId === registro.id
  );
  const estaFinalizada = Boolean(registro.completado && !estaEnProceso);
  const estaPendiente = !estaFinalizada && !estaEnProceso;

  // Pulso del indicador "En proceso": el mismo gesto del prototipo, aplicado
  // solo al halo para no alterar el tamaño del badge.
  const reduceMotion = useReducedMotion();
  const livePulso = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(livePulso);
    if (!estaEnProceso || reduceMotion) {
      livePulso.value = 0;
      return;
    }

    livePulso.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    return () => cancelAnimation(livePulso);
  }, [estaEnProceso, livePulso, reduceMotion]);

  const livePulseStyle = useAnimatedStyle(() => ({
    opacity: 0.38 + livePulso.value * 0.28,
    transform: [{ scale: 1 + livePulso.value * 1.15 }],
  }));

  // Cronómetro en vivo si está en proceso
  const [segundosDelta, setSegundosDelta] = useState(0);

  useEffect(() => {
    if (!estaEnProceso) return;

    const interval = setInterval(() => {
      setSegundosDelta((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [estaEnProceso]);

  const segundosEnVivo = (sesionActivaInfo?.segsTranscurridos || 0) + segundosDelta;

  // Duración final guardada si está finalizada
  const [duracionFinalSegs, setDuracionFinalSegs] = useState<number | null>(null);

  useEffect(() => {
    if (!estaFinalizada) return;
    let activo = true;

    AsyncStorage.getItem(`rutinia_duracion_${registro.id}`)
      .then((val) => {
        if (!activo) return;
        if (val) {
          const segs = Number(val);
          if (!isNaN(segs) && segs > 0) {
            setDuracionFinalSegs(segs);
          }
        }
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
  }, [estaFinalizada, registro.id]);

  // Datos de la rutina y ejercicios
  const nombrePlan =
    registro.plan_nombre || registro.planes_entrenamiento?.nombre || null;
  const planColor =
    registro.planes_entrenamiento?.color || colores.primarioHover;
  const nombreRutina =
    registro.rutina_nombre ||
    registro.rutinas?.nombre ||
    'Rutina Asignada';

  const ejsPuros = useMemo(
    () =>
      (registro.ejercicios_registro || []).filter(
        (e) => !e.nombre.startsWith('📌')
      ),
    [registro.ejercicios_registro]
  );

  const totalEjercicios = ejsPuros.length;
  const totalSeries = useMemo(() => {
    return ejsPuros.reduce((acc, ej) => acc + (ej.series || 3), 0);
  }, [ejsPuros]);

  // Borrador persistente de la sesión activa para extraer detalles inteligentes
  const [borrador, setBorrador] = useState<BorradorSesion | null>(null);

  useEffect(() => {
    if (!estaEnProceso) return;
    let activo = true;
    obtenerBorradorSesion(registro.id).then((b) => {
      if (activo) {
        setBorrador(b);
      }
    });
    return () => {
      activo = false;
    };
  }, [estaEnProceso, registro.id]);

  const borradorActivo = estaEnProceso ? borrador : null;

  // Desglose inteligente de series y próximo ejercicio
  const { seriesCompletadasLive, totalSeriesLive, proximoEjercicioNombre, proximaSerieIndice } =
    useMemo(() => {
      let comps = sesionActivaInfo?.seriesCompletadas || 0;
      let tots = sesionActivaInfo?.totalSeries || totalSeries;
      let nextName = '';
      let nextSet = 0;

      if (borradorActivo?.ejerciciosState && borradorActivo.ejerciciosState.length > 0) {
        let bComps = 0;
        let bTots = 0;
        let foundNext = false;

        for (const ej of borradorActivo.ejerciciosState) {
          bTots += ej.series.length;
          const c = ej.series.filter((s) => s.completado).length;
          bComps += c;

          if (!foundNext) {
            const nextIdx = ej.series.findIndex((s) => !s.completado);
            if (nextIdx !== -1) {
              nextName = ej.nombre;
              nextSet = nextIdx + 1;
              foundNext = true;
            }
          }
        }

        if (bTots > 0) {
          tots = bTots;
          comps = bComps;
        }
      }

      return {
        seriesCompletadasLive: comps,
        totalSeriesLive: tots,
        proximoEjercicioNombre: nextName,
        proximaSerieIndice: nextSet,
      };
    }, [borradorActivo, sesionActivaInfo, totalSeries]);

  const porcentajeLive =
    totalSeriesLive > 0
      ? Math.round((seriesCompletadasLive / totalSeriesLive) * 100)
      : 0;

  const handleDescartarSesion = () => {
    confirmarAccion(
      'Descartar Entrenamiento',
      '¿Estás seguro de que deseas cancelar la sesión en curso? Se perderán las series de este borrador.',
      async () => {
        await limpiarSesionActiva(registro.id);
        if (onDescartar) {
          onDescartar(registro);
        }
      },
      'Descartar'
    );
  };

  // Manejo de la acción según estado
  const handlePressAccion = () => {
    vibrarBoton();
    if (estaEnProceso) {
      onReanudar(registro);
    } else if (estaFinalizada) {
      onVerResumen(registro);
    } else {
      onIniciar(registro);
    }
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.cardContainer,
        esHome && styles.cardContainerHome,
        conEfectoGlowBlanco && styles.cardContainerGlowBase,
        conEfectoGlowBlanco && isWeb && styles.cardContainerGlowWeb,
        !esHome && estaEnProceso && styles.cardContainerEnProceso,
        !esHome && estaFinalizada && styles.cardContainerFinalizada,
      ]}
    >
      {/* Fondo Skia en plataformas nativas para el efecto Uiverse con Outer Glow e Inset Glow */}
      {conEfectoGlowBlanco && !isWeb && dimensions.width > 0 && dimensions.height > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Box
            box={rrect(rect(0, 0, dimensions.width, dimensions.height), 20, 20)}
            color="rgb(15, 15, 15)"
          >
            {/* Outer Glow perla frío difuso */}
            <BoxShadow
              dx={0}
              dy={0}
              blur={28}
              color="rgba(226, 239, 255, 0.52)"
            />
            {/* Inset Glow perla desde los bordes hacia el centro */}
            <BoxShadow
              dx={0}
              dy={0}
              blur={50}
              color="rgba(226, 239, 255, 0.24)"
              inner
            />
          </Box>
        </Canvas>
      )}

      {/* 1. Header con Badge de Plan y Estado */}
      <View style={styles.headerRow}>
        {nombrePlan ? (
          esHome ? (
            <LinearGradient
              colors={[
                'rgba(92, 200, 255, 0.24)',
                'rgba(92, 200, 255, 0.075)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planBadgeHome}
            >
              <View style={styles.planBadgeDotHome} />
              <Text numberOfLines={1} style={styles.planBadgeTextHome}>
                {nombrePlan.toUpperCase()}
              </Text>
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.planBadge,
                {
                  backgroundColor: `${planColor}18`,
                  borderColor: `${planColor}40`,
                },
              ]}
            >
              <View style={[styles.planBadgeDot, { backgroundColor: planColor }]} />
              <Text
                numberOfLines={1}
                style={[styles.planBadgeText, { color: planColor }]}
              >
                {nombrePlan.toUpperCase()}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.planBadgePlaceholder} />
        )}

        <View style={styles.headerActions}>
          {/* Badge de Estado */}
          {estaEnProceso &&
            (esHome ? (
              <LinearGradient
                colors={[
                  'rgba(63, 242, 176, 0.22)',
                  'rgba(63, 242, 176, 0.06)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badgeLiveHome}
              >
                <View style={styles.liveDotWrap}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.liveDotHalo, livePulseStyle]}
                  />
                  <View style={styles.liveDotCore} />
                </View>
                <Text style={styles.badgeLiveTextHome}>EN PROCESO</Text>
              </LinearGradient>
            ) : (
              <View style={styles.badgeEnProceso}>
                <View style={styles.dotLivePulse} />
                <Text style={styles.badgeEnProcesoText}>EN PROCESO</Text>
              </View>
            ))}

          {/* Botón discreto de descartar sesión en proceso */}
          {estaEnProceso && (
            <Pressable
              onPress={handleDescartarSesion}
              hitSlop={8}
              style={[styles.discardLiveBtn, esHome && styles.iconButtonHome]}
              accessibilityRole="button"
              accessibilityLabel="Descartar entrenamiento en curso"
            >
              <Ionicons
                name="trash-outline"
                size={13}
                color={esHome ? noir.muted : 'rgba(248, 113, 113, 0.9)'}
              />
            </Pressable>
          )}

          {estaFinalizada &&
            (esHome ? (
              <LinearGradient
                colors={[
                  'rgba(63, 242, 176, 0.18)',
                  'rgba(63, 242, 176, 0.05)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badgeDoneHome}
              >
                <Ionicons name="checkmark-circle" size={11} color={noir.mint} />
                <Text style={styles.badgeDoneTextHome}>FINALIZADA</Text>
              </LinearGradient>
            ) : (
              <View style={styles.badgeFinalizada}>
                <Ionicons name="checkmark-circle" size={12} color={colores.exito} />
                <Text style={styles.badgeFinalizadaText}>FINALIZADA</Text>
              </View>
            ))}

          {estaPendiente &&
            (esHome ? (
              <LinearGradient
                colors={[
                  'rgba(92, 200, 255, 0.18)',
                  'rgba(92, 200, 255, 0.045)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badgePendingHome}
              >
                <Text style={styles.badgePendingTextHome}>POR INICIAR</Text>
              </LinearGradient>
            ) : (
              <View style={styles.badgePendiente}>
                <Text style={styles.badgePendienteText}>POR INICIAR</Text>
              </View>
            ))}

          {/* Botón discreto de desvincular */}
          {Boolean(onDesvincular) && (
            <Pressable
              onPress={() => onDesvincular && onDesvincular(registro)}
              hitSlop={8}
              style={[styles.unlinkGlassBtn, esHome && styles.iconButtonHome]}
            >
              <Ionicons
                name="trash-outline"
                size={13}
                color={esHome ? noir.muted : 'rgba(248, 113, 113, 0.85)'}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* 2. Título de la Rutina */}
      <Text
        numberOfLines={1}
        style={[styles.tituloRutina, esHome && styles.tituloRutinaHome]}
      >
        {nombreRutina}
      </Text>

      {/* 3. Indicador de Tiempo / Cronómetro / Series */}
      {esHome ? (
        <View style={styles.timerRowHome}>
          {estaEnProceso && (
            <View style={styles.timerSectionLive}>
              <View style={styles.timerPillsRowLive}>
                <LinearGradient
                  colors={[
                    'rgba(255, 209, 102, 0.14)',
                    'rgba(255, 209, 102, 0.035)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.timerBoxHome}
                >
                  <Ionicons name="time" size={13} color={noir.champagne} />
                  <Text style={styles.timerTextHome}>
                    {formatearTiempo(segundosEnVivo)}
                  </Text>
                  <Text style={styles.timerLabelHome}>CRONÓMETRO EN VIVO</Text>
                </LinearGradient>

                {totalSeriesLive > 0 && (
                  <LinearGradient
                    colors={[
                      'rgba(179, 148, 255, 0.20)',
                      'rgba(179, 148, 255, 0.05)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.seriesPillHome}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={12}
                      color={noir.lavender}
                    />
                    <Text style={styles.seriesTextHome}>
                      {seriesCompletadasLive}/{totalSeriesLive} series
                    </Text>
                    {porcentajeLive > 0 && (
                      <Text style={styles.seriesPctHome}>
                        ({porcentajeLive}%)
                      </Text>
                    )}
                  </LinearGradient>
                )}
              </View>

              {/* Barra de progreso de series completadas */}
              {totalSeriesLive > 0 && (
                <View style={styles.liveProgressBarContainer}>
                  <LinearGradient
                    colors={['#5CC8FF', '#B394FF', '#F2EEFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.liveProgressBarFill,
                      { width: `${Math.max(porcentajeLive, 4)}%` },
                    ]}
                  />
                </View>
              )}

              {/* Snapshot inteligente: Próximo ejercicio */}
              {Boolean(proximoEjercicioNombre) && (
                <LinearGradient
                  colors={[
                    'rgba(92, 200, 255, 0.11)',
                    'rgba(92, 200, 255, 0.02)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextRowHome}
                >
                  <Ionicons name="bookmark" size={11} color={noir.info} />
                  <Text style={styles.nextTextHome} numberOfLines={1}>
                    Siguiente:{' '}
                    <Text style={styles.nextNameHome}>
                      {proximoEjercicioNombre}
                    </Text>
                    {proximaSerieIndice > 0 ? (
                      <Text style={styles.nextSerieHome}>
                        {` (Serie ${proximaSerieIndice})`}
                      </Text>
                    ) : null}
                  </Text>
                </LinearGradient>
              )}
            </View>
          )}

          {estaFinalizada && (
            <LinearGradient
              colors={[
                'rgba(255, 209, 102, 0.14)',
                'rgba(255, 209, 102, 0.035)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.timerBoxHome}
            >
              <Ionicons name="trophy-outline" size={13} color={noir.champagne} />
              <Text style={styles.timerTextHome}>
                {duracionFinalSegs
                  ? formatearTiempoTexto(duracionFinalSegs)
                  : `${totalSeries * 2.5} min aprox`}
              </Text>
              <Text style={styles.timerLabelHome}>TIEMPO DE EJECUCIÓN</Text>
            </LinearGradient>
          )}

          {estaPendiente && (
            <View style={styles.timerBoxPendingHome}>
              <Ionicons
                name="stopwatch-outline"
                size={13}
                color={noir.info}
              />
              <Text style={styles.timerTextPendingHome}>
                ~{Math.max(25, Math.round(totalSeries * 2.5))} min estimados
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.timerRow}>
          {estaEnProceso && (
            <View style={styles.timerSectionLive}>
              <View style={styles.timerPillsRowLive}>
                <View style={styles.timerBoxLive}>
                  <Ionicons name="time" size={14} color="#F59E0B" />
                  <Text style={styles.timerTextLive}>
                    {formatearTiempo(segundosEnVivo)}
                  </Text>
                  <Text style={styles.timerLabelLive}>CRONÓMETRO EN VIVO</Text>
                </View>

                {totalSeriesLive > 0 && (
                  <View style={styles.seriesProgressPillLive}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={12}
                      color="#10B981"
                    />
                    <Text style={styles.seriesProgressTextLive}>
                      {seriesCompletadasLive}/{totalSeriesLive} series
                    </Text>
                    {porcentajeLive > 0 && (
                      <Text style={styles.seriesProgressPctLive}>
                        ({porcentajeLive}%)
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Barra de progreso de series completadas */}
              {totalSeriesLive > 0 && (
                <View style={styles.liveProgressBarContainer}>
                  <View
                    style={[
                      styles.liveProgressBarFill,
                      { width: `${Math.max(porcentajeLive, 4)}%` },
                    ]}
                  />
                </View>
              )}

              {/* Snapshot inteligente: Próximo ejercicio */}
              {Boolean(proximoEjercicioNombre) && (
                <View style={styles.proximoEjercicioRow}>
                  <Ionicons name="bookmark" size={11} color="#F59E0B" />
                  <Text style={styles.proximoEjercicioText} numberOfLines={1}>
                    Siguiente:{' '}
                    <Text style={styles.proximoEjercicioNombre}>
                      {proximoEjercicioNombre}
                    </Text>
                    {proximaSerieIndice > 0
                      ? ` (Serie ${proximaSerieIndice})`
                      : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {estaFinalizada && (
            <View style={styles.timerBoxDone}>
              <Ionicons name="trophy-outline" size={13} color={colores.exito} />
              <Text style={styles.timerTextDone}>
                {duracionFinalSegs
                  ? formatearTiempoTexto(duracionFinalSegs)
                  : `${totalSeries * 2.5} min aprox`}
              </Text>
              <Text style={styles.timerLabelDone}>TIEMPO DE EJECUCIÓN</Text>
            </View>
          )}

          {estaPendiente && (
            <View style={styles.timerBoxPending}>
              <Ionicons
                name="stopwatch-outline"
                size={13}
                color={colores.suave}
              />
              <Text style={styles.timerTextPending}>
                ~{Math.max(25, Math.round(totalSeries * 2.5))} min estimados
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 4. Métricas Compactas y Botón de Acción */}
      {esHome ? (
        <View style={styles.footerRowHome}>
          <View style={styles.metricChipsHome}>
            <View style={styles.metricChipExHome}>
              <Ionicons name="barbell-outline" size={11} color={noir.info} />
              <Text style={styles.metricChipExTextHome}>
                {totalEjercicios} ejercicios
              </Text>
            </View>

            <View style={styles.metricChipSeriesHome}>
              <Ionicons name="repeat-outline" size={11} color={noir.lavender} />
              <Text style={styles.metricChipSeriesTextHome}>
                {estaEnProceso
                  ? `${seriesCompletadasLive}/${totalSeriesLive} series`
                  : `${totalSeries} series`}
              </Text>
            </View>
          </View>

          <RoutineActionButton
            estado={
              estaEnProceso
                ? 'proceso'
                : estaFinalizada
                ? 'finalizada'
                : 'pendiente'
            }
            onPress={handlePressAccion}
          />
        </View>
      ) : (
      <View style={styles.footerRow}>
        <View style={styles.metricChipsContainer}>
          <View style={styles.metricChip}>
            <Ionicons name="barbell-outline" size={12} color={colores.suave} />
            <Text style={styles.metricChipText}>{totalEjercicios} ejercicios</Text>
          </View>

          <View style={styles.metricChip}>
            <Ionicons name="repeat-outline" size={12} color={colores.suave} />
            <Text style={styles.metricChipText}>
              {estaEnProceso
                ? `${seriesCompletadasLive}/${totalSeriesLive} series`
                : `${totalSeries} series`}
            </Text>
          </View>
        </View>

        {/* Botón de Acción según Estado */}
        <Pressable
          onPress={handlePressAccion}
          style={({ pressed }) => [
            styles.actionButton,
            estaEnProceso && styles.actionButtonLive,
            estaFinalizada && styles.actionButtonDone,
            estaPendiente && styles.actionButtonPending,
            pressed && { opacity: 0.84, transform: [{ scale: 0.98 }] },
          ]}
        >
          {estaEnProceso && (
            <>
              <Ionicons name="flash" size={13} color="#FFFFFF" />
              <Text style={styles.actionButtonTextLive}>Reanudar</Text>
            </>
          )}

          {estaFinalizada && (
            <>
              <Ionicons name="eye-outline" size={13} color={colores.exito} />
              <Text style={styles.actionButtonTextDone}>Ver Resumen</Text>
            </>
          )}

          {estaPendiente && (
            <>
              <Ionicons name="play" size={12} color="#FFFFFF" />
              <Text style={styles.actionButtonTextPending}>Iniciar</Text>
            </>
          )}
        </Pressable>
      </View>
      )}

      {/* 5. Desglose colapsable opcional de ejercicios */}
      {permitirDesplegarEjercicios && totalEjercicios > 0 && (
        <View style={styles.collapseWrapper}>
          <Pressable
            onPress={() => {
              vibrarBoton();
              setEjerciciosDesplegados(!ejerciciosDesplegados);
            }}
            style={styles.collapseToggleBtn}
          >
            <Text style={styles.collapseToggleText}>
              {ejerciciosDesplegados ? 'Ocultar ejercicios' : `Ver ejercicios (${totalEjercicios})`}
            </Text>
            <Ionicons
              name={ejerciciosDesplegados ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={colores.suave}
            />
          </Pressable>

          {ejerciciosDesplegados && (
            <View style={styles.exercisesListExpanded}>
              {ejsPuros.map((ej) => {
                const parsed = parsearEjercicioInfo(ej);
                return (
                  <View key={ej.id} style={styles.expandedExerciseRow}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.expandedExerciseName} numberOfLines={1}>
                        {parsed.nombreLimpio}
                      </Text>
                      {parsed.tieneDropset && (
                        <View style={styles.miniTag}>
                          <Text style={styles.miniTagText}>DROP</Text>
                        </View>
                      )}
                      {parsed.tieneParciales && (
                        <View style={styles.miniTag}>
                          <Text style={styles.miniTagText}>PARCIAL</Text>
                        </View>
                      )}
                      {Boolean(parsed.sustituyeANombre) && (
                        <View style={styles.miniTag}>
                          <Text style={styles.miniTagText}>↔ {parsed.sustituyeANombre}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.expandedExerciseSets}>
                      {ej.series ? `${ej.series} series` : ''} {ej.repeticiones ? `· ${ej.repeticiones}r` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

type RoutineActionEstado = 'proceso' | 'finalizada' | 'pendiente';

function RoutineActionButton({
  estado,
  onPress,
}: {
  estado: RoutineActionEstado;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const config =
    estado === 'finalizada'
      ? {
          label: 'Ver Resumen',
          icon: 'eye-outline' as keyof typeof Ionicons.glyphMap,
          iconColor: noir.lavender,
          colors: ['#FFFFFF', '#FBF8FF', '#EFE8FF', '#DED2FF'] as const,
        }
      : estado === 'pendiente'
      ? {
          label: 'Iniciar',
          icon: 'play' as keyof typeof Ionicons.glyphMap,
          iconColor: noir.info,
          colors: ['#FFFFFF', '#F5FCFF', '#E6F5FF', '#CDEBFF'] as const,
        }
      : {
          label: 'Reanudar',
          icon: 'play' as keyof typeof Ionicons.glyphMap,
          iconColor: noir.pearl,
          colors: ['#FFFFFF', '#F4FBFF', '#E4F2FF', '#E6DDFF'] as const,
        };

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.actionButtonHome,
        hovered && styles.actionButtonHomeHover,
        pressed && styles.actionButtonHomePressed,
        Platform.OS === 'web' && styles.actionButtonHomeWeb,
        hovered && Platform.OS === 'web' && styles.actionButtonHomeHoverWeb,
      ]}
      accessibilityRole="button"
      accessibilityLabel={config.label}
    >
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionButtonHomeGradient}
      >
        <LinearGradient
          colors={['#1B2230', '#080A0E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionIconHome}
        >
          <Ionicons name={config.icon} size={10} color={config.iconColor} />
        </LinearGradient>
        <Text style={styles.actionButtonHomeText}>{config.label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContainerEnProceso: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: '#1C1917',
  },
  cardContainerFinalizada: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: '#131816',
  },
  cardContainerGlowBase: {
    backgroundColor: 'rgb(15, 15, 15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.52,
    shadowRadius: 22,
    elevation: 12,
    marginVertical: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  cardContainerGlowWeb: {
    // @ts-ignore
    boxShadow:
      '0 0 50px 0px rgba(226, 239, 255, 0.52), inset 0 0 90px 0px rgba(226, 239, 255, 0.24)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  planBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  planBadgePlaceholder: {
    height: 18,
  },
  planBadgeText: {
    fontFamily: fuentes.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  badgeEnProceso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dotLivePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  badgeEnProcesoText: {
    color: '#F59E0B',
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  badgeFinalizada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeFinalizadaText: {
    color: colores.exito,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  badgePendiente: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePendienteText: {
    color: colores.suave,
    fontFamily: fuentes.medium,
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  tituloRutina: {
    fontFamily: fuentes.extraBold,
    fontSize: 17,
    color: colores.texto,
    letterSpacing: -0.2,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBoxLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  timerTextLive: {
    fontFamily: fuentes.bold,
    fontSize: 14,
    color: '#F59E0B',
  },
  timerLabelLive: {
    fontFamily: fuentes.medium,
    fontSize: 9,
    color: 'rgba(245, 158, 11, 0.8)',
    letterSpacing: 0.4,
  },
  timerBoxDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
  },
  timerTextDone: {
    fontFamily: fuentes.bold,
    fontSize: 12.5,
    color: colores.exito,
  },
  timerLabelDone: {
    fontFamily: fuentes.medium,
    fontSize: 9,
    color: 'rgba(16, 185, 129, 0.8)',
    letterSpacing: 0.4,
  },
  timerBoxPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timerTextPending: {
    fontFamily: fuentes.regular,
    fontSize: 12,
    color: colores.suave,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    gap: 10,
  },
  metricChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricChipText: {
    fontFamily: fuentes.medium,
    fontSize: 11,
    color: colores.suave,
  },
  discardLiveBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerSectionLive: {
    width: '100%',
    gap: 7,
  },
  timerPillsRowLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  seriesProgressPillLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  seriesProgressTextLive: {
    fontFamily: fuentes.bold,
    fontSize: 11.5,
    color: '#10B981',
  },
  seriesProgressPctLive: {
    fontFamily: fuentes.regular,
    fontSize: 11,
    color: 'rgba(16, 185, 129, 0.85)',
  },
  liveProgressBarContainer: {
    width: '100%',
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  liveProgressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 2,
  },
  proximoEjercicioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  proximoEjercicioText: {
    fontFamily: fuentes.medium,
    fontSize: 11.5,
    color: '#D4D4D8',
    flex: 1,
  },
  proximoEjercicioNombre: {
    fontFamily: fuentes.bold,
    color: '#FFFFFF',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionButtonLive: {
    backgroundColor: '#C22240',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: '#C22240',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  actionButtonTextLive: {
    fontFamily: fuentes.bold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  actionButtonDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  actionButtonTextDone: {
    fontFamily: fuentes.bold,
    fontSize: 12,
    color: colores.exito,
  },
  actionButtonPending: {
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  actionButtonTextPending: {
    fontFamily: fuentes.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  unlinkGlassBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseWrapper: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  collapseToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  collapseToggleText: {
    fontFamily: fuentes.bold,
    fontSize: 11,
    color: colores.suave,
  },
  exercisesListExpanded: {
    marginTop: 8,
    gap: 7,
  },
  expandedExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  expandedExerciseName: {
    fontFamily: fuentes.bold,
    fontSize: 12.5,
    color: '#F4F4F5',
  },
  expandedExerciseSets: {
    fontFamily: fuentes.regular,
    fontSize: 11,
    color: colores.suave,
  },
  miniTag: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  miniTagText: {
    fontFamily: fuentes.bold,
    fontSize: 9,
    color: '#A1A1AA',
  },

  // ── Variante Noir Pearl para la pantalla principal ──────────────
  cardContainerHome: {
    backgroundColor: noir.routine,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: noir.line,
    gap: 9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  planBadgeHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.58)',
    flexShrink: 1,
    shadowColor: noir.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 2,
  },
  planBadgeDotHome: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: noir.info,
    shadowColor: noir.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 2,
  },
  planBadgeTextHome: {
    color: '#EAF7FF',
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  badgeLiveHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.58)',
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 2,
  },
  liveDotWrap: {
    width: 9,
    height: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotHalo: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: noir.mint,
  },
  liveDotCore: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: noir.mint,
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 5,
    elevation: 3,
  },
  badgeLiveTextHome: {
    color: '#EAFFF8',
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 0.54,
  },
  iconButtonHome: {
    backgroundColor: noir.glass,
    borderColor: noir.line,
  },
  badgeDoneHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.45)',
  },
  badgeDoneTextHome: {
    color: '#EAFFF8',
    fontFamily: fuentes.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  badgePendingHome: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.42)',
  },
  badgePendingTextHome: {
    color: '#D9F0FF',
    fontFamily: fuentes.medium,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  tituloRutinaHome: {
    fontFamily: fuentes.extraBold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  timerRowHome: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerBoxHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.48)',
    shadowColor: noir.champagne,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 1,
  },
  timerTextHome: {
    fontFamily: fuentes.bold,
    fontSize: 13.5,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  timerLabelHome: {
    fontFamily: fuentes.semiBold,
    fontSize: 8,
    color: 'rgba(255, 231, 174, 0.88)',
    letterSpacing: 0.56,
    textTransform: 'uppercase',
  },
  seriesPillHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(179, 148, 255, 0.55)',
    shadowColor: noir.lavender,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 1,
  },
  seriesTextHome: {
    fontFamily: fuentes.bold,
    fontSize: 10.5,
    color: '#F0EBFF',
  },
  seriesPctHome: {
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    color: 'rgba(214, 201, 255, 0.82)',
  },
  nextRowHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.14)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(92, 200, 255, 0.85)',
    borderRadius: 8,
  },
  nextTextHome: {
    flex: 1,
    fontFamily: fuentes.medium,
    fontSize: 10.5,
    color: '#DBE9FB',
    lineHeight: 14,
  },
  nextNameHome: {
    fontFamily: fuentes.bold,
    color: '#FFFFFF',
  },
  nextSerieHome: {
    fontFamily: fuentes.regular,
    color: '#8E98A8',
  },
  timerBoxPendingHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  timerTextPendingHome: {
    fontFamily: fuentes.regular,
    fontSize: 12,
    color: noir.platinum,
  },
  footerRowHome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
    gap: 8,
  },
  metricChipsHome: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metricChipExHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(92, 200, 255, 0.15)',
  },
  metricChipExTextHome: {
    fontFamily: fuentes.medium,
    fontSize: 10,
    color: '#E3F3FF',
  },
  metricChipSeriesHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(179, 148, 255, 0.15)',
  },
  metricChipSeriesTextHome: {
    fontFamily: fuentes.medium,
    fontSize: 10,
    color: '#EDE9FF',
  },
  actionButtonHome: {
    flexShrink: 0,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: noir.info,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 13,
    elevation: 8,
  },
  actionButtonHomeHover: {
    transform: [{ translateY: -1 }],
    shadowOpacity: 0.46,
    shadowRadius: 16,
  },
  actionButtonHomePressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.94,
  },
  actionButtonHomeWeb: {
    // @ts-ignore
    boxShadow:
      '0 8px 26px rgba(92,200,255,.38), 0 0 24px rgba(179,148,255,.16), 0 0 0 1px rgba(255,255,255,.12)',
  },
  actionButtonHomeHoverWeb: {
    // @ts-ignore
    boxShadow:
      '0 11px 32px rgba(92,200,255,.46), 0 0 30px rgba(179,148,255,.22), 0 0 0 1px rgba(255,255,255,.16)',
  },
  actionButtonHomeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 5,
    paddingRight: 11,
    paddingVertical: 4,
    borderRadius: 13,
  },
  actionIconHome: {
    width: 21,
    height: 21,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: noir.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 2,
  },
  actionButtonHomeText: {
    fontFamily: fuentes.bold,
    fontSize: 11.5,
    color: '#080A0E',
    letterSpacing: 0.1,
  },
});

