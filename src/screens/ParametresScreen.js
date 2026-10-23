import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getColors, Fonts } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import MalawLogo from '../components/MalawLogo';
import { useUser, formatPhone } from '../hooks/useUser';
import { logout, deleteAccount, PIN_LENGTH } from '../api/auth';
import { clearSession } from '../api/client';
import { getSettings, updateSettings } from '../api/settings';
import { registerPushDevice, unregisterPushDevice } from '../api/notifications';
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

  // Préférences du compte, telles que le serveur les connaît. `null` tant
  // qu'elles ne sont pas chargées : afficher un interrupteur avant d'en
  // connaître la valeur afficherait un réglage faux.
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    getSettings()
      .then((data) => { if (active) setSettings(data); })
      .catch((e) => { if (active) Alert.alert(s.preferences, e.message); })
      .finally(() => { if (active) setLoadingSettings(false); });
    return () => { active = false; };
  }, []);

  /**
   * Bascule une préférence. L'interrupteur bouge tout de suite (sinon il
   * paraît insensible le temps de l'aller-retour) mais revient à son état
   * précédent si le serveur refuse : ce qui est affiché doit toujours être
   * ce qui est enregistré.
   */
  const toggleSetting = async (key, value) => {
    if (savingKey || !settings) return;
    const previous = settings[key];
    setSettings({ ...settings, [key]: value });
    setSavingKey(key);
    try {
      const saved = await updateSettings({ [key]: value });
      setSettings(saved);
      // Le serveur ne pousse qu'aux appareils enregistrés : réactiver le push
      // sans réinscrire l'appareil ne changerait rien.
      if (key === 'pushEnabled' && value) await registerPushDevice();
      if (key === 'pushEnabled' && !value) await unregisterPushDevice();
    } catch (e) {
      setSettings((cur) => ({ ...cur, [key]: previous }));
      Alert.alert(s.preferences, e.message);
    } finally {
      setSavingKey(null);
    }
  };

  /**
   * La langue est aussi une préférence du compte : sans cette synchro, le
   * serveur continuerait d'écrire ses notifications en français à un client
   * passé en anglais.
   */
  const handleLang = (id) => {
    setLang(id);
    if (settings?.preferredLanguage === id) return;
    updateSettings({ preferredLanguage: id })
      .then((saved) => setSettings(saved))
      .catch((e) => Alert.alert(s.preferences, e.message));
  };

  const handleLogout = async () => {
    // Retrait de l'appareil d'abord : après `logout()` il n'y a plus de jeton
    // pour autoriser l'appel, et le serveur pousserait encore les commandes
    // du compte précédent sur ce téléphone.
    await unregisterPushDevice();
    await logout();
    navigation.replace('Connexion');
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeletePin('');
    setDeleteReason('');
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (deleting) return;
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(deletePin)) {
      setDeleteError(s.deletePinInvalid.replace('{n}', PIN_LENGTH));
      return;
    }
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteAccount({ pin: deletePin, reason: deleteReason.trim() || undefined });
      // Le compte n'existe plus : la session locale n'a plus aucun sens et
      // l'historique de navigation ne doit pas permettre d'y revenir.
      await clearSession();
      setDeleteOpen(false);
      navigation.reset({ index: 0, routes: [{ name: 'Connexion' }] });
    } catch (e) {
      // Message serveur tel quel : c'est lui qui explique le refus (commande
      // en cours, PIN erroné…).
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  };

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
                onPress={() => handleLang(l.id)}
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
          {loadingSettings ? (
            <ActivityIndicator color={Colors.darkGreen} style={{ paddingVertical: 20 }} />
          ) : (
            <>
              <RowSwitch Colors={Colors} icon="cube-outline" label={s.notifOrders} value={!!settings?.pushEnabled} onToggle={(v) => toggleSetting('pushEnabled', v)} />
              <View style={styles(Colors).rowDivider} />
              <RowSwitch Colors={Colors} icon="pricetag-outline" label={s.notifPromos} value={!!settings?.promoOptIn} onToggle={(v) => toggleSetting('promoOptIn', v)} />
              <View style={styles(Colors).rowDivider} />
              <RowSwitch Colors={Colors} icon="phone-portrait-outline" label={s.notifSMS} value={!!settings?.smsEnabled} onToggle={(v) => toggleSetting('smsEnabled', v)} />
            </>
          )}
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
          <RowLink Colors={Colors} icon="bar-chart-outline" label={s.myData} onPress={() => Alert.alert(s.dataAlertTitle, s.dataAlert)} />
        </Section>

        {/* Support */}
        <Section Colors={Colors} title={s.support}>
          <RowLink Colors={Colors} icon="help-circle-outline" label={s.faq} onPress={() => Alert.alert('FAQ', s.faqAlert)} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="call-outline" label={s.contact} onPress={() => Linking.openURL('tel:+221338001234')} />
          <View style={styles(Colors).rowDivider} />
          <RowLink Colors={Colors} icon="star-outline" label={s.rateApp} onPress={() => Alert.alert(s.rateAlertTitle, s.rateAlert)} />
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
            onPress={() => setDeleteOpen(true)}
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

      {/* Suppression de compte : parcours complet dans l'app, le serveur
          expose la route. L'e-mail au support ne laissait aucune trace
          vérifiable de la demande. */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={closeDelete}>
        <KeyboardAvoidingView
          style={styles(Colors).modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles(Colors).modalCard}>
            <View style={styles(Colors).modalIcon}>
              <Ionicons name="warning-outline" size={26} color="#DC2626" />
            </View>
            <Text style={styles(Colors).modalTitle}>{s.deleteAccount}</Text>
            <Text style={styles(Colors).modalWarning}>{s.deleteWarning}</Text>

            <Text style={styles(Colors).modalLabel}>{s.deletePinLabel}</Text>
            <TextInput
              style={styles(Colors).modalInput}
              value={deletePin}
              onChangeText={(v) => { setDeletePin(v.replace(/\D/g, '')); setDeleteError(''); }}
              placeholder={'•'.repeat(PIN_LENGTH)}
              placeholderTextColor={Colors.placeholder}
              keyboardType="number-pad"
              maxLength={PIN_LENGTH}
              secureTextEntry
              editable={!deleting}
            />

            <Text style={styles(Colors).modalLabel}>{s.deleteReasonLabel}</Text>
            <TextInput
              style={styles(Colors).modalInput}
              value={deleteReason}
              onChangeText={setDeleteReason}
              placeholder={s.deleteReasonPlaceholder}
              placeholderTextColor={Colors.placeholder}
              maxLength={500}
              editable={!deleting}
            />

            {deleteError ? <Text style={styles(Colors).modalError}>{deleteError}</Text> : null}

            <View style={styles(Colors).modalActions}>
              <TouchableOpacity style={styles(Colors).modalCancelBtn} onPress={closeDelete} disabled={deleting}>
                <Text style={styles(Colors).modalCancelText}>{s.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles(Colors).modalDangerBtn, deleting && { opacity: 0.7 }]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles(Colors).modalDangerText}>{s.deleteConfirm}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: Colors.white, borderRadius: 24, padding: 24, gap: 10 },
  modalIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#DC262615', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: '#DC2626', textAlign: 'center' },
  modalWarning: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: Colors.darkGray, textAlign: 'center', lineHeight: 20 },
  modalLabel: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: Colors.darkGreen, marginTop: 6 },
  modalInput: { height: 50, backgroundColor: Colors.offWhite, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: Fonts.manrope.semiBold, color: Colors.charcoal },
  modalError: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: '#DC2626', marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.mediumGray, justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: Colors.darkGray },
  modalDangerBtn: { flex: 1.4, height: 48, borderRadius: 100, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  modalDangerText: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: Colors.white },
});
