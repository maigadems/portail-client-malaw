import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';
import Button from './Button';

/**
 * État de liste unifié : chargement, erreur avec relance, ou vide —
 * toujours centré, toujours avec la même respiration.
 *
 * `onAction` absent : pas de bouton (état vide pur). `loading` rend un
 * simple indicateur : les squelettes (Skeleton) couvrent le cas où la
 * forme des données est connue d'avance.
 */
export default function StateView({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
  loading = false,
  children,
  style,
}) {
  const C = useColors();
  const S = styles(C);

  if (loading) {
    return (
      <View style={[S.wrap, style]}>
        <Ionicons name="hourglass-outline" size={34} color={C.placeholder} />
        <Text style={S.message}>{message ?? title}</Text>
      </View>
    );
  }

  return (
    <View style={[S.wrap, style]}>
      <View style={S.iconCircle}>
        <Ionicons name={icon} size={30} color={C.darkGreen} />
      </View>
      {title ? <Text style={S.title}>{title}</Text> : null}
      {message ? <Text style={S.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" size="md" style={S.action} />
      ) : null}
      {children}
    </View>
  );
}

const styles = (C) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 32 },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.greenSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    title: { fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
    message: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
    action: { marginTop: 8, alignSelf: 'center', paddingHorizontal: 32 },
  });
