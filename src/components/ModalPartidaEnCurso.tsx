import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { tema } from '../constants/tema';
import BotonRutinia from './BotonRutinia';
import { formatearTiempo } from '../utils/timer';
import { SesionActivaInfo, limpiarSesionActiva } from '../utils/sesionActiva';
import { confirmarAccion } from '../utils/errores';

type Props = {
  visible: boolean;
  sesionInfo: SesionActivaInfo | null;
  onReanudar: () => void;
  onDescartar: () => void;
};

export default function ModalPartidaEnCurso({
  visible,
  sesionInfo,
  onReanudar,
  onDescartar,
}: Props) {
  const [extraSegs, setExtraSegs] = useState(0);

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

  if (!visible || !sesionInfo) return null;

  const segs = sesionInfo.segsTranscurridos + extraSegs;

  const handleDescartarConfirm = () => {
    confirmarAccion(
      'Descartar Entrenamiento',
      '¿Estás seguro de que deseas cancelar la sesión en curso? Se perderán los datos no guardados.',
      async () => {
        await limpiarSesionActiva(sesionInfo.registroId);
        onDescartar();
      }
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => {}}
    >
      {/* Fondo borroso / Frosted glass overlay */}
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Badge superior de Estado En Vivo */}
          <View style={styles.badgeRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.badgeText}>ENTRENAMIENTO EN CURSO</Text>
          </View>

          {/* Título de la Rutina */}
          <View style={styles.headerInfo}>
            <Text style={styles.routineTitle} numberOfLines={2}>
              {sesionInfo.nombreRutina}
            </Text>

            {/* Tiempo Transcurrido */}
            <View style={styles.timerBox}>
              <Ionicons name="stopwatch-outline" size={20} color={tema.acentoEstado.pendiente} />
              <Text style={styles.timerText}>{formatearTiempo(segs)}</Text>
            </View>

            {/* Avance de Series */}
            {sesionInfo.totalSeries > 0 && (
              <View style={styles.progressRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colores.exito} />
                <Text style={styles.progressText}>
                  {sesionInfo.seriesCompletadas} de {sesionInfo.totalSeries} series completadas
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.descriptionText}>
            Tienes una sesión de entrenamiento iniciada. ¿Deseas volver a ella y continuar donde lo dejaste?
          </Text>

          {/* Acciones */}
          <View style={styles.actionsRow}>
            <BotonRutinia
              titulo="Reanudar Entrenamiento"
              variante="principal"
              onPress={onReanudar}
              style={{ width: '100%' }}
            />
            <Pressable
              onPress={handleDescartarConfirm}
              style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="trash-outline" size={16} color="#F58A9B" />
              <Text style={styles.cancelButtonText}>Descartar Entrenamiento</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 15, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(12, 14, 26, 0.95)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 162, 75, 0.40)', // Resplandor naranja/pendiente
    padding: 22,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#F5A24B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 162, 75, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 162, 75, 0.35)',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tema.acentoEstado.pendiente,
  },
  badgeText: {
    color: tema.acentoEstado.pendiente,
    fontSize: 11,
    fontFamily: fuentes.black,
    letterSpacing: 0.5,
  },
  headerInfo: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  routineTitle: {
    color: colores.texto,
    fontSize: 20,
    fontFamily: fuentes.black,
    textAlign: 'center',
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  timerText: {
    color: colores.texto,
    fontSize: 18,
    fontFamily: fuentes.black,
    letterSpacing: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  descriptionText: {
    color: colores.suave,
    fontSize: 13,
    fontFamily: fuentes.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsRow: {
    width: '100%',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#F58A9B',
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
});
