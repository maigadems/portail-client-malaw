import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { sendOtp, PIN_LENGTH } from '../api/auth';
import { useUser, formatPhone } from '../hooks/useUser';

/**
 * « Changer le code PIN » — utilisateur connecté (accessible depuis
 * Paramètres). Le numéro vient de la session ; le nouveau PIN est confirmé
 * par OTP SMS (verify-otp avec `pin` = reset sur téléphone vérifié).
 */
export default function ResetPasswordScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const a = t.auth;
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!user?.phone) { setError(a.sessionRequired); return; }
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) { setError(a.choosePin.replace('{n}', PIN_LENGTH)); return; }
    if (pin !== confirm) { setError(a.pinMismatch); return; }
    setError('');
    setLoading(true);
    try {
      const res = await sendOtp(user.phone);
      navigation.navigate('OTP', { phone: user.phone, pin, mode: 'reset', devOtp: res?.devOtp });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[S.container, { paddingTop: insets.top }]}>
        <View style={S.decorCircle} />
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={S.iconBg}>
            <Text style={S.iconEmoji}>🔐</Text>
          </View>
          <Text style={S.title}>{a.pinChangeTitle}</Text>
          <Text style={S.subtitle}>
            {a.pinChangeSubtitle}{'\n'}
            <Text style={S.phoneHighlight}>{formatPhone(user?.phone)}</Text>
          </Text>

          {/* Nouveau PIN */}
          <View style={S.fieldGroup}>
            <Text style={S.fieldLabel}>{a.newPin}</Text>
            <View style={S.inputContainer}>
              <TextInput
                style={[S.input, { flex: 1 }]}
                placeholder={'•'.repeat(PIN_LENGTH)}
                placeholderTextColor={C.placeholder}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                secureTextEntry={!showPin}
                value={pin}
                onChangeText={v => { setPin(v.replace(/\D/g, '')); setError(''); }}
              />
              <TouchableOpacity onPress={() => setShowPin(!showPin)} style={S.eyeBtn}>
                <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.darkGray} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmation */}
          <View style={S.fieldGroup}>
            <Text style={S.fieldLabel}>{a.confirmPin}</Text>
            <View style={S.inputContainer}>
              <TextInput
                style={[S.input, { flex: 1 }]}
                placeholder={'•'.repeat(PIN_LENGTH)}
                placeholderTextColor={C.placeholder}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                secureTextEntry={!showPin}
                value={confirm}
                onChangeText={v => { setConfirm(v.replace(/\D/g, '')); setError(''); }}
              />
            </View>
          </View>

          {error ? <Text style={S.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[S.primaryBtn, loading && S.primaryBtnDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={S.primaryBtnText}>{a.sendCode}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  decorCircle: {
    position: 'absolute', top: -80, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: C.gold, opacity: 0.07,
  },
  backBtn: { padding: 20, paddingBottom: 0, alignSelf: 'flex-start' },
  backIcon: { fontSize: 22, color: C.darkGreen },
  content: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 32, gap: 18, alignItems: 'stretch' },
  iconBg: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.darkGreen + '12',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center',
  },
  iconEmoji: { fontSize: 36 },
  title: { fontSize: 28, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 24 },
  phoneHighlight: { fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  inputContainer: {
    height: 56, backgroundColor: C.offWhite, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: Fonts.manrope.regular, color: C.charcoal },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: '#DC2626' },
  primaryBtn: {
    width: '100%', height: 58, backgroundColor: C.darkGreen,
    borderRadius: 100, justifyContent: 'center', alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
});
