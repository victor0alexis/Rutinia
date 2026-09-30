import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../../constants/colores';
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

  const inputStyle = {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colores.fondo,
    color: colores.texto,
    fontSize: 15,
  } as const;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Crear Nueva Rutina',
          headerStyle: { backgroundColor: colores.tarjeta },
          headerTintColor: colores.texto,
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colores.fondo }}
      >
        <ScrollView
          style={{ backgroundColor: colores.fondo }}
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 50 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Nombre de la Rutina */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colores.suave, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Nombre de la Rutina
            </Text>
            <TextInput
              placeholder="Ej. Torso Pesado / Día de Pierna"
              placeholderTextColor={colores.suave}
              value={nombre}
              onChangeText={setNombre}
              style={[inputStyle, { backgroundColor: colores.tarjeta, fontSize: 16, fontWeight: '700' }]}
            />
          </View>

          {/* Ejercicios */}
          <Text style={{ color: colores.suave, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 }}>
            Ejercicios del Plan
          </Text>

          {filas.map((f, i) => (
            <View key={i} style={{ gap: 10, backgroundColor: colores.tarjeta, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colores.borde }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colores.primarioHover, fontWeight: '800', fontSize: 14 }}>Ejercicio #{i + 1}</Text>
                {filas.length > 1 && (
                  <Pressable onPress={() => setFilas(filas.filter((_, j) => j !== i))} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colores.peligro} />
                  </Pressable>
                )}
              </View>

              <TextInput
                placeholder="Nombre del ejercicio (ej. Press Inclinado)"
                placeholderTextColor={colores.suave}
                value={f.nombre}
                onChangeText={(t) => cambiar(i, 'nombre', t)}
                style={inputStyle}
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  placeholder="Series"
                  placeholderTextColor={colores.suave}
                  keyboardType="numeric"
                  value={f.series}
                  onChangeText={(t) => cambiar(i, 'series', t)}
                  style={[inputStyle, { flex: 1 }]}
                />
                <TextInput
                  placeholder="Reps"
                  placeholderTextColor={colores.suave}
                  keyboardType="numeric"
                  value={f.repeticiones}
                  onChangeText={(t) => cambiar(i, 'repeticiones', t)}
                  style={[inputStyle, { flex: 1 }]}
                />
                <TextInput
                  placeholder="Kg"
                  placeholderTextColor={colores.suave}
                  keyboardType="numeric"
                  value={f.peso}
                  onChangeText={(t) => cambiar(i, 'peso', t)}
                  style={[inputStyle, { flex: 1 }]}
                />
              </View>
            </View>
          ))}

          {/* Botón Añadir Ejercicio */}
          <Pressable
            onPress={() => setFilas([...filas, vacia()])}
            style={({ pressed }) => ({
              backgroundColor: colores.tarjeta,
              borderWidth: 1,
              borderColor: colores.primario,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            })}
          >
            <Ionicons name="add-circle-outline" size={20} color={colores.primarioHover} />
            <Text style={{ color: colores.primarioHover, fontWeight: '800', fontSize: 14 }}>Añadir Otro Ejercicio</Text>
          </Pressable>

          {/* Botón Guardar */}
          <Pressable
            onPress={guardar}
            style={({ pressed }) => ({
              backgroundColor: colores.primario,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              shadowColor: colores.primario,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
              marginTop: 10,
            })}
          >
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>Guardar Rutina</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
