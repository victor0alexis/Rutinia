import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colores, COLORES_PLANES, fuentes, noir } from '../constantes/colores';
import { useLayout } from '../hooks/useLayout';
import {
  actualizarEmailActual,
  actualizarPasswordActual,
  actualizarPerfilActual,
  cambiarCuenta,
  cerrarSesionActual,
  crearCuenta,
  CuentaRutinia,
  eliminarCuentaActual,
  EliminacionNoConfiguradaError,
  EstadoCuentas,
  iniciarSesion,
  obtenerEstadoCuentas,
  quitarCuentaDelDispositivo,
  reenviarConfirmacion,
  SesionExpiradaError,
  subscribirCambioCuenta,
} from '../services/cuentas';
import { limpiarCacheDatosLocales } from '../utilidades/almacenamientoLocal';
import { confirmarAccion, mostrarMensaje } from '../utilidades/errores';
import { vibrarBoton } from '../utilidades/hapticos';
import { emitirCambioDatos } from '../utilidades/sincronizacion';
import { RutiniaLogo } from './RutiniaLogo';

export const KEY_PREF_UNIDAD = 'rutinia_pref_unidad_peso';
export const KEY_PREF_HAPTICOS = 'rutinia_pref_hapticos';
export const KEY_PREF_TIMER_AUTO = 'rutinia_pref_timer_auto';

const DANGER = '#F08A9B';
const SUCCESS = '#3FF2B0';
const WARNING = noir.champagne;

type Vista = 'menu' | 'cuentas' | 'auth' | 'perfil';
type ModoAuth = 'login' | 'registro';
type Aviso = { tipo: 'error' | 'exito' | 'info'; texto: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  onSessionChange?: () => void;
}

const TITULOS: Record<Vista, string> = {
  menu: 'Menú & Ajustes',
  cuentas: 'Cambiar de cuenta',
  auth: 'Tu cuenta',
  perfil: 'Mi cuenta',
};

function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

function inicialDe(cuenta?: CuentaRutinia | null): string {
  return cuenta?.nombre?.trim().charAt(0).toUpperCase() || 'A';
}

function AvatarCuenta({
  cuenta,
  size = 44,
}: {
  cuenta: CuentaRutinia;
  size?: number;
}) {
  const esNube = cuenta.tipo === 'nube';
  const radio = size / 2;

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radio },
      ]}
    >
      <LinearGradient
        colors={
          esNube
            ? [cuenta.color || colores.primario, '#15171F']
            : ['#242833', '#12141A']
        }
        start={{ x: 0.25, y: 0.1 }}
        end={{ x: 0.8, y: 0.95 }}
        style={styles.avatarGradient}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
          {inicialDe(cuenta)}
        </Text>
      </LinearGradient>
      <View
        style={[
          styles.avatarDot,
          {
            backgroundColor: esNube ? SUCCESS : WARNING,
            shadowColor: esNube ? SUCCESS : WARNING,
          },
        ]}
      />
    </View>
  );
}

function Alerta({ aviso }: { aviso: Aviso }) {
  const color =
    aviso.tipo === 'error' ? DANGER : aviso.tipo === 'exito' ? SUCCESS : noir.info;
  const icono =
    aviso.tipo === 'error'
      ? 'alert-circle'
      : aviso.tipo === 'exito'
        ? 'checkmark-circle'
        : 'information-circle';

  return (
    <View
      style={[
        styles.alerta,
        {
          borderColor: `${color}55`,
          backgroundColor: `${color}14`,
        },
      ]}
    >
      <Ionicons name={icono as any} size={16} color={color} />
      <Text style={[styles.alertaTexto, { color }]}>{aviso.texto}</Text>
    </View>
  );
}

type CampoProps = React.ComponentProps<typeof TextInput> & {
  icono: keyof typeof Ionicons.glyphMap;
  mostrarOcultar?: boolean;
  oculto?: boolean;
  onMostrarOcultar?: () => void;
};

function Campo({
  icono,
  mostrarOcultar,
  oculto,
  onMostrarOcultar,
  style,
  ...props
}: CampoProps) {
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={[styles.campoWrap, enfocado && styles.campoWrapFocus]}>
      <Ionicons
        name={icono}
        size={17}
        color={enfocado ? noir.platinum : noir.muted2}
        style={styles.campoIcono}
      />
      <TextInput
        {...props}
        placeholderTextColor={noir.muted2}
        selectionColor={noir.ice}
        onFocus={(event) => {
          setEnfocado(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setEnfocado(false);
          props.onBlur?.(event);
        }}
        style={[styles.campoInput, style]}
      />
      {mostrarOcultar ? (
        <Pressable
          onPress={onMostrarOcultar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={oculto ? 'Mostrar contraseña' : 'Ocultar contraseña'}
        >
          <Ionicons
            name={oculto ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={noir.muted2}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function BotonPrimario({
  texto,
  icono,
  onPress,
  cargando,
  disabled,
}: {
  texto: string;
  icono?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  cargando?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled || cargando) return;
        vibrarBoton();
        onPress();
      }}
      disabled={disabled || cargando}
      style={({ pressed }) => [
        styles.botonPrimario,
        (disabled || cargando) && { opacity: 0.55 },
        pressed && { opacity: 0.86, transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      <LinearGradient
        colors={['#C2243D', '#7E1422']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.botonPrimarioGradient}
      >
        {cargando ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            {icono ? <Ionicons name={icono} size={17} color="#FFFFFF" /> : null}
            <Text style={styles.botonPrimarioTexto}>{texto}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function BotonSecundario({
  texto,
  icono,
  onPress,
  cargando,
  disabled,
}: {
  texto: string;
  icono?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  cargando?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled || cargando) return;
        vibrarBoton();
        onPress();
      }}
      disabled={disabled || cargando}
      style={({ pressed }) => [
        styles.botonSecundario,
        (disabled || cargando) && { opacity: 0.55 },
        pressed && { opacity: 0.72 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      {icono ? <Ionicons name={icono} size={16} color={noir.platinum} /> : null}
      <Text style={styles.botonSecundarioTexto}>{texto}</Text>
    </Pressable>
  );
}

export default function MenuOpcionesModal({
  visible,
  onClose,
  onSessionChange,
}: Props) {
  const { contentMaxWidth, isCompact } = useLayout();

  const [vista, setVista] = useState<Vista>('menu');
  const [estado, setEstado] = useState<EstadoCuentas | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // Autenticación
  const [modoAuth, setModoAuth] = useState<ModoAuth>('login');
  const [nombreInput, setNombreInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargandoAuth, setCargandoAuth] = useState(false);
  const [reenviandoConfirmacion, setReenviandoConfirmacion] = useState(false);
  const [avisoAuth, setAvisoAuth] = useState<Aviso | null>(null);

  // Edición de perfil
  const [nombrePerfil, setNombrePerfil] = useState('');
  const [colorPerfil, setColorPerfil] = useState<string>(COLORES_PLANES[0]);
  const [emailPerfil, setEmailPerfil] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordNueva2, setPasswordNueva2] = useState('');
  const [verPasswordNueva, setVerPasswordNueva] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoEmail, setGuardandoEmail] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [avisoPerfil, setAvisoPerfil] = useState<Aviso | null>(null);

  // Preferencias
  const [unidadPeso, setUnidadPeso] = useState<'kg' | 'lbs'>('kg');
  const [hapticosActivos, setHapticosActivos] = useState(true);
  const [timerAutoActivo, setTimerAutoActivo] = useState(true);
  const [recargando, setRecargando] = useState(false);
  const [mensajeSincro, setMensajeSincro] = useState<string | null>(null);

  const cargarCuentas = () => {
    obtenerEstadoCuentas()
      .then(setEstado)
      .catch((err) => {
        console.warn('No se pudo cargar el estado de las cuentas:', err);
      });
  };

  const cargarPerfil = (cuenta: CuentaRutinia) => {
    setNombrePerfil(cuenta.nombre);
    setColorPerfil(cuenta.color || COLORES_PLANES[0]);
    setEmailPerfil(cuenta.email || '');
  };

  const manejarApertura = () => {
    setVista('menu');
    setAviso(null);
    setAvisoAuth(null);
    setAvisoPerfil(null);
  };

  useEffect(() => {
    if (!visible) return;
    let activo = true;

    cargarCuentas();

    Promise.all([
      AsyncStorage.getItem(KEY_PREF_UNIDAD),
      AsyncStorage.getItem(KEY_PREF_HAPTICOS),
      AsyncStorage.getItem(KEY_PREF_TIMER_AUTO),
    ]).then(([prefUnidad, prefHapticos, prefTimer]) => {
      if (!activo) return;
      if (prefUnidad === 'lbs' || prefUnidad === 'kg') setUnidadPeso(prefUnidad);
      if (prefHapticos !== null) setHapticosActivos(prefHapticos === 'true');
      if (prefTimer !== null) setTimerAutoActivo(prefTimer === 'true');
    });

    return () => {
      activo = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    return subscribirCambioCuenta(cargarCuentas);
  }, [visible]);

  const cuentaActiva = estado?.activa ?? null;
  const otrasCuentas = estado?.cuentas.filter((c) => c.id !== cuentaActiva?.id) ?? [];

  const manejarCierre = () => {
    if (cambiandoId || cargandoAuth) return;
    setAviso(null);
    setAvisoAuth(null);
    setAvisoPerfil(null);
    setVista('menu');
    onClose();
  };

  const volverAlMenu = () => {
    setVista('menu');
    setAvisoAuth(null);
    setAvisoPerfil(null);
  };

  const abrirAuth = (modo: ModoAuth, email?: string | null, mensaje?: string) => {
    vibrarBoton();
    setModoAuth(modo);
    setNombreInput('');
    setEmailInput(email || '');
    setPasswordInput('');
    setConfirmarPassword('');
    setVerPassword(false);
    setAvisoAuth(mensaje ? { tipo: 'info', texto: mensaje } : null);
    setVista('auth');
  };

  const abrirPerfil = () => {
    if (!cuentaActiva || cuentaActiva.tipo !== 'nube') return;
    vibrarBoton();
    cargarPerfil(cuentaActiva);
    setPasswordNueva('');
    setPasswordNueva2('');
    setVerPasswordNueva(false);
    setAvisoPerfil(null);
    setVista('perfil');
  };

  // ── Preferencias ──────────────────────────────────────────────────────────
  const cambiarUnidadPeso = async (nueva: 'kg' | 'lbs') => {
    vibrarBoton(15);
    setUnidadPeso(nueva);
    await AsyncStorage.setItem(KEY_PREF_UNIDAD, nueva);
    emitirCambioDatos();
  };

  const toggleHapticos = async (valor: boolean) => {
    if (valor) vibrarBoton(20);
    setHapticosActivos(valor);
    await AsyncStorage.setItem(KEY_PREF_HAPTICOS, String(valor));
  };

  const toggleTimerAuto = async (valor: boolean) => {
    vibrarBoton(15);
    setTimerAutoActivo(valor);
    await AsyncStorage.setItem(KEY_PREF_TIMER_AUTO, String(valor));
  };

  // ── Cambio de cuenta ──────────────────────────────────────────────────────
  const seleccionarCuenta = async (cuenta: CuentaRutinia) => {
    if (!estado || cuenta.id === estado.activaId || cambiandoId) return;

    if (cuenta.tipo === 'nube' && !cuenta.sesionGuardada) {
      abrirAuth(
        'login',
        cuenta.email,
        `La sesión de ${cuenta.email || cuenta.nombre} expiró. Ingresa tu contraseña para volver a entrar.`
      );
      return;
    }

    vibrarBoton();
    setCambiandoId(cuenta.id);
    setAviso(null);

    try {
      const activa = await cambiarCuenta(cuenta.id);
      setEstado(await obtenerEstadoCuentas());
      setAviso({
        tipo: 'exito',
        texto:
          activa.tipo === 'local'
            ? 'Ahora estás en el perfil local.'
            : `Ahora estás usando ${activa.email || activa.nombre}.`,
      });
      setVista('menu');
      onSessionChange?.();
    } catch (err) {
      if (err instanceof SesionExpiradaError) {
        abrirAuth('login', err.email, err.message);
      } else {
        setAviso({
          tipo: 'error',
          texto: err instanceof Error ? err.message : 'No se pudo cambiar de cuenta.',
        });
      }
      cargarCuentas();
    } finally {
      setCambiandoId(null);
    }
  };

  // ── Autenticación ─────────────────────────────────────────────────────────
  const ejecutarLogin = async () => {
    if (!emailValido(emailInput)) {
      setAvisoAuth({ tipo: 'error', texto: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (!passwordInput) {
      setAvisoAuth({ tipo: 'error', texto: 'Ingresa tu contraseña.' });
      return;
    }

    setCargandoAuth(true);
    setAvisoAuth(null);
    try {
      await iniciarSesion(emailInput, passwordInput);
      setAviso({ tipo: 'exito', texto: '¡Sesión iniciada! Tus datos ya están disponibles.' });
      setEmailInput('');
      setPasswordInput('');
      setVista('menu');
      setEstado(await obtenerEstadoCuentas());
      onSessionChange?.();
    } catch (err) {
      setAvisoAuth({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo iniciar sesión.',
      });
    } finally {
      setCargandoAuth(false);
    }
  };

  const ejecutarRegistro = async () => {
    if (!emailValido(emailInput)) {
      setAvisoAuth({ tipo: 'error', texto: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (passwordInput.length < 6) {
      setAvisoAuth({
        tipo: 'error',
        texto: 'La contraseña debe tener al menos 6 caracteres.',
      });
      return;
    }
    if (passwordInput !== confirmarPassword) {
      setAvisoAuth({ tipo: 'error', texto: 'Las contraseñas no coinciden.' });
      return;
    }

    setCargandoAuth(true);
    setAvisoAuth(null);
    try {
      const resultado = await crearCuenta({
        nombre: nombreInput,
        email: emailInput,
        password: passwordInput,
      });

      setEstado(await obtenerEstadoCuentas());

      if (resultado.requiereConfirmacion) {
        setModoAuth('login');
        setPasswordInput('');
        setConfirmarPassword('');
        setAvisoAuth({ tipo: 'exito', texto: resultado.mensaje });
      } else {
        setAviso({ tipo: 'exito', texto: resultado.mensaje });
        setNombreInput('');
        setEmailInput('');
        setPasswordInput('');
        setConfirmarPassword('');
        setVista('menu');
        onSessionChange?.();
      }
    } catch (err) {
      setAvisoAuth({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo crear la cuenta.',
      });
    } finally {
      setCargandoAuth(false);
    }
  };

  const reenviarCorreoConfirmacion = async () => {
    if (!emailValido(emailInput)) {
      setAvisoAuth({ tipo: 'error', texto: 'Ingresa el correo de la cuenta.' });
      return;
    }

    setReenviandoConfirmacion(true);
    setAvisoAuth(null);
    try {
      await reenviarConfirmacion(emailInput);
      setAvisoAuth({
        tipo: 'info',
        texto:
          'Si la cuenta existe y sigue pendiente, enviamos un nuevo enlace. Revisa también la carpeta de Spam.',
      });
    } catch (err) {
      setAvisoAuth({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo reenviar el correo.',
      });
    } finally {
      setReenviandoConfirmacion(false);
    }
  };

  const cerrarSesion = () => {
    if (!cuentaActiva || cuentaActiva.tipo !== 'nube') return;
    vibrarBoton(20);
    confirmarAccion(
      'Cerrar sesión',
      `Se cerrará la sesión de ${cuentaActiva.email || cuentaActiva.nombre} en este dispositivo. La cuenta seguirá en la lista para que puedas volver a entrar.`,
      async () => {
        await cerrarSesionActual({ olvidarSesion: true });
        setEstado(await obtenerEstadoCuentas());
        setVista('menu');
        setAviso({ tipo: 'info', texto: 'Sesión cerrada. Estás en el perfil local.' });
        onSessionChange?.();
      },
      'Cerrar sesión'
    );
  };

  const quitarCuenta = (cuenta: CuentaRutinia) => {
    vibrarBoton(20);
    const eraActiva = estado?.activaId === cuenta.id;
    confirmarAccion(
      'Quitar de este dispositivo',
      `Se borrará la sesión guardada y la caché local de ${cuenta.email || cuenta.nombre} en este dispositivo. Sus datos en la nube no se eliminan y podrás volver a iniciar sesión cuando quieras.`,
      async () => {
        await quitarCuentaDelDispositivo(cuenta.id);
        setEstado(await obtenerEstadoCuentas());
        setAviso({ tipo: 'info', texto: 'Cuenta quitada de este dispositivo.' });
        if (eraActiva) setVista('menu');
        onSessionChange?.();
      },
      'Quitar'
    );
  };

  // ── Perfil ────────────────────────────────────────────────────────────────
  const guardarPerfil = async () => {
    if (!nombrePerfil.trim()) {
      setAvisoPerfil({ tipo: 'error', texto: 'El nombre no puede estar vacío.' });
      return;
    }

    setGuardandoPerfil(true);
    setAvisoPerfil(null);
    try {
      await actualizarPerfilActual({ nombre: nombrePerfil, color: colorPerfil });
      setEstado(await obtenerEstadoCuentas());
      setAvisoPerfil({ tipo: 'exito', texto: 'Perfil actualizado.' });
      onSessionChange?.();
    } catch (err) {
      setAvisoPerfil({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo actualizar el perfil.',
      });
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const guardarEmail = async () => {
    if (!emailValido(emailPerfil)) {
      setAvisoPerfil({ tipo: 'error', texto: 'Ingresa un correo electrónico válido.' });
      return;
    }

    setGuardandoEmail(true);
    setAvisoPerfil(null);
    try {
      const resultado = await actualizarEmailActual(emailPerfil);
      setEstado(await obtenerEstadoCuentas());
      setAvisoPerfil({
        tipo: resultado.requiereConfirmacion ? 'info' : 'exito',
        texto: resultado.mensaje,
      });
    } catch (err) {
      setAvisoPerfil({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo actualizar el correo.',
      });
    } finally {
      setGuardandoEmail(false);
    }
  };

  const guardarPassword = async () => {
    if (passwordNueva.length < 6) {
      setAvisoPerfil({
        tipo: 'error',
        texto: 'La nueva contraseña debe tener al menos 6 caracteres.',
      });
      return;
    }
    if (passwordNueva !== passwordNueva2) {
      setAvisoPerfil({ tipo: 'error', texto: 'Las contraseñas no coinciden.' });
      return;
    }

    setGuardandoPassword(true);
    setAvisoPerfil(null);
    try {
      await actualizarPasswordActual(passwordNueva);
      setPasswordNueva('');
      setPasswordNueva2('');
      setAvisoPerfil({ tipo: 'exito', texto: 'Contraseña actualizada.' });
    } catch (err) {
      setAvisoPerfil({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.',
      });
    } finally {
      setGuardandoPassword(false);
    }
  };

  const eliminarCuenta = () => {
    if (!cuentaActiva || cuentaActiva.tipo !== 'nube') return;
    vibrarBoton(25);
    confirmarAccion(
      'Eliminar cuenta',
      `Esta acción borra definitivamente la cuenta ${cuentaActiva.email || cuentaActiva.nombre} y todos sus datos en la nube (rutinas, planes, registros, notas y favoritos). No se puede deshacer.`,
      async () => {
        try {
          await eliminarCuentaActual();
          setEstado(await obtenerEstadoCuentas());
          setVista('menu');
          setAviso({
            tipo: 'exito',
            texto: 'Cuenta eliminada. Ahora estás en el perfil local.',
          });
          onSessionChange?.();
        } catch (err) {
          if (err instanceof EliminacionNoConfiguradaError) {
            mostrarMensaje('Falta configurar Supabase', err.message);
            return;
          }
          mostrarMensaje(
            'No se pudo eliminar la cuenta',
            err instanceof Error ? err.message : 'Intenta nuevamente.'
          );
        }
      },
      'Eliminar cuenta'
    );
  };

  // ── Datos ─────────────────────────────────────────────────────────────────
  const recargarDatos = async () => {
    vibrarBoton(15);
    setRecargando(true);
    setMensajeSincro(null);
    try {
      emitirCambioDatos();
      await new Promise((resolve) => setTimeout(resolve, 700));
      setMensajeSincro('✓ Datos recargados desde tu cuenta');
    } finally {
      setRecargando(false);
      setTimeout(() => setMensajeSincro(null), 3200);
    }
  };

  const limpiarCache = () => {
    vibrarBoton(20);
    confirmarAccion(
      'Limpiar caché local',
      'Se borrarán las copias locales de rutinas, planes, registros y notas de esta cuenta. La información de la nube no se modifica. La sesión en curso y tus preferencias se conservan.',
      async () => {
        const eliminadas = await limpiarCacheDatosLocales();
        emitirCambioDatos();
        setMensajeSincro(
          eliminadas > 0
            ? `✓ ${eliminadas} elemento(s) de caché eliminados`
            : '✓ No había caché que limpiar'
        );
        setTimeout(() => setMensajeSincro(null), 3200);
      },
      'Limpiar'
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const anchoHoja = Math.min(contentMaxWidth, isCompact ? 420 : 468);
  const titulo = TITULOS[vista];
  const cuentaNube = cuentaActiva?.tipo === 'nube';
  const hayCuentasNube = estado?.cuentas.some((cuenta) => cuenta.tipo === 'nube') ?? false;

  const renderMenu = () => (
    <>
      {aviso ? <Alerta aviso={aviso} /> : null}

      {/* Cuenta activa */}
      <View style={styles.card}>
        <View style={styles.cardEyebrowRow}>
          <Text style={styles.cardTitulo}>CUENTA ACTIVA</Text>
          <View style={styles.devicePill}>
            <Ionicons name="phone-portrait-outline" size={11} color={noir.muted2} />
            <Text style={styles.devicePillTexto}>Este dispositivo</Text>
          </View>
        </View>

        {cuentaActiva ? (
          <>
            <View style={styles.cuentaHero}>
              <AvatarCuenta cuenta={cuentaActiva} size={52} />
              <View style={styles.cuentaHeroInfo}>
                <Text style={styles.cuentaNombre} numberOfLines={1}>
                  {cuentaActiva.nombre}
                </Text>
                <Text style={styles.cuentaEmail} numberOfLines={1}>
                  {cuentaActiva.email || 'Sin cuenta en la nube'}
                </Text>
                <View
                  style={[
                    styles.badge,
                    {
                      borderColor: cuentaNube ? `${SUCCESS}55` : `${WARNING}55`,
                      backgroundColor: cuentaNube ? `${SUCCESS}14` : `${WARNING}14`,
                    },
                  ]}
                >
                  <Ionicons
                    name={cuentaNube ? 'cloud-done-outline' : 'phone-portrait-outline'}
                    size={11}
                    color={cuentaNube ? SUCCESS : WARNING}
                  />
                  <Text
                    style={[
                      styles.badgeTexto,
                      { color: cuentaNube ? SUCCESS : WARNING },
                    ]}
                  >
                    {cuentaNube ? 'Sincronizado con Supabase' : 'Perfil local'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.accionesCuenta}>
              {cuentaNube ? (
                <>
                  <BotonSecundario
                    texto="Gestionar"
                    icono="settings-outline"
                    onPress={abrirPerfil}
                  />
                  <BotonPrimario
                    texto="Cambiar de cuenta"
                    icono="swap-horizontal-outline"
                    onPress={() => {
                      vibrarBoton();
                      setVista('cuentas');
                    }}
                  />
                </>
              ) : hayCuentasNube ? (
                <>
                  <BotonSecundario
                    texto="Iniciar sesión"
                    icono="log-in-outline"
                    onPress={() => abrirAuth('login')}
                  />
                  <BotonPrimario
                    texto="Cambiar de cuenta"
                    icono="swap-horizontal-outline"
                    onPress={() => {
                      vibrarBoton();
                      setVista('cuentas');
                    }}
                  />
                </>
              ) : (
                <>
                  <BotonSecundario
                    texto="Crear cuenta"
                    icono="person-add-outline"
                    onPress={() => abrirAuth('registro')}
                  />
                  <BotonPrimario
                    texto="Iniciar sesión"
                    icono="log-in-outline"
                    onPress={() => abrirAuth('login')}
                  />
                </>
              )}
            </View>

            <Text style={styles.ayudaCuenta}>
              {cuentaNube
                ? 'Tus rutinas y registros se guardan en tu cuenta. Puedes añadir otra cuenta y alternar entre ellas sin cerrar la sesión.'
                : 'Estás entrenando sin una cuenta en la nube. Crea una o inicia sesión para sincronizar tus datos entre dispositivos.'}
            </Text>
          </>
        ) : (
          <View style={styles.cargandoCuenta}>
            <ActivityIndicator size="small" color={colores.primarioHover} />
            <Text style={styles.cargandoTexto}>Cargando tu sesión…</Text>
          </View>
        )}
      </View>

      {/* Preferencias */}
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>PREFERENCIAS DE ENTRENAMIENTO</Text>

        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <View style={styles.optionIcono}>
              <Ionicons name="barbell-outline" size={18} color={noir.platinum} />
            </View>
            <View style={styles.optionTexts}>
              <Text style={styles.optionLabel}>Unidad de peso</Text>
              <Text style={styles.optionSub}>Kilogramos o libras</Text>
            </View>
          </View>
          <View style={styles.segmento}>
            {(['kg', 'lbs'] as const).map((unidad) => (
              <Pressable
                key={unidad}
                onPress={() => cambiarUnidadPeso(unidad)}
                style={[
                  styles.segmentoBoton,
                  unidadPeso === unidad && styles.segmentoBotonActivo,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: unidadPeso === unidad }}
              >
                <Text
                  style={[
                    styles.segmentoTexto,
                    unidadPeso === unidad && styles.segmentoTextoActivo,
                  ]}
                >
                  {unidad}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.divisor} />

        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <View style={styles.optionIcono}>
              <Ionicons name="hardware-chip-outline" size={18} color={noir.platinum} />
            </View>
            <View style={styles.optionTexts}>
              <Text style={styles.optionLabel}>Vibración háptica</Text>
              <Text style={styles.optionSub}>Respuesta táctil al pulsar botones</Text>
            </View>
          </View>
          <Switch
            value={hapticosActivos}
            onValueChange={toggleHapticos}
            thumbColor="#FFFFFF"
            trackColor={{ false: '#262933', true: colores.primario }}
            ios_backgroundColor="#262933"
          />
        </View>

        <View style={styles.divisor} />

        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <View style={styles.optionIcono}>
              <Ionicons name="timer-outline" size={18} color={noir.platinum} />
            </View>
            <View style={styles.optionTexts}>
              <Text style={styles.optionLabel}>Temporizador de descanso</Text>
              <Text style={styles.optionSub}>Sugerir descanso al completar serie</Text>
            </View>
          </View>
          <Switch
            value={timerAutoActivo}
            onValueChange={toggleTimerAuto}
            thumbColor="#FFFFFF"
            trackColor={{ false: '#262933', true: colores.primario }}
            ios_backgroundColor="#262933"
          />
        </View>
      </View>

      {/* Datos */}
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>DATOS Y SINCRONIZACIÓN</Text>

        {mensajeSincro ? (
          <View style={styles.feedbackRow}>
            <Text style={styles.feedbackTexto}>{mensajeSincro}</Text>
          </View>
        ) : null}

        {cuentaNube ? (
          <>
            <Pressable
              onPress={recargarDatos}
              disabled={recargando}
              style={({ pressed }) => [
                styles.dataRow,
                pressed && { opacity: 0.72 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Recargar datos desde la nube"
            >
              <View style={styles.optionInfo}>
                <View style={styles.optionIcono}>
                  <Ionicons name="cloud-download-outline" size={18} color={noir.info} />
                </View>
                <View style={styles.optionTexts}>
                  <Text style={styles.optionLabel}>Recargar desde la nube</Text>
                  <Text style={styles.optionSub}>Vuelve a leer tus datos de Supabase</Text>
                </View>
              </View>
              {recargando ? (
                <ActivityIndicator size="small" color={noir.info} />
              ) : (
                <Ionicons name="chevron-forward" size={17} color={noir.muted2} />
              )}
            </Pressable>
            <View style={styles.divisor} />
          </>
        ) : (
          <>
            <View style={styles.localInfo}>
              <Ionicons name="information-circle-outline" size={16} color={WARNING} />
              <Text style={styles.localInfoTexto}>
                Estás en el perfil local. Inicia sesión para sincronizar entre dispositivos.
              </Text>
            </View>
            <View style={styles.divisor} />
          </>
        )}

        <Pressable
          onPress={limpiarCache}
          style={({ pressed }) => [styles.dataRow, pressed && { opacity: 0.72 }]}
          accessibilityRole="button"
          accessibilityLabel="Limpiar caché local"
        >
          <View style={styles.optionInfo}>
            <View style={styles.optionIcono}>
              <Ionicons name="trash-bin-outline" size={18} color={noir.muted} />
            </View>
            <View style={styles.optionTexts}>
              <Text style={styles.optionLabel}>Limpiar caché local</Text>
              <Text style={styles.optionSub}>Fuerza una recarga limpia de esta cuenta</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={17} color={noir.muted2} />
        </Pressable>
      </View>

      <View style={styles.acerca}>
        <RutiniaLogo size={18} />
        <Text style={styles.acercaTexto}>Rutinia · Versión 1.0.0</Text>
        <Text style={styles.acercaSub}>Sistema de Entrenamiento de Alto Rendimiento</Text>
      </View>
    </>
  );

  const renderCuentas = () => (
    <>
      {aviso ? <Alerta aviso={aviso} /> : null}

      <View style={styles.card}>
        <View style={styles.cardEyebrowRow}>
          <Text style={styles.cardTitulo}>CUENTAS EN ESTE DISPOSITIVO</Text>
          <Text style={styles.contadorCuentas}>{estado?.cuentas.length ?? 0}</Text>
        </View>

        <Text style={styles.descripcionSeccion}>
          Toca una cuenta para usarla. Las cuentas con candado necesitan que vuelvas a
          escribir tu contraseña porque su sesión guardada expiró.
        </Text>

        <View style={styles.listaCuentas}>
          {estado?.cuentas.map((cuenta) => {
            const activa = cuenta.id === estado.activaId;
            const bloqueada =
              cuenta.tipo === 'nube' && !cuenta.sesionGuardada && !activa;
            const cambiando = cambiandoId === cuenta.id;

            return (
              <View
                key={cuenta.id}
                style={[styles.filaCuenta, activa && styles.filaCuentaActiva]}
              >
                <Pressable
                  onPress={() => seleccionarCuenta(cuenta)}
                  disabled={activa || Boolean(cambiandoId)}
                  style={({ pressed }) => [
                    styles.filaCuentaToque,
                    pressed && !activa && { opacity: 0.74 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: activa,
                    disabled: activa || Boolean(cambiandoId),
                  }}
                  accessibilityLabel={`Usar la cuenta ${cuenta.nombre}`}
                >
                  <AvatarCuenta cuenta={cuenta} />
                  <View style={styles.filaCuentaInfo}>
                    <Text style={styles.filaCuentaNombre} numberOfLines={1}>
                      {cuenta.nombre}
                    </Text>
                    <Text style={styles.filaCuentaEmail} numberOfLines={1}>
                      {cuenta.email ||
                        (cuenta.tipo === 'local'
                          ? 'Datos sin cuenta en la nube'
                          : 'Cuenta de Supabase')}
                    </Text>
                  </View>

                  {cambiando ? (
                    <ActivityIndicator size="small" color={colores.primarioHover} />
                  ) : activa ? (
                    <View style={styles.checkActiva}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  ) : bloqueada ? (
                    <View style={styles.estadoCuenta}>
                      <Ionicons name="lock-closed" size={13} color={WARNING} />
                      <Text style={[styles.estadoCuentaTexto, { color: WARNING }]}>
                        Entrar
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.estadoCuenta}>
                      <Text style={styles.estadoCuentaTexto}>Cambiar</Text>
                      <Ionicons name="chevron-forward" size={14} color={noir.muted2} />
                    </View>
                  )}
                </Pressable>

                {!activa ? (
                  <Pressable
                    onPress={() => {
                      vibrarBoton(20);
                      quitarCuenta(cuenta);
                    }}
                    disabled={Boolean(cambiandoId)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.quitarCuentaBoton,
                      Boolean(cambiandoId) && { opacity: 0.35 },
                      pressed && { opacity: 0.6 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${cuenta.nombre} de este dispositivo`}
                  >
                    <Ionicons name="close" size={15} color={noir.muted2} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={() => abrirAuth('login')}
          style={({ pressed }) => [
            styles.anadirCuenta,
            pressed && { opacity: 0.72 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Añadir otra cuenta"
        >
          <View style={styles.anadirIcono}>
            <Ionicons name="add" size={18} color={noir.platinum} />
          </View>
          <View style={styles.filaCuentaInfo}>
            <Text style={styles.optionLabel}>Añadir otra cuenta</Text>
            <Text style={styles.optionSub}>Inicia sesión o crea una cuenta nueva</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={noir.muted2} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>CÓMO FUNCIONA</Text>
        <View style={styles.infoLinea}>
          <Ionicons name="key-outline" size={16} color={noir.info} />
          <Text style={styles.infoLineaTexto}>
            Guardamos una sesión renovable por cuenta en este dispositivo para que puedas
            alternar sin escribir la contraseña cada vez.
          </Text>
        </View>
        <View style={styles.infoLinea}>
          <Ionicons name="shield-checkmark-outline" size={16} color={SUCCESS} />
          <Text style={styles.infoLineaTexto}>
            Cerrar sesión borra el token guardado en este dispositivo. Quitar la cuenta
            borra también su caché local, pero no sus datos en la nube.
          </Text>
        </View>
        <View style={styles.infoLinea}>
          <Ionicons name="cloud-offline-outline" size={16} color={WARNING} />
          <Text style={styles.infoLineaTexto}>
            El perfil local no se sincroniza entre dispositivos. Cada cuenta de Supabase
            mantiene sus propios datos separados.
          </Text>
        </View>
      </View>

      {otrasCuentas.length > 0 ? (
        <Text style={styles.pieSeccion}>
          Usa la «×» de una fila para quitarla del dispositivo o entra en ella y pulsa
          «Gestionar».
        </Text>
      ) : null}
    </>
  );

  const renderAuth = () => (
    <>
      {avisoAuth ? <Alerta aviso={avisoAuth} /> : null}

      <View style={styles.card}>
        <View style={styles.tabsAuth}>
          {(['login', 'registro'] as const).map((modo) => (
            <Pressable
              key={modo}
              onPress={() => {
                vibrarBoton();
                setModoAuth(modo);
                setAvisoAuth(null);
              }}
              style={[styles.tabAuth, modoAuth === modo && styles.tabAuthActivo]}
              accessibilityRole="tab"
              accessibilityState={{ selected: modoAuth === modo }}
            >
              <Text
                style={[
                  styles.tabAuthTexto,
                  modoAuth === modo && styles.tabAuthTextoActivo,
                ]}
              >
                {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.authTitulo}>
          {modoAuth === 'login' ? 'Bienvenido de vuelta' : 'Tu nueva cuenta'}
        </Text>
        <Text style={styles.authSub}>
          {modoAuth === 'login'
            ? 'Entra para recuperar tus rutinas, planes y registros.'
            : 'Crea una cuenta para sincronizar tu entrenamiento en la nube.'}
        </Text>

        <View style={styles.authCampos}>
          {modoAuth === 'registro' ? (
            <Campo
              icono="person-outline"
              placeholder="Nombre o apodo"
              value={nombreInput}
              onChangeText={setNombreInput}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />
          ) : null}

          <Campo
            icono="mail-outline"
            placeholder="correo@ejemplo.com"
            value={emailInput}
            onChangeText={setEmailInput}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <Campo
            icono="lock-closed-outline"
            placeholder="Contraseña (mínimo 6 caracteres)"
            value={passwordInput}
            onChangeText={setPasswordInput}
            secureTextEntry={!verPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={modoAuth === 'login' ? 'current-password' : 'new-password'}
            textContentType={modoAuth === 'login' ? 'password' : 'newPassword'}
            returnKeyType={modoAuth === 'login' ? 'go' : 'next'}
            onSubmitEditing={modoAuth === 'login' ? ejecutarLogin : undefined}
            mostrarOcultar
            oculto={!verPassword}
            onMostrarOcultar={() => setVerPassword((valor) => !valor)}
          />

          {modoAuth === 'registro' ? (
            <Campo
              icono="shield-checkmark-outline"
              placeholder="Repite la contraseña"
              value={confirmarPassword}
              onChangeText={setConfirmarPassword}
              secureTextEntry={!verPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={ejecutarRegistro}
            />
          ) : null}
        </View>

        <BotonPrimario
          texto={modoAuth === 'login' ? 'Entrar' : 'Crear mi cuenta'}
          icono={modoAuth === 'login' ? 'log-in-outline' : 'person-add-outline'}
          onPress={modoAuth === 'login' ? ejecutarLogin : ejecutarRegistro}
          cargando={cargandoAuth}
        />

        <Text style={styles.authLegal}>
          {modoAuth === 'registro'
            ? 'Al crear una cuenta aceptas que tus datos de entrenamiento se guarden en Supabase.'
            : 'Si olvidaste tu contraseña, puedes restablecerla desde el panel de Supabase.'}
        </Text>

        {modoAuth === 'login' ? (
          <Pressable
            onPress={() => {
              if (reenviandoConfirmacion) return;
              vibrarBoton(15);
              void reenviarCorreoConfirmacion();
            }}
            disabled={reenviandoConfirmacion}
            style={({ pressed }) => [
              styles.authReenviarBoton,
              (pressed || reenviandoConfirmacion) && { opacity: 0.65 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reenviar correo de confirmación"
          >
            {reenviandoConfirmacion ? (
              <ActivityIndicator size="small" color={noir.champagne} />
            ) : (
              <Text style={styles.authReenviarTexto}>
                ¿No llegó el correo? Reenviar confirmación
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </>
  );

  const renderPerfil = () => (
    <>
      {avisoPerfil ? <Alerta aviso={avisoPerfil} /> : null}

      {cuentaActiva ? (
        <>
          <View style={styles.card}>
            <View style={styles.perfilHero}>
              <AvatarCuenta cuenta={{ ...cuentaActiva, color: colorPerfil }} size={62} />
              <View style={styles.perfilHeroInfo}>
                <Text style={styles.perfilNombre} numberOfLines={1}>
                  {nombrePerfil || cuentaActiva.nombre}
                </Text>
                <Text style={styles.perfilEmail} numberOfLines={1}>
                  {cuentaActiva.email || 'Cuenta de Supabase'}
                </Text>
              </View>
            </View>

            <Text style={styles.campoLabel}>Nombre visible</Text>
            <Campo
              icono="person-outline"
              placeholder="Tu nombre o apodo"
              value={nombrePerfil}
              onChangeText={setNombrePerfil}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />

            <Text style={styles.campoLabel}>Color de tu avatar</Text>
            <View style={styles.paleta}>
              {COLORES_PLANES.map((color) => {
                const activo = colorPerfil === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => {
                      vibrarBoton();
                      setColorPerfil(color);
                    }}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      activo && styles.colorSwatchActivo,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activo }}
                    accessibilityLabel={`Color de avatar ${color}`}
                  >
                    {activo ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                  </Pressable>
                );
              })}
            </View>

            <BotonPrimario
              texto="Guardar perfil"
              icono="save-outline"
              onPress={guardarPerfil}
              cargando={guardandoPerfil}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitulo}>CORREO ELECTRÓNICO</Text>
            <Text style={styles.descripcionSeccion}>
              Supabase enviará un enlace de confirmación al nuevo correo antes de aplicarlo.
            </Text>
            <Campo
              icono="mail-outline"
              placeholder="correo@ejemplo.com"
              value={emailPerfil}
              onChangeText={setEmailPerfil}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
            <BotonSecundario
              texto={guardandoEmail ? 'Actualizando…' : 'Actualizar correo'}
              icono="mail-outline"
              onPress={guardarEmail}
              cargando={guardandoEmail}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitulo}>CONTRASEÑA</Text>
            <Text style={styles.descripcionSeccion}>
              Usa al menos 6 caracteres. Se aplicará la próxima vez que inicies sesión.
            </Text>
            <Campo
              icono="lock-closed-outline"
              placeholder="Nueva contraseña"
              value={passwordNueva}
              onChangeText={setPasswordNueva}
              secureTextEntry={!verPasswordNueva}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              mostrarOcultar
              oculto={!verPasswordNueva}
              onMostrarOcultar={() => setVerPasswordNueva((valor) => !valor)}
            />
            <Campo
              icono="shield-checkmark-outline"
              placeholder="Repite la nueva contraseña"
              value={passwordNueva2}
              onChangeText={setPasswordNueva2}
              secureTextEntry={!verPasswordNueva}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <BotonSecundario
              texto={guardandoPassword ? 'Actualizando…' : 'Cambiar contraseña'}
              icono="key-outline"
              onPress={guardarPassword}
              cargando={guardandoPassword}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitulo}>SESIÓN Y DISPOSITIVO</Text>

            <Pressable
              onPress={cerrarSesion}
              style={({ pressed }) => [styles.dataRow, pressed && { opacity: 0.72 }]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
            >
              <View style={styles.optionInfo}>
                <View style={styles.optionIcono}>
                  <Ionicons name="log-out-outline" size={18} color={WARNING} />
                </View>
                <View style={styles.optionTexts}>
                  <Text style={styles.optionLabel}>Cerrar sesión</Text>
                  <Text style={styles.optionSub}>Borra el token guardado y vuelve al perfil local</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={17} color={noir.muted2} />
            </Pressable>

            <View style={styles.divisor} />

            <Pressable
              onPress={() => quitarCuenta(cuentaActiva)}
              style={({ pressed }) => [styles.dataRow, pressed && { opacity: 0.72 }]}
              accessibilityRole="button"
              accessibilityLabel="Quitar cuenta de este dispositivo"
            >
              <View style={styles.optionInfo}>
                <View style={styles.optionIcono}>
                  <Ionicons name="phone-portrait-outline" size={18} color={noir.muted} />
                </View>
                <View style={styles.optionTexts}>
                  <Text style={styles.optionLabel}>Quitar de este dispositivo</Text>
                  <Text style={styles.optionSub}>Borra la sesión guardada, no tus datos</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={17} color={noir.muted2} />
            </Pressable>
          </View>

          <View style={[styles.card, styles.cardPeligro]}>
            <Text style={[styles.cardTitulo, { color: DANGER }]}>ZONA DE PELIGRO</Text>
            <Text style={styles.descripcionSeccion}>
              Eliminar la cuenta borra de forma permanente tu identidad y todos tus datos en
              la nube. Esta acción no se puede deshacer.
            </Text>
            <Pressable
              onPress={eliminarCuenta}
              style={({ pressed }) => [
                styles.botonPeligro,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Eliminar mi cuenta"
            >
              <Ionicons name="trash-outline" size={17} color={DANGER} />
              <Text style={styles.botonPeligroTexto}>Eliminar mi cuenta</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={manejarApertura}
      onRequestClose={manejarCierre}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={manejarCierre}
          accessibilityLabel="Cerrar menú"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={styles.containerKeyboard}
        >
          <View style={[styles.sheet, { width: anchoHoja }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                {vista !== 'menu' ? (
                  <Pressable
                    onPress={() => {
                      vibrarBoton();
                      volverAlMenu();
                    }}
                    style={({ pressed }) => [
                      styles.headerIconButton,
                      pressed && { opacity: 0.65 },
                    ]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Volver"
                  >
                    <Ionicons name="chevron-back" size={18} color={noir.platinum} />
                  </Pressable>
                ) : (
                  <RutiniaLogo size={24} />
                )}
                <View>
                  <Text style={styles.sheetKicker}>RUTINIA</Text>
                  <Text style={styles.sheetTitle}>{titulo}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  vibrarBoton();
                  manejarCierre();
                }}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  pressed && { opacity: 0.65 },
                ]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Ionicons name="close" size={18} color={noir.platinum} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {vista === 'menu'
                ? renderMenu()
                : vista === 'cuentas'
                  ? renderCuentas()
                  : vista === 'auth'
                    ? renderAuth()
                    : renderPerfil()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  containerKeyboard: {
    width: '100%',
    maxHeight: '92%',
    alignItems: 'center',
  },
  sheet: {
    maxHeight: '100%',
    backgroundColor: '#090B10',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.62,
    shadowRadius: 32,
    elevation: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    backgroundColor: 'rgba(255, 255, 255, 0.018)',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  sheetKicker: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 8.5,
    letterSpacing: 1.7,
    marginBottom: 1,
  },
  sheetTitle: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 16.5,
    letterSpacing: -0.2,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 18,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.026)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.075)',
    padding: 14,
  },
  cardPeligro: {
    borderColor: 'rgba(240, 138, 155, 0.26)',
    backgroundColor: 'rgba(240, 138, 155, 0.045)',
  },
  cardEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 11,
  },
  cardTitulo: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 9.5,
    letterSpacing: 1.25,
  },
  devicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  devicePillTexto: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 9,
  },
  cuentaHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatar: {
    position: 'relative',
    overflow: 'visible',
  },
  avatarGradient: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
  },
  avatarDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#090B10',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 3,
  },
  cuentaHeroInfo: {
    flex: 1,
    minWidth: 0,
  },
  cuentaNombre: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  cuentaEmail: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 12,
    marginTop: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeTexto: {
    fontFamily: fuentes.semiBold,
    fontSize: 9.5,
  },
  accionesCuenta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  ayudaCuenta: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 10,
  },
  cargandoCuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  cargandoTexto: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 12,
  },
  botonPrimario: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    overflow: 'hidden',
  },
  botonPrimarioGradient: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  botonPrimarioTexto: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 12.5,
    letterSpacing: 0.1,
  },
  botonSecundario: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  botonSecundarioTexto: {
    color: noir.platinum,
    fontFamily: fuentes.semiBold,
    fontSize: 12.5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 7,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  optionIcono: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  optionTexts: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: noir.text,
    fontFamily: fuentes.medium,
    fontSize: 13.5,
  },
  optionSub: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    marginTop: 1,
    lineHeight: 14,
  },
  segmento: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 9,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentoBoton: {
    minWidth: 38,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    alignItems: 'center',
  },
  segmentoBotonActivo: {
    backgroundColor: colores.primario,
  },
  segmentoTexto: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 11.5,
  },
  segmentoTextoActivo: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
  },
  divisor: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    marginVertical: 5,
  },
  feedbackRow: {
    padding: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(92, 200, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(92, 200, 255, 0.2)',
    marginBottom: 7,
  },
  feedbackTexto: {
    color: noir.info,
    fontFamily: fuentes.medium,
    fontSize: 10.5,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
  },
  localInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 209, 102, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.18)',
  },
  localInfoTexto: {
    flex: 1,
    color: WARNING,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 14,
  },
  acerca: {
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    marginBottom: 4,
  },
  acercaTexto: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 10.5,
    marginTop: 3,
  },
  acercaSub: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
  },
  alerta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  alertaTexto: {
    flex: 1,
    fontFamily: fuentes.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  contadorCuentas: {
    color: noir.muted2,
    fontFamily: fuentes.bold,
    fontSize: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  descripcionSeccion: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15,
    marginBottom: 10,
  },
  listaCuentas: {
    gap: 7,
  },
  filaCuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.065)',
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  filaCuentaToque: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  filaCuentaActiva: {
    borderColor: 'rgba(194, 36, 61, 0.52)',
    backgroundColor: 'rgba(194, 36, 61, 0.09)',
  },
  filaCuentaInfo: {
    flex: 1,
    minWidth: 0,
  },
  filaCuentaNombre: {
    color: noir.text,
    fontFamily: fuentes.semiBold,
    fontSize: 13,
  },
  filaCuentaEmail: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    marginTop: 1,
  },
  checkActiva: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estadoCuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  estadoCuentaTexto: {
    color: noir.muted2,
    fontFamily: fuentes.medium,
    fontSize: 10,
  },
  quitarCuentaBoton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
  },
  anadirCuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.018)',
  },
  anadirIcono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  infoLinea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 5,
  },
  infoLineaTexto: {
    flex: 1,
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 10.5,
    lineHeight: 15,
  },
  pieSeccion: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  tabsAuth: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  tabAuth: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  tabAuthActivo: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  tabAuthTexto: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 11.5,
  },
  tabAuthTextoActivo: {
    color: noir.text,
    fontFamily: fuentes.bold,
  },
  authTitulo: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 18,
    letterSpacing: -0.35,
  },
  authSub: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
    marginBottom: 13,
  },
  authCampos: {
    gap: 8,
    marginBottom: 12,
  },
  campoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 43,
    backgroundColor: 'rgba(0, 0, 0, 0.26)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.085)',
    paddingHorizontal: 11,
    marginBottom: 8,
  },
  campoWrapFocus: {
    borderColor: 'rgba(194, 36, 61, 0.65)',
    backgroundColor: 'rgba(194, 36, 61, 0.045)',
  },
  campoIcono: {
    marginRight: 1,
  },
  campoInput: {
    flex: 1,
    color: noir.text,
    fontFamily: fuentes.regular,
    fontSize: 12.5,
    paddingVertical: 9,
  },
  campoLabel: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  authLegal: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 9.5,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  authReenviarBoton: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  authReenviarTexto: {
    color: noir.champagne,
    fontFamily: fuentes.medium,
    fontSize: 10.5,
    textAlign: 'center',
  },
  perfilHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 14,
  },
  perfilHeroInfo: {
    flex: 1,
    minWidth: 0,
  },
  perfilNombre: {
    color: noir.text,
    fontFamily: fuentes.bold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  perfilEmail: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  paleta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 14,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActivo: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.06 }],
  },
  botonPeligro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(240, 138, 155, 0.36)',
    backgroundColor: 'rgba(240, 138, 155, 0.09)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  botonPeligroTexto: {
    color: DANGER,
    fontFamily: fuentes.bold,
    fontSize: 12.5,
  },
});
