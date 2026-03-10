/**
 * Personal Scenario Generator (PSG) v2
 * ─────────────────────────────────────
 * 5 proje fazı boyunca kronolojik karar + duyuru üretir.
 *
 * Yeni özellikler (v2):
 *   • Ad Soyad  — isimler.soyadlar kullanılır
 *   • Faz akışı — Başlatma → Planlama → Yürütme → İzleme → Kapanış
 *   • Yokluk    — doğum/hastalık izni başlayan karakter mesaj gönderemez
 *   • Lore      — 120-150 arası duyuru/hikâye bildirimi araya karışır
 *   • Geribildirim — her seçeneğe consequence nesnesi eklenir
 *
 * Kullanım:
 *   const scenario = await PSG.generate({ sector, dev_approach, player_name, project_name, session_id });
 *   localStorage.setItem('pmSim_personal_scenario', JSON.stringify(scenario));
 */
const PSG = (() => {
  'use strict';

  // ── Sabitler ─────────────────────────────────────────────────────────────────
  const BASE_HOUR    = 9;
  const OPTION_ORDER = ['medicine', 'distractor_1', 'distractor_2', 'poison'];
  const OPTION_KEYS  = { medicine: 'A', distractor_1: 'B', distractor_2: 'C', poison: 'D' };

  // Faz tanımları — decisions + loreCount toplamı tüm senaryo hacmini belirler
  const PHASES = [
    { id: 'baslangic', label: 'Başlatma',        decisions: 18, loreCount: 15 },
    { id: 'planlama',  label: 'Planlama',         decisions: 30, loreCount: 25 },
    { id: 'yurutme',   label: 'Yürütme',          decisions: 70, loreCount: 50 },
    { id: 'izleme',    label: 'İzleme & Kontrol', decisions: 40, loreCount: 25 },
    { id: 'kapanis',   label: 'Kapanış',          decisions: 22, loreCount: 15 },
  ];
  // Toplam: 180 karar + 130 lore = 310 bildirim

  // Her fazın mesele_id başına ağırlık çarpanı
  const PHASE_BIAS = {
    baslangic: { paydas_erisim_sorunu: 5, kaynak_erisilemezligi: 3, yazisiz_scope_degisikligi: 3, gorev_gecikmesi: 1, performans_geriligi: 1 },
    planlama:  { yazisiz_scope_degisikligi: 5, kaynak_erisilemezligi: 4, paydas_erisim_sorunu: 3, gorev_gecikmesi: 2, performans_geriligi: 1 },
    yurutme:   { performans_geriligi: 5, gorev_gecikmesi: 4, paydas_erisim_sorunu: 3, yazisiz_scope_degisikligi: 2, kaynak_erisilemezligi: 2 },
    izleme:    { gorev_gecikmesi: 5, performans_geriligi: 4, yazisiz_scope_degisikligi: 3, paydas_erisim_sorunu: 2, kaynak_erisilemezligi: 1 },
    kapanis:   { paydas_erisim_sorunu: 4, yazisiz_scope_degisikligi: 3, gorev_gecikmesi: 2, performans_geriligi: 2, kaynak_erisilemezligi: 1 },
  };

  // Seçime göre geribildirim şablonları
  const CONSEQUENCE_TPLS = {
    medicine: [
      { sender: 'sponsor', subject: 'Teşekkürler, {player_name}', body: 'Durumu çok iyi yönettin. Ekip morali yüksek kalmaya devam ediyor; bu tutumu sürdürmeni öneririm.' },
      { sender: 'team',    subject: 'Olumlu Geri Bildirim',       body: 'Aldığın karar sayesinde süreç hızla normalleşti. Ekip seni bu konudaki tutumun için takdir ediyor.' },
      { sender: 'client',  subject: 'Memnuniyetle Karşılandı',   body: 'Yaklaşımınız müşteri tarafında olumlu yankı uyandırdı. İşbirliğinin bu şekilde devam etmesini umuyoruz.' },
    ],
    distractor_1: [
      { sender: 'team',    subject: 'Durum Henüz Kapanmadı',      body: 'Niyetin iyiydi ancak tercih edilen yöntem beklenen etkiyi tam olarak yaratmadı. Durumu izlemeye devam etmek faydalı olur.' },
      { sender: 'sponsor', subject: 'Kısmen Etkili',              body: 'Alınan önlem kısmen sonuç verdi; ancak kök neden henüz tam çözülmedi. Bir takip adımı gerekebilir.' },
    ],
    distractor_2: [
      { sender: 'team',    subject: 'Kaygılar Sürüyor',           body: 'Ekipten bazı üyeler konuyla ilgili endişelerini dile getirmeye devam ediyor. Durumu yakından izlemeni öneririm.' },
      { sender: 'sponsor', subject: 'Süreç Bir Miktar Yavaşladı', body: 'Seçilen yaklaşım kısa vadede süreci yavaşlattı. Telafi planı hazırlamayı düşünebilirsin.' },
    ],
    poison: [
      { sender: 'team',    subject: 'Ekipte Hoşnutsuzluk Var',    body: 'Alınan kararın ardından ekipten olumsuz tepkiler geldi. Durumu acilen değerlendirmeni ve onarıcı bir adım atmayı öneririm.' },
      { sender: 'client',  subject: 'Müşteri Endişesi Yüksek',   body: 'Müşteri temsilcisi konuyla ilgili ciddi endişelerini iletti. Hızlı ve yapıcı bir yanıt verilmesi gerekiyor.' },
      { sender: 'sponsor', subject: 'Risk Seviyesi Arttı',        body: 'Bu karar proje riski üzerinde olumsuz etki yarattı. Sponsor düzeyinde bir eskalasyon söz konusu olabilir; dikkatli ol.' },
    ],
  };

  // Tailor → roller.json sektör eşlemesi
  const SECTOR_MAP = {
    it:           'yazilim',
    yazilim:      'yazilim',
    construction: 'insaat',
    insaat:       'insaat',
    health:       'saglik',
    saglik:       'saglik',
    finance:      'finans',
    finans:       'finans',
    defense:      'savunma',
    savunma:      'savunma',
    education:    'egitim',
    egitim:       'egitim',
    uretim:       'uretim',
    perakende:    'perakende',
  };

  // ── Seeded LCG PRNG ──────────────────────────────────────────────────────────
  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 4294967296; };
  }

  function seedFromString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    return h >>> 0;
  }

  // ── Süre string → karar sayısı dönüşümü ─────────────────────────────────────
  function durationToDecisions(durationStr) {
    if (!durationStr) return 0;
    const s = durationStr.toLowerCase().trim();
    if (s === 'bugün')       return 2;
    if (s === 'bu hafta')    return 5;
    if (s === 'birkaç gün')  return 3;
    if (s === '3 gün')       return 2;
    if (s === '10 gün')      return 5;
    if (s === '1 hafta')     return 5;
    if (s === '2 hafta')     return 10;
    if (s === '3 hafta')     return 15;
    if (s === '4 hafta')     return 20;
    if (s === '8 hafta')     return 40;
    if (s === '1 ay')        return 20;
    if (s === '2 ay')        return 35;
    if (s === '3 ay')        return 50;
    if (s === '4 ay')        return 65;
    if (s === '5 ay')        return 80;
    if (s === '6 ay')        return 100;
    if (s === '12 ay')       return 999; // senaryo boyunca yokta
    const wm = s.match(/(\d+)\s*hafta/);  if (wm) return parseInt(wm[1]) * 5;
    const mm = s.match(/(\d+)\s*ay/);     if (mm) return parseInt(mm[1]) * 20;
    const dm = s.match(/(\d+)\s*gün/);    if (dm) return Math.max(1, Math.ceil(parseInt(dm[1]) / 2));
    return 5;
  }

  // ── Yardımcılar ──────────────────────────────────────────────────────────────
  function weightedChoice(items, weights, rng) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  function randChoice(arr, rng) {
    return arr && arr.length ? arr[Math.floor(rng() * arr.length)] : undefined;
  }

  function fill(tpl, vars) {
    if (typeof tpl !== 'string') return tpl;
    let s = tpl;
    for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v ?? ''));
    return s;
  }

  function toTime(idx) {
    // 310 bildirim × 15 dk ≈ 77 saat ≈ 10 iş günü
    const mins = idx * 15;
    const h    = BASE_HOUR + Math.floor(mins / 60);
    const m    = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  async function fetchJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`[PSG] ${r.status}: ${url}`);
    return r.json();
  }

  /**
   * Mesele tipi verisini çek — Supabase öncelikli, yerel dosya fallback.
   * window.__sbFetchMeseleTipi(id) varsa Supabase'den çeker (ticari IP koruması).
   * @param {string} id
   * @returns {Promise<object>}
   */
  async function fetchMeseleTipi(id) {
    if (typeof window !== 'undefined' && typeof window.__sbFetchMeseleTipi === 'function') {
      const data = await window.__sbFetchMeseleTipi(id);
      if (data) return data;
    }
    // Fallback: yerel dosya (dev ortamı)
    return fetchJson(`data/mesele-tipleri/${id}.json`);
  }

  /**
   * Tüm mesele tipi ID listesini çek — Supabase öncelikli, yerel fallback.
   * @returns {Promise<string[]>}
   */
  async function fetchMeseleTipiIds() {
    if (typeof window !== 'undefined' && typeof window.__sbFetchMeseleTipiIds === 'function') {
      const ids = await window.__sbFetchMeseleTipiIds();
      if (ids && ids.length) return ids;
    }
    // Fallback: yerel _index.json (dev ortamı)
    return fetchJson('data/mesele-tipleri/_index.json');
  }

  // ── Yokluk takibi ────────────────────────────────────────────────────────────
  // absenceMap: fullName → endIdx (o index dahil yokta)
  function isAbsent(fullName, currentIdx, absenceMap) {
    const end = absenceMap.get(fullName);
    return end !== undefined && currentIdx <= end;
  }

  function activeKadro(kadro, currentIdx, absenceMap) {
    return kadro.filter(k => !isAbsent(k.fullName, currentIdx, absenceMap));
  }

  // ── Lore pozisyon dağıtımı ───────────────────────────────────────────────────
  // Toplam slot içinde loreCount adet lore pozisyonunu eşit aralıklarla dağıt
  function distributeLore(totalSlots, loreCount, rng) {
    const positions = new Set();
    if (loreCount <= 0 || totalSlots <= 0) return positions;
    const step = totalSlots / (loreCount + 1);
    for (let i = 0; i < loreCount; i++) {
      let pos = Math.round((i + 1) * step - 1);
      pos += Math.floor((rng() - 0.5) * step * 0.5);
      pos = Math.max(0, Math.min(totalSlots - 1, pos));
      while (positions.has(pos)) pos = (pos + 1) % totalSlots;
      positions.add(pos);
    }
    return positions;
  }

  // ── Mesele seçimi (faz biased) ───────────────────────────────────────────────
  function pickMesele(meseleTipiIds, meseleTipleri, phaseBias, reasonUseCounts, rng) {
    const available = meseleTipiIds.filter(id => {
      const m = meseleTipleri[id];
      return m && m.reasons && m.reasons.some(r => (reasonUseCounts[r.reason_id] || 0) < (r.max_per_scenario ?? 1));
    });
    if (!available.length) return null;

    const weights = available.map(id => {
      const bias = phaseBias[id] ?? 1;
      const m    = meseleTipleri[id];
      const avW  = m.reasons
        .filter(r => (reasonUseCounts[r.reason_id] || 0) < (r.max_per_scenario ?? 1))
        .reduce((s, r) => s + (r.weight ?? 1), 0);
      return bias * avW;
    });

    return meseleTipleri[weightedChoice(available, weights, rng)];
  }

  function pickReason(mesele, reasonUseCounts, rng) {
    const av = mesele.reasons.filter(r => (reasonUseCounts[r.reason_id] || 0) < (r.max_per_scenario ?? 1));
    if (!av.length) return null;
    return weightedChoice(av, av.map(r => r.weight ?? 1), rng);
  }

  // ── Gönderici seçimi ─────────────────────────────────────────────────────────
  function resolveSender(senderType, genderHint, kadro, disKisiler, currentIdx, absenceMap, rng) {
    if (senderType === 'client')   return { name: disKisiler[0].fullName, role: disKisiler[0].role };
    if (senderType === 'sponsor')  return { name: disKisiler[1].fullName, role: disKisiler[1].role };
    if (senderType === 'end_user') return { name: disKisiler[2].fullName, role: disKisiler[2].role };

    if (senderType === 'hr') {
      const hrPool = kadro.filter(k => k.gender === 'female');
      const hr = hrPool.length ? randChoice(hrPool, rng) : kadro[0];
      return { name: hr.fullName, role: 'İK Uzmanı' };
    }

    // team / self / third_party / internal → aktif kadroudan seç
    const g    = genderHint || 'any';
    const pool = activeKadro(kadro, currentIdx, absenceMap).filter(k => g === 'any' || k.gender === g);
    const member = pool.length
      ? randChoice(pool, rng)
      : randChoice(activeKadro(kadro, currentIdx, absenceMap), rng) || randChoice(kadro, rng);
    return { name: member?.fullName || '', role: member?.role || '' };
  }

  // ── Geribildirim üretimi ─────────────────────────────────────────────────────
  function makeConsequence(optionKey, vars, kadro, disKisiler, rng) {
    const tpls = CONSEQUENCE_TPLS[optionKey] || CONSEQUENCE_TPLS['distractor_2'];
    const tpl  = randChoice(tpls, rng);
    let fromName, fromRole;
    if (tpl.sender === 'sponsor')     { fromName = disKisiler[1].fullName; fromRole = disKisiler[1].role; }
    else if (tpl.sender === 'client') { fromName = disKisiler[0].fullName; fromRole = disKisiler[0].role; }
    else { const m = randChoice(kadro, rng) || kadro[0]; fromName = m.fullName; fromRole = m.role; }
    return { from: fromName, fromRole, subject: fill(tpl.subject, vars), body: fill(tpl.body, vars) };
  }

  // ── Karar bildirimi render ───────────────────────────────────────────────────
  function renderDecision(globalIdx, mesele, reason, phase, kadro, disKisiler, absenceMap, rng, baseVars) {
    // body_vars doldur — sector_vars varsa sektöre özgü değerleri üzerine yaz
    const mergedBodyVars = Object.assign({}, reason.body_vars || {}, (reason.sector_vars || {})[baseVars.mappedSector] || {});
    const bodyVars = {};
    for (const [vn, opts] of Object.entries(mergedBodyVars)) {
      bodyVars[vn] = randChoice(opts, rng);
    }

    // duration
    let duration = '';
    if (reason.duration) {
      duration = reason.duration.type === 'fixed'
        ? reason.duration.value
        : randChoice(reason.duration.options, rng);
    }

    const senderType = reason.sender || 'self';

    // Konu (bildirim gönderilen kişi) — sender'dan farklı olabilir
    let charName = '', charRole = '', charGender = 'any', charFirstName = '';
    if (['client', 'sponsor', 'end_user'].includes(senderType)) {
      const dk = senderType === 'client' ? disKisiler[0] : senderType === 'sponsor' ? disKisiler[1] : disKisiler[2];
      charName = dk.fullName; charRole = dk.role;
      charGender = dk.gender || 'any'; charFirstName = dk.firstName || charName.split(' ')[0];
    } else {
      const g    = reason.gender || 'any';
      const pool = activeKadro(kadro, globalIdx, absenceMap).filter(k => g === 'any' || k.gender === g);
      const m    = pool.length
        ? randChoice(pool, rng)
        : randChoice(activeKadro(kadro, globalIdx, absenceMap), rng) || randChoice(kadro, rng);
      charName = m?.fullName || ''; charRole = m?.role || '';
      charGender = m?.gender || 'any'; charFirstName = m?.firstName || charName.split(' ')[0];
    }
    // {name_polite} = "Serdar Bey" / "Elif Hanım" — selamlama için doğal Türkçe hitap formu
    const charPolite = charGender === 'female' ? `${charFirstName} Hanım`
                     : charGender === 'male'   ? `${charFirstName} Bey`
                     : charFirstName;

    const vars = { ...baseVars, name: charName, name_polite: charPolite, name_first: charFirstName, role: charRole, duration, month: 'Kasım', ...bodyVars };

    // Mesajı gerçekte kimin gönderdiği
    let fromName, fromRole;
    if (senderType === 'self') {
      fromName = charName; fromRole = charRole;
    } else if (senderType === 'third_party') {
      const others = activeKadro(kadro, globalIdx, absenceMap).filter(k => k.fullName !== charName);
      const other  = others.length ? randChoice(others, rng) : randChoice(kadro, rng);
      fromName = other.fullName; fromRole = 'Ekip Üyesi';
    } else if (senderType === 'hr') {
      const hrPool = kadro.filter(k => k.gender === 'female');
      const hr = hrPool.length ? randChoice(hrPool, rng) : kadro[0];
      fromName = hr.fullName; fromRole = 'İK Uzmanı';
    } else if (['client', 'end_user', 'sponsor', 'internal'].includes(senderType)) {
      if (['client', 'sponsor', 'end_user'].includes(senderType)) {
        fromName = charName; fromRole = charRole;
      } else {
        const relay = randChoice(activeKadro(kadro, globalIdx, absenceMap).filter(k => k.fullName !== charName), rng) || kadro[0];
        fromName = relay.fullName; fromRole = 'İç Paydaş';
      }
    } else {
      fromName = charName; fromRole = charRole;
    }

    // Yokluk tetikleyici — mesele seviyesinde ya da reason seviyesinde işaretlenmiş
    const triggersAbsence = reason.triggers_absence ?? mesele.triggers_absence_default ?? false;
    if (triggersAbsence && charName && kadro.some(k => k.fullName === charName)) {
      const decCount = durationToDecisions(duration);
      if (decCount > 0) absenceMap.set(charName, globalIdx + decCount);
    }

    // Seçenekler + geribildirim
    // optionVars: seçenek metinlerinde {name} → kibar hitap ("Serdar Bey" / "Elif Hanım")
    // subject/body şablonlarında {name} → tam ad korunur (farklı anlam)
    const optionVars = { ...vars, name: charPolite };
    const options = OPTION_ORDER.map(key => {
      const opt = reason.options?.[key];
      if (!opt) return null;
      return {
        key:         OPTION_KEYS[key],
        text:        fill(opt.text_template, optionVars),
        xp:          opt.xp,
        isEthical:   opt.isEthical,
        triggers:    opt.triggers || [],   // Karma kuyruğu için — NarrativeEngine.processTriggers() okur
        consequence: makeConsequence(key, vars, kadro, disKisiler, rng),
      };
    }).filter(Boolean);

    return {
      id:         globalIdx + 1,
      type:       'decision',
      phase:      phase.id,
      phaseLabel: phase.label,
      section:    PHASES.findIndex(p => p.id === phase.id) + 1,
      time:       toTime(globalIdx),
      mesele_id:  mesele.mesele_id,
      reason_id:  reason.reason_id,
      from:       fromName,
      fromRole,
      subject:    fill(reason.subject_template, vars),
      body:       fill(reason.body_template, vars),
      options,
    };
  }

  // ── Lore bildirimi render ────────────────────────────────────────────────────
  function renderLore(globalIdx, tpl, phase, kadro, disKisiler, absenceMap, rng, baseVars) {
    let fromName, fromRole;
    const st  = tpl.sender_type || 'team';
    const act = activeKadro(kadro, globalIdx, absenceMap);

    // Yokluk duyurusu mu?
    if (tpl.absence) {
      const g    = tpl.gender || 'any';
      const pool = act.filter(k => g === 'any' || k.gender === g);
      const absentChar = pool.length ? randChoice(pool, rng) : null;

      if (absentChar) {
        const dur = tpl.absence.duration_decisions || 25;
        absenceMap.set(absentChar.fullName, globalIdx + dur);

        // İK olarak gönder
        const hrPool = kadro.filter(k => k.gender === 'female' && k.fullName !== absentChar.fullName);
        const hr = hrPool.length ? randChoice(hrPool, rng) : kadro[0];
        fromName = hr.fullName; fromRole = 'İK Uzmanı';

        const vars = { ...baseVars, name: absentChar.fullName, role: absentChar.role };
        return {
          id:         globalIdx + 1,
          type:       'story',
          phase:      phase.id,
          phaseLabel: phase.label,
          section:    PHASES.findIndex(p => p.id === phase.id) + 1,
          time:       toTime(globalIdx),
          from:       fromName,
          fromRole,
          subject:    fill(tpl.subject_template, vars),
          body:       fill(tpl.body_template, vars),
        };
      }
      // Uygun karakter yoksa düz lore olarak devam et
    }

    if (st === 'sponsor')       { fromName = disKisiler[1].fullName; fromRole = disKisiler[1].role; }
    else if (st === 'client')   { fromName = disKisiler[0].fullName; fromRole = disKisiler[0].role; }
    else if (st === 'end_user') { fromName = disKisiler[2].fullName; fromRole = disKisiler[2].role; }
    else if (st === 'hr') {
      const hrPool = kadro.filter(k => k.gender === 'female');
      const hr = hrPool.length ? randChoice(hrPool, rng) : kadro[0];
      fromName = hr.fullName; fromRole = 'İK Uzmanı';
    } else {
      // team
      const g    = tpl.gender || 'any';
      const pool = act.filter(k => g === 'any' || k.gender === g);
      const m    = pool.length ? randChoice(pool, rng) : randChoice(act, rng) || kadro[0];
      fromName   = m?.fullName || 'Ekip Üyesi';
      fromRole   = m?.role     || 'Ekip Üyesi';
    }

    const vars = { ...baseVars, name: fromName, role: fromRole };
    return {
      id:         globalIdx + 1,
      type:       'story',
      phase:      phase.id,
      phaseLabel: phase.label,
      section:    PHASES.findIndex(p => p.id === phase.id) + 1,
      time:       toTime(globalIdx),
      from:       fromName,
      fromRole,
      subject:    fill(tpl.subject_template, vars),
      body:       fill(tpl.body_template, vars),
    };
  }

  // ── Ana üretim fonksiyonu ────────────────────────────────────────────────────
  async function generate(config = {}) {
    const {
      sector         = 'yazilim',
      sector_label   = null,
      dev_approach   = 'hybrid',
      difficulty     = 'medium',
      pmo_type       = null,
      team_culture   = null,
      player_name    = 'PM',
      project_name   = 'Stratejik Proje',
      session_id     = Date.now().toString(36),
      totalDecisions = 180,
    } = config;

    // Cinsiyete göre kibarca hitap (Hanım / Bey) — tam ad kullanılır
    const _pgGender = (() => { try { return JSON.parse(localStorage.getItem('pmSim_work_meta') || '{}').gender || ''; } catch { return ''; } })();
    const _playerPolite = _pgGender === 'female' ? `${player_name} Hanım`
                        : _pgGender === 'male'   ? `${player_name} Bey`
                        : player_name;

    // Kaynakları paralel yükle (havuzlar yerel kalır; mesele tipleri Supabase'den)
    const [isimler, roller, meseleTipiIds, loreTpls] = await Promise.all([
      fetchJson('data/havuzlar/isimler.json'),
      fetchJson('data/havuzlar/roller.json'),
      fetchMeseleTipiIds(),
      fetchJson('data/havuzlar/lore_templates.json'),
    ]);

    // Mesele tipi JSON'larını paralel yükle (Supabase öncelikli)
    // Promise.allSettled kullanılıyor: tek bir hata tüm yüklemeyi çökertmesin
    const meseleTipleri = {};
    const _mtResults = await Promise.allSettled(meseleTipiIds.map(async id => {
      const data = await fetchMeseleTipi(id);
      return { id, data };
    }));
    let _loadedCount = 0;
    _mtResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value?.data) {
        meseleTipleri[r.value.id] = r.value.data;
        _loadedCount++;
      }
    });
    console.log(`[PSG] Mesele tipleri: ${_loadedCount}/${meseleTipiIds.length} yüklendi`);
    if (_loadedCount === 0) {
      throw new Error('Hiç mesele tipi yüklenemedi — lütfen giriş yapın veya bağlantınızı kontrol edin');
    }

    const rng      = makeRng(seedFromString(session_id));
    const soyadlar = isimler.soyadlar || [];
    const usedFirstNames = new Set();

    // Tam ad üret (ad + soyad)
    function pickFullName(gender) {
      let pool;
      if (gender === 'female')    pool = isimler.female.filter(n => !usedFirstNames.has(n));
      else if (gender === 'male') pool = isimler.male.filter(n => !usedFirstNames.has(n));
      else                        pool = [...isimler.female, ...isimler.male].filter(n => !usedFirstNames.has(n));

      if (!pool.length) pool = gender === 'female' ? isimler.female : gender === 'male' ? isimler.male : isimler.female;

      const firstName = randChoice(pool, rng);
      usedFirstNames.add(firstName);
      const soyad = soyadlar.length ? randChoice(soyadlar, rng) : '';
      return { fullName: `${firstName} ${soyad}`.trim(), firstName, gender };
    }

    // Kadro (8 kişi)
    const KADRO_GENDERS = ['female', 'male', 'female', 'male', 'female', 'male', 'female', 'male'];
    const mappedSector  = SECTOR_MAP[sector] || 'yazilim';
    const sektorRoller  = roller[mappedSector] || roller['yazilim'] || ['Geliştirici', 'Test Uzmanı', 'Analist'];
    const kadro = KADRO_GENDERS.map(g => ({
      ...pickFullName(g),
      role: randChoice(sektorRoller, rng),
    }));

    // Dış kişiler (müşteri, sponsor, son kullanıcı)
    const disKisiler = [
      { ...pickFullName('female'), role: 'Müşteri Yetkilisi',         kind: 'client'   },
      { ...pickFullName('male'),   role: 'Sponsor',                   kind: 'sponsor'  },
      { ...pickFullName('any'),    role: 'Son Kullanıcı Temsilcisi',  kind: 'end_user' },
    ];

    const absenceMap      = new Map();
    const reasonUseCounts = {};
    const baseVars        = { player_name, project_name, mappedSector };

    // ── Hoşgeldiniz bildirimleri (her senaryo bunlarla başlar) ──────────────
    const hrPool   = kadro.filter(k => k.gender === 'female');
    const hrPerson = hrPool.length ? randChoice(hrPool, rng) : kadro[0];
    const sponsor  = disKisiler[1];

    const allNotifications = [
      {
        type: 'story', phase: 'baslangic', phaseLabel: 'Başlatma', section: 1,
        from: hrPerson.fullName, fromRole: 'İK Uzmanı',
        subject: `${project_name} — Hoş Geldiniz`,
        body: `Sayın ${_playerPolite},\n\n${project_name} projesinde Proje Yöneticisi olarak görevlendirildiniz. Ekibinize ve proje belgelerine bugün itibarıyla erişiminiz tanımlanmıştır.\n\nEkip tanışma toplantısı ve oryantasyon programı önümüzdeki günlerde düzenlenecektir. Herhangi bir sorunuz olursa benimle iletişime geçebilirsiniz.\n\nBaşarılar dileriz.`,
      },
      {
        type: 'story', phase: 'baslangic', phaseLabel: 'Başlatma', section: 1,
        from: sponsor.fullName, fromRole: sponsor.role,
        subject: `${project_name} — İlk Mesajım`,
        body: `Sayın ${_playerPolite},\n\n${project_name} için sizi tercih ettiğimizden son derece memnunum. Bu proje kurumumuz açısından stratejik öneme sahip; ekibimizin doğru liderle yola çıktığına inanıyorum.\n\nHer türlü destek ve kaynağa erişiminiz mevcut. Önceliklerinizi ve ihtiyaçlarınızı doğrudan benimle paylaşmaktan çekinmeyin.\n\nBaşarılar.`,
      },
    ];
    let globalIdx = allNotifications.length; // 2'den başla

    // Faz başına karar sayısını totalDecisions'a oranla ölçekle
    const planTotal = PHASES.reduce((s, p) => s + p.decisions, 0); // 180
    const scale     = totalDecisions / planTotal;

    for (const phase of PHASES) {
      const phaseDecCount  = Math.round(phase.decisions * scale);
      const phaseLoreCount = phase.loreCount;
      const totalSlots     = phaseDecCount + phaseLoreCount;
      const phaseBias      = PHASE_BIAS[phase.id] || {};

      // Bu fazın lore şablonlarını filtrele
      const phaseLoreTpls = loreTpls.filter(t => t.phases.includes(phase.id));

      // Lore pozisyonlarını önceden belirle
      const lorePositions = distributeLore(totalSlots, phaseLoreCount, rng);

      let decisionsDone = 0;
      let loreDone      = 0;

      for (let slot = 0; slot < totalSlots; slot++) {
        if (lorePositions.has(slot) && loreDone < phaseLoreCount && phaseLoreTpls.length > 0) {
          // ── Lore bildirimi ──
          const tpl  = weightedChoice(phaseLoreTpls, phaseLoreTpls.map(t => t.weight ?? 1), rng);
          const lore = renderLore(globalIdx, tpl, phase, kadro, disKisiler, absenceMap, rng, baseVars);
          allNotifications.push(lore);
          loreDone++;
          globalIdx++;
        } else if (decisionsDone < phaseDecCount) {
          // ── Karar bildirimi ──
          const mesele = pickMesele(meseleTipiIds, meseleTipleri, phaseBias, reasonUseCounts, rng);
          if (!mesele) { globalIdx++; continue; }
          const reason = pickReason(mesele, reasonUseCounts, rng);
          if (!reason) { globalIdx++; continue; }

          reasonUseCounts[reason.reason_id] = (reasonUseCounts[reason.reason_id] || 0) + 1;
          const dec = renderDecision(globalIdx, mesele, reason, phase, kadro, disKisiler, absenceMap, rng, baseVars);
          allNotifications.push(dec);
          decisionsDone++;
          globalIdx++;
        } else if (loreDone < phaseLoreCount && phaseLoreTpls.length > 0) {
          // Karar bitti ama hâlâ lore slotu var
          const tpl  = weightedChoice(phaseLoreTpls, phaseLoreTpls.map(t => t.weight ?? 1), rng);
          const lore = renderLore(globalIdx, tpl, phase, kadro, disKisiler, absenceMap, rng, baseVars);
          allNotifications.push(lore);
          loreDone++;
          globalIdx++;
        }
      }
    }

    // id ve time alanlarını sırayla yeniden ata
    allNotifications.forEach((n, i) => {
      n.id   = i + 1;
      n.time = toTime(i);
    });

    return {
      id:          `personal-${session_id.slice(0, 8)}`,
      title:       `${project_name} — Kariyer Simülasyonu`,
      generated:   true,
      sector,
      sector_label: sector_label || sector,
      dev_approach,
      difficulty,
      pmo_type,
      team_culture,
      player_name,
      project_name,
      kadro,
      dis_kisiler: disKisiler,
      // game.html'in section-tabanlı batch sistemini doğru besle
      sections: PHASES.map((p, i) => ({
        id:        i + 1,
        title:     `${i + 1}. Faz: ${p.label}`,
        iteration: p.label,
      })),
      notifications: allNotifications,
    };
  }

  return { generate };
})();
