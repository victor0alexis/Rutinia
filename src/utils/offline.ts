import AsyncStorage from '@react-native-async-storage/async-storage';

export async function guardarCacheLocal<T>(key: string, data: T): Promise<void> {
  try {
    const jsonStr = JSON.stringify(data);
    await AsyncStorage.setItem(`rutinia_${key}`, jsonStr);
  } catch (err) {
    console.warn('Error al guardar caché local:', err);
  }
}

export async function obtenerCacheLocal<T>(key: string): Promise<T | null> {
  try {
    const jsonStr = await AsyncStorage.getItem(`rutinia_${key}`);
    return jsonStr ? (JSON.parse(jsonStr) as T) : null;
  } catch (err) {
    console.warn('Error al leer caché local:', err);
    return null;
  }
}
