import React, { useEffect, useState, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { Registro } from '../types';
import { SesionActivaInfo } from '../utils/sesionActiva';
import { formatearTiempo, formatearTiempoTexto } from '../utils/timer';
import { vibrarBoton } from '../utils/haptics';

export interface RutinaLiveCardProps {
  registro: Registro;
  sesionActivaInfo?: SesionActivaInfo | null;
  onIniciar: (registro: Registro) => void;
  onReanudar: (registro: Registro) => void;
  onVerResumen: (registro: Registro) => void;
}

export default function RutinaLiveCard({
  registro,
  sesionActivaInfo,
  onIniciar,
  onReanudar,
  onVerResumen,
}: RutinaLiveCardProps) {
  const estaEnProceso = Boolean(
    sesionActivaInfo && sesionActivaInfo.registroId === registro.id
  );
  const estaFinalizada = Boolean(registro.completado && !estaEnProceso);
  const estaPendiente = !estaFinalizada && !estaEnProceso;

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
      style={[
        styles.cardContainer,
        estaEnProceso && styles.cardContainerEnProceso,
        estaFinalizada && styles.cardContainerFinalizada,
      ]}
    >
      {/* 1. Header con Badge de Plan y Estado */}
      <View style={styles.headerRow}>
        {nombrePlan ? (
          <View
            style={[
              styles.planBadge,
              {
                backgroundColor: `${planColor}18`,
                borderColor: `${planColor}40`,
              },
            ]}
          >
            <Ionicons name="barbell" size={11} color={planColor} />
            <Text
              numberOfLines={1}
              style={[styles.planBadgeText, { color: planColor }]}
            >
              {nombrePlan.toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={styles.planBadgePlaceholder} />
        )}

        {/* Badge de Estado */}
        {estaEnProceso && (
          <View style={styles.badgeEnProceso}>
            <View style={styles.dotLivePulse} />
            <Text style={styles.badgeEnProcesoText}>EN PROCESO</Text>
          </View>
        )}

        {estaFinalizada && (
          <View style={styles.badgeFinalizada}>
            <Ionicons name="checkmark-circle" size={12} color={colores.exito} />
            <Text style={styles.badgeFinalizadaText}>FINALIZADA</Text>
          </View>
        )}

        {estaPendiente && (
          <View style={styles.badgePendiente}>
            <Text style={styles.badgePendienteText}>POR INICIAR</Text>
          </View>
        )}
      </View>

      {/* 2. Título de la Rutina */}
      <Text numberOfLines={1} style={styles.tituloRutina}>
        {nombreRutina}
      </Text>

      {/* 3. Indicador de Tiempo / Cronómetro */}
      <View style={styles.timerRow}>
        {estaEnProceso && (
          <View style={styles.timerBoxLive}>
            <Ionicons name="time" size={14} color={colores.hoy} />
            <Text style={styles.timerTextLive}>
              {formatearTiempo(segundosEnVivo)}
            </Text>
            <Text style={styles.timerLabelLive}>CRONÓMETRO EN VIVO</Text>
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
            <Ionicons name="stopwatch-outline" size={13} color={colores.suave} />
            <Text style={styles.timerTextPending}>
              ~{Math.max(25, Math.round(totalSeries * 2.5))} min estimados
            </Text>
          </View>
        )}
      </View>

      {/* 4. Métricas Compactas y Botón de Acción */}
      <View style={styles.footerRow}>
        <View style={styles.metricChipsContainer}>
          <View style={styles.metricChip}>
            <Ionicons name="barbell-outline" size={12} color={colores.suave} />
            <Text style={styles.metricChipText}>{totalEjercicios} ejercicios</Text>
          </View>

          <View style={styles.metricChip}>
            <Ionicons name="repeat-outline" size={12} color={colores.suave} />
            <Text style={styles.metricChipText}>{totalSeries} series</Text>
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
    </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionButtonLive: {
    backgroundColor: colores.primarioHover,
    shadowColor: colores.primarioHover,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  actionButtonTextLive: {
    fontFamily: fuentes.bold,
    fontSize: 12,
    color: '#FFFFFF',
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
});
