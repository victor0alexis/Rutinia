import { useState } from 'react';
import { ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colores, fuentes } from '../../constants/colores';
import ScreenBackground from '../../components/ScreenBackground';
import GlowButton from '../../components/GlowButton';
import { crearRutina } from '../../services/rutinas';
import { seguro } from '../../utils/errores';

type Fila = { nombre: string; series: string; repeticiones: string; peso: string };
const vacia = (): Fila => ({ nombre: '', series: '', repeticiones: '', peso: '' });
const num = (t: string) => (t.trim() ? Number(t) : null);

export default function NuevaRutina() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [filas, setFilas] = useState<Fila[]>([vacia()]);

  const cambiar = (i: number, campo: keyof Fila, valor: string) =>
    setFilas(filas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));

  const guardar = () =>
    seguro(async () => {
      if (!nombre.trim()) throw new Error('Ingresa un nombre para la rutina.');
      const ejercicios = filas
        .filter((f) => f.nombre.trim())
        .map((f) => ({
          nombre: f.nombre.trim(),
          series: num(f.series),
          repeticiones: num(f.repeticiones),
          peso: num(f.peso),
        }));
      await crearRutina(nombre.trim(), ejercicios);
      router.back();
    });

  return (
    <ScreenBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Crear Nueva Rutina',
          headerStyle: { backgroundColor: colores.tarjetaSolida },
          headerTintColor: colores.texto,
          headerTitleStyle: { fontFamily: fuentes.black },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Nombre de la Rutina */}
          <View style={{ gap: 6 }}>
            <Text style={styles.sectionLabel}>
              Nombre de la Rutina
            </Text>
            <TextInput
              placeholder="Ej. Torso Pesado / Día de Pierna"
              placeholderTextColor={colores.suave}
              value={nombre}
              onChangeText={setNombre}
              style={[styles.inputBase, styles.nameInput]}
            />
          </View>

          {/* Ejercicios */}
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>
            Ejercicios del Plan
          </Text>

          {filas.map((f, i) => (
            <View key={i} style={styles.exerciseCardBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colores.primarioHover, fontFamily: fuentes.black, fontSize: 14 }}>Ejercicio #{i + 1}</Text>
                {filas.length > 1 && (
                  <GlowButton
                    icon="trash-outline"
                    onPress={() => setFilas(filas.filter((_, j) => j !== i))}
                    variant="danger"
                    size="sm"
                    shape="rounded"
                  />
                )}
              </View>

              <TextInput
                placeholder="Nombre del ejercicio (ej. Press Inclinado)"
                placeholderTextColor={colores.suave}
                value={f.nombre}
                onChangeText={(t) => cambiar(i, 'nombre', t)}
                style={styles.inputBase}
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  placeholder="Series"
                  placeholderTextColor={colores.suave}
                  keyboardType="numeric"
                  value={f.series}
                  onChangeText={(t) => cambiar(i, 'series', t)}
                  style={[styles.inputBase, { flex: 1, textAlign: 'center' }]}
                />
                <TextInput
                  placeholder="Reps"
                  placeholderTextColor={colores.suave}
                  keyboardType="numeric"
                  value={f.repeticiones}
                  onChangeText={(t) => cambiar(i, 'repeticiones', t)}
                  style={[styles.inputBase, { flex: 1, textAlign: 'center' }]}
                />
                <TextInput
                  placeholder="Kg"
                  placeholderTextColor={colores.suave}
                  keyboardType="numeric"
                  value={f.peso}
                  onChangeText={(t) => cambiar(i, 'peso', t)}
                  style={[styles.inputBase, { flex: 1, textAlign: 'center' }]}
                />
              </View>
            </View>
          ))}

          {/* Botón Añadir Ejercicio */}
          <GlowButton
            title="Añadir Otro Ejercicio"
            icon="add-circle-outline"
            onPress={() => setFilas([...filas, vacia()])}
            variant="outline"
            size="md"
            shape="rounded"
            fullWidth
          />

          {/* Botón Guardar */}
          <GlowButton
            title="Guardar Rutina"
            onPress={guardar}
            variant="primary"
            size="lg"
            shape="rounded"
            fullWidth
            style={{ marginTop: 10 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colores.suave,
    fontFamily: fuentes.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputBase: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(10, 12, 18, 0.60)',
    color: colores.texto,
    fontSize: 15,
    fontFamily: fuentes.regular,
  },
  nameInput: {
    backgroundColor: colores.tarjeta,
    fontSize: 16,
    fontFamily: fuentes.bold,
  },
  exerciseCardBox: {
    gap: 10,
    backgroundColor: colores.tarjeta,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
});
