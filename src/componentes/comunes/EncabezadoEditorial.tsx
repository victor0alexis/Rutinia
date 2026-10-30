import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fuentes, noir } from '../../constantes/colores';
import { useLayout } from '../../hooks/useLayout';
import {
  CuentaRutinia,
  obtenerCuentaActiva,
  subscribirCambioCuenta,
} from '../../servicios/cuentas';
import { vibrarBoton } from '../../utilidades/hapticos';
import TextoGradiente from '../efectos/TextoGradiente';
import { RutiniaLogo } from './RutiniaLogo';
import MenuOpcionesModal from '../cuenta/MenuOpcionesModal';

const TITLE_GRADIENT_COLORS = [
  '#FFFFFF',
  '#EDF3FB',
  '#AAB5C6',
  '#EAF1FA',
  '#FFFFFF',
];

type Props = {
  title?: string;
  mostrarLogo?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cabecera editorial compartida por las secciones principales.
 * Muestra el logotipo oficial solo cuando la pantalla lo solicita y conserva
 * el menú de cuenta y ajustes detrás del avatar.
 */
function EncabezadoEditorial({ title = 'RutinIA', mostrarLogo = false, style }: Props) {
  const { isCompact } = useLayout();
  const [cuenta, setCuenta] = useState<CuentaRutinia | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const cargarInfoUsuario = () => {
    obtenerCuentaActiva()
      .then(setCuenta)
      .catch(() => {
        // El avatar de respaldo mantiene la cabecera estable.
      });
  };

  useEffect(() => {
    cargarInfoUsuario();
    return subscribirCambioCuenta(cargarInfoUsuario);
  }, []);

  const avatarInicial = cuenta?.nombre?.trim().charAt(0).toUpperCase() || 'A';
  const esNube = cuenta?.tipo === 'nube';
  const coloresAvatar: [string, string] = esNube
    ? [cuenta?.color || '#9E1C30', '#13151B']
    : ['#232631', '#13151B'];

  return (
    <>
      <View style={[styles.headerWrap, style]}>
        <View style={styles.brandLockup}>
          {mostrarLogo && <RutiniaLogo size={32} />}

          <View style={styles.brandWordmark}>
            <TextoGradiente
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
            </TextoGradiente>
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
            accessibilityLabel="Abrir menú de cuenta y ajustes"
          >
            <LinearGradient
              colors={coloresAvatar}
              start={{ x: 0.3, y: 0.1 }}
              end={{ x: 0.7, y: 0.95 }}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>{avatarInicial}</Text>
            </LinearGradient>
          </Pressable>
          <View
            pointerEvents="none"
            style={[
              styles.avatarStatus,
              {
                backgroundColor: esNube ? noir.mint : noir.champagne,
                shadowColor: esNube ? noir.mint : noir.champagne,
              },
            ]}
          />
        </View>
      </View>

      <MenuOpcionesModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSessionChange={cargarInfoUsuario}
      />
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
});

export default EncabezadoEditorial;
