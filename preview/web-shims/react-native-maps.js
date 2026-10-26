/**
 * Shim web de react-native-maps — branché par metro.config.js uniquement
 * pour `platform=web` (le build natif garde la vraie lib).
 *
 * Sur le web de développement, aucun tuile cartographique n'est joignable
 * hors ligne : plutôt qu'un module natif qui plante à l'import, on rend un
 * aplat neutre. L'écran reste utilisable — recherche d'adresse et sélection
 * du point continuent de fonctionner (voir ChoixPositionScreen).
 */
import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;

const MapView = forwardRef(function MapViewShim({ children, style, ...rest }, ref) {
  useImperativeHandle(ref, () => ({
    animateToRegion() {},
    animateToCoordinate() {},
    fitToElements() {},
    getMapBoundaries: () => null,
  }));
  return (
    <View style={[styles.map, style]} accessibilityLabel="Carte (aperçu web)">
      <View style={styles.notice}>
        <Text style={styles.noticeIcon}>🗺️</Text>
        <Text style={styles.noticeText}>
          Carte indisponible dans l&apos;aperçu web — utilisez la recherche
          d&apos;adresse ou « Ma position ».
        </Text>
      </View>
      {children}
    </View>
  );
});

const Sub = ({ children, style }) => <View style={style}>{children}</View>;

export const Marker = Sub;
export const Polyline = Sub;
export const Polygon = Sub;
export const Circle = Sub;
export const Callout = Sub;
export const UrlTile = Sub;
export const Heatmap = Sub;

export default MapView;
