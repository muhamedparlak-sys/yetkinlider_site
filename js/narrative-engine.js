/**
 * Narrative Engine — YetkinLider
 * ─────────────────────────────────────────────────────────────────────────────
 * Hero's Journey × PM Proje Yaşam Döngüsü × Karma/Borç Kuyruğu
 *
 * Temel fikir (NotebookLM × PMI × Campbell):
 *   - Oyuncunun her kararı (özellikle Poison) ilerleyen perdede patlayacak
 *     bir kriz tohumunu KARMA KUYRUĞU'na ekler.
 *   - Yeterli Poison birikince (Ay 9 = Ordeal) tüm kök nedenler aynı anda
 *     patlar → "Boss Savaşı": Süreç + İnsan + İş Çevresi üçlü krizi.
 *   - PMP ECO Coverage tracker sezon boyunca tüm alanların görüldüğünü garanti eder.
 *
 * Hero's Journey → PM Perde Eşlemesi (PMBOK + Campbell):
 *   P1 KALKIŞ     → Başlatma + Planlama (Olağan Dünya, Çağrı, Eşiği Geçme)
 *   P2 SINAVLAR   → Yürütme/başı (Müttefikler, Düşmanlar, Fırtına)
 *   P3 İÇ MAĞARA  → Yürütme/ortası (Kaos birikiyor, sessiz gerilim)
 *   P4 ORDEAL     → İzleme (En Büyük Sınav — tüm kök nedenler patlar)
 *   P5 DÖNÜŞ      → Kapanış (Ödül, Diriliş, İksir / Lessons Learned)
 */

'use strict';

const NarrativeEngine = (() => {

  // ── Hero's Journey Perde Haritası ───────────────────────────────────────────
  const HERO_JOURNEY = {
    P1: {
      label: 'Kalkış',
      subtitle: 'Olağan Dünya & Çağrı',
      pm_faz: ['baslangic', 'planlama'],
      pmp_odak: 'process',          // Bu perdede ağırlıklı hangi PMP alanı
      ay: [1, 2, 3],
      acilis_text: 'Proje başlıyor. Ekip kuruldu, sponsor heyecanlı. Ama bazı şeyler henüz netleşmedi...',
    },
    P2: {
      label: 'Sınavlar',
      subtitle: 'Müttefikler, Düşmanlar & Fırtına',
      pm_faz: ['yurutme'],
      pmp_odak: 'people',
      ay: [4, 5, 6],
      acilis_text: 'İşler yürüyor ama takımda gerilimler belirdi. İlk gerçek kararlar geliyor.',
    },
    P3: {
      label: 'İç Mağara',
      subtitle: 'Birikmiş Kaos & Sessiz Gerilim',
      pm_faz: ['yurutme', 'izleme'],
      pmp_odak: 'process',
      ay: [7, 8],
      acilis_text: 'Aylar içinde biriken kararların ağırlığı hissedilmeye başladı...',
    },
    P4: {
      label: 'En Büyük Sınav',
      subtitle: 'Ordeal — Tüm Kök Nedenler Patlar',
      pm_faz: ['izleme'],
      pmp_odak: 'all',             // Tüm 3 alan aynı anda
      ay: [9],
      acilis_text: 'Geçmişte alınan kararların bedeli bugün ödeniyor.',
    },
    P5: {
      label: 'Dönüş',
      subtitle: 'Ödül, Diriliş & İksir',
      pm_faz: ['kapanis'],
      pmp_odak: 'biz_cevre',
      ay: [10, 11, 12],
      acilis_text: 'Proje sonuna gelindi. Kazanımlar ve kayıplar net görünüyor artık.',
    },
  };

  // ── PMP Alan Etiketleri (ECO 2023) ─────────────────────────────────────────
  // Her mesele tipi hangi PMP alanına giriyor?
  const MESELE_PMP_ALAN = {
    // PEOPLE (%42)
    kaynak_erisilemezligi:     'people',
    yetkinlik_uyumsuzlugu:     'people',
    bilgi_adasi:               'people',
    takim_catismasi:           'people',
    cakisan_gorevlendirme:     'people',
    yeni_uye_entegrasyonu:     'people',
    kilit_kisi_bagimlilik:     'people',
    paralel_is_birikimi:       'people',
    iletisim_kopuklugu:        'people',
    patron_degisikligi:        'people',

    // PROCESS (%50)
    kapsam_belirsizligi:       'process',
    gereksinim_catismasi:      'process',
    kapsam_kiymeti_sorgusu:    'process',
    gizli_kapsam_kabulu:       'process',
    yazisiz_scope_degisikligi: 'process',
    gorev_gecikmesi:           'process',
    milestone_baskisi:         'process',
    takvim_degisikligi:        'process',
    performans_geriligi:       'process',
    teknik_borc:               'process',
    test_atlamasi_baskisi:     'process',
    gizli_bagimlilik:          'process',
    beklenti_sapma:            'process',
    maliyet_asimi_riski:       'process',
    onaylanmamis_harcama:      'process',
    butce_kesmesi:             'process',
    kayitli_risk_gerceklesti:  'process',
    tanimsiz_risk:             'process',
    hata_gec_bildirim:         'process',
    teslimat_sonrasi_kriz:     'process',
    proje_kapatma_sorunu:      'process',

    // BUSINESS ENVIRONMENT (%8)
    paydas_erisim_sorunu:      'biz_cevre',
    paydas_catismasi:          'biz_cevre',
    dis_etki_mudahalesi:       'biz_cevre',
    tedarikci_sorunu:          'biz_cevre',
    uyum_ve_lisans:            'biz_cevre',
  };

  // ── Minimum kapsam hedefleri (sezon sonu garantisi) ─────────────────────────
  const COVERAGE_MIN = { people: 30, process: 45, biz_cevre: 5 };

  // ── Ordeal tetikleyici eşikler ──────────────────────────────────────────────
  const ORDEAL_THRESHOLDS = {
    min_pending_crises: 2,    // En az 2 birikmiş kriz
    min_poison_count: 3,      // En az 3 Poison kararı
    min_phase: 'izleme',      // En erken İzleme fazında tetiklenir
  };

  // ── Karma/Borç Kuyruğu Yönetimi ────────────────────────────────────────────

  /**
   * Oyuncu bir şıkkı seçtiğinde çağrılır.
   * opt.triggers varsa kuyruğa ekler ve karakter etkilerini günceller.
   *
   * @param {object} notif  - Seçilen bildirim
   * @param {string} key    - Seçilen şık ('A','B','C','D')
   * @param {object} S      - Oyun state'i (S.pendingCrises, S.chars vb.)
   */
  function processTriggers(notif, key, S) {
    if (!notif || !key) return;
    const opt = (notif.options || []).find(o => o.key === key);
    if (!opt || !opt.triggers) return;

    for (const trigger of opt.triggers) {
      if (trigger.target_issue) {
        // Kriz kuyruğuna ekle
        S.pendingCrises = S.pendingCrises || [];
        S.pendingCrises.push({
          mesele_id: trigger.target_issue,
          delay_phase: trigger.delay_phase || 1,
          reason_context: trigger.reason_context || '',
          source_notif_id: notif.id,
          source_key: key,
          queued_at: Date.now(),
        });
        console.log(`[NE] Kriz kuyruğa eklendi: ${trigger.target_issue} (delay: ${trigger.delay_phase || 1})`);
      }

      if (trigger.target_character_effect) {
        // Karakter state etkisi
        const fx = trigger.target_character_effect;
        S.charState = S.charState || {};
        const charId = fx.character_id;
        if (!S.charState[charId]) {
          S.charState[charId] = { burnout: 0, morale: 5, loyalty: 5 };
        }
        const c = S.charState[charId];
        if (fx.burnout_increase) c.burnout = Math.min(10, c.burnout + fx.burnout_increase / 10);
        if (fx.burnout_decrease) c.burnout = Math.max(0,  c.burnout - fx.burnout_decrease / 10);
        if (fx.morale_change)   c.morale  = Math.max(0, Math.min(10, c.morale + fx.morale_change));
        if (fx.loyalty_change)  c.loyalty = Math.max(0, Math.min(10, c.loyalty + fx.loyalty_change));
        console.log(`[NE] Karakter etkisi: ${charId}`, c);
      }
    }
  }

  /**
   * Bekleyen krizlerin delay_phase sayacını bir azalt.
   * Perde geçişlerinde (section değişimlerinde) çağrılır.
   */
  function tickPendingCrises(S) {
    S.pendingCrises = (S.pendingCrises || []).map(c => ({
      ...c,
      delay_phase: c.delay_phase - 1,
    }));
  }

  /**
   * delay_phase <= 0 olan krizleri döndür ve kuyruktan kaldır.
   * Bu krizler bir sonraki section'a enjekte edilecek.
   */
  function drainReadyCrises(S) {
    const ready = (S.pendingCrises || []).filter(c => c.delay_phase <= 0);
    S.pendingCrises = (S.pendingCrises || []).filter(c => c.delay_phase > 0);
    return ready;
  }

  // ── PMP Kapsam Takibi ───────────────────────────────────────────────────────

  /**
   * Bir bildirimin PMP alanını döndür.
   */
  function getPmpAlan(notif) {
    // Bildirimde mesele_id veya mesele_tipi alanı varsa kullan
    const mid = notif.mesele_id || notif.mesele_tipi || '';
    return MESELE_PMP_ALAN[mid] || null;
  }

  /**
   * Sezon boyunca PMP alan dağılımını hesapla.
   */
  function computeCoverage(S) {
    const cov = { people: 0, process: 0, biz_cevre: 0 };
    for (const n of S.notifs || []) {
      if (n.type !== 'decision') continue;
      if (!S.answered[n.id] || S.answered[n.id] === 'READ') continue;
      const alan = getPmpAlan(n);
      if (alan && cov[alan] !== undefined) cov[alan]++;
    }
    return cov;
  }

  /**
   * Eksik PMP alanlarını döndür (min eşiğin altında kalanlar).
   */
  function getMissingCoverage(S) {
    const cov = computeCoverage(S);
    const missing = [];
    for (const [alan, min] of Object.entries(COVERAGE_MIN)) {
      if (cov[alan] < min) {
        missing.push({ alan, current: cov[alan], needed: min - cov[alan] });
      }
    }
    return missing;
  }

  // ── Ordeal Tespiti ──────────────────────────────────────────────────────────

  /**
   * Ordeal (En Büyük Sınav) tetiklenmeli mi?
   * @returns {boolean}
   */
  function shouldTriggerOrdeal(S, currentPhase) {
    if (S.ordealFired) return false;

    const poisonCount = Object.values(S.answered || {})
      .filter(v => v === 'D').length;

    const pendingCount = (S.pendingCrises || []).length;

    const phaseOrder = ['baslangic', 'planlama', 'yurutme', 'izleme', 'kapanis'];
    const currentIdx = phaseOrder.indexOf(currentPhase);
    const minIdx = phaseOrder.indexOf(ORDEAL_THRESHOLDS.min_phase);

    return (
      pendingCount >= ORDEAL_THRESHOLDS.min_pending_crises &&
      poisonCount  >= ORDEAL_THRESHOLDS.min_poison_count  &&
      currentIdx   >= minIdx
    );
  }

  /**
   * Ordeal bildirimi üret.
   * Birikmiş krizlere dayanarak üç alanı aynı anda sorgulayan özel karar.
   */
  function buildOrdealNotification(S) {
    const pending = S.pendingCrises || [];
    const poisonCount = Object.values(S.answered || {}).filter(v => v === 'D').length;

    // İlk birikmiş krizin reason_context'ini narratif için kullan
    const ctxs = pending.slice(0, 3).map(c => c.reason_context).filter(Boolean);
    const narrative = ctxs.length
      ? ctxs.join(' ') + ' '
      : 'Aylardır biriken kararların faturası bugün geldi. ';

    return {
      id: `ordeal_${Date.now()}`,
      type: 'decision',
      is_ordeal: true,
      mesele_id: 'ordeal',
      phase: 'izleme',
      phaseLabel: 'En Büyük Sınav',
      from: 'Sponsor',
      fromRole: 'Proje Sponsoru',
      subject: '🔴 ACİL: Proje Kriz Noktasında — Acil Toplantı',
      body: `Sayın PM,\n\n${narrative}` +
        `Bugün itibarıyla üç ayrı cephede kriz yaşıyoruz:\n\n` +
        `📋 SÜREÇ: Onaysız kapsam genişlemeleri yüzünden kod kalitesi kritik eşiğin altına düştü, test süreçleri atlanmış durumda.\n\n` +
        `👥 EKİP: Kilit teknik liderimiz ciddi tükenmişlik içinde. Psikolojik güvenlik sarsıldı, bilgi paylaşımı durdu.\n\n` +
        `🌐 DIŞ ÇEVRE: PMO onaysız yapılan kapsam değişikliklerini yasal uyumluluk ihlali olarak kayıt altına aldı. Denetim başlatılıyor.\n\n` +
        `Açıkça söyleyeyim: Bu noktada ne yapacağınız projenin kaderini belirleyecek.`,
      options: [
        {
          key: 'A',
          text: 'Tüm tarafları acil toplantıya çağırıyorum: önce şeffaf bir durum değerlendirmesi, sonra kapsam yeniden müzakeresi, ardından ekiple bireysel görüşmeler. PMO ile iletişim kurarak uyumluluk planı hazırlıyorum.',
          xp: 60,
          isEthical: true,
          feedback: 'Krizin üç boyutunu da ele alan liderlik. Zor ama doğru yol.',
          pmp_alan: 'all',
        },
        {
          key: 'B',
          text: 'Önce PMO krizini çözeyim — uyumluluk belgelerini hazırlıyorum. Sonra ekiple konuşurum.',
          xp: 20,
          isEthical: true,
          feedback: 'Dışsal baskıyı önceliklendirdin ama ekip yarası büyüyor.',
          pmp_alan: 'biz_cevre',
        },
        {
          key: 'C',
          text: 'Ekipteki kilit kişiyle özel görüşme yapıyorum, onu tutmaya çalışıyorum. Kapsam ve PMO meselelerini sonraya bırakıyorum.',
          xp: 10,
          isEthical: true,
          feedback: 'İnsan odaklı yaklaşım ama sistemik sorunlar birikmaya devam ediyor.',
          pmp_alan: 'people',
        },
        {
          key: 'D',
          text: 'Durumu sponsora bildirip kararı ona bırakıyorum. Artık benim elim değil.',
          xp: -40,
          isEthical: false,
          feedback: 'PM liderliğini bıraktı. Bu kriz senin sorumluluğundu.',
          triggers: [
            {
              target_issue: 'teslimat_sonrasi_kriz',
              delay_phase: 1,
              reason_context: 'Ordeal aşamasında liderlikten kaçınma projeyi son aşamaya taşıdı.',
            }
          ],
        },
      ],
    };
  }

  // ── Hero Journey Perde Bilgisi ──────────────────────────────────────────────

  /**
   * Section ID'den Hero Journey perdesini bul.
   * PSG'nin section.id'si 1-5 arası.
   */
  function getHeroPerde(sectionId) {
    const map = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5' };
    const key = map[sectionId] || 'P1';
    return { id: key, ...HERO_JOURNEY[key] };
  }

  /**
   * Perde geçiş metni döndür.
   */
  function getPerdeTransitionText(fromSectionId, toSectionId) {
    const from = HERO_JOURNEY[`P${fromSectionId}`];
    const to   = HERO_JOURNEY[`P${toSectionId}`];
    if (!to) return null;
    return {
      perde_label: to.label,
      perde_subtitle: to.subtitle,
      from_label: from?.label || '',
      acilis_text: to.acilis_text,
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    HERO_JOURNEY,
    MESELE_PMP_ALAN,
    COVERAGE_MIN,

    // Kuyruğa ekle
    processTriggers,

    // Perde geçişinde
    tickPendingCrises,
    drainReadyCrises,

    // Ordeal
    shouldTriggerOrdeal,
    buildOrdealNotification,

    // PMP kapsam
    computeCoverage,
    getMissingCoverage,
    getPmpAlan,

    // Perde bilgisi
    getHeroPerde,
    getPerdeTransitionText,

    /** State'e NE eksiklikleri initialize et */
    initState(S) {
      if (!S.pendingCrises) S.pendingCrises = [];
      if (!S.ordealFired)   S.ordealFired   = false;
      if (!S.charState)     S.charState     = {};
      if (!S.heroPerde)     S.heroPerde     = 'P1';
    },
  };

})();

// Browser + module uyumu
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NarrativeEngine;
}
