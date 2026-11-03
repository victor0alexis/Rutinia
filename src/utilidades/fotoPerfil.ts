import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { eliminarLocal, escribirLocal, leerLocal } from './almacenamientoLocal';

export type FotoPerfilProcesada = {
  uri: string;
  base64?: string;
};

const LIMITE_ORIGEN_BYTES = 5 * 1024 * 1024; // 5 MB
const CLAVE_AVATAR_LOCAL = 'avatar_data_url';

/**
 * Abre la biblioteca de fotos del dispositivo (o el selector de archivos en web/PWA),
 * valida tipo y tamaño, recorta al centro en cuadrado y reduce a 512×512 (JPEG calidad 0.8).
 * Si el usuario cancela, devuelve null sin lanzar error.
 */
export async function seleccionarFotoPerfil(): Promise<FotoPerfilProcesada | null> {
  if (Platform.OS !== 'web') {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      throw new Error(
        'Rutinia necesita permiso para acceder a tu galería de fotos y elegir tu imagen de perfil.'
      );
    }
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (resultado.canceled || !resultado.assets || resultado.assets.length === 0) {
    return null;
  }

  const asset = resultado.assets[0];

  if (asset.fileSize && asset.fileSize > LIMITE_ORIGEN_BYTES) {
    throw new Error(
      'La imagen seleccionada supera el límite de 5 MB. Por favor elige una imagen más ligera.'
    );
  }

  if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
    throw new Error(
      'El archivo seleccionado no es una imagen válida. Selecciona un archivo JPG, PNG o WEBP.'
    );
  }

  let ancho = asset.width;
  let alto = asset.height;

  // Si las dimensiones no vienen informadas por el picker, las obtenemos
  if (!ancho || !alto || ancho <= 0 || alto <= 0) {
    const inspeccion = await ImageManipulator.manipulateAsync(asset.uri, []);
    ancho = inspeccion.width;
    alto = inspeccion.height;
  }

  const acciones: ImageManipulator.Action[] = [];

  // Recorte al centro en cuadrado si no lo es
  if (ancho && alto && ancho !== alto) {
    const lado = Math.min(ancho, alto);
    const originX = Math.max(0, Math.floor((ancho - lado) / 2));
    const originY = Math.max(0, Math.floor((alto - lado) / 2));
    acciones.push({
      crop: {
        originX,
        originY,
        width: lado,
        height: lado,
      },
    });
  }

  // Reducción a 512×512
  acciones.push({
    resize: {
      width: 512,
      height: 512,
    },
  });

  const manipulada = await ImageManipulator.manipulateAsync(
    asset.uri,
    acciones,
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  return {
    uri: manipulada.uri,
    base64: manipulada.base64,
  };
}

/**
 * Genera una miniatura cuadrada reducida a 256×256 como data URL base64 (<~80 KB)
 * para almacenar en el espacio local/invitado sin depender de la nube.
 */
export async function generarMiniaturaLocal(uriOBase64: string): Promise<string> {
  let resultado = await ImageManipulator.manipulateAsync(
    uriOBase64,
    [{ resize: { width: 256, height: 256 } }],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  // Si por alguna razón excede 80 KB (aprox 110.000 caracteres base64), recomprimimos
  if (resultado.base64 && resultado.base64.length > 105000) {
    resultado = await ImageManipulator.manipulateAsync(
      resultado.uri,
      [],
      {
        compress: 0.5,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
  }

  if (!resultado.base64) {
    throw new Error('No se pudo procesar la imagen para el perfil local.');
  }

  return `data:image/jpeg;base64,${resultado.base64}`;
}

export async function guardarAvatarLocalEnStorage(dataUrl: string): Promise<void> {
  await escribirLocal(CLAVE_AVATAR_LOCAL, dataUrl);
}

export async function leerAvatarLocalDeStorage(): Promise<string | null> {
  return await leerLocal(CLAVE_AVATAR_LOCAL);
}

export async function eliminarAvatarLocalDeStorage(): Promise<void> {
  await eliminarLocal(CLAVE_AVATAR_LOCAL);
}
