import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constants/colores';
import EjercicioGif from '../entrenamiento/EjercicioGif';
import {
  EjercicioBiblioteca,
  colorDeGrupo,
} from '../../services/bibliotecaEjercicios';
import { ListaFavoritosBiblioteca } from '../../services/favoritosBiblioteca';

interface Props {
  lista: ListaFavoritosBiblioteca;
  grupoLabel: string;
  grupoIcono: string;
  previews: EjercicioBiblioteca[];
  onPress: () => void;
}

export default function TarjetaListaFavoritos({
  lista,
  grupoLabel,
  grupoIcono,
  previews,
  onPress,
}: Props) {
  const color = colorDeGrupo(lista.grupoMuscular);
  const total = lista.ejercicioIds.length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: `${color}2E` },
        pressed && { opacity: 0.84, transform: [{ scale: 0.992 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Abrir lista ${lista.nombre}, ${total} ejercicios`}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[`${color}14`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.accent, { backgroundColor: color }]} />

      <View style={[styles.iconBox, { borderColor: `${color}44` }]}>
        <Ionicons name={grupoIcono as any} size={17} color={color} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.nombre} numberOfLines={1}>
          {lista.nombre}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.grupo, { color }]} numberOfLines={1}>
            {grupoLabel}
          </Text>
          <View style={styles.metaDot} />
          <Text style={styles.meta}>
            {total} {total === 1 ? 'ejercicio' : 'ejercicios'}
          </Text>
        </View>
      </View>

      {previews.length > 0 ? (
        <View style={styles.previews}>
          {previews.slice(0, 3).map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.preview,
                {
                  marginLeft: index === 0 ? 0 : -10,
                  zIndex: 3 - index,
                  borderColor: `${color}55`,
                },
              ]}
            >
              <EjercicioGif
                uri={item.gifUrl}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                animated={false}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.previewVacio, { borderColor: `${color}33` }]}>
          <Ionicons name="add" size={14} color={color} />
        </View>
      )}

      <Ionicons name="chevron-forward" size={15} color={noir.muted2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nombre: {
    color: noir.text,
    fontSize: 12.5,
    fontFamily: fuentes.bold,
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  grupo: {
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: noir.muted2,
  },
  meta: {
    color: noir.muted2,
    fontSize: 9,
    fontFamily: fuentes.medium,
  },
  previews: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#06070B',
  },
  previewVacio: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
});
