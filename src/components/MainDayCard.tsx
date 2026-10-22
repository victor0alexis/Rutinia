import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Canvas,
  Box,
  BoxShadow,
  rect,
  rrect,
} from '@shopify/react-native-skia';
import { fuentes, noir } from '../constants/colores';
import { EjercicioRegistro, Registro } from '../types';
import { SesionActivaInfo } from '../utils/sesionActiva';
import { parsearEjercicioInfo } from '../utils/ejercicios';
import { parsearNotaInteligente } from './DiaDetalleModal';
import RutinaLiveCard from './RutinaLiveCard';

export interface MainDayCardProps {
  registrosConRutina: Registro[];
  notasDelDia: EjercicioRegistro[];
  ejerciciosExtras: EjercicioRegistro[];
  sesionActivaInfo?: SesionActivaInfo | null;
  onIniciarRutina: (r: Registro) => void;
  onReanudarRutina: (r: Registro) => void;
  onVerResumenRutina: (r: Registro) => void;
  onDescartarRutina?: (r: Registro) => void;
  // Props opcionales para retrocompatibilidad
  diaActivo?: Date;
  esDiaHoy?: boolean;
  onDiaAnterior?: () => void;
  onDiaSiguiente?: () => void;
}

export default function MainDayCard({
  registrosConRutina,
  notasDelDia,
  ejerciciosExtras,
  sesionActivaInfo,
  onIniciarRutina,
  onReanudarRutina,
  onVerResumenRutina,
  onDescartarRutina,
}: MainDayCardProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const tieneContenido =
    registrosConRutina.length > 0 ||
    notasDelDia.length > 0 ||
    ejerciciosExtras.length > 0;

  const isWeb = Platform.OS === 'web';

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.uiverseCardBase,
        isWeb && styles.uiverseCardWeb,
      ]}
    >
      {/* Fondo Skia en plataformas nativas (iOS / Android) para lograr el BoxShadow e Inset Glow idéntico */}
      {!isWeb && dimensions.width > 0 && dimensions.height > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Box
            box={rrect(rect(0, 0, dimensions.width, dimensions.height), 20, 20)}
            color="rgb(15, 15, 15)"
          >
            {/* Outer Glow perla fría difuso */}
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

      {/* Filo de luz superior: el detalle editorial del MainDayCard */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(255, 255, 255, 0.16)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topHairline}
      />

      {/* Contenido Scrollable Interno (Sin SelectedDayHeader, como se solicitó) */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !tieneContenido && styles.scrollContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!tieneContenido ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="barbell-outline" size={26} color="rgba(255, 255, 255, 0.7)" />
            </View>
            <Text style={styles.emptyTitle}>Sin actividades programadas</Text>
            <Text style={styles.emptySubtext}>
              Usa el botón “Administrar” para añadir rutinas, ejercicios o notas.
            </Text>
          </View>
        ) : (
          <>
            {/* A. Tarjetas de Rutinas (Componente Hijo Minimalista Compacto) */}
            {registrosConRutina.map((r) => (
              <RutinaLiveCard
                key={r.id}
                registro={r}
                sesionActivaInfo={sesionActivaInfo}
                onIniciar={onIniciarRutina}
                onReanudar={onReanudarRutina}
                onVerResumen={onVerResumenRutina}
                onDescartar={onDescartarRutina}
                variant="home"
              />
            ))}

            {/* B. Sección de Observaciones / Notas Inteligentes */}
            {notasDelDia.length > 0 && (
              <View style={styles.notesSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons
                    name="document-text-outline"
                    size={13}
                    color={noir.info}
                  />
                  <Text style={[styles.sectionHeaderText, styles.notesHeaderText]}>
                    OBSERVACIONES Y NOTAS
                  </Text>
                </View>

                {notasDelDia.map((notaObj) => {
                  const { categoria, titulo, cuerpo, iconName } =
                    parsearNotaInteligente(notaObj.nombre);

                  return (
                    <View key={notaObj.id} style={styles.noteCard}>
                      <View style={styles.noteTopRow}>
                        <View style={styles.noteCategoryBadge}>
                          <Ionicons name={iconName} size={10} color={noir.info} />
                          <Text style={styles.noteCategoryText}>
                            {categoria}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={styles.noteTitle}>
                          {titulo}
                        </Text>
                      </View>
                      {cuerpo ? (
                        <Text numberOfLines={2} style={styles.noteBody}>
                          {cuerpo}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {/* C. Sección de Ejercicios Extras Sueltos */}
            {ejerciciosExtras.length > 0 && (
              <View style={styles.extrasSectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="flash-outline" size={13} color={noir.champagne} />
                  <Text style={[styles.sectionHeaderText, styles.extrasHeaderText]}>
                    EJERCICIOS EXTRAS
                  </Text>
                </View>

                <View style={styles.extraSection}>
                  {ejerciciosExtras.map((e) => {
                    const parsed = parsearEjercicioInfo(e);
                    return (
                      <View key={e.id} style={styles.extraRow}>
                        <Ionicons
                          name={
                            e.completado
                              ? 'checkmark-circle'
                              : 'ellipse-outline'
                          }
                          size={14}
                          color={e.completado ? noir.mint : noir.muted}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.extraExerciseName,
                            e.completado && { opacity: 0.7 },
                          ]}
                        >
                          {parsed.nombreLimpio}
                        </Text>
                        {parsed.resumenVisual && (
                          <View style={styles.extraBadge}>
                            <Text style={styles.extraBadgeText}>
                              {parsed.resumenVisual}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  uiverseCardBase: {
    flex: 1,
    backgroundColor: noir.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
    // Sombra nativa de fallback para dispositivos móviles
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.52,
    shadowRadius: 22,
    elevation: 12,
  },
  // Estilo exacto de Uiverse para Web (con doble box-shadow: exterior + inset)
  uiverseCardWeb: {
    // @ts-ignore
    boxShadow:
      '0 0 50px 0px rgba(226, 239, 255, 0.52), inset 0 0 90px 0px rgba(226, 239, 255, 0.24)',
    color: '#FFFFFF',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    zIndex: 3,
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 10,
    flexGrow: 1,
  },
  scrollContentEmpty: {
    justifyContent: 'center',
  },
  notesSection: {
    gap: 8,
    marginTop: 2,
  },
  extrasSectionContainer: {
    gap: 8,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  sectionHeaderText: {
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.68)',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  notesHeaderText: {
    color: 'rgba(92, 200, 255, 0.92)',
  },
  extrasHeaderText: {
    color: noir.champagne,
  },
  noteCard: {
    backgroundColor: 'rgba(20, 20, 24, 0.82)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 11,
    gap: 4,
    borderWidth: 1,
    borderColor: noir.line,
    borderLeftWidth: 3.5,
    borderLeftColor: noir.info,
  },
  noteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(92, 200, 255, 0.18)',
  },
  noteCategoryText: {
    fontSize: 8,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#D9F0FF',
  },
  noteTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: fuentes.bold,
    flex: 1,
    lineHeight: 15,
  },
  noteBody: {
    color: 'rgba(255, 255, 255, 0.66)',
    fontSize: 10.5,
    fontFamily: fuentes.regular,
    lineHeight: 15,
  },
  extraSection: {
    backgroundColor: 'rgba(20, 20, 24, 0.82)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: noir.line,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 2,
  },
  extraExerciseName: {
    flex: 1,
    fontFamily: fuentes.medium,
    fontSize: 11.5,
    color: '#FFFFFF',
    lineHeight: 15,
  },
  extraBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  extraBadgeText: {
    fontFamily: fuentes.semiBold,
    fontSize: 8.5,
    color: '#AAB3C0',
  },
  emptyContainer: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 2,
    // @ts-ignore
    boxShadow:
      'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 0 26px rgba(226, 239, 255, 0.07)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 15,
    letterSpacing: -0.15,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 245,
    paddingHorizontal: 20,
    fontFamily: fuentes.regular,
  },
});
