import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fuentes, noir } from '../constants/colores';
import { useLayout } from '../hooks/useLayout';
import { supabase } from '../lib/supabase';
import { vibrarBoton } from '../utils/haptics';
import GradientText from './GradientText';
import { RutiniaLogo } from './RutiniaLogo';

const TITLE_GRADIENT_COLORS = [
  '#FFFFFF',
  '#EDF3FB',
  '#AAB5C6',
  '#EAF1FA',
  '#FFFFFF',
];

type Props = {
  title?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cabecera editorial compartida por las secciones principales.
 * Reproduce el lockup de marca con el logotipo oficial de Rutinia y el título de la sección,
 * y conserva el menú de cuenta detrás del avatar.
 */
export default function EditorialHeader({ title = 'Semana', style }: Props) {
  const { gutter, topInset, isCompact, width, contentMaxWidth } = useLayout();
  // El avatar vive dentro del contenido centrado; el menú debe nacer de su
  // borde derecho también en tablet/escritorio, no del borde de la pantalla.
  const menuRight = Math.max(gutter, (width - contentMaxWidth) / 2 + gutter);
  const [avatarInicial, setAvatarInicial] = useState('A');
  const [emailCuenta, setEmailCuenta] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    let activo = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!activo) return;
        const user = data.session?.user;
        const nombre =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.nombre ||
          user?.email ||
          '';
        if (typeof nombre === 'string' && nombre.trim().length > 0) {
          setAvatarInicial(nombre.trim().charAt(0).toUpperCase());
        }
        setEmailCuenta(user?.email ?? '');
      })
      .catch(() => {
        // El avatar de respaldo mantiene la cabecera estable sin sesión.
      });

    return () => {
      activo = false;
    };
  }, []);

  const cerrarSesion = () => {
    setMenuVisible(false);
    supabase.auth.signOut();
  };

  return (
    <>
      <View style={[styles.headerWrap, style]}>
        <View style={styles.brandLockup}>
          <RutiniaLogo size={32} />

          <View style={styles.brandWordmark}>
            <GradientText
              colors={TITLE_GRADIENT_COLORS}
              animationSpeed={8}
              direction="horizontal"
              scale={3}
              style={{
                fontSize: isCompact ? 19 : 21,
                lineHeight: 24,
                fontFamily: fuentes.extraBold,
                letterSpacing: -0.55,
              }}
            >
              {title}
            </GradientText>
            <View style={styles.brandDotSmall} />
          </View>
        </View>

        <View style={styles.avatarWrap}>
          <Pressable
            onPress={() => {
              vibrarBoton();
              setMenuVisible(true);
            }}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && { opacity: 0.82, transform: [{ scale: 0.94 }] },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú de cuenta"
          >
            <LinearGradient
              colors={['#232631', '#13151B']}
              start={{ x: 0.3, y: 0.1 }}
              end={{ x: 0.7, y: 0.95 }}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>{avatarInicial}</Text>
            </LinearGradient>
          </Pressable>
          <View pointerEvents="none" style={styles.avatarStatus} />
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuVisible(false)}
            accessibilityLabel="Cerrar menú de cuenta"
          />

          <View
            style={[
              styles.accountMenu,
              {
                top: topInset + 46,
                right: menuRight,
              },
            ]}
          >
            <Text style={styles.accountMenuLabel}>CUENTA</Text>
            <Text numberOfLines={1} style={styles.accountMenuEmail}>
              {emailCuenta || 'Sesión activa'}
            </Text>
            <View style={styles.accountMenuDivider} />
            <Pressable
              onPress={cerrarSesion}
              style={({ pressed }) => [
                styles.accountMenuLogout,
                pressed && { opacity: 0.68 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
            >
              <Ionicons name="log-out-outline" size={15} color={noir.platinum} />
              <Text style={styles.accountMenuLogoutText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    position: 'relative',
    zIndex: 60,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  brandWordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 0,
  },
  brandDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: noir.pearl,
    marginBottom: 4,
    shadowColor: '#E2EFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarWrap: {
    position: 'relative',
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
  },
  avatarGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#E8EDF5',
    fontFamily: fuentes.semiBold,
    fontSize: 11,
  },
  avatarStatus: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: noir.mint,
    borderWidth: 2,
    borderColor: '#06070A',
    shadowColor: noir.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
    elevation: 2,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  accountMenu: {
    position: 'absolute',
    width: 218,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 20, 26, 0.98)',
    borderWidth: 1,
    borderColor: noir.lineStrong,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
  },
  accountMenuLabel: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  accountMenuEmail: {
    color: noir.text,
    fontFamily: fuentes.medium,
    fontSize: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  accountMenuDivider: {
    height: 1,
    backgroundColor: noir.line,
    marginVertical: 8,
  },
  accountMenuLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  accountMenuLogoutText: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 12,
  },
});
