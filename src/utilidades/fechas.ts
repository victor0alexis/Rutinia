import { addDays, endOfWeek, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export const aISO = (d: Date) => format(d, 'yyyy-MM-dd');
export const inicioSemana = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

export const diasDeSemana = (d: Date) => {
  const ini = inicioSemana(d);
  return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
};

export const nombreDia = (d: Date) => format(d, 'EEEE d', { locale: es });

export const rangoSemana = (d: Date) =>
  `${format(inicioSemana(d), 'd MMM', { locale: es })} a ${format(
    endOfWeek(d, { weekStartsOn: 1 }),
    'd MMM',
    { locale: es }
  )}`;
