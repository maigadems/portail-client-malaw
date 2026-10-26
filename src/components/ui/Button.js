import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, ButtonHeight, MinTouchTarget } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';

/**
 * Bouton de référence de l'app.
 *
 * Une seule prime : l'appui doit être net et impossible à rater (54 px de
 * haut, largeur pleine par défaut). Les variantes ne changent que le
 * contraste — jamais la géométrie, pour que la barre de commande, le
 * login et les états vides aient la même "voix".
 *
 * @param variant primary | secondary | ghost | danger
 * @param size    lg (54) | md (44)
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  style,
  textStyle,
}) {
  const C = useColors();
  const S = styles(C);

  const bg = {
    primary: C.darkGreen,
    secondary: C.greenSoft,
    ghost: 'transparent',
    danger: C.danger,
  }[variant];
  const fg = {
    primary: '#FFFFFF',
    secondary: C.darkGreen,
    ghost: C.darkGreen,
    danger: '#FFFFFF',
  }[variant];

  const height = size === 'lg' ? ButtonHeight : MinTouchTarget;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        S.base,
        { backgroundColor: bg, height, opacity: disabled ? 0.5 : 1 },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: C.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={S.content}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[S.text, { color: fg, fontSize: size === 'lg' ? 16 : 14 }, textStyle]} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={18} color={fg} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = (C) =>
  StyleSheet.create({
    base: {
      borderRadius: 999,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    text: { fontFamily: Fonts.manrope.bold, letterSpacing: 0.2 },
  });
