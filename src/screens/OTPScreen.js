import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { sendOtp, verifyOtp, updateProfile, OTP_LENGTH } from '../api/auth';
import { uploadAvatar } from '../api/uploads';

export default function OTPScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const a = t.auth;
  const insets = useSafeAreaInsets();
  const phone = route?.params?.phone ?? '';
  const name = route?.params?.name;
  const email = route?.params?.email;
  const pin = route?.params?.pin;
  const avatarUrl = route?.params?.avatarUrl;
  // 'reset' quand on vient de "PIN oublié" ; 'signup' sinon (inscription).
  const mode = route?.params?.mode ?? (name ? 'signup' : 'reset');
  const [devOtp, setDevOtp] = useState(route?.params?.devOtp);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(59);
  const [canResend, setCanResend] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputs = useRef([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleChange = (val, idx) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setError('');
    if (val && idx < OTP_LENGTH - 1) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
    if (next.every(d => d !== '')) {
      handleVerify(next.join(''));
    }
  };

  const handleVerify = async (code) => {
    if (verifying) return;
    setVerifying(true);
    try {
      await verifyOtp(phone, code, { name, pin, mode });

      // Email et photo ne sont pas gérés par verify-otp : on les pousse sur
      // le profil juste après, une fois la session ouverte.
      //
      // La photo doit d'abord être hébergée : le serveur n'accepte que ses
      // propres adresses et rejetait l'image encodée envoyée telle quelle.
      // Les deux champs partent séparément pour qu'un échec sur la photo
      // n'emporte pas l'adresse e-mail avec lui.
      if (email) {
        try {
          await updateProfile({ email });
        } catch {
          // Le compte est créé, c'est l'essentiel : l'e-mail reste
          // modifiable depuis le profil.
        }
      }
      if (avatarUrl) {
        try {
          const hostedUrl = await uploadAvatar(avatarUrl);
          await updateProfile({ avatarUrl: hostedUrl });
        } catch {
          // Idem : la photo pourra être reprise depuis le profil.
        }
      }
      Animated.spring(successScale, { toValue: 1, friction: 5, useNativeDriver: true }).start(() => {
        setTimeout(() => {
          const returnTo = route?.params?.returnTo;
          if (returnTo) {
            navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: returnTo }] });
          } else {
            navigation.replace('Main');
          }
        }, 800);
      });
    } catch (e) {
      setError(e.status === 401 ? a.otpWrong : e.message);
      setOtp(Array(OTP_LENGTH).fill(''));
      shake();
      inputs.current[0]?.focus();
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setCountdown(59);
    setOtp(Array(OTP_LENGTH).fill(''));
    setError('');
    inputs.current[0]?.focus();
    try {
      const res = await sendOtp(phone);
      setDevOtp(res?.devOtp);
    } catch (e) {
      setError(e.message);
      setCanResend(true);
    }
  };

  const filled = otp.filter(d => d !== '').length;
  const allFilled = filled === OTP_LENGTH;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[S.container, { paddingTop: insets.top }]}>

        {/* Back */}
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>

        {/* Top decoration */}
        <View style={S.decorCircle} />

        <View style={S.content}>
          {/* Icon */}
          <View style={S.iconWrapper}>
            <View style={S.iconBg}>
              <Text style={S.iconEmoji}>📱</Text>
            </View>
          </View>

          <Text style={S.title}>{a.otpTitle}</Text>
          <Text style={S.subtitle}>
            {a.otpSubtitle.replace('{n}', OTP_LENGTH)}{'\n'}
            <Text style={S.phoneHighlight}>{phone}</Text>
          </Text>
          {devOtp ? (
            <Text style={S.devOtpHint}>{a.otpDevHint} {devOtp}</Text>
          ) : null}

          {/* OTP inputs */}
          <Animated.View style={[S.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {otp.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={r => inputs.current[idx] = r}
                style={[
                  S.otpCell,
                  digit !== '' && S.otpCellFilled,
                  error && S.otpCellError,
                  allFilled && !error && S.otpCellSuccess,
                ]}
                value={digit}
                onChangeText={v => handleChange(v, idx)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={idx === 0}
                selectTextOnFocus
                autoComplete={idx === 0 ? 'sms-otp' : 'off'}
                textContentType={idx === 0 ? 'oneTimeCode' : 'none'}
              />
            ))}
          </Animated.View>

          {/* Error message */}
          {error ? (
            <View style={S.errorRow}>
              <Text style={S.errorIcon}>⚠️</Text>
              <Text style={S.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Progress bar */}
          <View style={S.progressBar}>
            <View style={[S.progressFill, { width: `${(filled / OTP_LENGTH) * 100}%` }]} />
          </View>
          <Text style={S.progressLabel}>{filled}/{OTP_LENGTH} {a.otpProgress}</Text>

          {/* Verify button */}
          <TouchableOpacity
            style={[S.verifyBtn, !allFilled && S.verifyBtnDisabled]}
            onPress={() => allFilled && handleVerify(otp.join(''))}
            disabled={!allFilled || verifying}
          >
            {verifying ? (
              <Text style={S.verifyBtnText}>{a.otpVerifying}</Text>
            ) : (
              <Text style={S.verifyBtnText}>{a.otpConfirm}</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={S.resendRow}>
            <Text style={S.resendLabel}>{a.otpNotReceived}</Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResend}>
                <Text style={S.resendLink}>{a.otpResend}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={S.resendCountdown}>
                {a.otpResendIn} <Text style={S.resendCountdownBold}>0:{String(countdown).padStart(2, '0')}</Text>
              </Text>
            )}
          </View>

          {/* Info note */}
          <View style={S.infoNote}>
            <Text style={S.infoNoteIcon}>🔒</Text>
            <Text style={S.infoNoteText}>{a.otpExpiry}</Text>
          </View>
        </View>

        {/* Success overlay */}
        <Animated.View style={[S.successOverlay, { transform: [{ scale: successScale }], opacity: successScale }]}>
          <View style={S.successCircle}>
            <Text style={S.successIcon}>✓</Text>
          </View>
          <Text style={S.successText}>{a.otpSuccess}</Text>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  backBtn: { padding: 20, paddingBottom: 0, alignSelf: 'flex-start' },
  backIcon: { fontSize: 22, color: C.darkGreen },
  decorCircle: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.gold, opacity: 0.08,
  },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 24, alignItems: 'center', gap: 20 },
  iconWrapper: { marginBottom: 4 },
  iconBg: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.darkGreen + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  iconEmoji: { fontSize: 36 },
  title: { fontSize: 28, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 24 },
  phoneHighlight: { fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  devOtpHint: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.gold },
  otpRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  otpCell: {
    width: 48, height: 60, borderRadius: 14,
    borderWidth: 2, borderColor: C.mediumGray,
    backgroundColor: C.white,
    fontSize: 28, fontFamily: Fonts.epilogue.bold, color: C.darkGreen,
    textAlign: 'center',
  },
  otpCellFilled: { borderColor: C.darkGreen, backgroundColor: C.darkGreen + '08' },
  otpCellError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  otpCellSuccess: { borderColor: C.darkGreen, backgroundColor: C.darkGreen + '12' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorIcon: { fontSize: 14 },
  errorText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: '#DC2626' },
  progressBar: { width: '100%', height: 4, backgroundColor: C.mediumGray, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.darkGreen, borderRadius: 2 },
  progressLabel: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, alignSelf: 'flex-end' },
  verifyBtn: {
    width: '100%', height: 60, backgroundColor: C.darkGreen,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  verifyBtnDisabled: { backgroundColor: C.mediumGray },
  verifyBtnText: { color: C.white, fontSize: 17, fontFamily: Fonts.manrope.bold },
  resendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  resendLabel: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  resendLink: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.gold },
  resendCountdown: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  resendCountdownBold: { fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  infoNote: {
    flexDirection: 'row', gap: 10, backgroundColor: C.offWhite,
    borderRadius: 12, padding: 14, width: '100%',
  },
  infoNoteIcon: { fontSize: 14 },
  infoNoteText: { flex: 1, fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, lineHeight: 18 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: C.cream,
    justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center',
  },
  successIcon: { fontSize: 44, color: C.white },
  successText: { fontSize: 22, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
});
