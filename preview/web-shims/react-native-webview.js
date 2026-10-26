/**
 * Shim web de react-native-webview — branché par metro.config.js uniquement
 * pour `platform=web`. L'écran Paiement n'ouvre l'iframe que sur action
 * explicite du client ; les contrôles du parcours (vérification « j'ai
 * payé », mode test) restent gérés par l'app elle-même.
 */
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';

export function WebView({ source, renderLoading, onError, style, ...rest }) {
  const uri = source?.uri ?? null;
  const ref = useRef(null);
  const notified = useRef(false);

  useEffect(() => {
    if (!uri && !notified.current) {
      notified.current = true;
      onError?.();
    }
  }, [uri, onError]);

  return (
    <View style={[{ flex: 1, backgroundColor: '#FFFFFF' }, style]}>
      {uri ? (
        <iframe
          ref={ref}
          title="page de paiement"
          src={uri}
          style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
          onError={() => onError?.()}
          {...rest}
        />
      ) : (
        (renderLoading?.() ?? <ActivityIndicator />)
      )}
    </View>
  );
}

export default WebView;
