// app/hooks/useCollapsibleHeader.js
// Hides the header when scrolling down, brings it back (pinned at the
// top) as soon as the user scrolls up even slightly — the header never
// has to be scrolled all the way back to the top to reappear.
import { useRef } from 'react';
import { Animated } from 'react-native';

export function useCollapsibleHeader(headerHeight) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const onScroll = (e) => {
    const y = Math.max(0, e.nativeEvent.contentOffset.y);
    const diff = y - lastOffset.current;

    if (y <= 4) {
      // Back at the very top — always fully show, no snapping needed
      Animated.timing(translateY, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    } else if (diff > 6) {
      // Scrolling down with some intent — hide
      Animated.timing(translateY, { toValue: -headerHeight, duration: 220, useNativeDriver: true }).start();
    } else if (diff < -6) {
      // Scrolling up with some intent — reveal, pinned at top
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
    lastOffset.current = y;
  };

  return { translateY, onScroll };
}
