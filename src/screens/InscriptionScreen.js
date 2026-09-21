import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import MalawLogo from '../components/MalawLogo';
import GoogleLogo from '../components/GoogleLogo';
import { sendOtp, PIN_LENGTH } from '../api/auth';
import { pickAvatar } from '../utils/pickAvatar';

export default function InscriptionScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const a = t.auth;
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', pin: '' });
  const [avatar, setAvatar] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePickAvatar = async () => {
    try {
      const uri = await pickAvatar();
      if (uri) setAvatar(uri);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSignup = async () => {
    if (!form.nom.trim()) {
      setError(a.nameRequired);
      return;
    }
    const digits = form.telephone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError(a.invalidPhone);
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError(a.invalidEmail);
      return;
    }
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(form.pin)) {
      setError(a.choosePin.replace('{n}', PIN_LENGTH));
      return;
    }
    if (!accepted) {
      setError(a.acceptCgu);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const phone = `+221${digits.startsWith('221') ? digits.slice(3) : digits}`;
      const res = await sendOtp(phone);
      navigation.navigate('OTP', {
        phone,
        name: form.nom.trim(),
        email: form.email.trim() || undefined,
        pin: form.pin,
        avatarUrl: avatar || undefined,
        mode: 'signup',
        devOtp: res?.devOtp,
      });
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
        {/* Background decorations */}
        <View style={S.bgDecorGold} />
        <View style={S.bgDecorGreen} />

        {/* Retour vers Connexion */}
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.navigate('Connexion')}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>

        {/* Logo */}
        <View style={S.logoContainer}>
          <MalawLogo size={80} />
        </View>

        {/* Header text */}
        <View style={S.headerContent}>
          <Text style={S.heading}>{a.signupTitle}</Text>
          <Text style={S.subtext}>{a.signupSubtext}</Text>
        </View>

        {/* Form card */}
        <View style={S.formCard}>
          {/* Photo de profil (optionnelle) */}
          <View style={S.avatarPickerWrap}>
            <TouchableOpacity style={S.avatarPicker} onPress={handlePickAvatar}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={S.avatarPreview} />
              ) : (
                <Text style={S.avatarPickerIcon}>📷</Text>
              )}
              <View style={S.avatarPickerBadge}>
                <Text style={S.avatarPickerBadgeText}>{avatar ? '✎' : '+'}</Text>
              </View>
            </TouchableOpacity>
            <Text style={S.avatarPickerLabel}>{a.avatarLabel}</Text>
          </View>

          {/* Nom complet */}
          <View style={S.fieldGroup}>
            <Text style={S.fieldLabel}>Nom complet</Text>
            <View style={S.inputContainer}>
              <TextInput
                style={S.input}
                placeholder={a.fullNamePlaceholder}
                placeholderTextColor={C.placeholder}
                autoComplete="name"
                textContentType="name"
                value={form.nom}
                onChangeText={(v) => setForm({ ...form, nom: v })}
              />
            </View>
          </View>

          {/* Email */}
          <View style={S.fieldGroup}>
            <Text style={S.fieldLabel}>{a.email}</Text>
            <View style={S.inputContainer}>
              <TextInput
                style={S.input}
                placeholder={a.emailPlaceholder}
                placeholderTextColor={C.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
              />
            </View>
          </View>

          {/* Téléphone */}
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
                  value={form.telephone}
                  onChangeText={(v) => setForm({ ...form, telephone: v })}
                />
              </View>
            </View>
          </View>

          {/* Code PIN — remplace le mot de passe, servira à la connexion */}
          <View style={S.fieldGroup}>
            <Text style={S.fieldLabel}>{a.pinLabel.replace('{n}', PIN_LENGTH)}</Text>
            <View style={S.inputContainer}>
              <TextInput
                style={[S.input, { flex: 1 }]}
                placeholder={'•'.repeat(PIN_LENGTH)}
                placeholderTextColor={C.placeholder}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                secureTextEntry={!showPin}
                value={form.pin}
                onChangeText={(v) => setForm({ ...form, pin: v.replace(/\D/g, '') })}
              />
              <TouchableOpacity onPress={() => setShowPin(!showPin)} style={S.eyeBtn}>
                <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.darkGray} />
              </TouchableOpacity>
            </View>
            <Text style={S.pinHelper}>{a.pinHelper}</Text>
          </View>

          {/* CGU */}
          <TouchableOpacity style={S.cguRow} onPress={() => setAccepted(!accepted)}>
            <View style={[S.checkbox, accepted && S.checkboxActive]}>
              {accepted && <Text style={S.checkmark}>✓</Text>}
            </View>
            <Text style={S.cguText}>
              {a.cguPrefix}<Text style={S.cguLink}>{a.cguTerms}</Text>{a.cguAnd}<Text style={S.cguLink}>{a.cguPrivacy}</Text>
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={S.divider}>
            <View style={S.dividerLine} />
            <Text style={S.dividerText}>{a.orContinueWith}</Text>
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

          {error ? <Text style={S.errorText}>{error}</Text> : null}

          {/* Submit — envoie l'OTP puis passe à la vérification SMS */}
          <TouchableOpacity
            style={[S.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <>
                <Text style={S.submitBtnText}>{a.signup}</Text>
                <Text style={S.submitBtnArrow}>→</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer link */}
        <TouchableOpacity
          style={S.footerLink}
          onPress={() => navigation.navigate('Connexion')}
        >
          <Text style={S.footerLinkText}>
            {a.hasAccount}<Text style={S.footerLinkBold}>{a.loginLink}</Text>
          </Text>
        </TouchableOpacity>

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
  },
  bgDecorGold: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: C.gold,
    opacity: 0.06,
  },
  bgDecorGreen: {
    position: 'absolute',
    top: -50,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: C.darkGreen,
    opacity: 0.05,
  },
  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: 8 },
  backIcon: { fontSize: 22, color: C.darkGreen },
  logoContainer: {
    marginBottom: 16,
  },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.darkGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoLetter: {
    color: C.gold,
    fontSize: 36,
    fontFamily: Fonts.epilogue.black,
  },
  headerContent: {
    width: '100%',
    marginBottom: 24,
  },
  heading: {
    fontSize: 36,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    fontFamily: Fonts.manrope.medium,
    color: C.darkGray,
    lineHeight: 24,
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
  avatarPickerWrap: {
    alignItems: 'center',
    gap: 8,
  },
  avatarPicker: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPreview: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPickerIcon: {
    fontSize: 32,
  },
  avatarPickerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.white,
  },
  avatarPickerBadgeText: {
    color: C.white,
    fontSize: 13,
    fontFamily: Fonts.manrope.bold,
  },
  avatarPickerLabel: {
    fontSize: 12,
    fontFamily: Fonts.manrope.semiBold,
    color: C.darkGray,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: Fonts.manrope.semiBold,
    color: C.darkGold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    height: 56,
    backgroundColor: C.mediumGray,
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
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phoneFlagContainer: {
    height: 56,
    backgroundColor: C.mediumGray,
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
  pinHelper: {
    fontSize: 12,
    fontFamily: Fonts.manrope.regular,
    color: C.darkGray,
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
    color: '#DC2626',
  },
  cguRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: C.mediumGray,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: C.darkGreen,
    borderColor: C.darkGreen,
  },
  checkmark: {
    color: C.white,
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
  },
  cguText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: C.darkGray,
    lineHeight: 22,
  },
  cguLink: {
    color: C.darkGreen,
    fontFamily: Fonts.manrope.semiBold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.mediumGray,
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
  submitBtn: {
    height: 56,
    backgroundColor: C.darkGreen,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  submitBtnText: {
    color: C.white,
    fontSize: 16,
    fontFamily: Fonts.manrope.bold,
  },
  submitBtnArrow: {
    color: C.white,
    fontSize: 16,
  },
  footerLink: {
    marginTop: 24,
  },
  footerLinkText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: C.darkGray,
  },
  footerLinkBold: {
    color: C.darkGreen,
    fontFamily: Fonts.manrope.bold,
  },
});
