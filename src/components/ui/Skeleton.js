import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useColors } from '../../context/ThemeContext';

/**
 * Squelette de chargement : la mise en page finale à moitié transparente,
 * qui pulse. Remplace les ronds "ActivityIndicator" au centre d'un vide :
 * l'utilisateur voit la forme de ce qui va s'afficher, donc il sait où
 * regarder et ne croit pas à un écran vide.
 */
export default function Skeleton({ width = '100%', height = 16, radius = 8, style }) {
  const C = useColors();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: radius, backgroundColor: C.lightGray, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({ base: { alignSelf: 'stretch' } });
