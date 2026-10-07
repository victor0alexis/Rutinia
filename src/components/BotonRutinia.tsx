import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import Animated, {
  Easing, SharedValue, cancelAnimation, useAnimatedProps, useAnimatedStyle,
  useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

export const tokensBoton = {
  fondo: '#201D26',
  bordeReposo: '#4A4466',
  destelloNucleo: '#FAF9FD',
  destelloCola: '#8A84B8',
  halo: '#CFC9F0',
  texto: '#FFFFFF',
  vueltaMs: 3333, // una vuelta completa, velocidad lineal constante
  fase: 0.714,    // el destello arranca en la parte baja del botón
};

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const PAD = 14;     // margen extra del SVG para que el resplandor no se corte
const BORDE = 1.5;

const mezclar = (a: string, b: string, t: number) => {
  const h = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const A = h(a), B = h(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

type Capa = { frac: number; color: string; opacidad: number; grosor: number };
const CAPAS: Capa[] = [
  // resplandor (trazos anchos y casi transparentes apilados)
  { frac: 0.30, color: tokensBoton.halo, opacidad: 0.05, grosor: 22 },
  { frac: 0.26, color: tokensBoton.halo, opacidad: 0.08, grosor: 15 },
  { frac: 0.22, color: tokensBoton.halo, opacidad: 0.12, grosor: 9 },
  // cola: 9 capas, de larga/violeta a corta/blanca, para un degradado suave
  ...Array.from({ length: 9 }, (_, k) => {
    const t = k / 8;
    return {
      frac: 0.4 * Math.pow(0.05 / 0.4, t),
      color: mezclar(tokensBoton.destelloCola, tokensBoton.destelloNucleo, t),
      opacidad: 0.3,
      grosor: 3,
    };
  }),
  // núcleo brillante
  { frac: 0.05, color: tokensBoton.destelloNucleo, opacidad: 1, grosor: 2.6 },
];

function CapaDestello(props: {
  capa: Capa; ancho: number; alto: number; perimetro: number; progreso: SharedValue<number>;
}) {
  const { capa, ancho, alto, perimetro, progreso } = props;
  const largo = capa.frac * perimetro;
  const animadas = useAnimatedProps(() => {
    const cabeza = ((progreso.value + tokensBoton.fase) % 1) * perimetro;
    return { strokeDashoffset: (((largo - cabeza) % perimetro) + perimetro) % perimetro };
  });
  return (
    <AnimatedRect
      x={PAD + BORDE / 2} y={PAD + BORDE / 2}
      width={ancho - BORDE} height={alto - BORDE}
      rx={(alto - BORDE) / 2} ry={(alto - BORDE) / 2}
      fill="none" stroke={capa.color} strokeOpacity={capa.opacidad}
      strokeWidth={capa.grosor} strokeLinecap="round"
      strokeDasharray={[largo, perimetro - largo]}
      animatedProps={animadas}
    />
  );
}

type Props = {
  titulo: string;
  onPress?: () => void;
  disabled?: boolean;
  tamano?: 'normal' | 'compacto';
  style?: StyleProp<ViewStyle>; // ej. { alignSelf: 'stretch' } para ancho completo
};

export default function BotonRutinia({ titulo, onPress, disabled, tamano = 'normal', style }: Props) {
  const alto = tamano === 'compacto' ? 38 : 48;
  const [ancho, setAncho] = useState(0);
  const progreso = useSharedValue(0);
  const presionado = useSharedValue(0);
  const reducir = useReducedMotion();

  useEffect(() => {
    if (reducir || disabled) {
      cancelAnimation(progreso);
      return;
    }
    progreso.value = 0;
    progreso.value = withRepeat(
      withTiming(1, { duration: tokensBoton.vueltaMs, easing: Easing.linear }), -1, false
    );
    return () => cancelAnimation(progreso);
  }, [reducir, disabled, progreso]);

  const escala = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.03 * presionado.value }],
  }));

  const rw = ancho - BORDE, rh = alto - BORDE;
  const perimetro = 2 * (rw - rh) + Math.PI * rh;

  return (
    <Animated.View style={[{ alignSelf: 'flex-start' }, escala, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => { presionado.value = withTiming(1, { duration: 120 }); }}
        onPressOut={() => { presionado.value = withTiming(0, { duration: 160 }); }}
        onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        style={{
          width: '100%',
          height: alto,
          borderRadius: alto / 2,
          paddingHorizontal: tamano === 'compacto' ? 18 : 24,
          backgroundColor: tokensBoton.fondo,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          shadowColor: tokensBoton.halo, // halo tenue (solo iOS)
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {ancho > 0 && (
          <Svg
            pointerEvents="none"
            width={ancho + PAD * 2} height={alto + PAD * 2}
            style={{ position: 'absolute', left: -PAD, top: -PAD }}
          >
            <Rect
              x={PAD + BORDE / 2} y={PAD + BORDE / 2}
              width={rw} height={rh} rx={rh / 2} ry={rh / 2}
              fill="none" stroke={tokensBoton.bordeReposo} strokeWidth={BORDE}
            />
            {CAPAS.map((capa, i) => (
              <CapaDestello key={i} capa={capa} ancho={ancho} alto={alto}
                perimetro={perimetro} progreso={progreso} />
            ))}
          </Svg>
        )}
        <Text style={{
          color: tokensBoton.texto,
          fontSize: tamano === 'compacto' ? 15 : 18,
          fontWeight: '400',
          letterSpacing: 0.2,
        }}>
          {titulo}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
