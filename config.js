// ── Supabase yapılandırması ──────────────────────────────────────────────────
//
// GitHub Pages ortam değişkenini desteklemez; bu nedenle config.js kullanılır.
// Anon key Supabase'in PUBLIC anahtarıdır — Row Level Security (RLS) ile
// korunduğu sürece açık olması sorun yaratmaz.
//
// ⚠️  ANON KEY nereden alınır?
//   Supabase Dashboard → Settings → API → "anon public" satırı
//
// ⚠️  Supabase Console'da şunları ayarla:
//   Authentication → URL Configuration
//     Site URL      : https://yetkinlider.com
//     Redirect URLs : https://yetkinlider.com
//                     https://www.yetkinlider.com
//   Authentication → Providers → Google → Enabled
//     Redirect callback : https://fmrevabjbqozmqejhfvd.supabase.co/auth/v1/callback
//
// ──────────────────────────────────────────────────────────────────────────────

window.__ENV = {
  SUPABASE_URL     : 'https://fmrevabjbqozmqejhfvd.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_7orz7Qrbjtawj_yPQfuk6w_NQ76tO8g',
};
