import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import { useUser, formatPhone } from '../hooks/useUser';
import { logout, updateProfile } from '../api/auth';
import { listAddresses } from '../api/addresses';
import { pickAvatar } from '../utils/pickAvatar';
import { uploadAvatar } from '../api/uploads';
import { Alert } from '../components/AppAlert';

export default function ProfilScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const p = t.profile;
  const { user, reload } = useUser();
  const [notifCommandes, setNotifCommandes] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // Rechargées à chaque affichage : au retour de l'éditeur, la liste reflète
  // immédiatement l'ajout, la modification ou la suppression.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listAddresses()
        .then((items) => { if (active) setAddresses(items); })
        .catch(() => {}) // hors-ligne : on garde la dernière liste connue
        .finally(() => { if (active) setLoadingAddresses(false); });
      return () => { active = false; };
    }, []),
  );

  const handleLogout = async () => {
    // logout() efface toujours la session locale même si l'appel serveur
    // échoue — on quitte donc systématiquement vers Connexion, jamais
    // bloqué par une erreur réseau ou un token périmé.
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Connexion' }] });
  };

  const handleChangeAvatar = async () => {
    try {
      const dataUrl = await pickAvatar();
      if (!dataUrl) return;
      // L'image part sur le service d'hébergement : on enregistre l'URL
      // renvoyée, pas la data-URL. Sans ça, la photo pèserait en base et
      // serait rechargée en entier à chaque affichage.
      const url = await uploadAvatar(dataUrl);
      await updateProfile({ avatarUrl: url });
      await reload();
    } catch (e) {
      Alert.alert(p.avatarAlertTitle, e.message);
    }
  };

  const startEditing = () => {
    setEditName(user?.name ?? '');
    setEditEmail(user?.email ?? '');
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    const name = editName.trim();
    const email = editEmail.trim();
    if (!name) {
      Alert.alert(p.profileAlertTitle, p.nameRequired);
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert(p.profileAlertTitle, p.invalidEmail);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name, ...(email ? { email } : {}) });
      await reload();
      setEditing(false);
    } catch (e) {
      Alert.alert(p.profileAlertTitle, e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={S.container}>
      <TopBar showLocation={false} title={p.title} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Identity header */}
        <View style={S.identitySection}>
          {/* Avatar */}
          <View style={S.avatarContainer}>
            <View style={S.avatarBg}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={S.avatarImg} />
              ) : (
                <Ionicons name="person-outline" size={56} color={C.placeholder} />
              )}
            </View>
            <TouchableOpacity style={S.avatarEditBtn} onPress={handleChangeAvatar}>
              <Ionicons name="pencil" size={13} color={C.white} />
            </TouchableOpacity>
          </View>

          <Text style={S.profileName}>{user?.name || p.defaultName}</Text>
          <Text style={S.profileSubtitle}>{formatPhone(user?.phone)}</Text>
        </View>

        {/* Personal Info */}
        <View style={S.section}>
          <View style={S.sectionHeaderRow}>
            <Text style={S.sectionTitle}>{p.personalInfo}</Text>
            {!editing && (
              <TouchableOpacity onPress={startEditing}>
                <Text style={S.editLink}>{p.edit}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={S.infoCard}>
            {editing ? (
              <View style={S.editForm}>
                <View style={S.editField}>
                  <Text style={S.infoLabel}>{p.fullName}</Text>
                  <TextInput
                    style={S.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder={p.namePlaceholder}
                    placeholderTextColor={C.placeholder}
                    autoComplete="name"
                    textContentType="name"
                  />
                </View>
                <View style={S.editField}>
                  <Text style={S.infoLabel}>{p.email}</Text>
                  <TextInput
                    style={S.editInput}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder={p.emailPlaceholder}
                    placeholderTextColor={C.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                </View>
                <View style={S.infoRow}>
                  <Ionicons name="call-outline" size={18} color={C.darkGray} style={S.infoIcon} />
                  <View style={S.infoText}>
                    <Text style={S.infoLabel}>{p.phoneReadonly}</Text>
                    <Text style={S.infoValue}>{formatPhone(user?.phone)}</Text>
                  </View>
                </View>
                <View style={S.editActions}>
                  <TouchableOpacity style={S.editCancelBtn} onPress={() => setEditing(false)} disabled={saving}>
                    <Text style={S.editCancelText}>{p.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.editSaveBtn, saving && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={saving}>
                    {saving ? <ActivityIndicator color={C.white} /> : <Text style={S.editSaveText}>{p.save}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              [
                { icon: 'person-outline', label: p.fullName, value: user?.name || p.notProvided },
                { icon: 'call-outline', label: p.phone, value: formatPhone(user?.phone) || p.notProvided },
                { icon: 'mail-outline', label: p.email, value: user?.email || p.notProvided },
              ].map((item, i, rows) => (
                <View key={i}>
                  <View style={S.infoRow}>
                    <Ionicons name={item.icon} size={18} color={C.darkGray} style={S.infoIcon} />
                    <View style={S.infoText}>
                      <Text style={S.infoLabel}>{item.label}</Text>
                      <Text style={S.infoValue}>{item.value}</Text>
                    </View>
                  </View>
                  {i < rows.length - 1 && <View style={S.infoDivider} />}
                </View>
              ))
            )}
          </View>
        </View>

        {/* Adresses enregistrées — chargées depuis le serveur, chacune
            modifiable (lieu sur la carte, type Maison/Bureau/École ou nom
            personnalisé). */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{p.addresses}</Text>

          {loadingAddresses ? (
            <ActivityIndicator color={C.darkGreen} style={{ marginVertical: 16 }} />
          ) : addresses.length === 0 ? (
            <Text style={S.addressEmpty}>
              Aucune adresse enregistrée. Ajoutez-en une pour commander plus vite.
            </Text>
          ) : (
            addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={S.addressCard}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('EditionAdresse', { address: addr })}
              >
                <View style={S.addressIcon}>
                  <Text style={S.addressIconText}>{addr.icon}</Text>
                </View>
                <View style={S.addressText}>
                  <Text style={S.addressType}>{addr.label}</Text>
                  <Text style={S.addressValue} numberOfLines={2}>{addr.line}</Text>
                </View>
                <Text style={S.addressChevron}>›</Text>
              </TouchableOpacity>
            ))
          )}

          {/* Nouvelle adresse : on commence par le lieu sur la carte, le type
              vient ensuite. */}
          <TouchableOpacity
            style={S.addAddressBtn}
            onPress={() => navigation.navigate('ChoixPosition')}
          >
            <Text style={S.addAddressBtnIcon}>+</Text>
            <Text style={S.addAddressBtnText}>{p.addAddress}</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{p.notifications}</Text>
          <View style={S.notifCard}>
            <View style={S.notifRow}>
              <Text style={S.notifLabel}>{p.notifOrders}</Text>
              <Switch
                value={notifCommandes}
                onValueChange={setNotifCommandes}
                trackColor={{ false: C.border, true: C.darkGreen }}
                thumbColor={C.white}
              />
            </View>
            <View style={S.notifDivider} />
            <View style={S.notifRow}>
              <Text style={S.notifLabel}>{p.notifPromos}</Text>
              <Switch
                value={notifPromos}
                onValueChange={setNotifPromos}
                trackColor={{ false: C.border, true: C.darkGreen }}
                thumbColor={C.white}
              />
            </View>
          </View>
        </View>

        {/* Footer links */}
        <View style={S.footerLinks}>
          {[
            { icon: 'bicycle-outline', label: p.becomeCourier, onPress: () => {} },
            { icon: 'people-outline', label: p.becomePartner, onPress: () => {} },
            { icon: 'help-circle-outline', label: p.helpCenter, onPress: () => {} },
            { icon: 'settings-outline', label: p.settings, onPress: () => navigation.navigate('Parametres') },
            { icon: 'log-out-outline', label: p.logout, danger: true, onPress: handleLogout },
          ].map((link, i) => (
            <TouchableOpacity key={i} style={S.footerLink} onPress={link.onPress}>
              <Ionicons name={link.icon} size={18} color={link.danger ? '#DC2626' : C.darkGreen} style={S.footerLinkIcon} />
              <Text style={[S.footerLinkText, link.danger && { color: '#DC2626' }]}>
                {link.label}
              </Text>
              <Text style={S.footerLinkChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  identitySection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginTop: 8,
  },
  avatarBg: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: C.lightGray,
    borderWidth: 4,
    borderColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarImg: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.white,
  },
  profileName: {
    fontSize: 24,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
    marginTop: 8,
  },
  profileSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 28,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  editLink: {
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
    color: C.gold,
  },
  infoCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  infoIcon: {
    width: 24,
    textAlign: 'center',
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: Fonts.manrope.semiBold,
    color: C.placeholder,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.charcoal,
  },
  infoDivider: {
    height: 1,
    backgroundColor: C.offWhite,
  },
  editForm: {
    gap: 16,
  },
  editField: {
    gap: 6,
  },
  editInput: {
    height: 48,
    backgroundColor: C.offWhite,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.charcoal,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  editCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: C.mediumGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGray,
  },
  editSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 100,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSaveText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
    color: C.white,
  },
  addressCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    // La liste peut contenir plusieurs adresses : sans marge, les cartes se
    // touchent (la section n'a pas de `gap`).
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: C.darkGreen,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressIconText: {
    fontSize: 20,
  },
  addressText: {
    flex: 1,
    gap: 2,
  },
  addressType: {
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
    textTransform: 'uppercase',
  },
  addressValue: {
    fontSize: 13,
    fontFamily: Fonts.manrope.regular,
    color: C.charcoal,
  },
  addressChevron: {
    fontSize: 22,
    color: C.gold,
    paddingLeft: 4,
  },
  addressEmpty: {
    fontSize: 13,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
    lineHeight: 20,
    paddingVertical: 8,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addAddressBtnIcon: {
    fontSize: 20,
    color: C.placeholder,
  },
  addAddressBtnText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGray,
  },
  notifCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 20,
  },
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  notifLabel: {
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: C.charcoal,
  },
  notifDivider: {
    height: 1,
    backgroundColor: C.offWhite,
  },
  footerLinks: {
    marginHorizontal: 24,
    marginTop: 28,
    gap: 4,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.offWhite,
    gap: 14,
  },
  footerLinkIcon: {
    width: 28,
    textAlign: 'center',
  },
  footerLinkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.darkGreen,
  },
  footerLinkChevron: {
    fontSize: 20,
    color: C.placeholder,
  },
});
