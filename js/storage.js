// ── Supabase Storage yardımcıları ───────────────────────────────────────────
//
// Senaryo JSON dosyaları Supabase Storage'da "scenarios" bucket'ında tutulur.
// Herkes okuyabilir (public bucket). Yalnızca giriş yapmış kullanıcılar yazar.
//
// Supabase Dashboard'da yapılması gerekenler:
//   Storage → New Bucket
//     Name       : scenarios
//     Public     : ✓ (herkese açık okuma)
//   Storage → Policies → scenarios bucket
//     SELECT  : true  (herkes okuyabilir)
//     INSERT  : (auth.role() = 'authenticated')
//     UPDATE  : (auth.role() = 'authenticated')
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient.js';

const BUCKET = 'scenarios';

/** Supabase Storage public base URL */
export const STORAGE_BASE = `${window.__ENV.SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

/** Bir senaryonun public erişim URL'si */
export function scenarioUrl(id) {
  return `${STORAGE_BASE}/${id}.json`;
}

/** Manifest dosyasının public URL'si */
export function manifestUrl() {
  return `${STORAGE_BASE}/manifest.json`;
}

/**
 * Senaryo JSON'unu Supabase Storage'a yükle + manifest'i güncelle.
 * @param {object} scenario - Senaryo objesi (id, title, weeks, difficulty, domain zorunlu)
 */
export async function uploadScenario(scenario) {
  // 1. Senaryo dosyasını yükle
  const blob = new Blob(
    [JSON.stringify(scenario, null, 2)],
    { type: 'application/json' }
  );
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(`${scenario.id}.json`, blob, {
      upsert       : true,
      contentType  : 'application/json',
      cacheControl : '60',           // 60 sn cache — anlık değişiklik görülsün
    });
  if (uploadErr) throw uploadErr;

  // 2. Manifest'i güncelle
  await _updateManifest(scenario);
}

/**
 * Manifest'teki senaryo listesini günceller.
 * Yoksa oluşturur; varsa günceller.
 */
async function _updateManifest(scenario) {
  // Mevcut manifest'i oku
  let manifest = { scenarios: [], updatedAt: '' };
  try {
    const res = await fetch(manifestUrl() + '?t=' + Date.now());
    if (res.ok) manifest = await res.json();
  } catch { /* ilk yükleme — boş manifest ile başla */ }

  const entry = {
    id        : scenario.id,
    title     : scenario.title,
    decisions : (scenario.weeks || []).reduce((a, w) => a + (w.decisions?.length || 0), 0),
    difficulty: scenario.difficulty || 'beginner',
    sector    : scenario.domain || scenario.sector || 'Genel',
  };

  const idx = manifest.scenarios.findIndex(s => s.id === scenario.id);
  if (idx >= 0) manifest.scenarios[idx] = entry;
  else manifest.scenarios.push(entry);
  manifest.updatedAt = new Date().toISOString().split('T')[0];

  const mBlob = new Blob(
    [JSON.stringify(manifest, null, 2)],
    { type: 'application/json' }
  );
  const { error: mErr } = await supabase.storage
    .from(BUCKET)
    .upload('manifest.json', mBlob, {
      upsert      : true,
      contentType : 'application/json',
      cacheControl: '60',
    });
  if (mErr) throw mErr;
}

/**
 * Senaryo JSON'unu Supabase Storage'dan çeker.
 * @param {string} id - Senaryo ID
 * @returns {Promise<object>} Senaryo objesi
 */
export async function fetchScenario(id) {
  const res = await fetch(scenarioUrl(id) + '?t=' + Date.now());
  if (!res.ok) throw new Error(`Senaryo bulunamadı: ${id} (HTTP ${res.status})`);
  return res.json();
}

/**
 * Manifest JSON'unu Supabase Storage'dan çeker.
 * @returns {Promise<object>} { scenarios: [...] }
 */
export async function fetchManifest() {
  const res = await fetch(manifestUrl() + '?t=' + Date.now());
  if (!res.ok) throw new Error(`Manifest bulunamadı (HTTP ${res.status})`);
  return res.json();
}
