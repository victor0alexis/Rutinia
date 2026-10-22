import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fuentes } from '../constants/colores';
import { formatearTiempo } from '../utils/timer';
import {
  SesionActivaInfo,
  limpiarSesionActiva,
  obtenerBorradorSesion,
  BorradorSesion,
} from '../utils/sesionActiva';
import { confirmarAccion } from '../utils/errores';

type Props = {
  visible: boolean;
  sesionInfo: SesionActivaInfo | null;
  onReanudar: () => void;
  onDescartar: () => void;
  onVolver?: () => void;
};

export default function ModalPartidaEnCurso({
  visible,
  sesionInfo,
  onReanudar,
  onDescartar,
  onVolver,
}: Props) {
  const [extraSegs, setExtraSegs] = useState(0);
  const [borrador, setBorrador] = useState<BorradorSesion | null>(null);
  const [minutosInactiva, setMinutosInactiva] = useState(0);

  useEffect(() => {
    if (!visible || !sesionInfo) return;

    const interval = setInterval(() => {
      setExtraSegs((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      setExtraSegs(0);
    };
  }, [visible, sesionInfo]);

  useEffect(() => {
    if (!visible || !sesionInfo) return;
    let isMounted = true;
    obtenerBorradorSesion(sesionInfo.registroId).then((b) => {
      if (isMounted && b) {
        setBorrador(b);
        if (b.updatedAt) {
          setMinutosInactiva(Math.max(0, Math.floor((Date.now() - b.updatedAt) / 60000)));
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [visible, sesionInfo]);

  if (!visible || !sesionInfo) return null;

  const segs = sesionInfo.segsTranscurridos + extraSegs;
  const porcentaje =
    sesionInfo.totalSeries > 0
      ? Math.round((sesionInfo.seriesCompletadas / sesionInfo.totalSeries) * 100)
      : 0;

  // Encontrar el próximo ejercicio pendiente dentro del borrador
  let proximoEjercicioNombre = '';
  let proximaSerieIndice = 0;
  let totalSeriesEjercicio = 0;

  if (borrador?.ejerciciosState) {
    for (const ej of borrador.ejerciciosState) {
      const idxPendiente = ej.series.findIndex((s) => !s.completado);
      if (idxPendiente !== -1) {
        proximoEjercicioNombre = ej.nombre;
        proximaSerieIndice = idxPendiente + 1;
        totalSeriesEjercicio = ej.series.length;
        break;
      }
    }
    if (!proximoEjercicioNombre && borrador.ejerciciosState.length > 0) {
      const ultimo = borrador.ejerciciosState[borrador.ejerciciosState.length - 1];
      proximoEjercicioNombre = ultimo.nombre;
      proximaSerieIndice = ultimo.series.length;
      totalSeriesEjercicio = ultimo.series.length;
    }
  }

  const handleDescartarConfirm = () => {
    confirmarAccion(
      'Descartar Entrenamiento',
      '¿Estás seguro de que deseas cancelar la sesión en curso? Se perderán los datos y avances no guardados.',
      async () => {
        await limpiarSesionActiva(sesionInfo.registroId);
        onDescartar();
      },
      'Descartar'
    );
  };

  const handleVolver = () => {
    if (onVolver) {
      onVolver();
    }
  };

  const inner = (
    <View style={styles.backdrop}>
      <View style={styles.cardWrapper}>
        {/* TOP CARD (weak-kangaroo-62) */}
        <View style={styles.topCard}>
          {/* Botón de cierre superior (Volver seguro) */}
          <Pressable
            onPress={handleVolver}
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.6, transform: [{ scale: 0.95 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Volver a la app"
          >
            <Ionicons name="close" size={14} color="#B5B5B5" />
          </Pressable>

          {/* Badge superior de estado */}
          <View style={styles.badgeRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.badgeText}>ENTRENAMIENTO EN CURSO</Text>
          </View>

          {/* Nombre de la rutina */}
          <Text style={styles.routineTitle} numberOfLines={2}>
            {sesionInfo.nombreRutina}
          </Text>

          {/* Cronómetro en vivo */}
          <View style={styles.timerContainer}>
            <View style={styles.timerLeft}>
              <Ionicons name="time-outline" size={18} color="#F5A24B" />
              <Text style={styles.timerText}>{formatearTiempo(segs)}</Text>
            </View>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>{porcentaje}%</Text>
            </View>
          </View>

          {/* Barra de progreso de series */}
          <View style={styles.seriesBarBg}>
            <View
              style={[
                styles.seriesBarFill,
                { width: `${Math.max(porcentaje, 4)}%` },
              ]}
            />
          </View>

          <View style={styles.seriesCountRow}>
            <Text style={styles.seriesCountText}>
              {sesionInfo.seriesCompletadas} de {sesionInfo.totalSeries} series
            </Text>
            <Text style={styles.seriesRemainingText}>
              {porcentaje === 100
                ? '¡Todas completadas!'
                : `${sesionInfo.totalSeries - sesionInfo.seriesCompletadas} restantes`}
            </Text>
          </View>
        </View>

        {/* BOTTOM CARD (Cajón Inteligente - weak-kangaroo-62) */}
        <View style={styles.bottomCard}>
          {/* Snapshot inteligente: Próximo ejercicio y estado de guardado */}
          <View style={styles.intelBox}>
            <Text style={styles.intelTitle}>📌 DÓNDE TE QUEDASTE</Text>
            <Text style={styles.intelValue} numberOfLines={1}>
              {proximoEjercicioNombre
                ? `${proximoEjercicioNombre} (Serie ${proximaSerieIndice}/${totalSeriesEjercicio})`
                : 'Listo para continuar'}
            </Text>
            <Text style={styles.intelSub}>
              💾 Guardado seguro en memoria local
              {minutosInactiva > 0 ? ` · Pausado hace ${minutosInactiva} min` : ' · Sesión activa'}
            </Text>
          </View>

          {/* Grupo de Acciones */}
          <View style={styles.actionsGroup}>
            {/* 1. Reanudar (Principal blanco brillante) */}
            <Pressable
              onPress={onReanudar}
              style={({ pressed }) => [
                styles.btnReanudar,
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reanudar Entrenamiento"
            >
              <Ionicons name="play" size={15} color="#0C0E12" />
              <Text style={styles.btnReanudarText}>Reanudar Entrenamiento</Text>
            </Pressable>

            {/* 2. Volver a la app sin perder sesión */}
            <Pressable
              onPress={handleVolver}
              style={({ pressed }) => [
                styles.btnVolver,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Volver a la app y mantener en pausa"
            >
              <Ionicons name="arrow-back" size={14} color="#E5E5E5" />
              <Text style={styles.btnVolverText}>Volver (Mantener en pausa)</Text>
            </Pressable>

            {/* 3. Descartar con confirmación */}
            <Pressable
              onPress={handleDescartarConfirm}
              style={({ pressed }) => [
                styles.btnDescartar,
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Descartar Entrenamiento"
            >
              <Ionicons name="trash-outline" size={13} color="#FFA7A7" />
              <Text style={styles.btnDescartarText}>Descartar Sesión</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={handleVolver}
    >
      {inner}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 5, 10, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 356,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 16,
  },
  topCard: {
    backgroundColor: '#11140E', // --color-primary de weak-kangaroo-62
    borderWidth: 1,
    borderColor: '#8A8B90', // --color-border de weak-kangaroo-62
    borderRadius: 16,
    padding: 18,
    paddingTop: 18,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(245, 162, 75, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 162, 75, 0.32)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F5A24B',
  },
  badgeText: {
    color: '#F5A24B',
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 0.6,
  },
  routineTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontFamily: fuentes.black,
    letterSpacing: -0.3,
    lineHeight: 26,
    marginBottom: 12,
    paddingRight: 28,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(138, 139, 144, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontFamily: fuentes.black,
    letterSpacing: 0.8,
  },
  progressPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fuentes.bold,
  },
  seriesBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  seriesBarFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  seriesCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seriesCountText: {
    color: '#A0A0A0',
    fontSize: 12,
    fontFamily: fuentes.medium,
  },
  seriesRemainingText: {
    color: '#22C55E',
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
  bottomCard: {
    backgroundColor: '#171A13', // Sub-capa complementaria Artahs
    borderWidth: 1,
    borderColor: 'rgba(138, 139, 144, 0.35)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  intelBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  intelTitle: {
    fontSize: 11,
    fontFamily: fuentes.bold,
    color: '#8A8B90',
    letterSpacing: 0.5,
  },
  intelValue: {
    fontSize: 13.5,
    fontFamily: fuentes.bold,
    color: '#FFFFFF',
  },
  intelSub: {
    fontSize: 11.5,
    fontFamily: fuentes.regular,
    color: '#8C9098',
  },
  actionsGroup: {
    gap: 8,
    width: '100%',
    marginTop: 2,
  },
  btnReanudar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  btnReanudarText: {
    color: '#0C0E12',
    fontSize: 14.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.2,
  },
  btnVolver: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnVolverText: {
    color: '#E5E5E5',
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  btnDescartar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 133, 0.28)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnDescartarText: {
    color: '#FFA7A7',
    fontSize: 12,
    fontFamily: fuentes.bold,
  },
});
