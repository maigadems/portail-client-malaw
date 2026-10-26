import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import MalawLogo from '../components/MalawLogo';
import GoogleLogo from '../components/GoogleLogo';
import { login, PIN_LENGTH } from '../api/auth';

export default function ConnexionScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const a = t.auth;
  const insets = useSafeAreaInsets();
  const [telephone, setTelephone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Connexion directe téléphone + PIN : aucune vérification OTP à cette étape.
  const handleLogin = async () => {
    const digits = telephone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError(a.invalidPhone);
      return;
    }
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
      setError(a.invalidPin.replace('{n}', PIN_LENGTH));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const phone = `+221${digits.startsWith('221') ? digits.slice(3) : digits}`;
      await login(phone, pin);
      // Retour à l'écran qui a exigé la connexion (ex. checkout) — un
      // client renvoyé sur l'accueil perdait son panier de vue.
      const returnTo = route?.params?.returnTo;
      if (returnTo) {
        navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: returnTo }] });
      } else {
        navigation.replace('Main');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[S.container, { paddingTop: insets.top }]}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Background decorative elements */}
        <View style={S.bgDecorGreen} />
        <View style={S.bgDecorGold} />

        {/* Culinary visual element */}
        <View style={S.culinaryVisual}>
          <Text style={S.culinaryEmoji}>🥘</Text>
        </View>

        {/* Logo section */}
        <View style={S.logoSection}>
          <View style={S.logoBgWhite}>
            <MalawLogo size={72} />
          </View>
          <Text style={S.welcomeTitle}>{a.welcomeTitle}</Text>
          <Text style={S.welcomeSubtext}>{a.welcomeSubtext}</Text>
        </View>

        {/* Form card */}
        <View style={S.formCard}>
          {/* Phone field — l'auth Malaw se fait par SMS (OTP), pas par mot de passe */}
          <View style={S.fieldGroup}>
            <Text style={S.fieldLabel}>{a.phone}</Text>
            <View style={S.phoneRow}>
              <View style={S.phoneFlagContainer}>
                <Text style={S.phoneFlag}>🇸🇳 +221</Text>
              </View>
              <View style={[S.inputContainer, { flex: 1 }]}>
                <TextInput
                  style={S.input}
                  placeholder={a.phonePlaceholder}
                  placeholderTextColor={C.placeholder}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  value={telephone}
                  onChangeText={(v) => { setTelephone(v); setError(''); }}
                />
              </View>
            </View>
          </View>

          {/* PIN field */}
          <View style={S.fieldGroup}>
            <View style={S.pinLabelRow}>
              <Text style={S.fieldLabel}>{a.pin}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MotDePasseOublie')}>
                <Text style={S.forgotLink}>{a.pinForgotLink}</Text>
              </TouchableOpacity>
            </View>
            <View style={S.inputContainer}>
              <TextInput
                style={[S.input, { flex: 1 }]}
                placeholder={'•'.repeat(PIN_LENGTH)}
                placeholderTextColor={C.placeholder}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                secureTextEntry={!showPin}
                value={pin}
                onChangeText={(v) => { setPin(v.replace(/\D/g, '')); setError(''); }}
              />
              <TouchableOpacity onPress={() => setShowPin(!showPin)} style={S.eyeBtn}>
                <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.darkGray} />
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={S.errorText}>{error}</Text> : null}

          {/* Submit button */}
          <TouchableOpacity
            style={[S.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            accessibilityRole="button"
            accessibilityLabel={a.login}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={S.submitBtnText}>{a.login}</Text>}
          </TouchableOpacity>

          {/* Créer un compte */}
          <TouchableOpacity
            style={S.createAccountBtn}
            onPress={() => navigation.navigate('Inscription', { returnTo: route?.params?.returnTo })}
          >
            <Text style={S.createAccountBtnText}>{a.signupLink}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={S.divider}>
            <View style={S.dividerLine} />
            <View style={S.dividerTextBg}>
              <Text style={S.dividerText}>{a.orContinueWith}</Text>
            </View>
            <View style={S.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={S.socialRow}>
            <TouchableOpacity style={S.socialBtn}>
              <GoogleLogo size={18} />
              <Text style={S.socialBtnText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.socialBtn}>
              <Ionicons name="logo-apple" size={20} color={C.charcoal} />
              <Text style={S.socialBtnText}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footerLinks}>
          <Text style={S.footerText}>{a.noAccount}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Inscription', { returnTo: route?.params?.returnTo })} accessibilityRole="link">
            <Text style={S.footerLink}>{a.signupLink}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    minHeight: '100%',
    justifyContent: 'center',
  },
  bgDecorGreen: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 384,
    height: 384,
    borderRadius: 192,
    backgroundColor: C.darkGreen,
    opacity: 0.06,
  },
  bgDecorGold: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 384,
    height: 384,
    borderRadius: 192,
    backgroundColor: C.gold,
    opacity: 0.06,
  },
  culinaryVisual: {
    position: 'absolute',
    top: 40,
    right: 24,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  culinaryEmoji: {
    fontSize: 56,
  },
  logoSection: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
    width: '100%',
  },
  logoBgWhite: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    color: C.gold,
    fontSize: 28,
    fontFamily: Fonts.epilogue.black,
  },
  welcomeTitle: {
    fontSize: 36,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  welcomeSubtext: {
    fontSize: 14,
    fontFamily: Fonts.manrope.medium,
    color: C.darkGray,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 32,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLink: {
    fontSize: 12,
    fontFamily: Fonts.manrope.semiBold,
    color: C.gold,
  },
  phoneFlagContainer: {
    height: 56,
    backgroundColor: C.offWhite,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  phoneFlag: {
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.charcoal,
  },
  eyeBtn: {
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
    color: '#DC2626',
  },
  inputContainer: {
    height: 56,
    backgroundColor: C.offWhite,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.manrope.regular,
    color: C.charcoal,
  },
  submitBtn: {
    height: 60,
    backgroundColor: C.darkGreen,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: C.white,
    fontSize: 18,
    fontFamily: Fonts.epilogue.bold,
  },
  createAccountBtn: {
    height: 60,
    backgroundColor: C.cream,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountBtnText: {
    color: C.darkGreen,
    fontSize: 18,
    fontFamily: Fonts.epilogue.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.mediumGray,
  },
  dividerTextBg: {
    backgroundColor: C.white,
    paddingHorizontal: 8,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGray,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.offWhite,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialBtnText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.charcoal,
  },
  footerLinks: {
    flexDirection: 'row',
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontFamily: Fonts.manrope.medium,
    color: C.darkGray,
  },
  footerLink: {
    fontSize: 16,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
  },
});
