import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fuentes } from '../../constantes/colores';
import { EjercicioRegistro, Registro } from '../../tipos';
import { SesionActivaInfo } from '../../utilidades/sesionActiva';
import { parsearEjercicioInfo } from '../../utilidades/ejercicios';
import { parsearNotaInteligente } from './DiaDetalleModal';
import PanelBrillo from '../comunes/PanelBrillo';
import TarjetaRutinaEnVivo from '../rutinas/TarjetaRutinaEnVivo';

function obtenerTemaNota(categoria: string) {
  const cat = (categoria || '').toUpperCase();
  if (cat.includes('RECUPERA') || cat.includes('DESCANSO')) {
    return {
      color: '#5CC8FF',
      bg: 'rgba(92, 200, 255, 0.16)',
      borderColor: 'rgba(92, 200, 255, 0.40)',
      icon: 'pulse-outline' as const,
    };
  }
  if (cat.includes('NUTRICI') || cat.includes('DIETA') || cat.includes('COMIDA')) {
    return {
      color: '#3FF2B0',
      bg: 'rgba(63, 242, 176, 0.16)',
      borderColor: 'rgba(63, 242, 176, 0.40)',
      icon: 'nutrition-outline' as const,
    };
  }
  if (cat.includes('SUPLE') || cat.includes('SALUD') || cat.includes('MEDIC')) {
    return {
      color: '#FFD166',
      bg: 'rgba(255, 209, 102, 0.16)',
      borderColor: 'rgba(255, 209, 102, 0.40)',
      icon: 'medical-outline' as const,
    };
  }
  if (cat.includes('TECNIC') || cat.includes('ENTRENA') || cat.includes('POSTURA')) {
    return {
      color: '#B394FF',
      bg: 'rgba(179, 148, 255, 0.16)',
      borderColor: 'rgba(179, 148, 255, 0.40)',
      icon: 'fitness-outline' as const,
    };
  }
  return {
    color: '#5CC8FF',
    bg: 'rgba(92, 200, 255, 0.16)',
    borderColor: 'rgba(92, 200, 255, 0.40)',
    icon: 'document-text-outline' as const,
  };
}

interface MainDayCardProps {
  registrosConRutina: Registro[];
  notasDelDia: EjercicioRegistro[];
  ejerciciosExtras: EjercicioRegistro[];
  sesionActivaInfo?: SesionActivaInfo | null;
  onIniciarRutina: (r: Registro) => void;
  onReanudarRutina: (r: Registro) => void;
  onVerResumenRutina: (r: Registro) => void;
  onDescartarRutina?: (r: Registro) => void;
}

function TarjetaDiaPrincipal({
  registrosConRutina,
  notasDelDia,
  ejerciciosExtras,
  sesionActivaInfo,
  onIniciarRutina,
  onReanudarRutina,
  onVerResumenRutina,
  onDescartarRutina,
}: MainDayCardProps) {
  const tieneContenido =
    registrosConRutina.length > 0 ||
    notasDelDia.length > 0 ||
    ejerciciosExtras.length > 0;

  return (
    <PanelBrillo style={styles.mainCard}>
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
              <TarjetaRutinaEnVivo
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
                    size={14}
                    color="#5CC8FF"
                  />
                  <Text style={[styles.sectionHeaderText, styles.notesHeaderText]}>
                    OBSERVACIONES Y NOTAS
                  </Text>
                </View>

                {notasDelDia.map((notaObj) => {
                  const { categoria, titulo, cuerpo } =
                    parsearNotaInteligente(notaObj.nombre);
                  const tema = obtenerTemaNota(categoria);

                  return (
                    <View
                      key={notaObj.id}
                      style={[
                        styles.noteCard,
                        { borderLeftColor: tema.color },
                      ]}
                    >
                      <View style={styles.noteTopRow}>
                        <View
                          style={[
                            styles.noteCategoryBadge,
                            {
                              backgroundColor: tema.bg,
                              borderColor: tema.borderColor,
                            },
                          ]}
                        >
                          <Ionicons name={tema.icon} size={11} color={tema.color} />
                          <Text
                            style={[
                              styles.noteCategoryText,
                              { color: tema.color },
                            ]}
                          >
                            {categoria.toUpperCase()}
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
                  <Ionicons name="flash" size={14} color="#FFD166" />
                  <Text style={[styles.sectionHeaderText, styles.extrasHeaderText]}>
                    EJERCICIOS EXTRAS
                  </Text>
                </View>

                <View style={styles.extrasList}>
                  {ejerciciosExtras.map((e) => {
                    const parsed = parsearEjercicioInfo(e);
                    return (
                      <View key={e.id} style={styles.extraCard}>
                        <View style={styles.extraLeft}>
                          <Ionicons
                            name={
                              e.completado
                                ? 'checkmark-circle'
                                : 'ellipse-outline'
                            }
                            size={18}
                            color={e.completado ? '#3FF2B0' : 'rgba(255, 255, 255, 0.4)'}
                          />
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.extraExerciseName,
                              e.completado && { opacity: 0.85 },
                            ]}
                          >
                            {parsed.nombreLimpio}
                          </Text>
                        </View>
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
    </PanelBrillo>
  );
}

const styles = StyleSheet.create({
  mainCard: {
    flex: 1,
    padding: 14,
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
    marginTop: 6,
  },
  extrasSectionContainer: {
    gap: 8,
    marginTop: 6,
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
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  notesHeaderText: {
    color: '#5CC8FF',
  },
  extrasHeaderText: {
    color: '#FFD166',
  },
  noteCard: {
    backgroundColor: 'rgba(20, 20, 24, 0.85)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 3.5,
    borderLeftColor: '#5CC8FF',
  },
  noteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteCategoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.40)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(92, 200, 255, 0.16)',
  },
  noteCategoryText: {
    fontSize: 9,
    fontFamily: fuentes.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#5CC8FF',
  },
  noteTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fuentes.bold,
    flex: 1,
    lineHeight: 18,
  },
  noteBody: {
    color: '#98A1AF',
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 17,
    marginTop: 2,
  },
  extrasList: {
    gap: 6,
  },
  extraCard: {
    backgroundColor: 'rgba(20, 20, 24, 0.85)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  extraLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  extraExerciseName: {
    flex: 1,
    fontFamily: fuentes.bold,
    fontSize: 13.5,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  extraBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  extraBadgeText: {
    fontFamily: fuentes.semiBold,
    fontSize: 11,
    color: '#98A1AF',
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

export default TarjetaDiaPrincipal;
