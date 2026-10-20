import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../../constants/colores';
import { vibrarBoton } from '../../utils/haptics';
import { EjercicioGifInfo, obtenerGifEjercicio } from '../../services/ejerciciosGifs';

interface Props {
  nombreEjercicio: string;
  totalSeries: number;
  objetivoTexto?: string;
  onReemplazar?: () => void;
  onNotas?: () => void;
  onCopiarHistorial?: () => void;
  tieneHistorialPrevio?: boolean;
}

export default function HeroEjercicioActivo({
  nombreEjercicio,
  totalSeries,
  objetivoTexto,
  onReemplazar,
  onNotas,
  onCopiarHistorial,
  tieneHistorialPrevio,
}: Props) {
  const [modalTutorialVisible, setModalTutorialVisible] = useState(false);
  const gifInfo: EjercicioGifInfo = obtenerGifEjercicio(nombreEjercicio);

  const equipamientoTexto = gifInfo.equipment ? gifInfo.equipment.toUpperCase() : 'PESO LIBRE';
  const grupoMuscular = (gifInfo.muscle || 'Cuerpo').toUpperCase();
  const subtitulo = `${equipamientoTexto} · ${totalSeries} series · ${objetivoTexto || 'Fuerza / Hipertrofia'} · ${grupoMuscular}`;

  return (
    <View style={styles.container}>
      {/* Visualizador Hero Anatómico (GIF Animado sin marco blanco) */}
      <View style={styles.heroBox}>
        <Image
          source={{ uri: gifInfo.gifUrl }}
          style={[
            styles.gifImage,
            Platform.OS === 'web' && ({
              filter: 'invert(1) contrast(1.1) brightness(0.96)',
            } as any),
          ]}
          contentFit="contain"
          autoplay
          cachePolicy="disk"
        />

        {/* Badge 'R' de Rutinia en esquina inferior derecha */}
        <View style={styles.badgeR}>
          <Text style={styles.badgeRText}>R</Text>
        </View>
      </View>

      {/* Título Principal y Metadatos */}
      <View style={styles.textContainer}>
        <Text style={styles.titulo} numberOfLines={2}>
          {nombreEjercicio}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1}>
          {subtitulo}
        </Text>
      </View>

      {/* Barra de Píldoras de Acción Rápida */}
      <View style={styles.pillsRow}>
        <Pressable
          onPress={() => {
            vibrarBoton(12);
            setModalTutorialVisible(true);
          }}
          style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
        >
          <Ionicons name="play" size={13} color="#FFFFFF" />
          <Text style={styles.pillText}>Tutorial</Text>
        </Pressable>

        {Boolean(onReemplazar) && (
          <Pressable
            onPress={() => {
              vibrarBoton(12);
              onReemplazar?.();
            }}
            style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
          >
            <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
            <Text style={styles.pillText}>Reemplazar</Text>
          </Pressable>
        )}

        {Boolean(onNotas) && (
          <Pressable
            onPress={() => {
              vibrarBoton(12);
              onNotas?.();
            }}
            style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
          >
            <Ionicons name="pencil" size={13} color="#FFFFFF" />
            <Text style={styles.pillText}>Notas</Text>
          </Pressable>
        )}

        {Boolean(onCopiarHistorial && tieneHistorialPrevio) && (
          <Pressable
            onPress={() => {
              vibrarBoton(12);
              onCopiarHistorial?.();
            }}
            style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
          >
            <Ionicons name="copy-outline" size={13} color="#FFFFFF" />
            <Text style={styles.pillText}>Previa</Text>
          </Pressable>
        )}
      </View>

      {/* Modal Desplegable de Tutorial y Técnica Paso a Paso */}
      <Modal
        visible={modalTutorialVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalTutorialVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTag}>GUÍA TÉCNICA Y ANATOMÍA</Text>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                  {gifInfo.name || nombreEjercicio}
                </Text>
              </View>
              <Pressable
                onPress={() => setModalTutorialVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Animación en grande */}
              <View style={styles.modalBigGifBox}>
                <Image
                  source={{ uri: gifInfo.gifUrl }}
                  style={[
                    styles.modalBigGif,
                    Platform.OS === 'web' && ({
                      filter: 'invert(1) contrast(1.1) brightness(0.96)',
                    } as any),
                  ]}
                  contentFit="contain"
                  autoplay
                />
              </View>

              {/* Ficha rápida de Músculo y Equipo */}
              <View style={styles.modalMetaCard}>
                <View style={styles.modalMetaItem}>
                  <Text style={styles.modalMetaLabel}>MÚSCULO PRINCIPAL</Text>
                  <Text style={styles.modalMetaVal}>{gifInfo.muscle.toUpperCase()}</Text>
                </View>
                <View style={styles.modalMetaDivider} />
                <View style={styles.modalMetaItem}>
                  <Text style={styles.modalMetaLabel}>EQUIPAMIENTO</Text>
                  <Text style={styles.modalMetaVal}>{gifInfo.equipment.toUpperCase()}</Text>
                </View>
              </View>

              {/* Lista numerada de instrucciones */}
              <Text style={styles.instruccionesTitulo}>EJECUCIÓN CORRECTA</Text>
              <View style={styles.instruccionesList}>
                {gifInfo.instructions.map((paso, idx) => (
                  <View key={idx} style={styles.instruccionItem}>
                    <View style={styles.instruccionNumero}>
                      <Text style={styles.instruccionNumeroText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.instruccionTexto}>{paso}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
    width: '100%',
  },
  heroBox: {
    width: '100%',
    height: 250,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    marginVertical: 4,
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  badgeR: {
    position: 'absolute',
    bottom: 4,
    right: 28,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E0608',
    borderWidth: 1.5,
    borderColor: '#FF1E3C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF1E3C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  badgeRText: {
    color: '#FFFFFF',
    fontFamily: fuentes.black,
    fontSize: 15,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  titulo: {
    color: '#FFFFFF',
    fontFamily: fuentes.black,
    fontSize: 20,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitulo: {
    color: colores.suave,
    fontFamily: fuentes.medium,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  pillBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ scale: 0.97 }],
  },
  pillText: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 12.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0A0C14',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderTag: {
    color: '#EF4444',
    fontFamily: fuentes.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.black,
    fontSize: 17,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    padding: 20,
    gap: 16,
  },
  modalBigGifBox: {
    width: '100%',
    height: 250,
    borderRadius: 20,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalBigGif: {
    width: '100%',
    height: '100%',
  },
  modalMetaCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalMetaItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalMetaDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalMetaLabel: {
    color: colores.suave,
    fontSize: 10,
    fontFamily: fuentes.medium,
  },
  modalMetaVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fuentes.bold,
    marginTop: 2,
  },
  instruccionesTitulo: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 14,
    letterSpacing: 0.4,
    marginTop: 6,
  },
  instruccionesList: {
    gap: 12,
  },
  instruccionItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  instruccionNumero: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  instruccionNumeroText: {
    color: '#EF4444',
    fontFamily: fuentes.bold,
    fontSize: 11,
  },
  instruccionTexto: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: fuentes.medium,
    fontSize: 13.5,
    lineHeight: 19,
    flex: 1,
  },
});
