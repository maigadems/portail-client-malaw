import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getStoredUser, saveSession } from '../api/client';
import { me, OTP_SIMULATION } from '../api/auth';

/**
 * Utilisateur de la session courante ({ id, phone, name, email, role,
 * avatarUrl }). Relu depuis le stockage à chaque focus de l'écran ; en mode
 * réel il est aussi rafraîchi depuis GET /auth/me en arrière-plan.
 * `reload()` relit le stockage à la demande (après un updateProfile).
 */
export function useUser() {
  const [user, setUser] = useState(null);

  const reload = useCallback(async () => {
    const u = await getStoredUser();
    if (u) setUser(u);
    return u;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getStoredUser().then((u) => { if (active && u) setUser(u); });
      if (!OTP_SIMULATION) {
        me()
          .then(async (u) => {
            if (!u) return;
            await saveSession({ user: u });
            if (active) setUser(u);
          })
          .catch(() => {}); // hors-ligne ou session expirée : on garde la copie locale
      }
      return () => { active = false; };
    }, [])
  );

  return { user, reload };
}

/** "+221771234567" → "+221 77 123 45 67" (rendu tel quel si autre format) */
export function formatPhone(phone) {
  if (!phone) return '';
  const m = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
