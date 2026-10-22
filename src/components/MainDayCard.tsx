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
import {
  Canvas,
  Box,
  BoxShadow,
  rect,
  rrect,
} from '@shopify/react-native-skia';
import { colores, fuentes } from '../constants/colores';
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
            {/* Outer Glow blanco/plateado difuso (box-shadow: 0 0 50px 0px white) */}
            <BoxShadow
              dx={0}
              dy={0}
              blur={28}
              color="rgba(255, 255, 255, 0.70)"
            />
            {/* Inset Glow blanco desde los bordes hacia el centro (inset 0 0 90px 0px white) */}
            <BoxShadow
              dx={0}
              dy={0}
              blur={50}
              color="rgba(255, 255, 255, 0.40)"
              inner
            />
          </Box>
        </Canvas>
      )}

      {/* Contenido Scrollable Interno (Sin SelectedDayHeader, como se solicitó) */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!tieneContenido ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="barbell-outline" size={26} color="rgba(255, 255, 255, 0.7)" />
            </View>
            <Text style={styles.emptyTitle}>Sin actividades programadas</Text>
            <Text style={styles.emptySubtext}>
              Usa el botón &quot;MyDia&quot; para añadir rutinas, ejercicios o notas.
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
              />
            ))}

            {/* B. Sección de Observaciones / Notas Inteligentes */}
            {notasDelDia.length > 0 && (
              <View style={styles.notesSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="document-text-outline" size={13} color="rgba(255, 255, 255, 0.6)" />
                  <Text style={styles.sectionHeaderText}>OBSERVACIONES Y NOTAS</Text>
                </View>

                {notasDelDia.map((notaObj) => {
                  const {
                    categoria,
                    titulo,
                    cuerpo,
                    colorBadge,
                    bgBadge,
                    iconName,
                  } = parsearNotaInteligente(notaObj.nombre);

                  return (
                    <View
                      key={notaObj.id}
                      style={[
                        styles.noteCard,
                        { borderLeftColor: colorBadge },
                      ]}
                    >
                      <View style={styles.noteTopRow}>
                        <View
                          style={[
                            styles.noteCategoryBadge,
                            { backgroundColor: bgBadge },
                          ]}
                        >
                          <Ionicons
                            name={iconName}
                            size={11}
                            color={colorBadge}
                          />
                          <Text
                            style={[
                              styles.noteCategoryText,
                              { color: colorBadge },
                            ]}
                          >
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
              <View style={styles.extraSection}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="flash-outline" size={13} color={colores.exito} />
                  <Text style={[styles.sectionHeaderText, { color: colores.exito }]}>
                    EJERCICIOS EXTRAS
                  </Text>
                </View>

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
                        size={16}
                        color={e.completado ? colores.exito : colores.suave}
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
    backgroundColor: 'rgb(15, 15, 15)',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
    // Sombra nativa de fallback para dispositivos móviles
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 22,
    elevation: 12,
  },
  // Estilo exacto de Uiverse para Web (con doble box-shadow: exterior + inset)
  uiverseCardWeb: {
    // @ts-ignore
    boxShadow: '0 0 50px 0px rgba(255, 255, 255, 0.7), inset 0 0 90px 0px rgba(255, 255, 255, 0.45)',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingVertical: 8,
    gap: 12,
  },
  notesSection: {
    gap: 8,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  sectionHeaderText: {
    fontFamily: fuentes.bold,
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.6,
  },
  noteCard: {
    backgroundColor: 'rgba(20, 20, 24, 0.82)',
    borderRadius: 14,
    padding: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 3.5,
  },
  noteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteCategoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteCategoryText: {
    fontSize: 9.5,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
  },
  noteTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: fuentes.bold,
    flex: 1,
  },
  noteBody: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
  },
  extraSection: {
    backgroundColor: 'rgba(20, 20, 24, 0.82)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  extraExerciseName: {
    flex: 1,
    fontFamily: fuentes.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  extraBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  extraBadgeText: {
    fontFamily: fuentes.bold,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
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
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 15,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 20,
    fontFamily: fuentes.regular,
  },
});
