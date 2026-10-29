import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fuentes, noir } from '../../constantes/colores';
import { vibrarBoton } from '../../utilidades/hapticos';
import EjercicioGif from '../entrenamiento/EjercicioGif';
import {
  EjercicioBiblioteca,
  colorDeGrupo,
} from '../../services/bibliotecaEjercicios';

interface Props {
  item: EjercicioBiblioteca;
  esFavorito: boolean;
  enLista?: boolean;
  /** true: la acción del badge añade/quita de la lista abierta. */
  modoLista?: boolean;
  onPress: () => void;
  onToggleFavorito: () => void;
  onInfo: () => void;
  onAccionLista: () => void;
}

export default function TarjetaEjercicioBiblioteca({
  item,
  esFavorito,
  enLista = false,
  modoLista = false,
  onPress,
  onToggleFavorito,
  onInfo,
  onAccionLista,
}: Props) {
  const color = colorDeGrupo(item.muscle);
  const etiquetaLista = modoLista
    ? enLista
      ? 'Quitar de esta lista'
      : 'Añadir a esta lista'
    : 'Añadir a una lista';

  return (
    <View style={[styles.card, esFavorito && styles.cardFavorita]}>
      {esFavorito ? (
        <View
          pointerEvents="none"
          style={[styles.favoritoHalo, { borderColor: `${color}30` }]}
        />
      ) : null}

      <Pressable
        onPress={() => {
          vibrarBoton(10);
          onPress();
        }}
        style={({ pressed }) => [styles.cardTouch, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <View style={styles.gifBox}>
          <EjercicioGif
            uri={item.gifUrl}
            style={styles.gifImage}
            contentFit="contain"
            animated={false}
          />
          <View style={[styles.gifAccent, { backgroundColor: `${color}66` }]} />
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.nombre} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.tagsRow}>
            <View
              style={[
                styles.tagMusculo,
                {
                  backgroundColor: `${color}16`,
                  borderColor: `${color}3D`,
                },
              ]}
            >
              <View style={[styles.tagDot, { backgroundColor: color }]} />
              <Text style={[styles.tagMusculoText, { color }]}>
                {item.muscleLabel}
              </Text>
            </View>

            <View style={styles.tagEquipo}>
              <Text style={styles.tagEquipoText}>{item.equipmentLabel}</Text>
            </View>

            {modoLista && enLista ? (
              <View style={styles.tagEnLista}>
                <Ionicons name="checkmark" size={9} color={noir.mint} />
                <Text style={styles.tagEnListaText}>En lista</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={() => {
          vibrarBoton(12);
          onAccionLista();
        }}
        style={({ pressed }) => [
          styles.listaBadge,
          modoLista && enLista && styles.listaBadgeActiva,
          pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
        ]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={etiquetaLista}
      >
        <Ionicons
          name={
            modoLista
              ? enLista
                ? 'checkmark'
                : 'add'
              : 'bookmark-outline'
          }
          size={13}
          color={modoLista && enLista ? noir.mint : noir.info}
        />
      </Pressable>

      <View style={styles.actionsColumn}>
        <Pressable
          onPress={() => {
            vibrarBoton(16);
            onToggleFavorito();
          }}
          style={({ pressed }) => [
            styles.actionBtn,
            esFavorito && styles.actionBtnFavorito,
            pressed && { opacity: 0.7, transform: [{ scale: 0.93 }] },
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ selected: esFavorito }}
          accessibilityLabel={
            esFavorito ? 'Quitar de favoritos' : 'Añadir a favoritos'
          }
        >
          <Ionicons
            name={esFavorito ? 'heart' : 'heart-outline'}
            size={17}
            color={esFavorito ? '#FF6B8A' : noir.muted}
          />
        </Pressable>

        <Pressable
          onPress={() => {
            vibrarBoton(10);
            onInfo();
          }}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Ver técnica de ${item.name}`}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={noir.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.028)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    padding: 9,
    paddingLeft: 10,
    gap: 7,
    overflow: 'hidden',
  },
  cardFavorita: {
    borderColor: 'rgba(255, 107, 138, 0.24)',
    backgroundColor: 'rgba(255, 107, 138, 0.035)',
  },
  favoritoHalo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    borderWidth: 1,
    opacity: 0.65,
  },
  cardTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minWidth: 0,
  },
  gifBox: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#06070B',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  gifAccent: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  cardInfo: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  nombre: {
    color: noir.text,
    fontSize: 12.5,
    fontFamily: fuentes.bold,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  tagMusculo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tagMusculoText: {
    fontSize: 9,
    fontFamily: fuentes.bold,
  },
  tagEquipo: {
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagEquipoText: {
    color: noir.muted,
    fontSize: 9,
    fontFamily: fuentes.medium,
  },
  tagEnLista: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(63, 242, 176, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(63, 242, 176, 0.22)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagEnListaText: {
    color: noir.mint,
    fontSize: 8,
    fontFamily: fuentes.bold,
  },
  listaBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 11, 17, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.38)',
  },
  listaBadgeActiva: {
    borderColor: 'rgba(63, 242, 176, 0.45)',
    backgroundColor: 'rgba(6, 18, 13, 0.94)',
  },
  actionsColumn: {
    width: 30,
    height: 64,
    justifyContent: 'space-between',
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  actionBtnFavorito: {
    backgroundColor: 'rgba(255, 107, 138, 0.08)',
  },
});
