import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getColors, Fonts } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import MalawLogo from '../components/MalawLogo';
import { useUser, formatPhone } from '../hooks/useUser';
import { logout } from '../api/auth';
import { Alert } from '../components/AppAlert';

const LANGUAGES = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];

const VERSION = '1.0.0 (build 42)';

// Composants définis au niveau module (PAS dans le corps de l'écran) : sinon
// ils seraient recréés à chaque render et tous les Switch seraient remontés,
// d'où le "saut" visible des autres toggles quand on en actionne un. On leur
// passe Colors/s en props puisqu'ils en dépendent.
function Section({ Colors, title, children }) {
  const S = styles(Colors);
  return (
    <View style={S.section}>
      <Text style={S.sectionTitle}>{title}</Text>
      <View style={S.sectionCard}>{children}</View>
    </View>
  );
}

function RowLink({ Colors, icon, label, value, onPress, danger }) {
  const S = styles(Colors);
  return (
    <TouchableOpacity style={S.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? '#DC2626' : Colors.charcoal} style={S.rowIcon} />
      <Text style={[S.rowLabel, danger && S.rowLabelDanger]}>{label}</Text>
      {value && <Text style={S.rowValue}>{value}</Text>}
      <Text style={[S.rowChevron, danger && { color: '#DC2626' }]}>›</Text>
    </TouchableOpacity>
  );
}

function RowInfo({ Colors, notProvided, icon, label, value }) {
  const S = styles(Colors);
  return (
    <View style={S.row}>
      <Ionicons name={icon} size={20} color={Colors.charcoal} style={S.rowIcon} />
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowValue}>{value || notProvided}</Text>
    </View>
  );
}

function RowSwitch({ Colors, icon, label, value, onToggle, disabled, soon }) {
  const S = styles(Colors);
  return (
    <View style={[S.row, disabled && S.rowDisabled]}>
      <Ionicons name={icon} size={20} color={disabled ? Colors.placeholder : Colors.charcoal} style={S.rowIcon} />
      <View style={{ flex: 1 }}>
        <Text style={[S.rowLabel, disabled && S.rowTextDisabled]}>{label}</Text>
        {disabled && <Text style={S.rowComingSoon}>{soon}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onToggle}
        disabled={disabled}
        trackColor={{ false: Colors.border, true: Colors.darkGreen }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

export default function ParametresScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useTheme();
  const { lang, t, setLang } = useLang();
  const Colors = getColors(isDark);
  const s = t.settings;
  const { user } = useUser();

  const handleLogout = async () => {
    await logout();
    navigation.replace('Connexion');
  };

  const [notifOrders, setNotifOrders] = useState(true);
  const [notifPromos, setNotifPromos] = useState(true);
  const [notifSMS, setNotifSMS] = useState(true);

  return (
    <View style={[styles(Colors).container, { paddingTop: insets.top }]}>
      <View style={styles(Colors).header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles(Colors).backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles(Colors).headerTitle}>{s.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 4 }}>

        {/* Account — données réelles de la session */}
        <Section Colors={Colors} title={s.account}>
          <RowInfo Colors={Colors} notProvided={s.notProvided} icon="person-outline" label={s.accountName} value={user?.name} />
          <View style={styles(Colors).rowDivider} />
          <RowInfo Colors={Colors} notProvided={s.notProvided} icon="call-outline" label={s.accountPhone} value={formatPhone(user?.phone)} />
          <View style={styles(Colors).rowDivider} />
          <RowInfo Colors={Colors} notProvided={s.notProvided} icon="mail-outline" label={s.accountEmail} value={user?.email} />
        </Section>

        {/* Language */}
        <Section Colors={Colors} title={s.language}>
          <View style={styles(Colors).langGrid}>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.id}
                style={[styles(Colors).langChip, lang === l.id && styles(Colors).langChipActive]}
                onPress={() => setLang(l.id)}
              >
                <Text style={styles(Colors).langFlag}>{l.flag}</Text>
                <Text style={[styles(Colors).langLabel, lang === l.id && styles(Colors).langLabelActive]}>{l.label}</Text>
                {lang === l.id && <Text style={styles(Colors).langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Notifications */}
        <Section Colors={Colors} title={s.notifications}>
          <RowSwitch Colors={Colors} icon="cube-outline" label={s.notifOrders} value={notifOrders} onToggle={setNotifOrders} />
          <View style={styles(Colors).rowDivider} />
          <RowSwitch Colors={Colors} icon="pricetag-outline" label={s.notifPromos} value={notifPromos} onToggle={setNotifPromos} />
          <View style={styles(Colors).rowDivider} />
          <RowSwitch Colors={Colors} icon="phone-portrait-outline" label={s.notifSMS} value={notifSMS} onToggle={setNotifSMS} />
        </Section>

        {/* Appearance */}
        <Section Colors={Colors} title={s.appearance}>
          <RowSwitch Colors={Colors} icon="moon-outline" label={s.darkMode} value={isDark} onToggle={toggleTheme} />
        </Section>

        {/* Security */}
        <Section Colors={Colors} title={s.security}>
          <RowSwitch Colors={Colors} icon="finger-print-outline" label={s.biometric} value={false} onToggle={() => {}} disabled soon={s.biometricSoon} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="key-outline" label={s.changePassword} onPress={() => navigation.navigate('ResetPassword')} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="shield-checkmark-outline" label={s.twoFactor} value={s.twoFactorStatus} onPress={() => Alert.alert('2FA', s.twoFactorAlert)} />
        </Section>

        {/* Legal */}
        <Section Colors={Colors} title={s.legal}>
          <RowLink Colors={Colors} icon="document-text-outline" label={s.cgu} onPress={() => navigation.navigate('CGU')} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="lock-closed-outline" label={s.privacy} onPress={() => navigation.navigate('Confidentialite')} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="ellipse-outline" label={s.cookies} onPress={() => Alert.alert('Cookies', s.cookiesAlert)} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="bar-chart-outline" label={s.myData} onPress={() => Alert.alert('Données', s.dataAlert)} />
        </Section>

        {/* Support */}
        <Section Colors={Colors} title={s.support}>
          <RowLink Colors={Colors} icon="help-circle-outline" label={s.faq} onPress={() => Alert.alert('FAQ', s.faqAlert)} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="call-outline" label={s.contact} onPress={() => Linking.openURL('tel:+221338001234')} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="star-outline" label={s.rateApp} onPress={() => Alert.alert('Merci !', s.rateAlert)} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="bug-outline" label={s.reportBug} onPress={() => Linking.openURL('mailto:bugs@malaw.sn?subject=Bug%20App%20Malaw')} />
        </Section>

        {/* Danger zone */}
        <Section Colors={Colors} title={s.dangerZone}>
          <RowLink Colors={Colors} icon="log-out-outline" label={s.logout} onPress={handleLogout} />
          <View style={styles(Colors).rowDivider} />
          <RowLink
            Colors={Colors}
            icon="trash-outline"
            label={s.deleteAccount}
            danger
            onPress={() => Alert.alert(
              s.deleteTitle,
              s.deleteMsg,
              [
                { text: s.cancel, style: 'cancel' },
                { text: s.contactSupport, onPress: () => Linking.openURL('mailto:support@malaw.sn?subject=Suppression%20compte') },
              ]
            )}
          />
        </Section>

        {/* Version */}
        <View style={styles(Colors).versionBlock}>
          <View style={styles(Colors).versionLogo}>
            <MalawLogo size={32} />
            <Text style={styles(Colors).versionAppName}>Malaw</Text>
          </View>
          <Text style={styles(Colors).versionText}>{s.version} {VERSION}</Text>
          <Text style={styles(Colors).versionCopyright}>{s.copyright}</Text>
          <Text style={styles(Colors).versionTagline}>{s.tagline}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backIcon: { fontSize: 22, color: Colors.darkGreen, padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: Colors.darkGreen },
  section: { gap: 8, marginTop: 20 },
  sectionTitle: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: Colors.placeholder, textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 4 },
  sectionCard: { backgroundColor: Colors.white, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 14 },
  rowIcon: { width: 28, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.manrope.regular, color: Colors.charcoal },
  rowLabelDanger: { color: '#DC2626' },
  rowValue: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: Colors.placeholder },
  rowChevron: { fontSize: 20, color: Colors.placeholder },
  rowDivider: { height: 1, backgroundColor: Colors.offWhite, marginLeft: 60 },
  rowDisabled: { opacity: 0.45 },
  rowTextDisabled: { color: Colors.placeholder },
  rowComingSoon: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: Colors.placeholder, marginTop: 2 },
  langGrid: { flexDirection: 'row', gap: 10, padding: 16 },
  langChip: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.mediumGray, backgroundColor: Colors.cream },
  langChipActive: { borderColor: Colors.darkGreen, backgroundColor: Colors.darkGreen + '18' },
  langFlag: { fontSize: 24 },
  langLabel: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: Colors.darkGray },
  langLabelActive: { color: Colors.darkGreen, fontFamily: Fonts.manrope.bold },
  langCheck: { fontSize: 12, color: Colors.darkGreen, fontFamily: Fonts.manrope.bold },
  versionBlock: { alignItems: 'center', gap: 6, paddingTop: 24, paddingBottom: 8 },
  versionLogo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  versionAppName: { fontSize: 16, fontFamily: Fonts.epilogue.black, color: Colors.darkGreen },
  versionText: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: Colors.placeholder },
  versionCopyright: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: Colors.placeholder },
  versionTagline: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: Colors.gold, textAlign: 'center' },
});
