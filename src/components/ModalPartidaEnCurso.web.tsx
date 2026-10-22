import React, { useEffect, useState, useId } from 'react';
import { View, StyleSheet } from 'react-native';
import { formatearTiempo } from '../utils/timer';
import {
  SesionActivaInfo,
  limpiarSesionActiva,
  obtenerBorradorSesion,
  BorradorSesion,
} from '../utils/sesionActiva';
import { confirmarAccion } from '../utils/errores';

type Props = {
  visible: boolean;
  sesionInfo: SesionActivaInfo | null;
  onReanudar: () => void;
  onDescartar: () => void;
  onVolver?: () => void;
};

export default function ModalPartidaEnCursoWeb({
  visible,
  sesionInfo,
  onReanudar,
  onDescartar,
  onVolver,
}: Props) {
  const [extraSegs, setExtraSegs] = useState(0);
  const [borrador, setBorrador] = useState<BorradorSesion | null>(null);
  const uniqueId = useId().replace(/:/g, '');
  const scopeClass = `wk-modal-${uniqueId}`;

  // Timer en vivo
  useEffect(() => {
    if (!visible || !sesionInfo) return;

    const interval = setInterval(() => {
      setExtraSegs((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      setExtraSegs(0);
    };
  }, [visible, sesionInfo]);

  const [minutosInactiva, setMinutosInactiva] = useState(0);

  // Carga inteligente del borrador completo para extraer el snapshot del entrenamiento
  useEffect(() => {
    if (!visible || !sesionInfo) return;

    let isMounted = true;
    obtenerBorradorSesion(sesionInfo.registroId).then((b) => {
      if (isMounted && b) {
        setBorrador(b);
        if (b.updatedAt) {
          setMinutosInactiva(Math.max(0, Math.floor((Date.now() - b.updatedAt) / 60000)));
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [visible, sesionInfo]);

  if (!visible || !sesionInfo) return null;

  const segs = sesionInfo.segsTranscurridos + extraSegs;
  const porcentaje =
    sesionInfo.totalSeries > 0
      ? Math.round((sesionInfo.seriesCompletadas / sesionInfo.totalSeries) * 100)
      : 0;

  // Encontrar el próximo ejercicio pendiente dentro del borrador
  let proximoEjercicioNombre = '';
  let proximaSerieIndice = 0;
  let totalSeriesEjercicio = 0;

  if (borrador?.ejerciciosState) {
    for (const ej of borrador.ejerciciosState) {
      const idxPendiente = ej.series.findIndex((s) => !s.completado);
      if (idxPendiente !== -1) {
        proximoEjercicioNombre = ej.nombre;
        proximaSerieIndice = idxPendiente + 1;
        totalSeriesEjercicio = ej.series.length;
        break;
      }
    }
    // Si todas las series están completadas pero no finalizó:
    if (!proximoEjercicioNombre && borrador.ejerciciosState.length > 0) {
      const ultimo = borrador.ejerciciosState[borrador.ejerciciosState.length - 1];
      proximoEjercicioNombre = ultimo.nombre;
      proximaSerieIndice = ultimo.series.length;
      totalSeriesEjercicio = ultimo.series.length;
    }
  }

  const handleDescartarConfirm = () => {
    confirmarAccion(
      'Descartar Entrenamiento',
      '¿Estás seguro de que deseas cancelar la sesión en curso? Se perderán los datos y avances no guardados.',
      async () => {
        await limpiarSesionActiva(sesionInfo.registroId);
        onDescartar();
      },
      'Descartar'
    );
  };

  const handleVolver = () => {
    if (onVolver) {
      onVolver();
    }
  };

  const css = `
    .${scopeClass}-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 5, 10, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 16px;
      box-sizing: border-box;
      user-select: none;
      animation: ${scopeClass}-fadeIn 0.25s ease-out;
    }

    @keyframes ${scopeClass}-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Adaptación del componente weak-kangaroo-62 de Artahs */
    .${scopeClass}-card-wrapper {
      --color-primary: #11140e;
      --color-border: #8a8b90;
      --color-accent: #f5a24b;
      --color-bg-secondary: #171a13;

      width: 100%;
      max-width: 356px;
      position: relative;
      color: white;
      box-shadow: rgba(0, 0, 0, 0.7) 0px 14px 40px -10px, rgba(138, 139, 144, 0.22) 0px 0px 0px 1px;
      border-radius: 18px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: ${scopeClass}-slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes ${scopeClass}-slideUp {
      from {
        transform: translateY(18px) scale(0.97);
        opacity: 0;
      }
      to {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }

    /* Top Card de weak-kangaroo-62 */
    .${scopeClass}-top-card {
      width: 100%;
      background-color: var(--color-primary);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      position: relative;
      z-index: 2;
      padding: 18px 18px 16px 18px;
      box-sizing: border-box;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    .${scopeClass}-card-wrapper:hover .${scopeClass}-top-card {
      border-color: rgba(245, 162, 75, 0.6);
      transform: translateY(-2px);
    }

    .${scopeClass}-close-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 28px;
      height: 28px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #b5b5b5;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s ease;
      outline: none;
    }

    .${scopeClass}-close-btn:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      transform: scale(1.06);
    }

    /* Badge superior de estado */
    .${scopeClass}-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(245, 162, 75, 0.12);
      border: 1px solid rgba(245, 162, 75, 0.32);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      color: var(--color-accent);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .${scopeClass}-pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: var(--color-accent);
      box-shadow: 0 0 8px var(--color-accent);
      animation: ${scopeClass}-pulse 2s infinite ease-in-out;
    }

    @keyframes ${scopeClass}-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .${scopeClass}-routine-title {
      font-size: 21px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 12px 0;
      letter-spacing: -0.3px;
      line-height: 1.25;
      padding-right: 28px;
    }

    /* Cronómetro badge */
    .${scopeClass}-timer-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(138, 139, 144, 0.25);
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }

    .${scopeClass}-timer-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .${scopeClass}-timer-left svg {
      width: 18px;
      height: 18px;
      fill: var(--color-accent);
    }

    .${scopeClass}-timer-time {
      font-size: 19px;
      font-weight: 800;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.8px;
    }

    .${scopeClass}-progress-pill {
      font-size: 11px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      padding: 3px 8px;
      border-radius: 6px;
      color: #ffffff;
    }

    /* Barra de progreso de series */
    .${scopeClass}-series-bar-bg {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .${scopeClass}-series-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #f5a24b, #22c55e);
      border-radius: 3px;
      transition: width 0.5s ease;
    }

    .${scopeClass}-series-count {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #a0a0a0;
      font-weight: 500;
    }

    .${scopeClass}-series-count span:last-child {
      color: #22c55e;
      font-weight: 600;
    }

    /* Bottom Card de weak-kangaroo-62 (Cajón Inteligente) */
    .${scopeClass}-bottom-card {
      width: 100%;
      background-color: var(--color-bg-secondary);
      border: 1px solid rgba(138, 139, 144, 0.35);
      border-radius: 16px;
      padding: 14px 16px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
      transition: border-color 0.3s ease;
    }

    .${scopeClass}-card-wrapper:hover .${scopeClass}-bottom-card {
      border-color: rgba(138, 139, 144, 0.6);
    }

    /* Snapshot inteligente */
    .${scopeClass}-intel-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .${scopeClass}-intel-title {
      font-size: 11px;
      font-weight: 700;
      color: #8a8b90;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .${scopeClass}-intel-value {
      font-size: 13.5px;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${scopeClass}-intel-sub {
      font-size: 11.5px;
      color: #8c9098;
    }

    /* Grupo de Botones */
    .${scopeClass}-actions-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      margin-top: 4px;
    }

    /* 1. Botón Reanudar (Principal - Blanco brillante sobre obsidian) */
    .${scopeClass}-btn-reanudar {
      background: #ffffff;
      color: #0c0e12;
      border: none;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(255, 255, 255, 0.15);
      outline: none;
      letter-spacing: 0.2px;
    }

    .${scopeClass}-btn-reanudar:hover {
      background: #f0f0f0;
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(255, 255, 255, 0.25);
    }

    .${scopeClass}-btn-reanudar:active {
      transform: scale(0.97);
    }

    /* 2. Botón Volver (Secundario - Permite seguir navegando sin perder sesión) */
    .${scopeClass}-btn-volver {
      background: rgba(255, 255, 255, 0.05);
      color: #e5e5e5;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      transition: all 0.2s ease;
      outline: none;
    }

    .${scopeClass}-btn-volver:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.25);
      color: #ffffff;
      transform: translateY(-1px);
    }

    .${scopeClass}-btn-volver:active {
      transform: scale(0.98);
    }

    /* 3. Botón Descartar (Peligro protegido con modal) */
    .${scopeClass}-btn-descartar {
      background: transparent;
      color: #ffa7a7;
      border: 1px dashed rgba(255, 122, 133, 0.28);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s ease;
      outline: none;
    }

    .${scopeClass}-btn-descartar:hover {
      background: rgba(255, 122, 133, 0.1);
      border-color: rgba(255, 122, 133, 0.5);
      color: #ffffff;
    }

    .${scopeClass}-btn-descartar:active {
      transform: scale(0.98);
    }
  `;

  return (
    <View style={styles.container}>
      {/* Inyección CSS pura y aislada */}
      {/* @ts-ignore */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className={`${scopeClass}-overlay`}>
        <div className={`${scopeClass}-card-wrapper`}>
          {/* TOP CARD (weak-kangaroo-62) */}
          <div className={`${scopeClass}-top-card`}>
            {/* Botón Volver / Cerrar sin descartar */}
            <button
              type="button"
              className={`${scopeClass}-close-btn`}
              onClick={handleVolver}
              title="Volver a la app (Mantener sesión pausada)"
              aria-label="Volver"
            >
              ✕
            </button>

            {/* Chip de estado en vivo */}
            <div className={`${scopeClass}-badge`}>
              <div className={`${scopeClass}-pulse-dot`} />
              <span>Entrenamiento en Curso</span>
            </div>

            {/* Nombre de la rutina activa */}
            <h2 className={`${scopeClass}-routine-title`}>
              {sesionInfo.nombreRutina}
            </h2>

            {/* Caja de tiempo transcurrido en vivo */}
            <div className={`${scopeClass}-timer-container`}>
              <div className={`${scopeClass}-timer-left`}>
                <svg viewBox="0 0 24 24">
                  <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
                <span className={`${scopeClass}-timer-time`}>
                  {formatearTiempo(segs)}
                </span>
              </div>
              <span className={`${scopeClass}-progress-pill`}>
                {porcentaje}%
              </span>
            </div>

            {/* Barra de progreso de series */}
            <div className={`${scopeClass}-series-bar-bg`}>
              <div
                className={`${scopeClass}-series-bar-fill`}
                style={{ width: `${Math.max(porcentaje, 4)}%` }}
              />
            </div>

            <div className={`${scopeClass}-series-count`}>
              <span>
                {sesionInfo.seriesCompletadas} de {sesionInfo.totalSeries} series
              </span>
              <span>
                {porcentaje === 100
                  ? '¡Todas completadas!'
                  : `${sesionInfo.totalSeries - sesionInfo.seriesCompletadas} restantes`}
              </span>
            </div>
          </div>

          {/* BOTTOM CARD (Cajón Inteligente - weak-kangaroo-62) */}
          <div className={`${scopeClass}-bottom-card`}>
            {/* Snapshot inteligente: Próximo ejercicio y estado de guardado */}
            <div className={`${scopeClass}-intel-box`}>
              <div className={`${scopeClass}-intel-title`}>
                <span>📌 DÓNDE TE QUEDASTE</span>
              </div>
              <div className={`${scopeClass}-intel-value`}>
                {proximoEjercicioNombre
                  ? `${proximoEjercicioNombre} (Serie ${proximaSerieIndice}/${totalSeriesEjercicio})`
                  : 'Listo para continuar'}
              </div>
              <div className={`${scopeClass}-intel-sub`}>
                💾 Guardado seguro en memoria local
                {minutosInactiva > 0 ? ` · Pausado hace ${minutosInactiva} min` : ' · Sesión activa'}
              </div>
            </div>

            {/* Grupo de Acciones */}
            <div className={`${scopeClass}-actions-group`}>
              {/* 1. Reanudar */}
              <button
                type="button"
                className={`${scopeClass}-btn-reanudar`}
                onClick={onReanudar}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Reanudar Entrenamiento</span>
              </button>

              {/* 2. Volver a la app sin perder sesión */}
              <button
                type="button"
                className={`${scopeClass}-btn-volver`}
                onClick={handleVolver}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span>Volver (Mantener en pausa)</span>
              </button>

              {/* 3. Descartar con confirmación */}
              <button
                type="button"
                className={`${scopeClass}-btn-descartar`}
                onClick={handleDescartarConfirm}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Descartar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 99999,
  },
});
