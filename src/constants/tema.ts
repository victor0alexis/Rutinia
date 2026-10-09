export const tema = {
  colores: {
    fondo: '#0B0D14',
    superficie: '#0F121B',
    borde: '#232838',
    texto: '#F4F3F8',
    textoSuave: '#9AA0B4',

    // Identidad
    carmesi: '#C2243D',
    naranja: '#E8892B',
    verde: '#2BD598',
    verdeBorde: '#1FA97A',
    violeta: '#8B5CF6',

    // Botón
    botonFondo: 'rgba(26, 23, 34, 0.74)',
    botonBorde: '#4A4466',
    destelloNucleo: '#FAF9FD',
    destelloCola: '#8A84B8',
    halo: '#CFC9F0',
  },
  medidas: {
    altoPrincipal: 52,
    altoPrincipalCompacto: 40,
    altoSecundario: 46,
    altoSecundarioCompacto: 38,
    margenLateral: 24,
  },
  tiempos: {
    vueltaMs: 3333,
  },

  // Nuevos tokens V2
  fondo: {
    base: '#070914',
    auroraVioleta: '#7C5CFF',
    auroraCian: '#22D3EE',
    auroraCarmesi: '#E0334F',
    nucleo: '#E8E4FF',
    vidrio: 'rgba(12, 14, 26, 0.72)',
    bordeVidrio: 'rgba(255, 255, 255, 0.09)',
  },
  acentoEstado: {
    vacio: '#22D3EE',
    pendiente: '#F5A24B',
    completado: '#2BD598',
  },
  tornasol: ['#7CF3FF', '#A78BFA', '#FF8AD8', '#FFE3C2', '#FFFFFF'],
  animacion: {
    vueltaBotonMs: 4000,
    derivaMs: [22000, 28000, 26000] as const,
    respiroMs: 8000,
    parpadeoMs: 4500,
  },
};

