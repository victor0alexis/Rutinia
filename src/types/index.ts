export type SerieRutina = {
  id: string;
  numeroSerie: number;
  peso: number | null;
  repeticiones: number | null;
  rir?: number | null; // Repeticiones en reserva (RIR)
  nota?: string;
};

export type EjercicioRutinaDetallado = {
  id: string;
  nombre: string;
  seriesDetalladas?: SerieRutina[];
  series?: number | null;
  repeticiones?: number | null;
  peso?: number | null;
  notas?: string;
  orden?: number;
};

export type EjercicioRutina = {
  id: string;
  rutina_id: string;
  nombre: string;
  series: number | null;
  repeticiones: number | null;
  peso: number | null;
  orden: number;
  detallesJson?: string; // Para almacenar el array de series en formato JSON
};

export type Rutina = {
  id: string;
  nombre: string;
  ejercicios_rutina: EjercicioRutina[];
};

export type EjercicioRegistro = {
  id: string;
  registro_id: string;
  nombre: string;
  series: number | null;
  repeticiones: number | null;
  peso: number | null;
  completado: boolean;
};

export type Registro = {
  id: string;
  fecha: string; // yyyy-MM-dd
  rutina_id: string | null;
  completado: boolean;
  notas?: string | null;
  rutinas: { nombre: string } | null;
  ejercicios_registro: EjercicioRegistro[];
};
