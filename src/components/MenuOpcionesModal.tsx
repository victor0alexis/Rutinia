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
import { fuentes, noir } from '../constants/colores';
import { supabase } from '../lib/supabase';
import { vibrarBoton } from '../utils/haptics';
import { emitirCambioDatos } from '../utils/sincronizacion';
import { RutiniaLogo } from './RutiniaLogo';

export const KEY_PREF_UNIDAD = 'rutinia_pref_unidad_peso';
export const KEY_PREF_HAPTICOS = 'rutinia_pref_hapticos';
export const KEY_PREF_TIMER_AUTO = 'rutinia_pref_timer_auto';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSessionChange?: () => void;
}

export default function MenuOpcionesModal({ visible, onClose, onSessionChange }: Props) {
  // Estado de usuario y autenticación
  const [usuario, setUsuario] = useState<any>(null);
  const [cargandoAuth, setCargandoAuth] = useState(false);
  const [mostrandoFormAuth, setMostrandoFormAuth] = useState(false);
  const [tipoFormAuth, setTipoFormAuth] = useState<'login' | 'registro'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nombreInput, setNombreInput] = useState('');
  const [mensajeAuth, setMensajeAuth] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  // Preferencias
  const [unidadPeso, setUnidadPeso] = useState<'kg' | 'lbs'>('kg');
  const [hapticosActivos, setHapticosActivos] = useState(true);
  const [timerAutoActivo, setTimerAutoActivo] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSincro, setMensajeSincro] = useState<string | null>(null);

  // Cargar sesión y preferencias al abrir (asíncrono sin setStates síncronos en el cuerpo del efecto)
  useEffect(() => {
    if (!visible) return;
    let activo = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return;
      setUsuario(data.session?.user || null);

      const [prefUnidad, prefHapticos, prefTimer] = await Promise.all([
        AsyncStorage.getItem(KEY_PREF_UNIDAD),
        AsyncStorage.getItem(KEY_PREF_HAPTICOS),
        AsyncStorage.getItem(KEY_PREF_TIMER_AUTO),
      ]);

      if (!activo) return;
      if (prefUnidad === 'lbs' || prefUnidad === 'kg') setUnidadPeso(prefUnidad);
      if (prefHapticos !== null) setHapticosActivos(prefHapticos === 'true');
      if (prefTimer !== null) setTimerAutoActivo(prefTimer === 'true');
    }).catch(() => {});

    return () => {
      activo = false;
    };
  }, [visible]);

  const manejarCierre = () => {
    setMensajeAuth(null);
    setMensajeSincro(null);
    onClose();
  };

  // Manejo de Preferencias
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

  // Manejo de Autenticación
  const ejecutarLogin = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setMensajeAuth({ tipo: 'error', texto: 'Ingresa correo y contraseña.' });
      return;
    }
    try {
      setCargandoAuth(true);
      setMensajeAuth(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });
      if (error) throw error;

      setUsuario(data.user);
      setMostrandoFormAuth(false);
      setEmailInput('');
      setPasswordInput('');
      setMensajeAuth({ tipo: 'exito', texto: '¡Sesión iniciada con éxito!' });
      emitirCambioDatos();
      if (onSessionChange) onSessionChange();
    } catch (err: any) {
      setMensajeAuth({
        tipo: 'error',
        texto: err?.message || 'Error al iniciar sesión. Revisa tus credenciales.',
      });
    } finally {
      setCargandoAuth(false);
    }
  };

  const ejecutarRegistro = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setMensajeAuth({ tipo: 'error', texto: 'Completa todos los campos requeridos.' });
      return;
    }
    if (passwordInput.length < 6) {
      setMensajeAuth({ tipo: 'error', texto: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    try {
      setCargandoAuth(true);
      setMensajeAuth(null);
      const { data, error } = await supabase.auth.signUp({
        email: emailInput.trim(),
        password: passwordInput,
        options: {
          data: {
            nombre: nombreInput.trim() || 'Atleta',
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        setUsuario(data.user);
        setMensajeAuth({
          tipo: 'exito',
          texto: data.session
            ? '¡Cuenta creada y sesión iniciada!'
            : '¡Cuenta creada! Revisa tu email para confirmarla si es requerido.',
        });
        if (data.session) {
          setMostrandoFormAuth(false);
          setEmailInput('');
          setPasswordInput('');
          setNombreInput('');
          emitirCambioDatos();
          if (onSessionChange) onSessionChange();
        }
      }
    } catch (err: any) {
      setMensajeAuth({
        tipo: 'error',
        texto: err?.message || 'Error al crear la cuenta. Intenta nuevamente.',
      });
    } finally {
      setCargandoAuth(false);
    }
  };

  const ejecutarCerrarSesion = async () => {
    vibrarBoton(20);
    try {
      setCargandoAuth(true);
      await supabase.auth.signOut();
      setUsuario(null);
      setMostrandoFormAuth(false);
      setMensajeAuth(null);
      emitirCambioDatos();
      if (onSessionChange) onSessionChange();
    } catch (err: any) {
      console.warn('Error cerrando sesión:', err);
    } finally {
      setCargandoAuth(false);
    }
  };

  // Sincronización manual
  const sincronizarDatos = async () => {
    vibrarBoton(15);
    setSincronizando(true);
    setMensajeSincro('Sincronizando...');
    try {
      emitirCambioDatos();
      await new Promise((resolve) => setTimeout(resolve, 600));
      setMensajeSincro('✓ Datos sincronizados con la nube');
      setTimeout(() => setMensajeSincro(null), 3500);
    } catch {
      setMensajeSincro('Error de sincronización');
    } finally {
      setSincronizando(false);
    }
  };

  const limpiarCacheLocal = async () => {
    vibrarBoton(25);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysCache = keys.filter((k) => k.startsWith('rutinia_') && !k.startsWith('rutinia_pref_'));
      if (keysCache.length > 0) {
        await AsyncStorage.multiRemove(keysCache);
      }
      emitirCambioDatos();
      setMensajeSincro('✓ Caché local limpiada');
      setTimeout(() => setMensajeSincro(null), 3000);
    } catch {
      setMensajeSincro('Error al limpiar caché');
    }
  };

  const inicialAvatar = usuario?.user_metadata?.nombre
    ? usuario.user_metadata.nombre.charAt(0).toUpperCase()
    : usuario?.email
    ? usuario.email.charAt(0).toUpperCase()
    : 'A';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={manejarCierre}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={manejarCierre} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.containerKeyboard}
        >
          <View style={styles.sheet}>
            {/* Cabecera del Menú */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <RutiniaLogo size={24} />
                <Text style={styles.sheetTitle}>Menú & Ajustes</Text>
              </View>
              <Pressable
                onPress={() => {
                  vibrarBoton();
                  manejarCierre();
                }}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color={noir.platinum} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* SECCIÓN 1: CUENTA Y PERFIL */}
              <View style={styles.card}>
                <View style={styles.accountRow}>
                  <View style={styles.avatarLarge}>
                    <LinearGradient
                      colors={usuario ? ['#9E1C30', '#450D15'] : ['#232631', '#13151B']}
                      style={styles.avatarGradient}
                    >
                      <Text style={styles.avatarTextLarge}>{inicialAvatar}</Text>
                    </LinearGradient>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: usuario ? '#10B981' : '#F59E0B' },
                      ]}
                    />
                  </View>

                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName} numberOfLines={1}>
                      {usuario?.user_metadata?.nombre || (usuario ? 'Atleta Rutinia' : 'Modo Invitado / Local')}
                    </Text>
                    <Text style={styles.accountEmail} numberOfLines={1}>
                      {usuario?.email || 'Sin cuenta en la nube'}
                    </Text>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: usuario
                              ? 'rgba(16, 185, 129, 0.14)'
                              : 'rgba(245, 158, 11, 0.14)',
                            borderColor: usuario
                              ? 'rgba(16, 185, 129, 0.3)'
                              : 'rgba(245, 158, 11, 0.3)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: usuario ? '#34D399' : '#FBBF24' },
                          ]}
                        >
                          {usuario ? 'Conectado a Supabase' : 'Almacenamiento Local'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Acciones de Cuenta */}
                {usuario ? (
                  <View style={styles.accountActionsContainer}>
                    <Pressable
                      onPress={ejecutarCerrarSesion}
                      disabled={cargandoAuth}
                      style={({ pressed }) => [
                        styles.logoutButton,
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      {cargandoAuth ? (
                        <ActivityIndicator size="small" color="#F87171" />
                      ) : (
                        <>
                          <Ionicons name="log-out-outline" size={17} color="#F87171" />
                          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.accountActionsContainer}>
                    {!mostrandoFormAuth ? (
                      <Pressable
                        onPress={() => {
                          vibrarBoton();
                          setMostrandoFormAuth(true);
                          setMensajeAuth(null);
                        }}
                        style={({ pressed }) => [
                          styles.primaryAuthButton,
                          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        <LinearGradient
                          colors={['#C2243D', '#801524']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.primaryAuthButtonGradient}
                        >
                          <Ionicons name="person-add-outline" size={17} color="#FFFFFF" />
                          <Text style={styles.primaryAuthButtonText}>
                            Iniciar Sesión / Registrarse
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    ) : (
                      /* FORMULARIO DE ACCESO / REGISTRO */
                      <View style={styles.authBox}>
                        <View style={styles.authTabs}>
                          <Pressable
                            onPress={() => {
                              vibrarBoton();
                              setTipoFormAuth('login');
                              setMensajeAuth(null);
                            }}
                            style={[
                              styles.authTab,
                              tipoFormAuth === 'login' && styles.authTabActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.authTabText,
                                tipoFormAuth === 'login' && styles.authTabTextActive,
                              ]}
                            >
                              Iniciar Sesión
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              vibrarBoton();
                              setTipoFormAuth('registro');
                              setMensajeAuth(null);
                            }}
                            style={[
                              styles.authTab,
                              tipoFormAuth === 'registro' && styles.authTabActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.authTabText,
                                tipoFormAuth === 'registro' && styles.authTabTextActive,
                              ]}
                            >
                              Crear Cuenta
                            </Text>
                          </Pressable>
                        </View>

                        {mensajeAuth && (
                          <View
                            style={[
                              styles.authAlert,
                              mensajeAuth.tipo === 'error'
                                ? styles.authAlertError
                                : styles.authAlertSuccess,
                            ]}
                          >
                            <Ionicons
                              name={
                                mensajeAuth.tipo === 'error'
                                  ? 'alert-circle'
                                  : 'checkmark-circle'
                              }
                              size={16}
                              color={mensajeAuth.tipo === 'error' ? '#F87171' : '#34D399'}
                            />
                            <Text
                              style={[
                                styles.authAlertText,
                                {
                                  color:
                                    mensajeAuth.tipo === 'error' ? '#FCA5A5' : '#6EE7B7',
                                },
                              ]}
                            >
                              {mensajeAuth.texto}
                            </Text>
                          </View>
                        )}

                        {tipoFormAuth === 'registro' && (
                          <View style={styles.inputWrap}>
                            <Ionicons
                              name="person-outline"
                              size={16}
                              color={noir.muted}
                              style={styles.inputIcon}
                            />
                            <TextInput
                              placeholder="Nombre o apodo"
                              placeholderTextColor={noir.muted2}
                              value={nombreInput}
                              onChangeText={setNombreInput}
                              style={styles.textInput}
                              autoCapitalize="words"
                            />
                          </View>
                        )}

                        <View style={styles.inputWrap}>
                          <Ionicons
                            name="mail-outline"
                            size={16}
                            color={noir.muted}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            placeholder="correo@ejemplo.com"
                            placeholderTextColor={noir.muted2}
                            value={emailInput}
                            onChangeText={setEmailInput}
                            style={styles.textInput}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>

                        <View style={styles.inputWrap}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={16}
                            color={noir.muted}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            placeholder="Contraseña (mínimo 6 caracteres)"
                            placeholderTextColor={noir.muted2}
                            value={passwordInput}
                            onChangeText={setPasswordInput}
                            style={styles.textInput}
                            secureTextEntry
                          />
                        </View>

                        <View style={styles.authButtonsRow}>
                          <Pressable
                            onPress={() => setMostrandoFormAuth(false)}
                            style={styles.cancelAuthButton}
                          >
                            <Text style={styles.cancelAuthButtonText}>Cancelar</Text>
                          </Pressable>

                          <Pressable
                            onPress={
                              tipoFormAuth === 'login' ? ejecutarLogin : ejecutarRegistro
                            }
                            disabled={cargandoAuth}
                            style={styles.submitAuthButton}
                          >
                            <LinearGradient
                              colors={['#C2243D', '#801524']}
                              style={styles.submitAuthButtonGradient}
                            >
                              {cargandoAuth ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={styles.submitAuthButtonText}>
                                  {tipoFormAuth === 'login' ? 'Entrar' : 'Registrar'}
                                </Text>
                              )}
                            </LinearGradient>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* SECCIÓN 2: PREFERENCIAS DE ENTRENAMIENTO */}
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>PREFERENCIAS DE ENTRENAMIENTO</Text>

                {/* Unidad de peso */}
                <View style={styles.optionRow}>
                  <View style={styles.optionInfo}>
                    <Ionicons name="barbell-outline" size={19} color={noir.platinum} />
                    <View style={styles.optionTexts}>
                      <Text style={styles.optionLabel}>Unidad de Peso</Text>
                      <Text style={styles.optionSub}>Kilogramos o Libras</Text>
                    </View>
                  </View>
                  <View style={styles.segmentContainer}>
                    <Pressable
                      onPress={() => cambiarUnidadPeso('kg')}
                      style={[
                        styles.segmentButton,
                        unidadPeso === 'kg' && styles.segmentButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentButtonText,
                          unidadPeso === 'kg' && styles.segmentButtonTextActive,
                        ]}
                      >
                        kg
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => cambiarUnidadPeso('lbs')}
                      style={[
                        styles.segmentButton,
                        unidadPeso === 'lbs' && styles.segmentButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentButtonText,
                          unidadPeso === 'lbs' && styles.segmentButtonTextActive,
                        ]}
                      >
                        lbs
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Respuesta Háptica */}
                <View style={styles.optionRow}>
                  <View style={styles.optionInfo}>
                    <Ionicons name="hardware-chip-outline" size={19} color={noir.platinum} />
                    <View style={styles.optionTexts}>
                      <Text style={styles.optionLabel}>Vibración Háptica</Text>
                      <Text style={styles.optionSub}>Respuesta táctil al pulsar botones</Text>
                    </View>
                  </View>
                  <Switch
                    value={hapticosActivos}
                    onValueChange={toggleHapticos}
                    thumbColor={hapticosActivos ? '#FFFFFF' : '#888888'}
                    trackColor={{ false: '#262933', true: '#9E1C30' }}
                  />
                </View>

                <View style={styles.divider} />

                {/* Temporizador Automático */}
                <View style={styles.optionRow}>
                  <View style={styles.optionInfo}>
                    <Ionicons name="timer-outline" size={19} color={noir.platinum} />
                    <View style={styles.optionTexts}>
                      <Text style={styles.optionLabel}>Temporizador de Descanso</Text>
                      <Text style={styles.optionSub}>Sugerir descanso al completar serie</Text>
                    </View>
                  </View>
                  <Switch
                    value={timerAutoActivo}
                    onValueChange={toggleTimerAuto}
                    thumbColor={timerAutoActivo ? '#FFFFFF' : '#888888'}
                    trackColor={{ false: '#262933', true: '#9E1C30' }}
                  />
                </View>
              </View>

              {/* SECCIÓN 3: GESTIÓN DE DATOS Y NUBE */}
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>DATOS Y SINCRONIZACIÓN</Text>

                {mensajeSincro && (
                  <View style={styles.syncFeedbackRow}>
                    <Text style={styles.syncFeedbackText}>{mensajeSincro}</Text>
                  </View>
                )}

                <Pressable
                  onPress={sincronizarDatos}
                  disabled={sincronizando}
                  style={({ pressed }) => [
                    styles.syncRowButton,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={styles.optionInfo}>
                    <Ionicons name="cloud-done-outline" size={19} color="#38BDF8" />
                    <View style={styles.optionTexts}>
                      <Text style={styles.optionLabel}>Sincronizar con Supabase</Text>
                      <Text style={styles.optionSub}>Actualizar cambios con la base de datos</Text>
                    </View>
                  </View>
                  {sincronizando ? (
                    <ActivityIndicator size="small" color="#38BDF8" />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={noir.muted} />
                  )}
                </Pressable>

                <View style={styles.divider} />

                <Pressable
                  onPress={limpiarCacheLocal}
                  style={({ pressed }) => [
                    styles.syncRowButton,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={styles.optionInfo}>
                    <Ionicons name="trash-bin-outline" size={19} color={noir.muted} />
                    <View style={styles.optionTexts}>
                      <Text style={styles.optionLabel}>Limpiar Caché Local</Text>
                      <Text style={styles.optionSub}>Fuerza la recarga limpia de rutinas</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={noir.muted} />
                </Pressable>
              </View>

              {/* SECCIÓN 4: ACERCA DE LA APP */}
              <View style={styles.aboutContainer}>
                <Text style={styles.aboutText}>Rutinia · Versión 1.0.0</Text>
                <Text style={styles.aboutSubText}>Sistema de Entrenamiento de Alto Rendimiento</Text>
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  containerKeyboard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
  },
  sheet: {
    backgroundColor: '#0C0E14',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#10131B',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 17,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#12151E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
  },
  cardSectionTitle: {
    color: noir.muted,
    fontFamily: fuentes.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarLarge: {
    position: 'relative',
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextLarge: {
    color: '#FFFFFF',
    fontFamily: fuentes.extraBold,
    fontSize: 18,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#0C0E14',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: '#FFFFFF',
    fontFamily: fuentes.semiBold,
    fontSize: 15,
  },
  accountEmail: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 12,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: fuentes.semiBold,
  },
  accountActionsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.22)',
  },
  logoutButtonText: {
    color: '#F87171',
    fontFamily: fuentes.semiBold,
    fontSize: 13,
  },
  primaryAuthButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  primaryAuthButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryAuthButtonText: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  authBox: {
    marginTop: 4,
    gap: 10,
  },
  authTabs: {
    flexDirection: 'row',
    backgroundColor: '#090B0F',
    borderRadius: 8,
    padding: 3,
  },
  authTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  authTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  authTabText: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 12,
  },
  authTabTextActive: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
  },
  authAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  authAlertError: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  authAlertSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  authAlertText: {
    fontFamily: fuentes.medium,
    fontSize: 12,
    flex: 1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090B0F',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    height: 40,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: fuentes.regular,
    fontSize: 13,
  },
  authButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelAuthButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelAuthButtonText: {
    color: noir.platinum,
    fontFamily: fuentes.medium,
    fontSize: 13,
  },
  submitAuthButton: {
    flex: 2,
    borderRadius: 9,
    overflow: 'hidden',
  },
  submitAuthButtonGradient: {
    paddingVertical: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitAuthButtonText: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 13,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionTexts: {
    flex: 1,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontFamily: fuentes.medium,
    fontSize: 14,
  },
  optionSub: {
    color: noir.muted,
    fontFamily: fuentes.regular,
    fontSize: 11,
    marginTop: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#090B0F',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#9E1C30',
  },
  segmentButtonText: {
    color: noir.muted,
    fontFamily: fuentes.medium,
    fontSize: 12,
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 8,
  },
  syncFeedbackRow: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    marginBottom: 8,
  },
  syncFeedbackText: {
    color: '#38BDF8',
    fontFamily: fuentes.medium,
    fontSize: 11,
    textAlign: 'center',
  },
  syncRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  aboutContainer: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  aboutText: {
    color: noir.muted,
    fontFamily: fuentes.semiBold,
    fontSize: 12,
  },
  aboutSubText: {
    color: noir.muted2,
    fontFamily: fuentes.regular,
    fontSize: 10,
    marginTop: 2,
  },
});
