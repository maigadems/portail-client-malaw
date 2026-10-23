import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Fonts } from '../constants/theme';
import { navigationRef } from '../navigation/AppNavigator';

/**
 * Filet de sécurité de rendu.
 *
 * Sans lui, une seule exception dans un écran (une donnée serveur au format
 * inattendu, une image absente) démonte tout l'arbre React : l'utilisateur se
 * retrouve devant un écran blanc, sans aucun moyen de revenir en arrière —
 * seul un redémarrage complet de l'app le sort de là. Ici il garde au moins
 * une porte de sortie.
 *
 * Composant de classe : seules les classes peuvent implémenter
 * `componentDidCatch` / `getDerivedStateFromError`. Elles n'ont pas accès aux
 * hooks, donc pas à `useColors()` — on utilise la palette claire statique,
 * qui reste lisible dans les deux thèmes pour cet écran exceptionnel.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Pas de service de rapport d'erreurs dans le projet : la console reste
    // le seul endroit où l'équipe peut retrouver la trace d'un plantage.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  handleGoHome = () => {
    // L'erreur vient peut-être de l'écran courant : on remet la pile à plat
    // sur l'accueil avant de retenter le rendu, sinon le même écran fautif
    // se remonte aussitôt et l'app replante en boucle.
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconBg}>
            <Text style={styles.icon}>🛠️</Text>
          </View>

          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.subtitle}>
            L'application a rencontré un problème inattendu. Vos commandes en
            cours ne sont pas affectées : elles sont enregistrées chez nous.
          </Text>

          {/* Le message technique n'a de sens que pour l'équipe : on l'affiche
              en développement, jamais à un client en production. */}
          {__DEV__ ? (
            <View style={styles.debugBox}>
              <Text style={styles.debugText}>{String(error?.message ?? error)}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={this.handleRetry}>
            <Text style={styles.primaryBtnText}>↺ Réessayer</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={this.handleGoHome}>
            <Text style={styles.secondaryBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  iconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.darkGreen + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  icon: { fontSize: 44 },
  title: {
    fontSize: 24,
    fontFamily: Fonts.epilogue.bold,
    color: Colors.darkGreen,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: Colors.darkGray,
    textAlign: 'center',
    lineHeight: 22,
  },
  debugBox: {
    width: '100%',
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    padding: 12,
  },
  debugText: {
    fontSize: 11,
    fontFamily: Fonts.manrope.regular,
    color: '#DC2626',
  },
  primaryBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.manrope.bold,
  },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: Colors.darkGreen,
    textDecorationLine: 'underline',
  },
});
