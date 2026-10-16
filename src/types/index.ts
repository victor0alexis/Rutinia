export type PlanEntrenamiento = {
  id: string;
  usuario_id?: string | null;
  nombre: string;
  descripcion?: string | null;
  objetivo?: string | null;
  color: string;
  icono: string;
  orden: number;
  activo: boolean;
  archivado: boolean;
  creado_en?: string;
  totalRutinas?: number;
  diasPorSemana?: number;
};

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
  creado_en?: string;
  plan_id?: string | null;
  dia_sugerido?: number | null; // 0 = Lunes, 6 = Domingo
  orden_en_plan?: number;
  planes_entrenamiento?: PlanEntrenamiento | null;
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
  plan_id?: string | null;
  plan_nombre?: string | null;
  rutina_nombre?: string | null;
  completado: boolean;
  notas?: string | null;
  rutinas: { nombre: string; plan_id?: string | null; dia_sugerido?: number | null } | null;
  planes_entrenamiento?: PlanEntrenamiento | null;
  ejercicios_registro: EjercicioRegistro[];
};

