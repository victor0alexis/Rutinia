import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';
import { ModalConfig, suscribirModalConfirmacion } from '../utils/errores';

export default function ConfirmModalGlobal() {
  const [config, setConfig] = useState<ModalConfig>({
    visible: false,
    tipo: 'confirm',
    titulo: '',
    mensaje: '',
  });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    return suscribirModalConfirmacion((nuevaConfig) => {
      setConfig(nuevaConfig);
      setCargando(false);
    });
  }, []);

  if (!config.visible) return null;

  const esEliminar = config.esPeligro !== false && (
    config.textoConfirmar?.toLowerCase().includes('eliminar') ||
    config.textoConfirmar?.toLowerCase().includes('desvincular') ||
    config.titulo.toLowerCase().includes('eliminar') ||
    config.titulo.toLowerCase().includes('desvincular')
  );

  const manejarCancelar = () => {
    if (cargando) return;
    setConfig((prev) => ({ ...prev, visible: false }));
  };

  const manejarConfirmar = async () => {
    if (cargando) return;
    if (config.tipo === 'alert') {
      setConfig((prev) => ({ ...prev, visible: false }));
      return;
    }

    if (config.onConfirmar) {
      try {
        setCargando(true);
        await config.onConfirmar();
      } catch (err) {
        console.warn('Error en confirmación:', err);
      } finally {
        setCargando(false);
        setConfig((prev) => ({ ...prev, visible: false }));
      }
    } else {
      setConfig((prev) => ({ ...prev, visible: false }));
    }
  };

  return (
    <Modal
      visible={config.visible}
      transparent
      animationType="fade"
      onRequestClose={manejarCancelar}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Badge Icono Central */}
          <View
            style={[
              styles.iconBadge,
              esEliminar ? styles.iconBadgeDanger : styles.iconBadgeInfo,
            ]}
          >
            <Ionicons
              name={
                config.tipo === 'alert'
                  ? 'checkmark-circle-outline'
                  : esEliminar
                  ? 'trash-outline'
                  : 'alert-circle-outline'
              }
              size={28}
              color={esEliminar ? colores.peligro : colores.primarioHover}
            />
          </View>

          {/* Título & Mensaje */}
          <Text style={styles.titulo}>{config.titulo}</Text>
          {config.mensaje ? <Text style={styles.mensaje}>{config.mensaje}</Text> : null}

          {/* Acciones */}
          <View style={styles.botonesRow}>
            {config.tipo === 'confirm' && (
              <Pressable
                onPress={manejarCancelar}
                disabled={cargando}
                style={({ pressed }) => [
                  styles.btnCancelar,
                  pressed && { opacity: 0.75 },
                  cargando && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.btnCancelarTexto}>
                  {config.textoCancelar || 'Cancelar'}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={manejarConfirmar}
              disabled={cargando}
              style={({ pressed }) => [
                styles.btnConfirmar,
                esEliminar ? styles.btnConfirmarDanger : styles.btnConfirmarPrimary,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                cargando && { opacity: 0.6 },
              ]}
            >
              {cargando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnConfirmarTexto}>
                  {config.textoConfirmar || (config.tipo === 'alert' ? 'Entendido' : 'Confirmar')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 4, 7, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } : {}),
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colores.tarjetaElevada,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.bordeBrillante,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
  },
  iconBadgeDanger: {
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  iconBadgeInfo: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primarioGlow,
  },
  titulo: {
    fontSize: 20,
    fontFamily: fuentes.black,
    color: colores.texto,
    textAlign: 'center',
  },
  mensaje: {
    fontSize: 14,
    fontFamily: fuentes.regular,
    color: colores.suave,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  botonesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
  btnCancelar: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelarTexto: {
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 14,
  },
  btnConfirmar: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  btnConfirmarDanger: {
    backgroundColor: colores.peligro,
  },
  btnConfirmarPrimary: {
    backgroundColor: colores.primarioHover,
  },
  btnConfirmarTexto: {
    color: '#FFFFFF',
    fontFamily: fuentes.bold,
    fontSize: 14,
  },
});
