// ── Supabase DB yardımcıları (game_saves tablosu) ────────────────────────────
//
// Kullanım (ESM, type="module" script içinde):
//   import { upsertGameSave, fetchUserSaves, deleteAllSaves } from '/js/db.js';
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient.js';

/** Supabase satırını → saveGame() formatına dönüştür */
function rowToSave(row) {
  return {
    scenarioId      : row.scenario_id,
    scenarioTitle   : row.scenario_title,
    difficultyWeight: row.difficulty_weight,
    sectionId       : row.section_id,
    xp              : row.xp,
    dCount          : row.d_count,
    answered        : row.answered  || {},
    revealedIds     : row.revealed_ids || [],
    activeId        : row.active_id,
    dayIndex        : row.day_index,
    dayBatches      : row.day_batches || [],
    gameDate        : row.game_date,
    shuffles        : row.shuffles  || {},
    pendingKey      : row.pending_key || {},
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
  if (!user) return;                        // oturum yoksa sessizce çık

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
 * Giriş yapmış kullanıcının tüm oyun kayıtlarını Supabase'den çeker.
 * @returns {Promise<object[]>}  saveGame() formatında dizi
 */
export async function fetchUserSaves() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('game_saves')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[DB] Kayıtlar yüklenemedi:', error.message);
    return [];
  }
  return (data || []).map(rowToSave);
}

/**
 * Giriş yapmış kullanıcının tüm oyun kayıtlarını Supabase'den siler.
 */
export async function deleteAllSaves() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('game_saves')
    .delete()
    .eq('user_id', user.id);

  if (error) console.error('[DB] Silme hatası:', error.message);
}
