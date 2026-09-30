import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../constants/colores';
import { aISO, nombreDia } from '../utils/fechas';
import { EjercicioRegistro, Registro } from '../types';

type Props = {
  fecha: Date;
  registros: Registro[];
  onPress: () => void;
};

export default function DiaCard({ fecha, registros, onPress }: Props) {
  const esHoy = aISO(fecha) === aISO(new Date());

  // Extraer todos los ejercicios del día
  const todosEjercicios: EjercicioRegistro[] = registros.flatMap((r) => r.ejercicios_registro || []);
  const completados = todosEjercicios.filter((e) => e.completado).length;
  const total = todosEjercicios.length;
  const estaCompleto = total > 0 && completados === total;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colores.tarjeta,
        borderRadius: 16,
        padding: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: esHoy ? colores.hoy : colores.borde,
        opacity: pressed ? 0.85 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
      })}
    >
      {/* Header del Día */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: esHoy ? colores.hoy : colores.texto,
              textTransform: 'capitalize',
            }}
          >
            {nombreDia(fecha)}
          </Text>
          {esHoy && (
            <View style={{ backgroundColor: colores.hoy + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ color: colores.hoy, fontSize: 11, fontWeight: '800' }}>HOY</Text>
            </View>
          )}
        </View>

        {/* Badge de Progreso */}
        {total > 0 ? (
          <View
            style={{
              backgroundColor: estaCompleto ? colores.primarioSuave : colores.borde,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons
              name={estaCompleto ? 'checkmark-circle' : 'time-outline'}
              size={14}
              color={estaCompleto ? colores.primario : colores.suave}
            />
            <Text style={{ fontSize: 12, fontWeight: '700', color: estaCompleto ? colores.primario : colores.suave }}>
              {completados}/{total}
            </Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colores.suave} />
        )}
      </View>

      {/* Contenido / Resumen */}
      {registros.length > 0 ? (
        <View style={{ gap: 6 }}>
          {registros.map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              {r.rutinas?.nombre && (
                <Text style={{ color: colores.primario, fontWeight: '700', fontSize: 13 }}>
                  • {r.rutinas.nombre}
                </Text>
              )}
              {r.ejercicios_registro.slice(0, 3).map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: r.rutinas?.nombre ? 12 : 0 }}>
                  <Ionicons
                    name={e.completado ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={e.completado ? colores.primario : colores.suave}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: e.completado ? colores.suave : colores.texto,
                      textDecorationLine: e.completado ? 'line-through' : 'none',
                    }}
                  >
                    {e.nombre}
                  </Text>
                </View>
              ))}
              {r.ejercicios_registro.length > 3 && (
                <Text style={{ color: colores.suave, fontSize: 12, paddingLeft: 12 }}>
                  + {r.ejercicios_registro.length - 3} ejercicios más...
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: colores.suave, fontSize: 13, fontStyle: 'italic' }}>
          Sin actividades programadas. Toca para agregar.
        </Text>
      )}
    </Pressable>
  );
}
