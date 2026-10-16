import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FontScale = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type SpaceScale = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

export type Layout = {
  /** Screen width (reactive, updates on rotate/resize) */
  width: number;
  /** Screen height (reactive) */
  height: number;
  /** true when width > height */
  isLandscape: boolean;
  /** true when width < 380 px (narrow mobile phones) */
  isCompact: boolean;
  /** true when width >= 768 px (tablet / desktop) */
  isTablet: boolean;
  /**
   * Horizontal padding for screen edges.
   * 16 on compact, 20 on phone, 24+ on tablet.
   * Always >= insets.left/right so notch is respected in landscape.
   */
  gutter: number;
  /**
   * Maximum content width for centered layouts (tablet/landscape).
   * In portrait phone: equals `width` (full width).
   */
  contentMaxWidth: number;
  /** Safe-area inset at the top (status bar / Dynamic Island) */
  topInset: number;
  /** Safe-area inset at the bottom (home indicator) */
  bottomInset: number;
  /** Minimum safe bottom padding that guarantees clearance over home indicator */
  safeBottom: number;
  /** Safe-area inset at the left (notch in landscape) */
  leftInset: number;
  /** Safe-area inset at the right (notch in landscape) */
  rightInset: number;
  /** Reactive keyboard height (supports web visualViewport and native) */
  keyboardHeight: number;
  /** true if virtual keyboard is open */
  isKeyboardVisible: boolean;
  /** Typography scale (slightly adjusted on isCompact) */
  fontScale: FontScale;
  /** Spacing scale */
  spaceScale: SpaceScale;
};

/**
 * Central hook for responsive layout across Rutinia.
 * Uses `useWindowDimensions()` (reactive) instead of `Dimensions.get` (static).
 * All screens and components should call this instead of hard-coding px values.
 */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const isLandscape = width > height;
  const isCompact = width < 380;
  const isTablet = width >= 768;

  // Gutter: 16 in compact, 20 normal, 24+ in tablet. Must respect lateral notch.
  const baseGutter = isCompact ? 16 : isTablet ? 24 : 20;
  const gutter = Math.max(baseGutter, insets.left, insets.right);

  // Content max width: ~720 centered on tablet/landscape, full width on portrait mobile
  const contentMaxWidth = isTablet || isLandscape ? Math.min(width - gutter * 2, 720) : width;

  // Safe bottom padding for docks and scrollviews
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10);

  // Web visualViewport & Native Keyboard listener
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.visualViewport) return;

      const handleResize = () => {
        if (!window.visualViewport) return;
        const currentVisualHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const diff = Math.max(0, windowHeight - currentVisualHeight);
        // Only consider it a keyboard if difference is significant (> 120px)
        setKeyboardHeight(diff > 120 ? diff : 0);
      };

      const vv = window.visualViewport;
      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize);
      return () => {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      };
    } else {
      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e) => setKeyboardHeight(e.endCoordinates.height)
      );
      const hideSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => setKeyboardHeight(0)
      );
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }
  }, []);

  const fontScale: FontScale = {
    xs: isCompact ? 10 : 11,
    sm: isCompact ? 12 : 13,
    md: isCompact ? 14 : 15,
    lg: isCompact ? 17 : 18,
    xl: isCompact ? 19 : 21,
    xxl: isCompact ? 23 : 25,
  };

  const spaceScale: SpaceScale = {
    xs: isCompact ? 4 : 6,
    sm: isCompact ? 8 : 10,
    md: isCompact ? 12 : 14,
    lg: isCompact ? 16 : 18,
    xl: isCompact ? 20 : 24,
  };

  return {
    width,
    height,
    isLandscape,
    isCompact,
    isTablet,
    gutter,
    contentMaxWidth,
    topInset: insets.top,
    bottomInset: insets.bottom,
    safeBottom,
    leftInset: insets.left,
    rightInset: insets.right,
    keyboardHeight,
    isKeyboardVisible: keyboardHeight > 0,
    fontScale,
    spaceScale,
  };
}
