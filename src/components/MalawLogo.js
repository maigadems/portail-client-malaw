import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

export default function MalawLogo({ size = 40, showText = false, textColor = Colors.darkGreen }) {
  return (
    <View style={styles.row}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={require('../../assets/images/logo-circular.png')}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
      {showText && (
        <Text style={[styles.logoText, { color: textColor }]}>Malaw</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circle: {
    overflow: 'hidden',
  },
  logoText: {
    fontFamily: Fonts.epilogue.black,
    fontSize: 24,
  },
});
