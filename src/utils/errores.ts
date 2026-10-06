import { Alert, Platform } from 'react-native';

export async function seguro(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (Platform.OS === 'web') {
      window.alert(`Error: ${msg}`);
    } else {
      Alert.alert('Error', msg);
    }
  }
}

export function confirmarAccion(
  titulo: string,
  mensaje: string,
  onConfirmar: () => Promise<void> | void,
  textoConfirmar = 'Eliminar'
) {
  if (Platform.OS === 'web') {
    const ok = window.confirm(`${titulo}\n\n${mensaje}`);
    if (ok) {
      seguro(async () => {
        await onConfirmar();
      });
    }
  } else {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: textoConfirmar,
        style: 'destructive',
        onPress: () =>
          seguro(async () => {
            await onConfirmar();
          }),
      },
    ]);
  }
}

export function mostrarMensaje(titulo: string, mensaje?: string) {
  if (Platform.OS === 'web') {
    window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
  } else {
    Alert.alert(titulo, mensaje);
  }
}
