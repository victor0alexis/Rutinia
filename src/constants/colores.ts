export const colores = {
  // Fondos y Capas (Negro carbón OLED, vidrio translúcido & Grises oscuros de alta profundidad)
  fondo: '#050608',                  // Negro profundo carbón OLED
  fondoGradiente: ['#050608', '#0A0C14', '#06070B'] as const,
  tarjeta: 'rgba(18, 22, 33, 0.78)',  // Vidrio translúcido superficie 1
  tarjetaSolida: '#11141F',          // Gris oscuro sólido respaldo
  tarjetaElevada: 'rgba(22, 26, 40, 0.94)', // Modales/Paneles con elevación
  borde: 'rgba(255, 255, 255, 0.08)', // Bordes sutiles metálicos
  bordeBrillante: 'rgba(255, 255, 255, 0.18)', // Bordes activos / hover
  bordeGlow: 'rgba(184, 29, 54, 0.45)', // Resplandor de contorno tecnológico

  // Acento Burdeos / Borgoña Premium & Creador de Resplandor
  primario: '#8C1327',               // Burdeos intenso elegante
  primarioHover: '#B81D36',          // Burdeos más vivo para acciones/press
  primarioSuave: 'rgba(184, 29, 54, 0.16)', // Resaltado de fondo suave
  primarioGlow: 'rgba(184, 29, 54, 0.38)',  // Resplandor para bordes/badges

  // Línea de contorno luminoso tipo "Tu Plan Inteligente"
  glowLine: ['rgba(255, 255, 255, 0.85)', 'rgba(184, 29, 54, 0.7)', 'rgba(184, 29, 54, 0.05)'] as const,

  // Textos y Legibilidad
  texto: '#F9FAFB',                  // Texto brillante de alto contraste
  suave: '#9CA3AF',                  // Texto secundario desaturado
  mutado: '#4B5563',                 // Detalles / captions desvanecidos

  // Indicadores de Estado
  hoy: '#D97706',                    // Ámbar luminoso para "Hoy"
  peligro: '#DC2626',                // Rojo carmesí para eliminar
  exito: '#10B981',                  // Verde esmeralda para completado

  // Halos de Luz Ambiental (Soft Background Lights)
  haloPrimario: 'rgba(184, 29, 54, 0.12)',
  haloAzul: 'rgba(59, 130, 246, 0.08)',
  haloEsmeralda: 'rgba(16, 185, 129, 0.08)',
};

export const fuentes = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semiBold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extraBold: 'Outfit_800ExtraBold',
  black: 'Outfit_900Black',
};
