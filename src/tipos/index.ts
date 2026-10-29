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

type DropItem = {
  orden: number;
  kg: number | string;
  reps: number | string;
  rir?: number | string | null;
};

type EjercicioRutina = {
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
  ejercicio_nombre?: string | null;
  sustituye_a_ejercicio_id?: string | null;
  sustituye_a_nombre?: string | null;
  sustitucion_alcance?: 'solo_hoy' | 'rutina' | null;
  reps_parciales?: number;
  drops?: DropItem[];
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


