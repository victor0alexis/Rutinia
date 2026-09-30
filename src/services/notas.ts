import AsyncStorage from '@react-native-async-storage/async-storage';

export type CategoriaNota = 'Nutrición' | 'Entrenamiento' | 'Suplementos' | 'Recuperación' | 'General';

export type NotaEstandar = {
  id: string;
  titulo: string;
  categoria: CategoriaNota;
  contenido: string;
  fechaCreacion: string;
};

const STORAGE_KEY = '@rutinia_notas_estandarizadas_v1';

// Notas por defecto iniciales
const NOTAS_POR_DEFECTO: NotaEstandar[] = [
  {
    id: '1',
    titulo: 'Protocolo de Suplementación',
    categoria: 'Suplementos',
    contenido: '• Creatina: 5g pre-entreno\n• Proteína Whey: 30g post-entreno\n• Multivitamínico: 1 cápsula con desayuno',
    fechaCreacion: new Date().toISOString(),
  },
  {
    id: '2',
    titulo: 'Check-in de Peso y Medidas',
    categoria: 'Nutrición',
    contenido: '• Peso en ayunas: -- kg\n• Calorías objetivo: 2500 kcal\n• Agua consumida: 3.5 Litros',
    fechaCreacion: new Date().toISOString(),
  },
];

export async function obtenerNotasEstandar(): Promise<NotaEstandar[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(NOTAS_POR_DEFECTO));
      return NOTAS_POR_DEFECTO;
    }
    return JSON.parse(json);
  } catch {
    return NOTAS_POR_DEFECTO;
  }
}

export async function guardarNotaEstandar(nota: Omit<NotaEstandar, 'id' | 'fechaCreacion'> & { id?: string }): Promise<void> {
  const lista = await obtenerNotasEstandar();
  if (nota.id) {
    const actualizada = lista.map((n) => (n.id === nota.id ? { ...n, ...nota } : n));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(actualizada));
  } else {
    const nueva: NotaEstandar = {
      ...nota,
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([nueva, ...lista]));
  }
}

export async function eliminarNotaEstandar(id: string): Promise<void> {
  const lista = await obtenerNotasEstandar();
  const filtrada = lista.filter((n) => n.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtrada));
}
