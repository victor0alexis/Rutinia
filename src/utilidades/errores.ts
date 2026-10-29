export type ModalConfig = {
  visible: boolean;
  tipo: 'confirm' | 'alert';
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  esPeligro?: boolean;
  onConfirmar?: () => Promise<void> | void;
};

type Listener = (config: ModalConfig) => void;
const listeners = new Set<Listener>();

export function suscribirModalConfirmacion(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function abrirModalGlobal(config: Omit<ModalConfig, 'visible'>) {
  listeners.forEach((l) => l({ ...config, visible: true }));
}

export function cerrarModalGlobal() {
  listeners.forEach((l) => l({ visible: false, tipo: 'alert', titulo: '', mensaje: '' }));
}

export async function seguro(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    mostrarMensaje('Atención', msg);
  }
}

export function confirmarAccion(
  titulo: string,
  mensaje: string,
  onConfirmar: () => Promise<void> | void,
  textoConfirmar = 'Eliminar'
) {
  const esPeligro =
    textoConfirmar.toLowerCase().includes('eliminar') ||
    textoConfirmar.toLowerCase().includes('desvincular') ||
    titulo.toLowerCase().includes('eliminar') ||
    titulo.toLowerCase().includes('desvincular');

  abrirModalGlobal({
    tipo: 'confirm',
    titulo,
    mensaje,
    textoConfirmar,
    esPeligro,
    onConfirmar,
  });
}

export function mostrarMensaje(titulo: string, mensaje?: string) {
  abrirModalGlobal({
    tipo: 'alert',
    titulo,
    mensaje: mensaje || '',
    textoConfirmar: 'Entendido',
  });
}
