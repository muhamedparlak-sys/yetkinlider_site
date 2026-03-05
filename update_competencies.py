import json

# Load current ebabil.json
with open(r'C:\Users\muham\OneDrive\Masaüstü\studyhell_site\data\scenarios\ebabil.json', encoding='utf-8') as f:
    data = json.load(f)

# New 3-domain / 16-component competency structure
new_competencies = [
    {
        "id": "people",
        "domain": "İnsan Domain",
        "icon": "👥",
        "weight": 42,
        "components": [
            {
                "id": "catisma",
                "label": "Çatışma Yönetimi",
                "decisionIds": [18, 35, 58, 108, 129, 135, 168, 209, 238, 274],
                "levels": {
                    "giris": "Çatışmanın kaynağını ve aşamasını yorumlar, temel etik kuralları uygular.",
                    "orta": "Çatışma bağlamını analiz eder; uygun çözümü değerlendirir ve uzlaştırır.",
                    "ileri": "Karmaşık çatışmaların kök nedenini analiz eder, çatışma yönetiminde takıma mentorluk yapar."
                }
            },
            {
                "id": "liderlik",
                "label": "Liderlik",
                "decisionIds": [45, 126, 149, 188, 272],
                "levels": {
                    "giris": "Liderlik stillerini ayırt eder, vizyonun önemini açıklar.",
                    "orta": "Vizyon belirler, hizmetkar liderliği uygular, takımı motive eder ve etkiler.",
                    "ileri": "Hizmetkar liderlik ilkelerini stratejik çalışmayla dengeleyerek kurumsal kültür inşa eder."
                }
            },
            {
                "id": "takim_gelisimi",
                "label": "Takım Gelişimi",
                "decisionIds": [28, 42, 86, 102, 142, 199, 235, 246, 284, 294],
                "levels": {
                    "giris": "Takım içi rollerin ve sorumlulukların amacını tanımlar.",
                    "orta": "Takım performansını KPI'lara göre destekler, paydaşları eğitir ve yetkilendirir.",
                    "ileri": "Yüksek performanslı takımları kurar, mentorluk yaparak yetkinlik boşluklarını stratejik olarak kapatır."
                }
            },
            {
                "id": "eq",
                "label": "Duygusal Zeka (EQ)",
                "decisionIds": [49, 68, 73, 225, 253, 263],
                "levels": {
                    "giris": "EQ'nun takım performansındaki etkisini anlar.",
                    "orta": "Kişilik göstergelerini analiz ederek iletişimi uyarlar.",
                    "ileri": "EQ'yu karmaşık paydaş müzakerelerinde ve kurumsal değişim yönetiminde stratejik olarak kullanır."
                }
            }
        ]
    },
    {
        "id": "process",
        "domain": "Süreç / Bilgi Alanı",
        "icon": "⚙️",
        "weight": 50,
        "components": [
            {
                "id": "entegrasyon",
                "label": "Entegrasyon / Planlama",
                "decisionIds": [2, 3, 5, 19, 32, 55, 88, 93, 105, 125, 136, 165, 172, 173, 186, 202, 203, 205, 236, 265, 268, 270, 291],
                "levels": {
                    "giris": "Proje ve operasyon farkını ayırt eder, planlama bileşenlerinin amacını açıklar.",
                    "orta": "Alt planları birleştiren entegre plan geliştirir, metodolojiyi (Çevik/Hibrit) seçer.",
                    "ileri": "Veri analitiği ve sürdürülebilirliği plana entegre eder, stratejik kararlar için veri toplar."
                }
            },
            {
                "id": "kapsam",
                "label": "Kapsam (Agile Dahil)",
                "decisionIds": [12, 46, 66, 79, 106, 115, 119, 148, 163, 166, 206, 213, 216, 218, 249, 281, 285],
                "levels": {
                    "giris": "WBS ve Backlog kavramlarını tanımlar, kapsamı gözden geçirir.",
                    "orta": "Gereksinimleri toplar, MVP'yi belirler, Backlog veya WBS'i yönetir.",
                    "ileri": "Dış çevre değişimlerinin Backlog üzerindeki etkisini değerlendirir ve önceliklendirir."
                }
            },
            {
                "id": "zaman",
                "label": "Zaman / Çizelgeleme",
                "decisionIds": [16, 22, 38, 56, 65, 76, 123, 133, 158, 208, 229, 243, 252, 262, 266, 282],
                "levels": {
                    "giris": "Kilometre taşı ve görev süresi farkını ayırt eder.",
                    "orta": "Zaman çizelgesini planlar ve yönetir, varyans analizi yapar.",
                    "ileri": "Teslimat temposunu (cadence) optimize eder, kritik yol risklerini stratejik yönetir."
                }
            },
            {
                "id": "maliyet",
                "label": "Maliyet / Finans",
                "decisionIds": [13, 69, 118, 122, 143, 189, 222, 223, 226, 269, 277],
                "levels": {
                    "giris": "Bütçelemenin amacını ve önemini açıklar.",
                    "orta": "Proje bütçesini planlar ve yönetir, harcamaları takip eder.",
                    "ileri": "Finansal rezervleri yönetir, finansal zorlukları öngörür ve yönetişimle çalışır."
                }
            },
            {
                "id": "kalite",
                "label": "Kalite",
                "decisionIds": [25, 43, 59, 63, 72, 145, 146, 162, 169, 212, 278, 288],
                "levels": {
                    "giris": "Kalite standartlarının önemini anlar.",
                    "orta": "Kalite yönetim planını uygular, ürün/teslimat kalitesini denetler.",
                    "ileri": "Ürün ve süreç kalitesini optimize eder, sürekli iyileştirme (kaizen) sistemini kurar."
                }
            },
            {
                "id": "risk",
                "label": "Risk / Sorun",
                "decisionIds": [23, 52, 62, 103, 113, 128, 139, 156, 228],
                "levels": {
                    "giris": "Risk ve sorun arasındaki farkı bilir, risk kaydını kullanır.",
                    "orta": "Riskleri analiz eder, yanıt stratejileri planlar ve sorunları çözer.",
                    "ileri": "Risk ve ihtiyat akçesi tahsislerini niceleştirir, stratejik riskleri izler."
                }
            },
            {
                "id": "tedarik",
                "label": "Tedarik",
                "decisionIds": [8, 9, 29, 36, 48, 53, 75, 89, 96, 112, 116, 175, 192, 193, 232, 233, 245, 275, 297],
                "levels": {
                    "giris": "Tedarik türlerini ve sözleşme temellerini tanımlar.",
                    "orta": "Tedarik süreçlerini planlar, satıcıları seçer ve yönetir.",
                    "ileri": "Tedarik stratejilerini kurum hedefleriyle hizalar, karmaşık sözleşme müzakerelerini yürütür."
                }
            },
            {
                "id": "kapanis",
                "label": "Kapanış / İzleme",
                "decisionIds": [92, 95, 99, 132, 178, 179, 182, 185, 215, 257, 287, 295, 298, 299],
                "levels": {
                    "giris": "Kapanış ve geçiş süreçlerini açıklar.",
                    "orta": "Proje/faz kapanışlarını yönetir, kazanılan dersleri belgeler.",
                    "ileri": "Bilgi transferini sağlar, kazanılan dersleri kurumsal hafızaya (OPA) aktarır."
                }
            }
        ]
    },
    {
        "id": "business",
        "domain": "İş Çevresi",
        "icon": "🌐",
        "weight": 8,
        "components": [
            {
                "id": "uyumluluk",
                "label": "Uyumluluk (Compliance)",
                "decisionIds": [6, 15, 39, 78, 85, 109, 138, 153, 159, 195, 196, 198, 219, 239, 248],
                "levels": {
                    "giris": "Etik kuralları senaryolara uygular.",
                    "orta": "Uyumluluk gereksinimlerini planlar ve yönetir.",
                    "ileri": "Proje yönetişim yapısını kurar, eskalasyon yollarını ve eşik değerlerini belirler."
                }
            },
            {
                "id": "fayda_deger",
                "label": "Fayda ve Değer",
                "decisionIds": [98, 242, 259, 292],
                "levels": {
                    "giris": "Projenin bir değişim aracı olduğunu açıklar.",
                    "orta": "Proje faydalarını ve değerini değerlendirir ve teslim eder.",
                    "ileri": "Başarı metriklerini tanımlar, stratejik değer teslimatını en üst düzeye çıkarır (maximize)."
                }
            },
            {
                "id": "kurumsal_degisim",
                "label": "Kurumsal Değişim",
                "decisionIds": [176, 183, 255],
                "levels": {
                    "giris": "Şirket kültürünün projedeki etkisini anlar.",
                    "orta": "Organizasyonel değişimi destekler.",
                    "ileri": "Kurumsal kültürü değerlendirir, değişimin projedeki etkisini analiz edip aksiyon alır."
                }
            },
            {
                "id": "dis_cevre",
                "label": "Dış Çevre Analizi",
                "decisionIds": [26, 33, 82, 83, 152, 155],
                "levels": {
                    "giris": "Dış faktörlerin kapsam üzerindeki etkisini fark eder.",
                    "orta": "İş ortamı değişikliklerini kapsam için değerlendirir.",
                    "ileri": "Mevzuat, teknoloji ve pazar değişimlerini sürekli tarar (survey) ve Backlog'u günceller."
                }
            }
        ]
    }
]

# Verify all 180 decisions are covered
all_ids = []
for domain in new_competencies:
    for comp in domain['components']:
        all_ids.extend(comp['decisionIds'])

decision_ids = set(n['id'] for n in data['notifications'] if n['type'] == 'decision')
mapped_ids = set(all_ids)
print(f"Total mapped: {len(all_ids)}, Unique: {len(mapped_ids)}")
print(f"Decision IDs in JSON: {len(decision_ids)}")
missing = decision_ids - mapped_ids
extra = mapped_ids - decision_ids
if missing:
    print(f"NOT MAPPED: {sorted(missing)}")
if extra:
    print(f"EXTRA (not in JSON): {sorted(extra)}")
if not missing and not extra:
    print("OK - All 180 decisions correctly mapped!")

# Update competencies in data
data['competencies'] = new_competencies

# Save
with open(r'C:\Users\muham\OneDrive\Masaüstü\studyhell_site\data\scenarios\ebabil.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("DONE - ebabil.json updated with new competency structure.")
