import { Alert } from 'react-native';

export async function seguro(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    Alert.alert('Error', e?.message ?? String(e));
  }
}
