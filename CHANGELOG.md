# Changelog — PMP® Study Hell™

Tüm önemli değişiklikler bu dosyada belgelenmektedir.
Format: [Semantic Versioning](https://semver.org/) · Tarih: GG-AA-YYYY

---

## [1.2.0] — 03-03-2026

### 🆕 Yeni Senaryo
- **Ebabil Otonom İHA Sistemi** senaryosu eklendi
  - 270 bildirim (B1–B270), 27 bölüm (Faz 1–27)
  - 161 karar bildirimi (her biri 4 şık: A/B/C/D)
  - 109 hikaye/story bildirimi
  - XP sistemi: A=+30, B=+10, C=+5, D=−20
  - 5 yetkinlik alanı: PMP Süreç Yönetimi, Çevik Liderlik, Etik Yönetim, İnsan Yönetimi, Risk & Tedarik
  - Zorluk: İleri (advanced) · Sektör: Savunma Sanayii / Teknoloji

### 🎮 Kariyer Kurulumu — Yeni Akış
- Sektör ve Zorluk seçimleri **dropdown menüye** dönüştürüldü (buton grid yerine)
- Sektör seçilmeden zorluk seçeneği pasif kalıyor
- Seçilen sektörde mevcut olmayan zorluk seçenekleri gösterilmiyor
- Senaryo seçilince alt bilgi kartı görünüyor (başlık + karar sayısı)
- Manifest'e `difficulty` ve `sector` alanları eklendi — yeni senaryolar eklenince otomatik arayüz güncelleniyor
- Ekip Kültürü ve Çalışma Yöntemi seçenekleri kaldırıldı (henüz işlevsel değildi)

### 👤 Kullanıcı Yönetimi
- **Misafir modu**: Giriş yapmadan da oynanabiliyor (kayıt gerektirmez)
- **Geliştirici Modu**: Kayıt formunda opsiyonel checkbox
  - Aktifken her bildirimde `✏️ Düzenle` ve `⚠️ Sorun Bildir` butonları görünür
  - Düzenlemeler localStorage'a yerel olarak kaydedilir
  - Sorun raporları panoya kopyalanır

### 🕐 Saat Düzeltmesi
- Üst sağ köşedeki oyun saati, ekrandaki **en son bildirimin** saatinden **+30 dakika ileride** gösteriliyor
- Daha eski bir bildirim seçildiğinde saat geriye gitmiyor — her zaman en güncel bildirimi referans alıyor
- Mailler geldikleri an cevaplandı gibi gözükmüyor

### 📝 Senaryo İçeriği Düzeltmeleri (Ebabil)
- Tümgeneral "Hulusi" → **Şeref KOÇHİSAR** olarak güncellendi (34 bildirim)
- Askeri rütbelilere hitap: "Generalim" → **"Sayın Komutanım"**

### 🔧 Teknik
- `manifest.json` şeması genişletildi: `difficulty`, `sector` alanları eklendi
- `?preview=<scenarioId>` URL parametresi ile mock skorlu scorecard önizlemesi
- `authSaveSession` artık `devMode` bayrağını oturuma ekliyor

---

## [1.1.0] — Önceki Geliştirmeler

### Eklenenler
- Zorluk ağırlıklı deneyim puanı sistemi (beginner ×1, intermediate ×3, advanced ×5)
- Şifremi Unuttum akışı (auth modal'a eklendi)
- Çoklu kayıt listesi — karşılama ekranında tüm kayıtlı oyunlar listeleniyor
- `scenarioTitle` kayıt verisine eklendi

### Düzeltmeler
- Menü çıkış butonları düzeltildi; "Kaydetmeden Çık" seçeneği eklendi
- Gönder butonu hatası, ilerleme yüzdesi, XP gösterimi ve yanıt paneli genişliği düzeltildi
- Opsiyon seçimi ve gönder butonu event delegation ile yeniden yazıldı

---

## [1.0.0] — İlk Yayın

### Eklenenler
- PM Simülasyonu — E-posta tarzı bildirim inbox'ı
- Kariyer Kurulumu ekranı (sektör, zorluk, kültür, yöntem)
- Kayıt / Giriş sistemi (localStorage tabanlı)
- Oyun kaydetme / devam etme sistemi
- Karar kilitleme (cevaplanan kararlar değiştirilemiyor)
- Karne ekranı (PMI Yetenek Üçgeni + Senaryo Yetkinlikleri)
- Yetkinlik Kartı sayfası (scorecard.html)
- Topbar yeniden tasarımı, profil fotoğrafı desteği, otomatik kayıt
- Star Top Bank senaryosu (40 karar, intermediate, Fintech/Bankacılık)
