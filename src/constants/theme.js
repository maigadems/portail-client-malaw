export const Colors = {
  // Primaires
  darkGreen: '#012D1D',
  topBarGreen: '#022C22',
  activeGreen: '#064E3B',
  mediumGreen: '#274E3D',
  gold: '#795900',
  activeGold: '#CA8A04',
  lightGold: '#FFC641',
  darkGold: '#5C4300',

  // Neutres
  cream: '#FBF9F5',
  lightGray: '#EAE8E4',
  mediumGray: '#E4E2DE',
  darkGray: '#414844',
  charcoal: '#1B1C1A',
  placeholder: '#717973',
  border: '#C1C8C2',

  // Backgrounds
  white: '#FFFFFF',
  offWhite: '#F5F3EF',
  cardBg: '#F5F3EF',

  // Status
  success: '#012D1D',
  emerald: '#ECFDF5',

  // Sémantique (ajouts — non destructifs)
  positive: '#16A34A',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#D97706',
  goldSoft: '#FDF3D7',
  greenSoft: '#E7F0EB',
};

export const DarkColors = {
  // Primaires — inchangés (vert foncé reste cohérent)
  darkGreen: '#1A5C3A',
  topBarGreen: '#0D1F17',
  activeGreen: '#22543D',
  mediumGreen: '#2D6A4F',
  gold: '#CA8A04',
  activeGold: '#F59E0B',
  lightGold: '#FFC641',
  darkGold: '#92400E',

  // Neutres
  cream: '#0F1A14',
  lightGray: '#1E2D24',
  mediumGray: '#263320',
  darkGray: '#A8B5AC',
  charcoal: '#E8EDE9',
  placeholder: '#8A9E90',
  border: '#2E4035',

  // Backgrounds
  white: '#162219',
  offWhite: '#1A2A1F',
  cardBg: '#1A2A1F',

  // Status
  success: '#1A5C3A',
  emerald: '#0D2B1A',

  // Sémantique
  positive: '#4ADE80',
  danger: '#F87171',
  dangerSoft: '#3B1515',
  warning: '#FBBF24',
  goldSoft: '#2E2610',
  greenSoft: '#14331F',
};

export function getColors(isDark) {
  return isDark ? DarkColors : Colors;
}

export const Fonts = {
  epilogue: {
    thin: 'Epilogue_100Thin',
    light: 'Epilogue_300Light',
    regular: 'Epilogue_400Regular',
    medium: 'Epilogue_500Medium',
    semiBold: 'Epilogue_600SemiBold',
    bold: 'Epilogue_700Bold',
    extraBold: 'Epilogue_800ExtraBold',
    black: 'Epilogue_900Black',
  },
  manrope: {
    light: 'Manrope_300Light',
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semiBold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extraBold: 'Manrope_800ExtraBold',
  },
};

/**
 * Échelle typographique — la référence pour tout nouvel écran.
 * Les écrans historiques gardent leurs styles inline : ces jetons servent
 * à ce qu'on écrit désormais, pour qu'un titre se ressemble d'un écran
 * à l'autre sans y penser.
 */
export const Type = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: Fonts.epilogue.bold },
  title: { fontSize: 24, lineHeight: 30, fontFamily: Fonts.epilogue.bold },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: Fonts.epilogue.bold },
  subheading: { fontSize: 15, lineHeight: 21, fontFamily: Fonts.manrope.semiBold },
  body: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.manrope.regular },
  bodyBold: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.manrope.bold },
  label: { fontSize: 12, lineHeight: 16, fontFamily: Fonts.manrope.semiBold },
  caption: { fontSize: 11, lineHeight: 15, fontFamily: Fonts.manrope.medium },
  price: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.epilogue.bold },
};

/** Rayons "modernes" : carte 20, bottom-sheet 28, pill. */
export const RadiusSheet = 28;
export const RadiusCard = 20;

/** Hauteur canonique des gros boutons et cible tactile minimale (pouce). */
export const ButtonHeight = 54;
export const MinTouchTarget = 44;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};
