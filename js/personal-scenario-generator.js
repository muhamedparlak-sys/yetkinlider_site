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
  const DISPLAY_KEYS = ['A', 'B', 'C', 'D'];
  // Not: OPTION_KEYS kaldırıldı — seçenekler artık her soruda rastgele karıştırılır

  // Faz tanımları — decisions + loreCount toplamı tüm senaryo hacmini belirler
  const PHASES = [
    { id: 'baslangic', label: 'Başlatma',        decisions: 18, loreCount: 15 },
    { id: 'planlama',  label: 'Planlama',         decisions: 30, loreCount: 25 },
    { id: 'yurutme',   label: 'Yürütme',          decisions: 70, loreCount: 50 },
    { id: 'izleme',    label: 'İzleme & Kontrol', decisions: 40, loreCount: 25 },
    { id: 'kapanis',   label: 'Kapanış',          decisions: 22, loreCount: 15 },
  ];
  // Toplam: 180 karar + 130 lore = 310 bildirim

  // Her fazın mesele_id başına ağırlık çarpanı — tüm 36 mesele tipi dahil
  // Mantık: fazın PM sürecine uygun tipler yüksek ağırlıkla, diğerleri 1 (varsayılan)
  const PHASE_BIAS = {
    // ── 1. BAŞLATMA (18 karar) ─────────────────────────────────────────────────
    // Odak: kapsam netleştirme, paydaş beklenti yönetimi, ilk kaynak & ekip kurulumu
    baslangic: {
      kapsam_belirsizligi:       5,
      paydas_erisim_sorunu:      4,
      yazisiz_scope_degisikligi: 4,
      beklenti_sapma:            4,
      yetkinlik_uyumsuzlugu:     3,
      kaynak_erisilemezligi:     3,
      dis_etki_mudahalesi:       3,
      patron_degisikligi:        3,
      gizli_bagimlilik:          2,
      paydas_catismasi:          2,
      gereksinim_catismasi:      2,
      uyum_ve_lisans:            2,
      tedarikci_sorunu:          2,
      yeni_uye_entegrasyonu:     1,
      kilit_kisi_bagimlilik:     1,
    },
    // ── 2. PLANLAMA (30 karar) ─────────────────────────────────────────────────
    // Odak: gereksinimleri netleştirme, bağımlılıklar, kaynak planı, risk planı
    planlama: {
      gereksinim_catismasi:      5,
      kapsam_belirsizligi:       5,
      gizli_bagimlilik:          4,
      kaynak_erisilemezligi:     4,
      yazisiz_scope_degisikligi: 3,
      milestone_baskisi:         3,
      takvim_degisikligi:        3,
      uyum_ve_lisans:            3,
      tedarikci_sorunu:          3,
      yeni_uye_entegrasyonu:     3,
      kilit_kisi_bagimlilik:     3,
      cakisan_gorevlendirme:     3,
      paydas_catismasi:          2,
      beklenti_sapma:            2,
      kayitli_risk_gerceklesti:  2,
      tanimsiz_risk:             2,
      paydas_erisim_sorunu:      2,
      patron_degisikligi:        2,
    },
    // ── 3. YÜRÜTME (70 karar) ─────────────────────────────────────────────────
    // Odak: ekip performansı, kapsam kayması, kalite, teknik borç, bütçe
    yurutme: {
      gorev_gecikmesi:           5,
      performans_geriligi:       5,
      takim_catismasi:           4,
      gizli_kapsam_kabulu:       4,
      paralel_is_birikimi:       4,
      hata_gec_bildirim:         4,
      teknik_borc:               4,
      test_atlamasi_baskisi:     4,
      maliyet_asimi_riski:       3,
      kapsam_kiymeti_sorgusu:    3,
      kayitli_risk_gerceklesti:  3,
      tanimsiz_risk:             3,
      onaylanmamis_harcama:      3,
      bilgi_adasi:               3,
      yetkinlik_uyumsuzlugu:     3,
      dis_etki_mudahalesi:       2,
      tedarikci_sorunu:          2,
      takvim_degisikligi:        2,
      kilit_kisi_bagimlilik:     2,
      cakisan_gorevlendirme:     2,
      milestone_baskisi:         2,
      paydas_catismasi:          2,
      iletisim_kopuklugu:        2,
    },
    // ── 4. İZLEME & KONTROL (40 karar) ────────────────────────────────────────
    // Odak: bütçe takibi, risk gerçekleşmesi, ekip sorunları, kalite değerlendirme
    izleme: {
      gorev_gecikmesi:           5,
      performans_geriligi:       5,
      maliyet_asimi_riski:       4,
      butce_kesmesi:             4,
      kayitli_risk_gerceklesti:  4,
      teknik_borc:               4,
      takim_catismasi:           3,
      iletisim_kopuklugu:        3,
      kilit_kisi_bagimlilik:     3,
      tanimsiz_risk:             3,
      onaylanmamis_harcama:      3,
      teslimat_sonrasi_kriz:     3,
      bilgi_adasi:               3,
      paydas_catismasi:          2,
      milestone_baskisi:         2,
      takvim_degisikligi:        2,
      hata_gec_bildirim:         2,
      test_atlamasi_baskisi:     2,
    },
    // ── 5. KAPANIŞ (22 karar) ─────────────────────────────────────────────────
    // Odak: proje kapanışı, son teslimat, geç bulgular, ders çıkarma
    kapanis: {
      proje_kapatma_sorunu:      5,
      teslimat_sonrasi_kriz:     5,
      iletisim_kopuklugu:        4,
      teknik_borc:               3,
      gorev_gecikmesi:           3,
      performans_geriligi:       3,
      maliyet_asimi_riski:       2,
      butce_kesmesi:             2,
      paydas_erisim_sorunu:      2,
      hata_gec_bildirim:         2,
      tanimsiz_risk:             2,
      kayitli_risk_gerceklesti:  2,
      paydas_catismasi:          2,
    },
  };

  // Mesele tiplerinin PMP domain sınıflandırması (domain multiplier için)
  const MESELE_PMP_ALAN = {
    // ── People & Ekip (11) ──────────────────────────────────────────────────
    kaynak_erisilemezligi:     'people',
    performans_geriligi:       'people',
    paydas_erisim_sorunu:      'people',
    yetkinlik_uyumsuzlugu:     'people',
    bilgi_adasi:               'people',
    takim_catismasi:           'people',
    yeni_uye_entegrasyonu:     'people',
    kilit_kisi_bagimlilik:     'people',
    beklenti_sapma:            'people',
    paydas_catismasi:          'people',
    iletisim_kopuklugu:        'people',
    // ── Süreç & Kapsam (17) ─────────────────────────────────────────────────
    yazisiz_scope_degisikligi: 'process',
    gorev_gecikmesi:           'process',
    cakisan_gorevlendirme:     'process',
    kapsam_belirsizligi:       'process',
    gereksinim_catismasi:      'process',
    kapsam_kiymeti_sorgusu:    'process',
    gizli_kapsam_kabulu:       'process',
    gizli_bagimlilik:          'process',
    milestone_baskisi:         'process',
    takvim_degisikligi:        'process',
    paralel_is_birikimi:       'process',
    kayitli_risk_gerceklesti:  'process',
    tanimsiz_risk:             'process',
    hata_gec_bildirim:         'process',
    test_atlamasi_baskisi:     'process',
    teknik_borc:               'process',
    proje_kapatma_sorunu:      'process',
    // ── İş Çevresi (8) ──────────────────────────────────────────────────────
    patron_degisikligi:        'biz_cevre',
    dis_etki_mudahalesi:       'biz_cevre',
    tedarikci_sorunu:          'biz_cevre',
    uyum_ve_lisans:            'biz_cevre',
    teslimat_sonrasi_kriz:     'biz_cevre',
    maliyet_asimi_riski:       'biz_cevre',
    onaylanmamis_harcama:      'biz_cevre',
    butce_kesmesi:             'biz_cevre',
  };

  // ── Metodoloji × Rol Kısıtları ───────────────────────────────────────────────
  // Her metodoloji için zorunlu ve yasak roller
  const METHODOLOGY_ROLES = {
    agile: {
      required: ['Scrum Master', 'Ürün Sahibi'],
      forbidden: ['Proje Koordinatörü', 'Değişim Yöneticisi'],
    },
    predictive: {
      required: ['Proje Koordinatörü', 'Teknik Lider'],
      forbidden: ['Scrum Master', 'Ürün Sahibi'],
    },
    hybrid: {
      required: ['Teknik Lider'],
      forbidden: [],
    },
  };

  // Rol üst limitleri (aynı rolden kaç kişi olabilir)
  const ROLE_CAPS = {
    'Scrum Master':        1,
    'Ürün Sahibi':         1,
    'Proje Koordinatörü':  1,
    'Teknik Lider':        1,
    'Kıdemli Geliştirici': 2,
    'Geliştirici':         5,
    'QA Mühendisi':        2,
    'UX/UI Tasarımcı':     1,
    'Veri Analisti':       1,
    'Değişim Yöneticisi':  1,
  };

  // ── Arketip → Garantili Mesele Tipleri ────────────────────────────────────────
  // Bu arketip senaryoda varsa, listedeki mesele tiplerinden EN AZ 1 tane çıkar
  const ARCHETYPE_LOCKS = {
    // Ekip arketipleri
    tukenme:               ['performans_geriligi'],
    sakat_yildiz:          ['performans_geriligi', 'cakisan_gorevlendirme'],
    sessiz_usta:           ['bilgi_adasi', 'kilit_kisi_bagimlilik'],
    kriz_kahramani:        ['kayitli_risk_gerceklesti', 'paralel_is_birikimi'],
    torpilli:              ['onaylanmamis_harcama', 'paydas_catismasi'],
    iyi_niyetli_toy:       ['yetkinlik_uyumsuzlugu', 'yeni_uye_entegrasyonu'],
    // takim_dinamosu, guvenilir_orta → nötr, lock yok

    // Paydaş arketipleri
    firsatci:              ['yazisiz_scope_degisikligi', 'gizli_kapsam_kabulu'],
    burokratik_veto:       ['gereksinim_catismasi', 'milestone_baskisi'],
    uyuyan_dev:            ['paydas_erisim_sorunu', 'patron_degisikligi'],
    gurultulu_muhalif:     ['iletisim_kopuklugu', 'takim_catismasi'],
    musteri_arketip:       ['beklenti_sapma', 'kapsam_kiymeti_sorgusu'],
    savunmasiz_paydas:     ['teslimat_sonrasi_kriz'],

    // Süreç arketipleri (yeni isimler — metodoloji değil, proje profili)
    net_yol:               ['takvim_degisikligi', 'gereksinim_catismasi'],
    dinamik_ortam:         ['kapsam_belirsizligi', 'yazisiz_scope_degisikligi'],
    yapilandirilmis_donus: ['gizli_bagimlilik', 'cakisan_gorevlendirme'],
    uyumluluk_kafesi:      ['uyum_ve_lisans', 'hata_gec_bildirim'],
    acil_mod:              ['kayitli_risk_gerceklesti', 'tanimsiz_risk'],
    bilinmez_zemin:        ['kapsam_belirsizligi', 'teknik_borc'],
    buyutulmus_kapsam:     ['teknik_borc', 'cakisan_gorevlendirme'],

    // Çevre arketipleri
    duzenlenmis_liman:     ['uyum_ve_lisans', 'butce_kesmesi'],
    girisimci_saha:        ['kaynak_erisilemezligi', 'tanimsiz_risk'],
    koklu_kurum:           ['patron_degisikligi', 'dis_etki_mudahalesi'],
    fintech_firtinasi:     ['uyum_ve_lisans', 'maliyet_asimi_riski'],
    inovasyon_merkezi:     ['tanimsiz_risk', 'teknik_borc'],
    rekabetci_arena:       ['takvim_degisikligi', 'maliyet_asimi_riski'],
    gecis_ekonomisi:       ['patron_degisikligi', 'kaynak_erisilemezligi'],
  };

  // ── Mesele → Zorunlu Arketip ─────────────────────────────────────────────────
  // Bu mesele tipi yalnızca listede en az 1 arketip senaryoda varsa havuzda kalır.
  // Boş/tanımsız = evrensel, her zaman erişilebilir.
  const MESELE_REQUIRED_ARCHETYPES = {
    bilgi_adasi:               ['sessiz_usta'],
    kilit_kisi_bagimlilik:     ['sessiz_usta', 'kriz_kahramani'],
    performans_geriligi:       ['tukenme', 'sakat_yildiz'],
    yetkinlik_uyumsuzlugu:     ['iyi_niyetli_toy'],
    yeni_uye_entegrasyonu:     ['iyi_niyetli_toy'],
    onaylanmamis_harcama:      ['torpilli', 'firsatci'],
    proje_kapatma_sorunu:      ['torpilli'],
    paydas_catismasi:          ['torpilli', 'burokratik_veto', 'gurultulu_muhalif'],
    takim_catismasi:           ['tukenme', 'torpilli', 'gurultulu_muhalif'],
    yazisiz_scope_degisikligi: ['firsatci', 'dinamik_ortam'],
    gizli_kapsam_kabulu:       ['firsatci', 'dinamik_ortam'],
    gereksinim_catismasi:      ['burokratik_veto', 'net_yol'],
    milestone_baskisi:         ['burokratik_veto', 'acil_mod'],
    paydas_erisim_sorunu:      ['uyuyan_dev'],
    patron_degisikligi:        ['uyuyan_dev', 'koklu_kurum', 'gecis_ekonomisi'],
    dis_etki_mudahalesi:       ['uyuyan_dev', 'koklu_kurum', 'fintech_firtinasi'],
    iletisim_kopuklugu:        ['gurultulu_muhalif', 'uyuyan_dev'],
    beklenti_sapma:            ['musteri_arketip', 'savunmasiz_paydas'],
    kapsam_kiymeti_sorgusu:    ['musteri_arketip'],
    teslimat_sonrasi_kriz:     ['musteri_arketip', 'savunmasiz_paydas'],
    uyum_ve_lisans:            ['burokratik_veto', 'uyumluluk_kafesi', 'duzenlenmis_liman', 'fintech_firtinasi'],
    butce_kesmesi:             ['burokratik_veto', 'duzenlenmis_liman'],
    kapsam_belirsizligi:       ['dinamik_ortam', 'bilinmez_zemin'],
    teknik_borc:               ['bilinmez_zemin', 'buyutulmus_kapsam'],
    tanimsiz_risk:             ['bilinmez_zemin', 'acil_mod', 'girisimci_saha', 'inovasyon_merkezi'],
    kayitli_risk_gerceklesti:  ['kriz_kahramani', 'acil_mod'],
    test_atlamasi_baskisi:     ['acil_mod', 'uyumluluk_kafesi'],
    hata_gec_bildirim:         ['iyi_niyetli_toy', 'uyumluluk_kafesi'],
    takvim_degisikligi:        ['net_yol', 'rekabetci_arena'],
    cakisan_gorevlendirme:     ['buyutulmus_kapsam', 'yapilandirilmis_donus', 'sakat_yildiz'],
    maliyet_asimi_riski:       ['rekabetci_arena', 'fintech_firtinasi'],
    tedarikci_sorunu:          ['rekabetci_arena'],
    kaynak_erisilemezligi:     ['girisimci_saha', 'gecis_ekonomisi'],
    // Evrensel (required arketip yok):
    // gorev_gecikmesi, gizli_bagimlilik, paralel_is_birikimi
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
    retail:       'perakende',   // profile.html değeri
    energy:       'yazilim',     // fallback (enerji rolü henüz yok)
    telecom:      'yazilim',     // fallback
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
    // {} veya diğer non-string şablonlar (body_template hatalı tanımlanmışsa) → boş string
    if (typeof tpl !== 'string') return (tpl !== null && typeof tpl === 'object') ? '' : tpl;
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
   * Mesele tipi verisini çek — yerel dosya öncelikli, Supabase opsiyonel.
   * Dosyalar artık repo'da olduğu için yerel kaynak her zaman günceldir;
   * Supabase fallback'i kaldırıldı (senkron sorununu önler).
   * @param {string} id
   * @returns {Promise<object>}
   */
  async function fetchMeseleTipi(id) {
    return fetchJson(`data/mesele-tipleri/${id}.json`);
  }

  /**
   * Tüm mesele tipi ID listesini çek — her zaman yerel _index.json kullanılır.
   * Dosyalar artık repo'da tutulduğu için (gitignore kaldırıldı) hem dev hem
   * prod ortamında statik servis üzerinden erişilebilir.
   * @returns {Promise<string[]>}
   */
  async function fetchMeseleTipiIds() {
    // Yerel _index.json her zaman otoriter kaynak — Supabase'de eksik type olsa bile
    // tüm 36 tip kullanılabilir.
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

  // ── Mesele seçimi (faz biased + domain multiplier + duration multiplier) ─────
  function pickMesele(meseleTipiIds, meseleTipleri, phaseBias, reasonUseCounts, rng, domainMult, lockedQueue, lockedPlaced, durationMults) {
    const available = meseleTipiIds.filter(id => {
      const m = meseleTipleri[id];
      return m && m.reasons && m.reasons.some(r => (reasonUseCounts[r.reason_id] || 0) < (r.max_per_scenario ?? 1));
    });
    if (!available.length) return null;

    const weights = available.map(id => {
      const bias     = phaseBias[id] ?? 1;
      const domain   = MESELE_PMP_ALAN[id] || 'process';
      const mult     = domainMult ? (domainMult[domain] ?? 1) : 1;
      const durMult  = durationMults ? (durationMults[id] ?? 1) : 1;
      const m        = meseleTipleri[id];
      const avW      = m.reasons
        .filter(r => (reasonUseCounts[r.reason_id] || 0) < (r.max_per_scenario ?? 1))
        .reduce((s, r) => s + (r.weight ?? 1), 0);
      return bias * avW * mult * durMult;
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
  function renderDecision(globalIdx, mesele, reason, phase, kadro, disKisiler, absenceMap, rng, baseVars, sectionNum) {
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
    // Şıkları karıştır — medicine her zaman en uzun/ilk olmasın
    const shuffledOrder = [...OPTION_ORDER];
    for (let i = shuffledOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledOrder[i], shuffledOrder[j]] = [shuffledOrder[j], shuffledOrder[i]];
    }
    const options = shuffledOrder.map((optType, idx) => {
      const opt = reason.options?.[optType];
      if (!opt) return null;
      return {
        key:         DISPLAY_KEYS[idx],   // A/B/C/D — rastgele sıraya göre
        type:        optType,             // 'medicine' | 'distractor_1' | 'distractor_2' | 'poison'
        text:        fill(opt.text_template, optionVars),
        xp:          opt.xp,
        isEthical:   opt.isEthical,
        triggers:    opt.triggers || [],   // Karma kuyruğu için
        consequence: makeConsequence(optType, vars, kadro, disKisiler, rng),
      };
    }).filter(Boolean);

    return {
      id:         globalIdx + 1,
      type:       'decision',
      phase:      phase.id,
      phaseLabel: phase.label,
      section:    sectionNum,
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
  function renderLore(globalIdx, tpl, phase, kadro, disKisiler, absenceMap, rng, baseVars, sectionNum) {
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
          section:    sectionNum,
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
      section:    sectionNum,
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
      sector             = 'yazilim',
      sector_label       = null,
      dev_approach       = 'hybrid',
      difficulty         = 'medium',   // backward compat
      difficulty_people  = 2,
      difficulty_process = 2,
      difficulty_biz     = 2,
      pmo_type           = null,
      team_culture       = null,
      player_name        = 'PM',
      project_name       = 'Stratejik Proje',
      session_id         = Date.now().toString(36),
      totalDecisions     = 180,
      start_phase        = 'baslangic',
      end_phase          = 'kapanis',
      customKadro        = null,
      customDisKisiler   = null,
      process_archetype  = null,   // Süreç arketipi (net_yol, dinamik_ortam, vb.)
      env_archetype      = null,   // Çevre arketipi (duzenlenmis_liman, girisimci_saha, vb.)
      duration_months    = 12,
      team_size          = 6,
    } = config;

    // Domain difficulty multipliers — 1=hafif(0.4×), 2=orta(1.0×), 3=sert(2.5×)
    const _dm = [0.4, 1.0, 2.5];
    const domainMult = {
      people:    _dm[(difficulty_people  - 1)] ?? 1,
      process:   _dm[(difficulty_process - 1)] ?? 1,
      biz_cevre: _dm[(difficulty_biz     - 1)] ?? 1,
    };

    // Proje süresi bazlı aciliyet çarpanı
    // Kısa proje = takvim baskısı artar; uzun proje = tükenmişlik/insan sorunları artar
    const durationUrgencyMult = duration_months <= 4  ? 2.2
                              : duration_months <= 7  ? 1.5
                              : duration_months <= 13 ? 1.0
                              : duration_months <= 19 ? 0.7
                              :                         0.5;

    const durationPeopleMult  = duration_months <= 4  ? 0.6
                              : duration_months <= 7  ? 0.8
                              : duration_months <= 13 ? 1.0
                              : duration_months <= 19 ? 1.3
                              :                         1.6;

    // Mesele tipi başına süre çarpanı
    const URGENCY_MESELE_IDS = new Set([
      'milestone_baskisi', 'takvim_degisikligi', 'gorev_gecikmesi',
      'paralel_is_birikimi', 'test_atlamasi_baskisi', 'hata_gec_bildirim',
    ]);
    const LONGTERM_MESELE_IDS = new Set([
      'performans_geriligi', 'takim_catismasi', 'bilgi_adasi',
      'kilit_kisi_bagimlilik', 'teknik_borc', 'iletisim_kopuklugu',
    ]);

    // Süre bazlı mesele ağırlık haritası
    const durationMults = {};
    URGENCY_MESELE_IDS.forEach(id => { durationMults[id] = durationUrgencyMult; });
    LONGTERM_MESELE_IDS.forEach(id => { durationMults[id] = durationPeopleMult; });

    // ── Aktif arketipler ────────────────────────────────────────────────────────
    const presentArchetypes = new Set();

    // Ekip karakterlerinin arketipleri (customKadro'dan)
    if (customKadro && customKadro.length) {
      customKadro.forEach(c => { if (c.archetype) presentArchetypes.add(c.archetype); });
    }
    // Dış paydaşların arketipleri (customDisKisiler'dan)
    if (customDisKisiler && customDisKisiler.length) {
      customDisKisiler.forEach(c => { if (c.archetype) presentArchetypes.add(c.archetype); });
    }
    // Süreç ve çevre arketipleri config'den
    if (process_archetype) presentArchetypes.add(process_archetype);
    if (env_archetype)     presentArchetypes.add(env_archetype);

    // Fallback: arketip tanımlanmamışsa dev_approach'dan varsayılan
    const hasProcessArk = process_archetype || (customKadro || []).some(c => c.archetype && ARCHETYPE_LOCKS[c.archetype]);
    if (!hasProcessArk) {
      if (dev_approach === 'agile')                                                         presentArchetypes.add('dinamik_ortam');
      else if (dev_approach === 'waterfall' || dev_approach === 'predictive')               presentArchetypes.add('net_yol');
      else                                                                                   presentArchetypes.add('yapilandirilmis_donus');
    }

    // ── Garantili mesele havuzu (archetype lock'larından) ───────────────────────
    const lockedMeseleSet = new Set();
    presentArchetypes.forEach(ark => {
      (ARCHETYPE_LOCKS[ark] || []).forEach(m => lockedMeseleSet.add(m));
    });

    // ── Metodoloji rol kısıtları ─────────────────────────────────────────────────
    // dev_approach'u metodoloji anahtarına eşle
    const methKey = dev_approach === 'agile' ? 'agile'
                  : (dev_approach === 'waterfall' || dev_approach === 'predictive') ? 'predictive'
                  : 'hybrid';
    const methRules = METHODOLOGY_ROLES[methKey] || { required: [], forbidden: [] };

    // Active phase slice based on start_phase / end_phase
    const PHASE_IDX    = { baslangic: 0, planlama: 1, yurutme: 2, izleme: 3, kapanis: 4 };
    const startIdx     = PHASE_IDX[start_phase] ?? 0;
    const endIdx       = PHASE_IDX[end_phase]   ?? 4;
    const activePhases = PHASES.slice(startIdx, endIdx + 1);

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

    // team_size kadar kadro oluştur
    const effectiveTeamSize = Math.max(2, Math.min(9, team_size || 6));
    const genderPool = ['female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'male'];
    const KADRO_GENDERS = genderPool.slice(0, effectiveTeamSize);
    const mappedSector  = SECTOR_MAP[sector] || 'yazilim';
    const sektorRoller  = roller[mappedSector] || roller['yazilim'] || ['Geliştirici', 'Test Uzmanı', 'Analist'];
    const kadro = KADRO_GENDERS.map(g => ({
      ...pickFullName(g),
      role: randChoice(sektorRoller, rng),
    }));

    // Kullanıcı önceden düzenlemişse kendi kadrosunu kullan
    const finalKadro = customKadro && customKadro.length
      ? customKadro.map(c => ({ fullName: c.fullName, firstName: c.fullName.split(' ')[0], gender: c.gender || 'any', role: c.role }))
      : kadro;

    // Metodoloji kısıtlarını uygula (sadece otomatik oluşturulmuş kadro için değil, custom için de kontrol et)
    // 1. Rol üst limitleri
    const roleCounts = {};
    const methodologyFinalKadro = finalKadro.map(c => {
      const cap = ROLE_CAPS[c.role];
      if (cap !== undefined) {
        roleCounts[c.role] = (roleCounts[c.role] || 0) + 1;
        if (roleCounts[c.role] > cap) {
          // Cap aşıldı — alternatif rol ver
          return { ...c, role: 'Geliştirici' };
        }
      } else {
        roleCounts[c.role] = (roleCounts[c.role] || 0) + 1;
      }
      return c;
    });

    // 2. Yasak rolleri temizle
    const cleanedKadro = methodologyFinalKadro.map(c => {
      if (methRules.forbidden.includes(c.role)) {
        return { ...c, role: 'Geliştirici' }; // Yasak rol → geliştirici
      }
      return c;
    });

    // 3. Zorunlu rolleri kontrol et ve ekle (mevcut değilse)
    const kadroWithRequired = [...cleanedKadro];
    methRules.required.forEach(reqRole => {
      const alreadyHas = kadroWithRequired.some(c => c.role === reqRole);
      if (!alreadyHas && kadroWithRequired.length > 0) {
        // Son kişiyi değiştir (sadece auto-generated kadro'da yapılır, customKadro'yu zorla değiştirme)
        if (!customKadro || !customKadro.length) {
          kadroWithRequired[kadroWithRequired.length - 1] = {
            ...kadroWithRequired[kadroWithRequired.length - 1],
            role: reqRole,
          };
        }
      }
    });

    // Temizlenmiş kadroyu kullan
    const effectiveFinalKadro = (customKadro && customKadro.length) ? cleanedKadro : kadroWithRequired;

    // Dış kişiler (müşteri, sponsor, son kullanıcı)
    const disKisiler = [
      { ...pickFullName('female'), role: 'Müşteri Yetkilisi',         kind: 'client'   },
      { ...pickFullName('male'),   role: 'Sponsor',                   kind: 'sponsor'  },
      { ...pickFullName('any'),    role: 'Son Kullanıcı Temsilcisi',  kind: 'end_user' },
    ];

    const finalDisKisiler = customDisKisiler && customDisKisiler.length === 3
      ? customDisKisiler.map((c, i) => ({
          fullName: c.fullName,
          firstName: c.fullName.split(' ')[0],
          gender: c.gender || 'any',
          role: c.role,
          kind: ['client','sponsor','end_user'][i]
        }))
      : disKisiler;

    const absenceMap      = new Map();
    const reasonUseCounts = {};
    const baseVars        = { player_name, project_name, mappedSector };

    // ── Hoşgeldiniz bildirimleri (her senaryo bunlarla başlar) ──────────────
    const hrPool   = effectiveFinalKadro.filter(k => k.gender === 'female');
    const hrPerson = hrPool.length ? randChoice(hrPool, rng) : effectiveFinalKadro[0];
    const sponsor  = finalDisKisiler[1];

    const _firstPhase = activePhases[0] || PHASES[0];
    const allNotifications = [
      {
        type: 'story', phase: _firstPhase.id, phaseLabel: _firstPhase.label, section: 1,
        from: hrPerson.fullName, fromRole: 'İK Uzmanı',
        subject: `${project_name} — Hoş Geldiniz`,
        body: `Sayın ${_playerPolite},\n\n${project_name} projesinde Proje Yöneticisi olarak görevlendirildiniz. Ekibinize ve proje belgelerine bugün itibarıyla erişiminiz tanımlanmıştır.\n\nEkip tanışma toplantısı ve oryantasyon programı önümüzdeki günlerde düzenlenecektir. Herhangi bir sorunuz olursa benimle iletişime geçebilirsiniz.\n\nBaşarılar dileriz.`,
      },
      {
        type: 'story', phase: _firstPhase.id, phaseLabel: _firstPhase.label, section: 1,
        from: sponsor.fullName, fromRole: sponsor.role,
        subject: `${project_name} — İlk Mesajım`,
        body: `Sayın ${_playerPolite},\n\n${project_name} için sizi tercih ettiğimizden son derece memnunum. Bu proje kurumumuz açısından stratejik öneme sahip; ekibimizin doğru liderle yola çıktığına inanıyorum.\n\nHer türlü destek ve kaynağa erişiminiz mevcut. Önceliklerinizi ve ihtiyaçlarınızı doğrudan benimle paylaşmaktan çekinmeyin.\n\nBaşarılar.`,
      },
    ];
    let globalIdx = allNotifications.length; // 2'den başla

    // Faz başına karar sayısını totalDecisions'a oranla ölçekle (sadece aktif fazlar)
    const planTotal = activePhases.reduce((s, p) => s + p.decisions, 0);
    const scale     = totalDecisions / Math.max(planTotal, 1);

    // ── Arketip bazlı mesele filtresi ─────────────────────────────────────────
    // Zorunlu arketipi olmayan mesele tiplerini havuzdan çıkar
    const baseMeseleTipiIds = meseleTipiIds.filter(id => {
      const required = MESELE_REQUIRED_ARCHETYPES[id];
      if (!required || required.length === 0) return true; // Evrensel
      return required.some(ark => presentArchetypes.has(ark));
    });

    // Garantili mesele listesi — bunlar senaryo boyunca EN AZ 1 kez çıkacak
    // Sadece filtrelenmiş havuzda olan locked mesele'leri al
    const guaranteedMesele = [...lockedMeseleSet].filter(id =>
      meseleTipleri[id] &&
      meseleTipleri[id].reasons &&
      meseleTipleri[id].reasons.length > 0
    );

    // Guaranteed injection: toplam kararları guaranteedMesele sayısına böl
    // Her N karardan birinde bir guaranteed mesele zorla yerleştir
    const totalDecisionSlots = activePhases.reduce((s, p) => s + Math.round(p.decisions * (totalDecisions / Math.max(activePhases.reduce((ss, pp) => ss + pp.decisions, 0), 1))), 0);
    const guaranteedInterval = guaranteedMesele.length > 0
      ? Math.floor(totalDecisionSlots / (guaranteedMesele.length + 1))
      : Infinity;

    // Guaranteed kuyruğu — sırayla yerleştirilecek
    const guaranteedQueue = [...guaranteedMesele];
    let guaranteedPlaced = 0;
    let totalDecisionsDone = 0; // Tüm fazlar boyunca sayaç

    for (let phaseIdx = 0; phaseIdx < activePhases.length; phaseIdx++) {
      const phase       = activePhases[phaseIdx];
      const sectionNum  = phaseIdx + 1;  // 1-indexed section for this scenario
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
          const lore = renderLore(globalIdx, tpl, phase, effectiveFinalKadro, finalDisKisiler, absenceMap, rng, baseVars, sectionNum);
          allNotifications.push(lore);
          loreDone++;
          globalIdx++;
        } else if (decisionsDone < phaseDecCount) {
          // ── Karar bildirimi ──
          // Guaranteed mesele injection: her N karardan birinde zorla ekle
          let mesele;
          const shouldInjectGuaranteed =
            guaranteedQueue.length > 0 &&
            totalDecisionsDone > 0 &&
            totalDecisionsDone % Math.max(guaranteedInterval, 10) === 0;

          if (shouldInjectGuaranteed) {
            // Guaranteed kuyruğundan uygun bir mesele seç (reason'ı bitmemiş olmalı)
            const gIdx = guaranteedQueue.findIndex(id => {
              const m = meseleTipleri[id];
              return m && m.reasons && m.reasons.some(r => (reasonUseCounts[r.reason_id] || 0) < (r.max_per_scenario ?? 1));
            });
            if (gIdx >= 0) {
              const gId = guaranteedQueue.splice(gIdx, 1)[0];
              mesele = meseleTipleri[gId];
              guaranteedPlaced++;
            } else {
              mesele = pickMesele(baseMeseleTipiIds, meseleTipleri, phaseBias, reasonUseCounts, rng, domainMult, null, null, durationMults);
            }
          } else {
            mesele = pickMesele(baseMeseleTipiIds, meseleTipleri, phaseBias, reasonUseCounts, rng, domainMult, null, null, durationMults);
          }
          totalDecisionsDone++;

          if (!mesele) { globalIdx++; continue; }
          const reason = pickReason(mesele, reasonUseCounts, rng);
          if (!reason) { globalIdx++; continue; }

          reasonUseCounts[reason.reason_id] = (reasonUseCounts[reason.reason_id] || 0) + 1;
          const dec = renderDecision(globalIdx, mesele, reason, phase, effectiveFinalKadro, finalDisKisiler, absenceMap, rng, baseVars, sectionNum);
          allNotifications.push(dec);
          decisionsDone++;
          globalIdx++;
        } else if (loreDone < phaseLoreCount && phaseLoreTpls.length > 0) {
          // Karar bitti ama hâlâ lore slotu var
          const tpl  = weightedChoice(phaseLoreTpls, phaseLoreTpls.map(t => t.weight ?? 1), rng);
          const lore = renderLore(globalIdx, tpl, phase, effectiveFinalKadro, finalDisKisiler, absenceMap, rng, baseVars, sectionNum);
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
      difficulty_people,
      difficulty_process,
      difficulty_biz,
      pmo_type,
      team_culture,
      player_name,
      project_name,
      start_phase,
      end_phase,
      kadro: effectiveFinalKadro,
      dis_kisiler: finalDisKisiler,
      // game.html'in section-tabanlı batch sistemini doğru besle (sadece aktif fazlar)
      sections: activePhases.map((p, i) => ({
        id:        i + 1,
        title:     `${i + 1}. Faz: ${p.label}`,
        iteration: p.label,
      })),
      notifications: allNotifications,
      archetypes: {
        present:      [...presentArchetypes],
        locked_mesele: guaranteedMesele,
        placed_locked: guaranteedPlaced,
      },
      methodology: methKey,
      duration_months,
      team_size: effectiveTeamSize,
    };
  }

  async function previewTeam(sector) {
    const SECTOR_MAP_PT = { it:'yazilim', finance:'finans', health:'saglik', construction:'insaat', defense:'savunma', education:'egitim', retail:'perakende', energy:'yazilim', telecom:'yazilim', other:'yazilim' };
    const [isimler, roller] = await Promise.all([
      fetch('data/havuzlar/isimler.json').then(r => r.json()),
      fetch('data/havuzlar/roller.json').then(r => r.json()),
    ]);
    const mappedSec  = SECTOR_MAP_PT[sector] || 'yazilim';
    const sRoller    = roller[mappedSec] || roller['yazilim'] || ['Geliştirici', 'Test Uzmanı', 'Analist'];
    const soyadlar   = isimler.soyadlar || [];
    const used       = new Set();
    const rng2       = makeRng(Date.now() ^ 0xdeadbeef);
    const GENDERS    = ['female','male','female','male','female','male','female','male'];

    function pick(gender) {
      let pool = gender === 'female' ? isimler.female : gender === 'male' ? isimler.male : [...isimler.female, ...isimler.male];
      pool = pool.filter(n => !used.has(n));
      if (!pool.length) pool = gender === 'female' ? isimler.female : isimler.male;
      const fn = randChoice(pool, rng2); used.add(fn);
      const sn = soyadlar.length ? randChoice(soyadlar, rng2) : '';
      return { fullName: `${fn} ${sn}`.trim(), gender };
    }

    const kadro = GENDERS.map(g => ({ ...pick(g), role: randChoice(sRoller, rng2) }));
    const disKisiler = [
      { ...pick('female'), role: 'Müşteri Yetkilisi',        kind: 'client'   },
      { ...pick('male'),   role: 'Sponsor',                  kind: 'sponsor'  },
      { ...pick('any'),    role: 'Son Kullanıcı Temsilcisi', kind: 'end_user' },
    ];
    return { kadro, disKisiler };
  }

  return { generate, previewTeam };
})();
