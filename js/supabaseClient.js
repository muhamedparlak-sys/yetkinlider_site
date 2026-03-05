// ── Supabase istemcisi ───────────────────────────────────────────────────────
//
// ESM import — config.js'nin bu dosyadan ÖNCE yüklenmiş olması gerekir:
//   <script src="/config.js"></script>   ← head'de
//
// CDN alternatifi (ESM kullanmak istemeyenler için):
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
//   const { createClient } = window.supabase;
//
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV || {};

if (!SUPABASE_URL || SUPABASE_ANON_KEY === 'BURAYA_ANON_KEY_YAZ') {
  console.error(
    '[Supabase] config.js eksik veya ANON KEY girilmemiş.\n' +
    'Dashboard → Settings → API → "anon public" anahtarını config.js içine yapıştır.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
