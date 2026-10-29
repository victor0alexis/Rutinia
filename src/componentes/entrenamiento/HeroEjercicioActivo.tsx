import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constantes/colores';
import { vibrarBoton } from '../../utilidades/hapticos';
import { EjercicioGifInfo, obtenerGifEjercicio } from '../../servicios/ejerciciosGifs';
import { parsearEjercicioInfo } from '../../utilidades/ejercicios';
import { useLayout } from '../../hooks/useLayout';
import EjercicioGif from './EjercicioGif';

const MUSCULO_ES: Record<string, string> = {
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Pantorrillas',
  chest: 'Pecho',
  delts: 'Hombros',
  forearms: 'Antebrazo',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  pectorals: 'Pectorales',
  quads: 'Cuádriceps',
  spine: 'Espalda',
  traps: 'Trapecio',
  triceps: 'Tríceps',
  'upper back': 'Espalda alta',
};

const EQUIPO_ES: Record<string, string> = {
  barbell: 'Barra',
  bodyweight: 'Peso corporal',
  cable: 'Polea',
  dumbbell: 'Mancuerna',
  'ez barbell': 'Barra EZ',
  kettlebell: 'Kettlebell',
  lever: 'Máquina',
  machine: 'Máquina',
  'pull-up bar': 'Barra fija',
  smith: 'Smith',
};

interface Props {
  nombreEjercicio: string;
  totalSeries: number;
  seriesCompletadas?: number;
  objetivoTexto?: string;
  nombrePlan?: string;
  indiceEjercicio?: number;
  totalEjercicios?: number;
  onReemplazar?: () => void;
  onOpciones?: () => void;
  onVerPrevia?: () => void;
  /** Incrementar este contador abre el tutorial desde fuera del hero. */
  solicitudTutorial?: number;
}

export default function HeroEjercicioActivo({
  nombreEjercicio,
  totalSeries,
  seriesCompletadas = 0,
  objetivoTexto,
  nombrePlan,
  indiceEjercicio,
  totalEjercicios,
  onReemplazar,
  onOpciones,
  onVerPrevia,
  solicitudTutorial = 0,
}: Props) {
  const [modalTutorialVisible, setModalTutorialVisible] = useState(false);

  useEffect(() => {
    if (solicitudTutorial <= 0) return;

    const frame = requestAnimationFrame(() => {
      setModalTutorialVisible(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [solicitudTutorial]);
  const { isCompact } = useLayout();
  const infoParsed = parsearEjercicioInfo({ nombre: nombreEjercicio });
  const nombreParaBuscar = infoParsed.nombreLimpio || nombreEjercicio;
  const gifInfo: EjercicioGifInfo = obtenerGifEjercicio(nombreParaBuscar);

  const equipamientoLegible =
    EQUIPO_ES[gifInfo.equipment?.toLowerCase()] || gifInfo.equipment || 'Peso libre';
  const grupoLegible =
    MUSCULO_ES[gifInfo.muscle?.toLowerCase()] || gifInfo.muscle || 'Cuerpo';
  const equipamientoTexto = equipamientoLegible.toUpperCase();
  const grupoMuscular = grupoLegible.toUpperCase();
  const completadas = Math.min(Math.max(seriesCompletadas, 0), totalSeries);
  const porcentaje = totalSeries > 0 ? Math.round((completadas / totalSeries) * 100) : 0;
  const completado = totalSeries > 0 && completadas >= totalSeries;
  const serieActual = Math.min(completadas + 1, totalSeries);
  const indiceTexto =
    indiceEjercicio !== undefined && totalEjercicios !== undefined
      ? `Ejercicio ${String(indiceEjercicio + 1).padStart(2, '0')} / ${String(totalEjercicios).padStart(2, '0')}`
      : 'Ejercicio activo';
  const subtitulo = `Técnica guiada · ${grupoLegible.toLowerCase()}`;
  const meta = `${equipamientoTexto} · ${totalSeries} series · ${objetivoTexto || 'Fuerza / Hipertrofia'}`;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(24, 27, 35, 0.96)', 'rgba(9, 11, 16, 0.97)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        {/* Cabecera: plan + estado en vivo */}
        <View style={styles.heroHead}>
          <View style={styles.planBadge}>
            <View style={styles.planDot} />
            <Text style={styles.planBadgeText} numberOfLines={1}>
              {nombrePlan || 'Sesión de hoy'}
            </Text>
          </View>
          <View style={[styles.liveBadge, completado && styles.liveBadgeDone]}>
            <View style={[styles.liveDot, completado && styles.liveDotDone]} />
            <Text style={[styles.liveBadgeText, completado && styles.liveBadgeTextDone]}>
              {completado ? 'Completado' : 'En proceso'}
            </Text>
          </View>
        </View>

        {/* Cuerpo: copy + visual anatómico */}
        <View style={styles.heroBody}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow} numberOfLines={1}>
              {indiceTexto} · {grupoMuscular}
            </Text>
            <Text
              style={[styles.titulo, isCompact && styles.tituloCompact]}
              numberOfLines={2}
            >
              {nombreEjercicio}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {subtitulo}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={2}>
              {meta}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              vibrarBoton(12);
              setModalTutorialVisible(true);
            }}
            style={({ pressed }) => [
              styles.heroVisualWrap,
              isCompact && styles.heroVisualWrapCompact,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ver tutorial ampliado del ejercicio"
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroVisual}>
              <EjercicioGif
                uri={gifInfo.gifUrl}
                style={styles.heroGif}
                contentFit="contain"
              />
              <View style={styles.badgeR}>
                <Ionicons name="expand" size={11} color={noir.pearl} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Acciones rápidas (en una sola fila horizontal) */}
        <View style={styles.pillsRow}>
          <Pressable
            onPress={() => {
              vibrarBoton(12);
              setModalTutorialVisible(true);
            }}
            style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
          >
            <Ionicons name="play" size={10} color={noir.info} />
            <Text numberOfLines={1} style={styles.pillText}>Tutorial</Text>
          </Pressable>

          {Boolean(onReemplazar) && (
            <Pressable
              onPress={() => {
                vibrarBoton(12);
                onReemplazar?.();
              }}
              style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
            >
              <Ionicons name="swap-horizontal" size={11} color={noir.lavender} />
              <Text numberOfLines={1} style={styles.pillText}>Reemplazar</Text>
            </Pressable>
          )}

          {Boolean(onVerPrevia) && (
            <Pressable
              onPress={() => {
                vibrarBoton(12);
                onVerPrevia?.();
              }}
              style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Ver historial y evolución del ejercicio"
            >
              <Ionicons name="analytics-outline" size={11} color={noir.mint} />
              <Text numberOfLines={1} style={styles.pillText}>Previa</Text>
            </Pressable>
          )}

          {Boolean(onOpciones) && (
            <Pressable
              onPress={() => {
                vibrarBoton(12);
                onOpciones?.();
              }}
              style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
            >
              <Ionicons name="ellipsis-horizontal" size={11} color={noir.platinum} />
              <Text numberOfLines={1} style={styles.pillText}>Opciones</Text>
            </Pressable>
          )}
        </View>

        {/* Progreso del ejercicio */}
        <View style={styles.heroFooter}>
          <View style={styles.heroFooterTop}>
            <View style={styles.statusPills}>
              <View style={[styles.statusPill, styles.statusPillChamp]}>
                <Ionicons name="layers-outline" size={8} color={noir.champagne} />
                <Text style={[styles.statusPillText, styles.statusPillTextChamp]}>
                  Serie {serieActual}/{totalSeries}
                </Text>
              </View>
              <View style={[styles.statusPill, styles.statusPillLav]}>
                <Ionicons name="checkmark-circle-outline" size={8} color={noir.lavender} />
                <Text style={[styles.statusPillText, styles.statusPillTextLav]}>
                  {completadas}/{totalSeries} series
                </Text>
              </View>
            </View>
            <Text style={styles.pctText}>{porcentaje}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[noir.info, noir.lavender, noir.pearl]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${porcentaje}%` }]}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Modal Desplegable de Tutorial y Técnica Paso a Paso */}
      <Modal
        visible={modalTutorialVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalTutorialVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
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
                <Ionicons name="close" size={20} color={noir.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalBigGifBox}>
                <EjercicioGif
                  uri={gifInfo.gifUrl}
                  style={styles.modalBigGif}
                  contentFit="contain"
                />
              </View>

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
    width: '100%',
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 7,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 21,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(92, 200, 255, 0.075)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.22)',
    maxWidth: '58%',
  },
  planDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.info,
  },
  planBadgeText: {
    color: '#CDEEFF',
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 21,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(63, 242, 176, 0.065)',
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.22)',
  },
  liveBadgeDone: {
    backgroundColor: 'rgba(63, 242, 176, 0.12)',
    borderColor: 'rgba(63, 242, 176, 0.4)',
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.mint,
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  liveDotDone: {
    backgroundColor: noir.mint,
  },
  liveBadgeText: {
    color: noir.mint,
    fontFamily: fuentes.bold,
    fontSize: 7.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  liveBadgeTextDone: {
    color: '#A8FFE0',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 7.2,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  titulo: {
    color: noir.text,
    fontFamily: fuentes.black,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.55,
    marginTop: 2,
  },
  tituloCompact: {
    fontSize: 18,
    lineHeight: 21,
  },
  heroSub: {
    color: noir.platinum,
    fontFamily: fuentes.medium,
    fontSize: 10,
    marginTop: 2,
  },
  heroMeta: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 8,
    lineHeight: 11,
    marginTop: 5,
  },
  heroVisualWrap: {
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  heroVisualWrapCompact: {
    width: 104,
    height: 104,
  },
  heroGlow: {
    position: 'absolute',
    width: '116%',
    height: '116%',
    borderRadius: 24,
    backgroundColor: 'rgba(216, 228, 245, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroVisual: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#06080D',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#A9BAD0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  heroGif: {
    width: '96%',
    height: '96%',
  },
  badgeR: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(9, 11, 16, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRText: {
    color: noir.pearl,
    fontFamily: fuentes.black,
    fontSize: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 12,
    width: '100%',
  },
  pillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  pillBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ scale: 0.98 }],
  },
  pillText: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 0.1,
  },
  heroFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroFooterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 21,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillChamp: {
    backgroundColor: 'rgba(255, 209, 102, 0.065)',
    borderColor: 'rgba(255, 209, 102, 0.22)',
  },
  statusPillLav: {
    backgroundColor: 'rgba(179, 148, 255, 0.065)',
    borderColor: 'rgba(179, 148, 255, 0.22)',
  },
  statusPillText: {
    fontFamily: fuentes.bold,
    fontSize: 7.4,
    letterSpacing: 0.2,
  },
  statusPillTextChamp: {
    color: '#FFE6A8',
  },
  statusPillTextLav: {
    color: '#E6DCFF',
  },
  pctText: {
    color: noir.platinum,
    fontFamily: fuentes.bold,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    marginTop: 7,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: noir.surface,
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
    color: noir.info,
    fontFamily: fuentes.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  modalHeaderTitle: {
    color: noir.text,
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
    backgroundColor: '#05070A',
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
    color: noir.muted,
    fontSize: 10,
    fontFamily: fuentes.medium,
  },
  modalMetaVal: {
    color: noir.text,
    fontSize: 13,
    fontFamily: fuentes.bold,
    marginTop: 2,
  },
  instruccionesTitulo: {
    color: noir.text,
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
    backgroundColor: 'rgba(92, 200, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  instruccionNumeroText: {
    color: noir.info,
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
