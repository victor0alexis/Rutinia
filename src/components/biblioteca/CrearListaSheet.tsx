import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constantes/colores';
import { useLayout } from '../../hooks/useLayout';
import { vibrarBoton } from '../../utils/haptics';
import {
  GRUPOS_MUSCULARES,
  colorDeGrupo,
} from '../../services/bibliotecaEjercicios';
import SmartTextKeyboard from './SmartTextKeyboard';

interface Props {
  visible: boolean;
  grupoInicial?: string;
  ejercicioNombre?: string;
  onClose: () => void;
  onCrear: (nombre: string, grupoMuscular: string) => void;
}

export default function CrearListaSheet({ visible, ...props }: Props) {
  if (!visible) return null;
  return <CrearListaContenido {...props} />;
}

function CrearListaContenido({
  grupoInicial = 'todos',
  ejercicioNombre,
  onClose,
  onCrear,
}: Omit<Props, 'visible'>) {
  const { isTablet, contentMaxWidth, barBottomPadding } = useLayout();
  const [nombre, setNombre] = useState('');
  const [grupo, setGrupo] = useState(grupoInicial || 'todos');
  const [tecladoVisible, setTecladoVisible] = useState(false);

  const nombreLimpio = nombre.trim();
  const puedeCrear = nombreLimpio.length > 0;
  const grupoInfo = GRUPOS_MUSCULARES.find((item) => item.id === grupo);
  const color = colorDeGrupo(grupo);
  const gruposDisponibles = GRUPOS_MUSCULARES.filter((item) => item.id !== 'todos');

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar creación de lista"
      />

      <View
        style={[
          styles.sheet,
          isTablet && { maxWidth: contentMaxWidth || 620, alignSelf: 'center' },
          tecladoVisible
            ? { paddingBottom: 0 }
            : { paddingBottom: Math.max(barBottomPadding, 14) },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={[styles.headerIcon, { borderColor: `${color}55` }]}>
            <Ionicons name="bookmarks" size={17} color={color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kicker}>NUEVA COLECCIÓN</Text>
            <Text style={styles.title}>Crear lista de favoritos</Text>
            {!tecladoVisible ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {ejercicioNombre
                  ? `Guardaremos «${ejercicioNombre}» en esta lista.`
                  : 'Agrupa tus ejercicios favoritos por zona muscular.'}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={20} color={noir.platinum} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            vibrarBoton(10);
            setTecladoVisible(true);
          }}
          style={({ pressed }) => [
            styles.nameField,
            tecladoVisible && styles.nameFieldActiva,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Escribir nombre de la lista"
        >
          <View style={styles.nameIcon}>
            <Ionicons name="create-outline" size={15} color={noir.info} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.nameLabel}>NOMBRE DE LA LISTA</Text>
            <Text
              style={[styles.nameValue, !nombreLimpio && styles.namePlaceholder]}
              numberOfLines={1}
            >
              {nombreLimpio || 'Ej. Empuje pesado, Pierna A…'}
            </Text>
          </View>
          <View style={styles.nameKeyboardIcon}>
            <Ionicons
              name={tecladoVisible ? 'chevron-down' : 'keypad-outline'}
              size={16}
              color={tecladoVisible ? noir.mint : noir.muted}
            />
          </View>
        </Pressable>

        {!tecladoVisible ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.grupoScroll}
            contentContainerStyle={styles.grupoScrollContent}
          >
            <View style={styles.grupoSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>GRUPO MUSCULAR</Text>
              <Text style={styles.sectionHint}>Opcional · organiza la lista</Text>
            </View>

            <View style={styles.chipsWrap}>
              <Pressable
                onPress={() => {
                  vibrarBoton(8);
                  setGrupo('todos');
                }}
                style={({ pressed }) => [
                  styles.chip,
                  grupo === 'todos' && styles.chipActiva,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityRole="button"
                accessibilityState={grupo === 'todos' ? { selected: true } : {}}
              >
                <View style={[styles.chipDot, { backgroundColor: noir.info }]} />
                <Text
                  style={[
                    styles.chipText,
                    grupo === 'todos' && styles.chipTextActiva,
                  ]}
                >
                  Sin grupo
                </Text>
              </Pressable>

              {gruposDisponibles.map((item) => {
                const activo = grupo === item.id;
                const itemColor = colorDeGrupo(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      vibrarBoton(8);
                      setGrupo(item.id);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      activo && {
                        backgroundColor: `${itemColor}18`,
                        borderColor: `${itemColor}66`,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={activo ? { selected: true } : {}}
                  >
                    <View
                      style={[styles.chipDot, { backgroundColor: itemColor }]}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        activo && { color: itemColor, fontFamily: fuentes.bold },
                      ]}
                    >
                      {item.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            </View>
          </ScrollView>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>

          <Pressable
            disabled={!puedeCrear}
            onPress={() => {
              if (!puedeCrear) return;
              vibrarBoton(15);
              onCrear(nombreLimpio, grupo);
            }}
            style={({ pressed }) => [
              styles.createBtn,
              !puedeCrear && styles.createBtnDisabled,
              pressed && puedeCrear && { opacity: 0.84, transform: [{ scale: 0.985 }] },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !puedeCrear }}
          >
            <LinearGradient
              colors={puedeCrear ? ['#E23A55', '#9E1C30'] : ['#343A47', '#252A34']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 13 }]}
            />
            <Ionicons
              name="add-circle"
              size={16}
              color={puedeCrear ? '#FFFFFF' : noir.muted2}
            />
            <Text
              style={[
                styles.createText,
                !puedeCrear && { color: noir.muted2 },
              ]}
            >
              Crear lista
            </Text>
          </Pressable>
        </View>

        {!tecladoVisible && grupoInfo && grupo !== 'todos' ? (
          <View style={[styles.groupHint, { borderColor: `${color}22` }]}>
            <Ionicons name="information-circle-outline" size={12} color={color} />
            <Text style={[styles.groupHintText, { color }]}>
              Se guardará como una lista de {grupoInfo.nombre.toLowerCase()}.
            </Text>
          </View>
        ) : null}

        {tecladoVisible ? (
          <SmartTextKeyboard
            valor={nombre}
            titulo="NOMBRE DE LA LISTA"
            placeholder="Ej. Empuje pesado"
            maxLength={42}
            textoListo="Listo"
            onCambiar={setNombre}
            onCerrar={() => setTecladoVisible(false)}
            style={styles.keyboard}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2, 3, 6, 0.8)',
    justifyContent: 'flex-end',
    zIndex: 90,
  },
  sheet: {
    width: '100%',
    maxHeight: '94%',
    backgroundColor: '#0B0D13',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignSelf: 'center',
    marginTop: 7,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
  },
  kicker: {
    color: noir.info,
    fontSize: 8,
    fontFamily: fuentes.bold,
    letterSpacing: 0.9,
  },
  title: {
    color: noir.text,
    fontSize: 17,
    fontFamily: fuentes.black,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  subtitle: {
    color: noir.muted,
    fontSize: 10,
    fontFamily: fuentes.regular,
    marginTop: 1,
    lineHeight: 14,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  nameFieldActiva: {
    borderColor: 'rgba(92, 200, 255, 0.45)',
    backgroundColor: 'rgba(92, 200, 255, 0.045)',
  },
  nameIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
  },
  nameLabel: {
    color: noir.muted2,
    fontSize: 7.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.7,
  },
  nameValue: {
    color: noir.text,
    fontSize: 13,
    fontFamily: fuentes.bold,
    marginTop: 1,
  },
  namePlaceholder: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
  },
  nameKeyboardIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  grupoSection: {
    marginTop: 13,
    gap: 7,
  },
  grupoScroll: {
    flexShrink: 1,
  },
  grupoScrollContent: {
    paddingBottom: 2,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: noir.muted2,
    fontSize: 8,
    fontFamily: fuentes.bold,
    letterSpacing: 0.9,
  },
  sectionHint: {
    color: noir.muted2,
    fontSize: 8.5,
    fontFamily: fuentes.regular,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  chipActiva: {
    backgroundColor: 'rgba(92, 200, 255, 0.08)',
    borderColor: 'rgba(92, 200, 255, 0.3)',
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  chipText: {
    color: noir.muted,
    fontSize: 9.5,
    fontFamily: fuentes.medium,
  },
  chipTextActiva: {
    color: '#CDEEFF',
    fontFamily: fuentes.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelText: {
    color: noir.platinum,
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
  createBtn: {
    flex: 1.35,
    height: 44,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  createBtnDisabled: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  createText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: fuentes.bold,
  },
  groupHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  groupHintText: {
    flex: 1,
    fontSize: 8.5,
    fontFamily: fuentes.medium,
  },
  keyboard: {
    marginTop: 12,
    marginHorizontal: -16,
  },
});
