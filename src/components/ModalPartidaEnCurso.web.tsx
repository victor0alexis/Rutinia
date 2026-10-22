import React, { useEffect, useState, useId } from 'react';
import { View, StyleSheet } from 'react-native';
import { formatearTiempo } from '../utils/timer';
import { SesionActivaInfo, limpiarSesionActiva } from '../utils/sesionActiva';
import { confirmarAccion } from '../utils/errores';

const DRAGON_SVG_ICON = `
<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 925.1 925.1" xml:space="preserve">
  <g>
    <g>
      <path d="M453.5,26.514l-345.6,187.3l15.2-3.8l412.9-104.7l-35-64.6C491.8,23.614,470.5,17.313,453.5,26.514z" />
      <path d="M780.9,222.313l-26.2-103.4c-4-15.9-18.3-26.4-33.9-26.4c-2.8,0-5.7,0.3-8.6,1.1l-160.5,40.7l-347.4,88.1H599.4h181.5V222.313z" />
      <path d="M546.7,665.513v-176c0-36.699,29.8-66.5,66.5-66.5h218.6h16.5h16.5H878v-135.7c0-19.3-15.7-35-35-35h-21.5H805h-16.5H615.7H133.8h-16.5h-16.5h-64H35c-12.9,0-24.1,7-30.2,17.3c-3,5.2-4.8,11.2-4.8,17.7v5.6v574.9c0,19.301,15.7,35,35,35h807.9c19.3,0,35-15.699,35-35V732.114H613.2C576.5,732.114,546.7,702.214,546.7,665.513z" />
      <path d="M908,459.513c-4.5-2.699-9.6-4.3-15-4.8c-1-0.1-1.9-0.1-2.9-0.1H878h-5.2h-16.5h-39.6H613.2c-19.3,0-35,15.7-35,35v176c0,19.299,15.7,35,35,35H878h12.1c1,0,1.9-0.102,2.9-0.102c5.4-0.398,10.5-2.1,15-4.799c10.2-6.1,17.1-17.301,17.1-30.1v-176C925.1,476.813,918.2,465.614,908,459.513z M700.5,634.313c-31.3,0-56.8-25.4-56.8-56.801c0-31.299,25.399-56.799,56.8-56.799c31.3,0,56.8,25.4,56.8,56.799C757.3,608.913,731.9,634.313,700.5,634.313z" />
    </g>
  </g>
</svg>
`;

type Props = {
  visible: boolean;
  sesionInfo: SesionActivaInfo | null;
  onReanudar: () => void;
  onDescartar: () => void;
  onClose?: () => void;
};

export default function ModalPartidaEnCursoWeb({
  visible,
  sesionInfo,
  onReanudar,
  onDescartar,
  onClose,
}: Props) {
  const [extraSegs, setExtraSegs] = useState(0);
  const uniqueId = useId().replace(/:/g, '');
  const scopeClass = `ld-modal-${uniqueId}`;

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

  if (!visible || !sesionInfo) return null;

  const segs = sesionInfo.segsTranscurridos + extraSegs;
  const porcentaje = sesionInfo.totalSeries > 0
    ? Math.round((sesionInfo.seriesCompletadas / sesionInfo.totalSeries) * 100)
    : 0;

  const handleDescartarConfirm = () => {
    confirmarAccion(
      'Descartar Entrenamiento',
      '¿Estás seguro de que deseas cancelar la sesión en curso? Se perderán los datos no guardados.',
      async () => {
        await limpiarSesionActiva(sesionInfo.registroId);
        onDescartar();
      },
      'Descartar'
    );
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
      background: rgba(3, 4, 8, 0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 16px;
      box-sizing: border-box;
      user-select: none;
    }

    .${scopeClass}-theme {
      --color-dark-subtle: linear-gradient(to right, #532222, #020202);
      --color-dark: #000000;
      --color-light: #fff7f7;
      --color-white: #ffffff;
      --color-red: #ff7a85d2;
      --color-red-light: #ffa7a7;
      --color-shadow-dark: rgb(31, 53, 31);
      --color-shadow-text: rgb(0 0 0 / 65%);
      --color-accent-bg: #ffa7ad4f;
      --shadow-light: -5px -5px 9px rgb(66, 48, 48);
      --shadow-dark: 5px 5px 9px rgb(128, 97, 97);
      --shadow-bar: -5px -5px 9px rgb(77 45 45 / 45%), 5px 5px 9px rgb(39 39 39);
      position: relative;
    }

    .${scopeClass}-theme .${scopeClass}-card {
      border-radius: 16px;
      padding: 12px 12px 14px 12px;
      width: 324px;
      max-width: 90vw;
      background: var(--color-dark);
      position: relative;
      transition-duration: 0.2s;
      user-select: none;
      box-sizing: border-box;
    }

    .${scopeClass}-card:before,
    .${scopeClass}-card:after {
      content: "";
      position: absolute;
      left: 0px;
      top: 0px;
      border-radius: 16px;
      background: linear-gradient(
        45deg,
        #fa0a0a,
        #eb021d,
        #f17917,
        #e763dc,
        #b96565,
        #e0d18b,
        #df6a0b,
        #956df3,
        #b15a65,
        #f5d103
      );
      background-size: 400%;
      width: 100%;
      height: 100%;
      z-index: -1;
      animation: ${scopeClass}-steam 40s linear infinite;
    }

    @keyframes ${scopeClass}-steam {
      0% {
        background-position: 0 0;
      }
      50% {
        background-position: 400% 0;
      }
      100% {
        background-position: 0 0;
      }
    }

    .${scopeClass}-card:after {
      filter: blur(20px);
    }

    .${scopeClass}-theme .${scopeClass}-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .${scopeClass}-theme .${scopeClass}-bar-label {
      text-shadow: 1px 1px 3px var(--color-shadow-text);
      font-size: 11px;
      font-weight: 700;
      color: var(--color-light);
    }

    .${scopeClass}-theme .${scopeClass}-flex .${scopeClass}-tag {
      fill: var(--color-white);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 25px;
      width: 25px;
      box-shadow: 4px 4px 3px var(--color-shadow-dark);
      border-radius: 4px;
    }

    .${scopeClass}-theme .${scopeClass}-flex .${scopeClass}-tag svg {
      width: 17px;
      height: 17px;
      fill: #ffffff;
    }

    .${scopeClass}-theme .${scopeClass}-bg-custom {
      background: var(--color-dark-subtle);
      padding: 16px;
      margin-bottom: 10px;
      border-radius: 10px;
      box-shadow:
        inset var(--shadow-light),
        inset var(--shadow-dark);
    }

    .${scopeClass}-theme .${scopeClass}-pr-day {
      position: absolute;
      top: -24px;
      font-size: 11px;
      font-weight: 700;
      color: var(--color-white);
      white-space: nowrap;
    }

    .${scopeClass}-theme .${scopeClass}-text-red {
      color: var(--color-red-light);
    }

    .${scopeClass}-theme .${scopeClass}-text-light {
      color: var(--color-light);
    }

    .${scopeClass}-theme .${scopeClass}-text-green {
      color: var(--color-white);
    }

    .${scopeClass}-theme .${scopeClass}-card .${scopeClass}-heading {
      margin: 0;
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: var(--color-light);
      text-shadow: 4px 4px 3px var(--color-shadow-dark);
      text-transform: uppercase;
    }

    .${scopeClass}-theme .${scopeClass}-amount {
      font-size: 28px;
      font-weight: bold;
      margin: 8px 0;
      line-height: 1.2;
      text-shadow: 4px 4px 3px var(--color-shadow-dark);
      display: inline-flex;
      align-items: center;
      font-variant-numeric: tabular-nums;
    }

    .${scopeClass}-theme .${scopeClass}-amount .${scopeClass}-main-pr {
      font-size: 12px;
      color: var(--color-red-light);
      margin-left: 8px;
      font-weight: 600;
      background: var(--color-accent-bg);
      border-radius: 5px;
      padding: 2px 6px;
      letter-spacing: 0.5px;
    }

    .${scopeClass}-theme .${scopeClass}-compare {
      font-size: 12px;
      text-shadow: 4px 4px 3px var(--color-shadow-dark);
      letter-spacing: 0.5px;
      line-height: 1.35;
    }

    .${scopeClass}-theme .${scopeClass}-chart {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      width: 100%;
      height: 120px;
      padding: 10px 4px 4px 4px;
      border-radius: 12px;
      box-sizing: border-box;
    }

    .${scopeClass}-theme .${scopeClass}-bar {
      width: 20px;
      font-size: 15px;
      background: var(--color-red);
      color: var(--color-dark);
      border-radius: 4px 4px 0 0;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      position: relative;
      transform: scaleY(0);
      transform-origin: bottom;
      animation: ${scopeClass}-rippleBounce 7.5s ease-in-out infinite;
      box-shadow: var(--shadow-bar);
    }

    @keyframes ${scopeClass}-rippleBounce {
      0%,
      100% {
        transform: scaleY(0.6);
      }
      25% {
        transform: scaleY(1.1);
      }
      50% {
        transform: scaleY(0.8);
      }
      75% {
        transform: scaleY(1.2);
      }
    }

    .${scopeClass}-theme .${scopeClass}-bar:nth-child(1) {
      height: 30px;
      animation-delay: 0.2s;
      background: var(--color-white);
    }

    .${scopeClass}-theme .${scopeClass}-bar:nth-child(2) {
      height: 75px;
      animation-delay: 0.4s;
    }

    .${scopeClass}-theme .${scopeClass}-bar:nth-child(3) {
      height: 48px;
      animation-delay: 0.6s;
      background: var(--color-white);
    }

    .${scopeClass}-theme .${scopeClass}-bar:nth-child(4) {
      height: 80px;
      animation-delay: 0.8s;
    }

    .${scopeClass}-theme .${scopeClass}-bar:nth-child(5) {
      height: 65px;
      animation-delay: 1s;
      background: var(--color-white);
    }

    .${scopeClass}-theme .${scopeClass}-bar:nth-child(6) {
      height: 76px;
      animation-delay: 1.2s;
    }

    .${scopeClass}-theme .${scopeClass}-bar:nth-child(7) {
      height: 56px;
      animation-delay: 1.4s;
      background: var(--color-white);
    }

    .${scopeClass}-theme .${scopeClass}-card .${scopeClass}-more-button {
      font-size: 15px;
      padding: 12px;
      border-radius: 10px;
      color: var(--color-dark);
      border: 0;
      width: 100%;
      margin-top: 10px;
      outline: none;
      background-color: var(--color-white);
      box-shadow: var(--shadow-bar);
      transition: ease all 0.3s;
      cursor: pointer;
      font-weight: 700;
      letter-spacing: 0.3px;
    }

    .${scopeClass}-theme .${scopeClass}-card .${scopeClass}-more-button:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 14px rgba(255, 255, 255, 0.4);
    }

    .${scopeClass}-theme .${scopeClass}-card .${scopeClass}-more-button:active {
      transform: scale(0.95);
    }

    .${scopeClass}-theme .${scopeClass}-tags {
      display: flex;
      margin-bottom: 6px;
      justify-content: flex-end;
      color: var(--color-light);
      font-size: 11px;
      font-weight: 600;
      gap: 5px;
      text-shadow: 2px 3px 3px var(--color-shadow-dark);
    }

    .${scopeClass}-theme .${scopeClass}-tags span {
      padding: 3px 8px;
      background-color: #4d2c2c73;
      border-radius: 4px;
      letter-spacing: 0.4px;
    }

    .${scopeClass}-theme .${scopeClass}-discard-button {
      font-size: 13px;
      padding: 8px 12px;
      border-radius: 8px;
      color: var(--color-red-light);
      border: 1px solid rgba(255, 122, 133, 0.25);
      background: transparent;
      width: 100%;
      margin-top: 8px;
      outline: none;
      transition: ease all 0.25s;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .${scopeClass}-theme .${scopeClass}-discard-button:hover {
      background: rgba(255, 122, 133, 0.12);
      border-color: rgba(255, 122, 133, 0.5);
      color: #ffffff;
    }

    .${scopeClass}-theme .${scopeClass}-discard-button:active {
      transform: scale(0.96);
    }

    .${scopeClass}-close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 26px;
      height: 26px;
      border-radius: 13px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      transition: 0.2s;
      z-index: 10;
    }

    .${scopeClass}-close-btn:hover {
      background: rgba(255, 255, 255, 0.22);
      transform: scale(1.05);
    }
  `;

  return (
    <View style={styles.container}>
      {/* Inyección CSS exacta del componente Lucky Dragon */}
      {/* @ts-ignore */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className={`${scopeClass}-overlay`}>
        <div className={`${scopeClass}-theme`}>
          <div className={`${scopeClass}-card`}>
            {/* Botón opcional de cerrar (X) sin descartar sesión */}
            {onClose && (
              <button
                type="button"
                className={`${scopeClass}-close-btn`}
                onClick={onClose}
                aria-label="Cerrar ventana"
              >
                ✕
              </button>
            )}

            {/* Caja de estadísticas superior (bg-custom) */}
            <div className={`${scopeClass}-bg-custom`}>
              <div className={`${scopeClass}-flex`}>
                <p className={`${scopeClass}-heading`}>Sesión en Curso</p>
                <p
                  className={`${scopeClass}-tag`}
                  dangerouslySetInnerHTML={{ __html: DRAGON_SVG_ICON }}
                />
              </div>

              {/* Cronómetro en vivo */}
              <div className={`${scopeClass}-amount ${scopeClass}-text-green`}>
                <span>{formatearTiempo(segs)}</span>
                <span className={`${scopeClass}-main-pr`}>
                  {porcentaje > 0 ? `${porcentaje}%` : 'EN VIVO'}
                </span>
              </div>

              {/* Comparador / Detalle de la rutina y avance de series */}
              <div className={`${scopeClass}-compare ${scopeClass}-text-light`}>
                {sesionInfo.nombreRutina}
                {sesionInfo.totalSeries > 0
                  ? ` · ${sesionInfo.seriesCompletadas} de ${sesionInfo.totalSeries} series completadas`
                  : ' · Rutina pausada'}
              </div>
            </div>

            {/* Tags de estado */}
            <div className={`${scopeClass}-tags`}>
              <span>EN VIVO</span>
              <span>RECUPERABLE</span>
            </div>

            {/* Gráfico ecualizador con 7 barras animadas (rippleBounce) */}
            <div className={`${scopeClass}-chart`}>
              <div className={`${scopeClass}-bar`}>
                <div className={`${scopeClass}-pr-day`}>L</div>
                <div className={`${scopeClass}-bar-label`}>S1</div>
              </div>
              <div className={`${scopeClass}-bar`}>
                <div className={`${scopeClass}-pr-day ${scopeClass}-text-red`}>M</div>
                <div className={`${scopeClass}-bar-label`}>S2</div>
              </div>
              <div className={`${scopeClass}-bar`}>
                <div className={`${scopeClass}-pr-day`}>M</div>
                <div className={`${scopeClass}-bar-label`}>S3</div>
              </div>
              <div className={`${scopeClass}-bar`}>
                <div className={`${scopeClass}-pr-day ${scopeClass}-text-red`}>J</div>
                <div className={`${scopeClass}-bar-label`}>S4</div>
              </div>
              <div className={`${scopeClass}-bar`}>
                <div className={`${scopeClass}-pr-day`}>V</div>
                <div className={`${scopeClass}-bar-label`}>S5</div>
              </div>
              <div className={`${scopeClass}-bar`}>
                <div className={`${scopeClass}-pr-day ${scopeClass}-text-red`}>S</div>
                <div className={`${scopeClass}-bar-label`}>S6</div>
              </div>
              <div className={`${scopeClass}-bar`}>
                <div className={`${scopeClass}-pr-day`}>D</div>
                <div className={`${scopeClass}-bar-label`}>S7</div>
              </div>
            </div>

            {/* Botón Principal: Reanudar Entrenamiento (more-button idéntico) */}
            <button
              type="button"
              className={`${scopeClass}-more-button`}
              onClick={onReanudar}
            >
              Reanudar Entrenamiento
            </button>

            {/* Botón Secundario Seguro: Descartar Entrenamiento */}
            <button
              type="button"
              className={`${scopeClass}-discard-button`}
              onClick={handleDescartarConfirm}
            >
              <span>🗑 Descartar Entrenamiento</span>
            </button>
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
