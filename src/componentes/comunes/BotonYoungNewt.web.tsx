import { useId } from 'react';
import { StyleSheet, View } from 'react-native';

const SPARKLE_PATH =
  'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z';

export interface YoungNewtButtonProps {
  title?: string;
  loadingTitle?: string;
  loading?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  highlightHue?: string; // e.g. "210deg" or "32deg"
  /** Ocupa todo el ancho disponible. No altera la animación ni los colores originales. */
  fullWidth?: boolean;
}

export default function BotonYoungNewtWeb({
  title = 'Añadir al Día',
  loadingTitle = 'Añadiendo...',
  loading = false,
  onPress,
  disabled = false,
  highlightHue = '210deg',
  fullWidth = false,
}: YoungNewtButtonProps) {
  const uniqueId = useId().replace(/:/g, '');
  const scopeClass = `yn-btn-${uniqueId}`;
  const displayText = loading ? loadingTitle : title;
  const letters = displayText.split('');

  const css = `
    .${scopeClass}-wrapper {
      position: relative;
      display: inline-block;
    }

    .${scopeClass}-btn {
      --border-radius: 24px;
      --padding: 4px;
      --transition: 0.4s;
      --button-color: #101010;
      --highlight-color-hue: ${highlightHue};

      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 190px;
      padding: 0.5em 0.85em 0.5em 0.9em;
      font-family: "Poppins", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.95em;
      font-weight: 500;
      line-height: 1;

      background-color: var(--button-color);

      box-shadow:
        inset 0px 1px 1px rgba(255, 255, 255, 0.2),
        inset 0px 2px 2px rgba(255, 255, 255, 0.15),
        inset 0px 4px 4px rgba(255, 255, 255, 0.1),
        inset 0px 8px 8px rgba(255, 255, 255, 0.05),
        inset 0px 16px 16px rgba(255, 255, 255, 0.05),
        0px -1px 1px rgba(0, 0, 0, 0.02),
        0px -2px 2px rgba(0, 0, 0, 0.03),
        0px -4px 4px rgba(0, 0, 0, 0.05),
        0px -8px 8px rgba(0, 0, 0, 0.06),
        0px -16px 16px rgba(0, 0, 0, 0.08);

      border: solid 1px rgba(255, 255, 255, 0.13);
      border-radius: var(--border-radius);
      cursor: pointer;
      position: relative;
      outline: none;

      transition:
        box-shadow var(--transition),
        border var(--transition),
        background-color var(--transition);
    }

    .${scopeClass}-btn::before {
      content: "";
      position: absolute;
      top: calc(0px - var(--padding));
      left: calc(0px - var(--padding));
      width: calc(100% + var(--padding) * 2);
      height: calc(100% + var(--padding) * 2);
      border-radius: calc(var(--border-radius) + var(--padding));
      pointer-events: none;
      background-image: linear-gradient(0deg, #0004, #000a);

      z-index: -1;
      transition:
        box-shadow var(--transition),
        filter var(--transition);
      box-shadow:
        0 -8px 8px -6px #0000 inset,
        0 -16px 16px -8px #00000000 inset,
        1px 1px 1px #fff2,
        2px 2px 2px #fff1,
        -1px -1px 1px #0002,
        -2px -2px 2px #0001;
    }

    .${scopeClass}-btn::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      pointer-events: none;
      background-image: linear-gradient(
        0deg,
        #fff,
        hsl(var(--highlight-color-hue), 100%, 70%),
        hsla(var(--highlight-color-hue), 100%, 70%, 50%),
        8%,
        transparent
      );
      background-position: 0 0;
      opacity: 0;
      transition:
        opacity var(--transition),
        filter var(--transition);
    }

    .${scopeClass}-letter {
      position: relative;
      display: inline-block;
      color: rgba(255, 255, 255, 0.4);
      animation: ${scopeClass}-letter-anim 2s ease-in-out infinite;
      transition:
        color var(--transition),
        text-shadow var(--transition),
        opacity var(--transition);
    }

    @keyframes ${scopeClass}-letter-anim {
      50% {
        text-shadow: 0 0 3px #fff8;
        color: #fff;
      }
    }

    .${scopeClass}-svg {
      flex-shrink: 0;
      height: 19px;
      width: 19px;
      margin-right: 0.5rem;
      fill: #e8e8e8;
      animation: ${scopeClass}-flicker 2s linear infinite;
      animation-delay: 0.5s;
      filter: drop-shadow(0 0 2px #fff9);
      transition:
        fill var(--transition),
        filter var(--transition),
        opacity var(--transition);
    }

    @keyframes ${scopeClass}-flicker {
      50% {
        opacity: 0.3;
      }
    }

    /* Hover state */
    .${scopeClass}-btn:hover {
      border: solid 1px hsla(var(--highlight-color-hue), 100%, 80%, 40%);
    }

    .${scopeClass}-btn:hover::before {
      box-shadow:
        0 -8px 8px -6px #fffa inset,
        0 -16px 16px -8px hsla(var(--highlight-color-hue), 100%, 70%, 30%) inset,
        1px 1px 1px #fff2,
        2px 2px 2px #fff1,
        -1px -1px 1px #0002,
        -2px -2px 2px #0001;
    }

    .${scopeClass}-btn:hover::after {
      opacity: 1;
      mask-image: linear-gradient(0deg, #fff, transparent);
    }

    .${scopeClass}-btn:hover .${scopeClass}-svg {
      fill: #fff;
      filter: drop-shadow(0 0 3px hsl(var(--highlight-color-hue), 100%, 70%))
        drop-shadow(0 -4px 6px #0009);
      animation: none;
    }

    /* Active state */
    .${scopeClass}-btn:active {
      border: solid 1px hsla(var(--highlight-color-hue), 100%, 80%, 70%);
      background-color: hsla(var(--highlight-color-hue), 50%, 20%, 0.5);
    }

    .${scopeClass}-btn:active::before {
      box-shadow:
        0 -8px 12px -6px #fffa inset,
        0 -16px 16px -8px hsla(var(--highlight-color-hue), 100%, 70%, 80%) inset,
        1px 1px 1px #fff4,
        2px 2px 2px #fff2,
        -1px -1px 1px #0002,
        -2px -2px 2px #0001;
    }

    .${scopeClass}-btn:active::after {
      opacity: 1;
      mask-image: linear-gradient(0deg, #fff, transparent);
      filter: brightness(200%);
    }

    .${scopeClass}-btn:active .${scopeClass}-letter {
      text-shadow: 0 0 1px hsla(var(--highlight-color-hue), 100%, 90%, 90%);
      animation: none;
    }
  `;

  return (
    <View style={[styles.container, fullWidth && styles.containerFull]}>
      {/* Inyección de las reglas CSS exactas de Uiverse */}
      {/* @ts-ignore */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div
        className={`${scopeClass}-wrapper`}
        style={fullWidth ? { display: 'block', width: '100%' } : undefined}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onPress}
          className={`${scopeClass}-btn`}
          style={fullWidth ? { width: '100%' } : undefined}
        >
          <svg
            className={`${scopeClass}-svg`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={SPARKLE_PATH} />
          </svg>

          <span style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
            {letters.map((char, index) => (
              <span
                key={`${char}-${index}`}
                className={`${scopeClass}-letter`}
                style={{
                  animationDelay: `${(index * 0.08).toFixed(2)}s`,
                  whiteSpace: char === ' ' ? 'pre' : 'normal',
                }}
              >
                {char}
              </span>
            ))}
          </span>
        </button>
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerFull: {
    alignItems: 'stretch',
    width: '100%',
  },
});
