// ── Supabase Auth yardımcıları ───────────────────────────────────────────────
//
// Kullanım (ESM, type="module" script içinde):
//   import { loginWithGoogle, loginWithEmail, signupWithEmail,
//            logoutSupabase, getSession, onAuthStateChange }
//     from '/js/auth.js';
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient.js';

/**
 * Google OAuth ile giriş yapar.
 * Supabase, işlem sonrası kullanıcıyı redirectTo adresine yönlendirir.
 */
export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://yetkinlider.com' },
  });
  if (error) {
    console.error('[Auth] Google giriş hatası:', error.message);
    alert('Google ile giriş başlatılamadı:\n' + error.message);
  }
}

/**
 * E-posta + şifre ile giriş yapar.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 * @throws Supabase AuthError
 */
export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/**
 * Yeni kullanıcı kaydı yapar.
 * Supabase'de "Confirm email" kapalıysa session hemen döner;
 * açıksa null döner (kullanıcı e-postayı doğrulayana kadar).
 * @param {string} email
 * @param {string} password
 * @param {string} fullName   - Supabase user_metadata.full_name olarak saklanır
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 * @throws Supabase AuthError
 */
export async function signupWithEmail(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data.session ?? null;
}

/**
 * Supabase oturumunu kapatır.
 */
export async function logoutSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[Auth] Çıkış hatası:', error.message);
}

/**
 * Mevcut Supabase oturumunu döndürür. Oturum yoksa null.
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error('[Auth] Oturum sorgu hatası:', error.message);
  return session ?? null;
}

/**
 * Oturum değişikliklerini (giriş / çıkış / token yenileme) dinler.
 * @param {(session: import('@supabase/supabase-js').Session|null) => void} callback
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
