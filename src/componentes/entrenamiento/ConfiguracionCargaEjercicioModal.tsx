import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fuentes, noir } from '../../constantes/colores';
import { vibrarBoton } from '../../utilidades/hapticos';
import {
  DISCOS_DISPONIBLES_POR_DEFECTO,
  normalizarPreferenciaCarga,
  type PreferenciaCargaEjercicio,
} from '../../utilidades/cargasEjercicio';
import type { TipoCarga } from '../../tipos';

type Props = {
  visible: boolean;
  nombreEjercicio: string;
  preferencia: PreferenciaCargaEjercicio;
  onClose: () => void;
  onGuardar: (preferencia: PreferenciaCargaEjercicio) => void;
};

const MODOS: { tipo: TipoCarga; titulo: string }[] = [
  { tipo: 'kg', titulo: 'Kilogramos' },
  { tipo: 'placas', titulo: 'Placas' },
  { tipo: 'discos_barra', titulo: 'Discos · barra' },
  { tipo: 'discos_maquina', titulo: 'Discos · máquina' },
];

function Stepper({
  etiqueta,
  valor,
  paso = 1,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  paso?: number;
  onChange: (valor: number) => void;
}) {
  const cambiar = (delta: number) => {
    vibrarBoton(10);
    const siguiente = Math.max(0, Math.round((valor + delta) * 100) / 100);
    onChange(siguiente);
  };

  return (
    <View style={styles.configRow}>
      <Text style={styles.configLabel}>{etiqueta}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => cambiar(-paso)} style={styles.stepperButton} accessibilityLabel={`Restar ${paso}`}>
          <Ionicons name="remove" size={16} color={noir.platinum} />
        </Pressable>
        <Text style={styles.stepperValue}>{valor}</Text>
        <Pressable onPress={() => cambiar(paso)} style={styles.stepperButton} accessibilityLabel={`Sumar ${paso}`}>
          <Ionicons name="add" size={16} color={noir.platinum} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ConfiguracionCargaEjercicioModal({
  visible,
  nombreEjercicio,
  preferencia,
  onClose,
  onGuardar,
}: Props) {
  const [draft, setDraft] = useState(() => normalizarPreferenciaCarga(preferencia));

  const cambiar = (patch: Partial<PreferenciaCargaEjercicio>) => {
    setDraft((actual) => normalizarPreferenciaCarga({ ...actual, ...patch }));
  };

  const cambiarDiscoDisponible = (disco: number) => {
    const activo = draft.discosDisponibles.includes(disco);
    const discosDisponibles = activo
      ? draft.discosDisponibles.filter((peso) => peso !== disco)
      : [...draft.discosDisponibles, disco].sort((a, b) => b - a);
    cambiar({ discosDisponibles });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>PREFERENCIA POR EJERCICIO</Text>
            <Text style={styles.title} numberOfLines={2}>{nombreEjercicio}</Text>
            <Text style={styles.subtitle}>La configuración se guarda en esta cuenta y se reutiliza la próxima vez.</Text>

            <Text style={styles.sectionLabel}>TIPO DE CARGA</Text>
            <View style={styles.modes}>
              {MODOS.map((modo) => (
                <Pressable
                  key={modo.tipo}
                  onPress={() => cambiar({ tipo: modo.tipo })}
                  style={[styles.mode, draft.tipo === modo.tipo && styles.modeActive]}
                >
                  <Text style={[styles.modeText, draft.tipo === modo.tipo && styles.modeTextActive]}>{modo.titulo}</Text>
                </Pressable>
              ))}
            </View>

            {draft.tipo === 'discos_barra' ? (
              <>
                <Text style={styles.sectionLabel}>BASE DE LA BARRA</Text>
                <Stepper etiqueta="Peso de la barra" valor={draft.pesoBarra} onChange={(pesoBarra) => cambiar({ pesoBarra })} />
                <Text style={styles.helper}>El total suma la barra y los discos cargados en ambos lados.</Text>
              </>
            ) : null}

            {draft.tipo === 'discos_maquina' ? (
              <>
                <Text style={styles.sectionLabel}>MÁQUINA</Text>
                <Stepper etiqueta="Peso base opcional" valor={draft.pesoBase} onChange={(pesoBase) => cambiar({ pesoBase })} />
                <Text style={styles.helper}>El total suma la base y los discos de ambos lados.</Text>
              </>
            ) : null}

            {draft.tipo === 'placas' ? (
              <>
                <Text style={styles.sectionLabel}>EQUIVALENCIA (OPCIONAL)</Text>
                <View style={styles.configRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configLabel}>Kg por placa</Text>
                    <Text style={styles.helperInline}>{draft.kgPorPlaca ? 'Se mostrará y guardará el total en kg.' : 'Sin equivalencia se guardan solo placas.'}</Text>
                  </View>
                  {draft.kgPorPlaca ? (
                    <View style={styles.stepper}>
                      <Pressable onPress={() => cambiar({ kgPorPlaca: Math.max(0.5, draft.kgPorPlaca! - 0.5) })} style={styles.stepperButton}>
                        <Ionicons name="remove" size={16} color={noir.platinum} />
                      </Pressable>
                      <Text style={styles.stepperValue}>{draft.kgPorPlaca} kg</Text>
                      <Pressable onPress={() => cambiar({ kgPorPlaca: draft.kgPorPlaca! + 0.5 })} style={styles.stepperButton}>
                        <Ionicons name="add" size={16} color={noir.platinum} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => cambiar({ kgPorPlaca: 5 })} style={styles.equivalenceButton}>
                      <Text style={styles.equivalenceText}>Definir</Text>
                    </Pressable>
                  )}
                </View>
                {draft.kgPorPlaca ? (
                  <Pressable onPress={() => cambiar({ kgPorPlaca: null })} style={styles.linkButton}>
                    <Text style={styles.linkText}>Quitar equivalencia</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {draft.tipo === 'discos_barra' || draft.tipo === 'discos_maquina' ? (
              <>
                <Text style={styles.sectionLabel}>DISCOS DISPONIBLES</Text>
                <View style={styles.discs}>
                  {(draft.discosDisponibles.length > 0
                    ? [...new Set([...draft.discosDisponibles, ...DISCOS_DISPONIBLES_POR_DEFECTO])]
                    : DISCOS_DISPONIBLES_POR_DEFECTO
                  ).sort((a, b) => b - a).map((disco) => {
                    const activo = draft.discosDisponibles.includes(disco);
                    return (
                      <Pressable
                        key={disco}
                        onPress={() => cambiarDiscoDisponible(disco)}
                        style={[styles.disc, activo && styles.discActive]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: activo }}
                      >
                        <Ionicons name={activo ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={activo ? noir.info : noir.muted} />
                        <Text style={[styles.discText, activo && styles.discTextActive]}>{disco} kg</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Pressable
              onPress={() => {
                vibrarBoton(15);
                onGuardar(normalizarPreferenciaCarga(draft));
                onClose();
              }}
              style={styles.saveButton}
            >
              <Ionicons name="checkmark" size={17} color="#08100D" />
              <Text style={styles.saveText}>Guardar ajustes</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { maxHeight: '88%', backgroundColor: noir.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: noir.lineStrong, overflow: 'hidden' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 10 },
  content: { padding: 20, paddingBottom: 34, gap: 10 },
  kicker: { color: noir.info, fontFamily: fuentes.bold, fontSize: 9, letterSpacing: 1.1 },
  title: { color: noir.text, fontFamily: fuentes.black, fontSize: 19 },
  subtitle: { color: noir.muted, fontFamily: fuentes.medium, fontSize: 11, lineHeight: 16 },
  sectionLabel: { color: noir.muted2, fontFamily: fuentes.bold, fontSize: 9, letterSpacing: 1, marginTop: 8 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  mode: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modeActive: { backgroundColor: 'rgba(92,200,255,0.12)', borderColor: 'rgba(92,200,255,0.42)' },
  modeText: { color: noir.muted, fontFamily: fuentes.bold, fontSize: 10 },
  modeTextActive: { color: noir.info },
  configRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 11, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  configLabel: { color: noir.text, fontFamily: fuentes.semiBold, fontSize: 12 },
  helper: { color: noir.muted, fontFamily: fuentes.regular, fontSize: 10, lineHeight: 14, marginHorizontal: 2 },
  helperInline: { color: noir.muted, fontFamily: fuentes.regular, fontSize: 9, lineHeight: 13, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.25)' },
  stepperButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.08)' },
  stepperValue: { minWidth: 50, textAlign: 'center', color: noir.platinum, fontFamily: fuentes.bold, fontSize: 12 },
  equivalenceButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(92,200,255,0.12)' },
  equivalenceText: { color: noir.info, fontFamily: fuentes.bold, fontSize: 10 },
  linkButton: { alignSelf: 'flex-end', padding: 4 },
  linkText: { color: noir.muted, fontFamily: fuentes.medium, fontSize: 10, textDecorationLine: 'underline' },
  discs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  disc: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  discActive: { borderColor: 'rgba(92,200,255,0.35)', backgroundColor: 'rgba(92,200,255,0.08)' },
  discText: { color: noir.muted, fontFamily: fuentes.bold, fontSize: 10 },
  discTextActive: { color: noir.platinum },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, marginTop: 8, borderRadius: 12, backgroundColor: noir.mint },
  saveText: { color: '#08100D', fontFamily: fuentes.black, fontSize: 12 },
});
