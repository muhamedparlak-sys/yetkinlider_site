// ── Supabase DB yardımcıları (game_saves + exam_results) ─────────────────────
//
// Kullanım (ESM, type="module" script içinde):
//   import { upsertGameSave, fetchUserSaves, archiveAllSaves,
//            insertExamResult } from '/js/db.js';
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient.js';

// ── game_saves ────────────────────────────────────────────────────────────────

/** Supabase satırını → saveGame() formatına dönüştür */
function rowToSave(row) {
  return {
    scenarioId      : row.scenario_id,
    scenarioTitle   : row.scenario_title,
    difficultyWeight: row.difficulty_weight,
    sectionId       : row.section_id,
    xp              : row.xp,
    dCount          : row.d_count,
    answered        : row.answered     || {},
    revealedIds     : row.revealed_ids || [],
    activeId        : row.active_id,
    dayIndex        : row.day_index,
    dayBatches      : row.day_batches  || [],
    gameDate        : row.game_date,
    shuffles        : row.shuffles     || {},
    pendingKey      : row.pending_key  || {},
    totalDecisions  : row.total_decisions,
    completed       : row.completed,
    savedAt         : row.updated_at,
  };
}

/**
 * Oyun durumunu Supabase'e kaydet (UPSERT).
 * saveGame() içinden fire-and-forget olarak çağrılır.
 * @param {object} data  – saveGame() ile oluşturulan obje
 */
export async function upsertGameSave(data) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('game_saves')
    .upsert({
      user_id          : user.id,
      scenario_id      : data.scenarioId,
      scenario_title   : data.scenarioTitle,
      difficulty_weight: data.difficultyWeight || 3,
      section_id       : data.sectionId  || 1,
      xp               : data.xp         || 0,
      d_count          : data.dCount     || 0,
      answered         : data.answered   || {},
      revealed_ids     : data.revealedIds || [],
      active_id        : data.activeId   || null,
      day_index        : data.dayIndex   || 0,
      day_batches      : data.dayBatches || [],
      game_date        : data.gameDate   || null,
      shuffles         : data.shuffles   || {},
      pending_key      : data.pendingKey || {},
      total_decisions  : data.totalDecisions || 0,
    }, { onConflict: 'user_id,scenario_id' });

  if (error) console.error('[DB] Kayıt hatası:', error.message);
}

/**
 * Aktif (arşivlenmemiş) oyun kayıtlarını Supabase'den çeker.
 * @returns {Promise<object[]>}  saveGame() formatında dizi
 */
export async function fetchUserSaves() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('game_saves')
    .select('*')
    .eq('user_id', user.id)
    .is('archived_at', null)           // arşivlenmiş kayıtları gösterme
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[DB] Kayıtlar yüklenemedi:', error.message);
    return [];
  }
  return (data || []).map(rowToSave);
}

/**
 * Kullanıcının tüm aktif oyun kayıtlarını arşivler (soft-delete).
 * Kayıtlar silinmez; archived_at doldurulur ve sorgulardan gizlenir.
 */
export async function archiveAllSaves() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('game_saves')
    .update({ archived_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('archived_at', null);          // sadece henüz arşivlenmemişleri arşivle

  if (error) console.error('[DB] Arşiv hatası:', error.message);
}

// ── exam_results ─────────────────────────────────────────────────────────────

/**
 * Deneme sınavı sonucunu Supabase'e kaydeder.
 * @param {object} data
 *   mode           – 'full' | 'category'
 *   categoryFilter – kategori modu için seçilen kategori (opsiyonel)
 *   score          – 0-100 yüzde
 *   correct        – doğru sayısı
 *   incorrect      – yanlış sayısı
 *   unanswered     – cevaplanmamış sayısı
 *   total          – toplam soru sayısı
 *   timeUsed       – kullanılan süre (saniye)
 *   timeTotal      – toplam süre (saniye)
 *   categoryStats  – { "Kategori": { correct: N, total: M }, ... }
 */
export async function insertExamResult(data) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('exam_results')
    .insert({
      user_id        : user.id,
      mode           : data.mode           || 'full',
      category_filter: data.categoryFilter || null,
      score          : data.score,
      correct        : data.correct,
      incorrect      : data.incorrect,
      unanswered     : data.unanswered,
      total          : data.total,
      time_used      : data.timeUsed       || null,
      time_total     : data.timeTotal      || null,
      category_stats : data.categoryStats  || {},
    });

  if (error) console.error('[DB] Sınav kaydı hatası:', error.message);
}

// ── user_scenarios ────────────────────────────────────────────────────────────

/**
 * PSG tarafından üretilen kişisel senaryoyu Supabase'e kaydet/güncelle.
 * tailor.html'den fire-and-forget olarak çağrılır.
 * @param {object} scenario  – PSG.generate() çıktısı (session_id alanı olmalı)
 */
export async function upsertPersonalScenario(scenario) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const scenarioId = scenario.session_id || scenario.id || Date.now().toString(36);

  const { error } = await supabase
    .from('user_scenarios')
    .upsert({
      user_id     : user.id,
      scenario_id : scenarioId,
      scenario    : scenario,
      sector      : scenario.sector     || null,
      difficulty  : scenario.difficulty || null,
    }, { onConflict: 'user_id,scenario_id' });

  if (error) console.error('[DB] Kişisel senaryo kayıt hatası:', error.message);
}

/**
 * Kullanıcının belirli (ya da en son) kişisel senaryosunu Supabase'den çeker.
 * game.html'de localStorage'da yoksa cross-device/refresh fallback olarak kullanılır.
 * @param {string|null} scenarioId  – PSG session_id (null ise en son çekilir)
 * @returns {Promise<object|null>}
 */
export async function fetchPersonalScenario(scenarioId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from('user_scenarios')
    .select('scenario')
    .eq('user_id', user.id);

  if (scenarioId) {
    query = query.eq('scenario_id', scenarioId);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) { console.warn('[DB] Kişisel senaryo çekme başarısız:', error.message); return null; }
  return data?.scenario || null;
}

// ── mesele_tipleri (IP korumalı — Supabase'den okunur) ───────────────────────

/**
 * Tüm mesele tipi ID'lerini Supabase'den çeker.
 * PSG'de window.__sbFetchMeseleTipiIds olarak bağlanır.
 * @returns {Promise<string[]>}
 */
export async function fetchMeseleTipiIds() {
  const { data, error } = await supabase
    .from('mesele_tipleri')
    .select('id')
    .order('id');
  if (error) { console.warn('[DB] mesele_tipleri ID listesi alınamadı:', error.message); return []; }
  return (data || []).map(r => r.id);
}

/**
 * Belirli bir mesele tipinin tam JSON verisini Supabase'den çeker.
 * PSG'de window.__sbFetchMeseleTipi olarak bağlanır.
 * @param {string} id  — örn. 'kaynak_erisilemezligi'
 * @returns {Promise<object|null>}
 */
export async function fetchMeseleTipi(id) {
  const { data, error } = await supabase
    .from('mesele_tipleri')
    .select('data')
    .eq('id', id)
    .single();
  if (error) { console.warn(`[DB] mesele_tipleri[${id}] alınamadı:`, error.message); return null; }
  return data?.data || null;
}

// ── profiles ──────────────────────────────────────────────────────────────────

/**
 * Kullanıcı profilini Supabase'e kaydet/güncelle (UPSERT).
 * Sadece verilen alanları günceller; diğerlerine dokunmaz.
 * @param {object} params
 *   id           – kullanıcı UUID (zorunlu)
 *   display_name – görünen isim (opsiyonel)
 *   email        – e-posta (opsiyonel)
 *   role         – 'user' | 'editor' | 'admin' (opsiyonel)
 *   sector       – sektör kodu (opsiyonel)
 *   gender       – 'erkek' | 'kadın' | 'belirtmek_istemiyorum' (opsiyonel)
 *   birth_year   – doğum yılı (opsiyonel)
 */
export async function upsertProfile({ id, display_name, email, role, sector, gender, birth_year }) {
  const update = { id, updated_at: new Date().toISOString() };
  if (display_name !== undefined) update.display_name = display_name;
  if (email       !== undefined) update.email        = email;
  if (role        !== undefined) update.role         = role;
  if (sector      !== undefined) update.sector       = sector;
  if (gender      !== undefined) update.gender       = gender;
  if (birth_year  !== undefined) update.birth_year   = birth_year;

  return supabase.from('profiles').upsert(update, { onConflict: 'id' });
}

/**
 * Belirli bir kullanıcının profil verisini Supabase'den çeker.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, email, role, sector, gender, birth_year, created_at, updated_at')
    .eq('id', userId)
    .single();
  return data || null;
}

// ── admin: kullanıcı yönetimi ─────────────────────────────────────────────────

/**
 * Tüm kullanıcı profillerini çeker (sadece admin/editor görebilir — RLS korumalı).
 * @returns {Promise<object[]>}
 */
export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, role, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) { console.warn('[DB] Admin kullanıcı listesi alınamadı:', error.message); return []; }
  return data || [];
}

/**
 * Belirli bir kullanıcının tüm oyun kayıtlarını çeker (admin RLS gerekli).
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function fetchUserGameStats(userId) {
  const { data, error } = await supabase
    .from('game_saves')
    .select('xp, d_count, answered, total_decisions, completed, created_at, updated_at, scenario_title')
    .eq('user_id', userId)
    .is('archived_at', null);
  if (error) { console.warn('[DB] Kullanıcı oyun istatistikleri alınamadı:', error.message); return []; }
  return data || [];
}

/**
 * Belirli bir kullanıcının sınav sonuçlarını çeker (admin RLS gerekli).
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function fetchUserExamStats(userId) {
  const { data, error } = await supabase
    .from('exam_results')
    .select('score, correct, total, time_used, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('[DB] Kullanıcı sınav istatistikleri alınamadı:', error.message); return []; }
  return data || [];
}

/**
 * Bir kullanıcının rolünü günceller (sadece admin yapabilir — RLS korumalı).
 * @param {string} userId
 * @param {'user'|'editor'|'admin'} newRole
 */
export async function updateUserRole(userId, newRole) {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

// ── glossary_blob ─────────────────────────────────────────────────────────────

/**
 * Sözlük verisini Supabase'den çeker.
 * glossary.html'de window.__sbFetchGlossary olarak bağlanır.
 * @returns {Promise<object|null>}
 */
export async function fetchGlossary() {
  const { data, error } = await supabase
    .from('glossary_blob')
    .select('data')
    .eq('id', 'main')
    .single();
  if (error) { console.warn('[DB] Glossary alınamadı:', error.message); return null; }
  return data?.data || null;
}
