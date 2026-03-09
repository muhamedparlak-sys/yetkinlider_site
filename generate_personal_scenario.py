import json, random, os

BASE = os.path.dirname(os.path.abspath(__file__))

with open(f'{BASE}/data/havuzlar/isimler.json', encoding='utf-8') as f:
    isimler = json.load(f)
with open(f'{BASE}/data/havuzlar/roller.json', encoding='utf-8') as f:
    roller = json.load(f)

# Tüm mesele tiplerini yükle
mesele_tipleri = {}
for fname in os.listdir(f'{BASE}/data/mesele-tipleri'):
    if fname.endswith('.json') and not fname.startswith('_'):
        with open(f'{BASE}/data/mesele-tipleri/{fname}', encoding='utf-8') as f:
            m = json.load(f)
            mesele_tipleri[m['mesele_id']] = m

# --- Kullanıcı profili ---
SECTOR = 'yazilim'
APPROACH = 'cevic'
TOTAL_DECISIONS = 7   # Demo için 7, gerçek senaryo için 180
random.seed(42)

# --- Kadro oluştur ---
used_names = set()

def pick_name(gender):
    if gender == 'female':
        pool = [n for n in isimler['female'] if n not in used_names]
    elif gender == 'male':
        pool = [n for n in isimler['male'] if n not in used_names]
    else:
        pool = [n for n in isimler['female'] + isimler['male'] if n not in used_names]
    if not pool:
        pool = isimler['female'] if gender == 'female' else isimler['male']
    name = random.choice(pool)
    used_names.add(name)
    return name

sektor_roller = roller[SECTOR]

kadro = []
for gender in ['female', 'male', 'female', 'male', 'female', 'male']:
    kadro.append({
        'name': pick_name(gender),
        'role': random.choice(sektor_roller),
        'gender': gender
    })

# Dış paydaşlar
dis_kisiler = [
    {'name': pick_name('female'), 'role': 'Müşteri Yetkilisi'},
    {'name': pick_name('male'),   'role': 'Sponsor'},
    {'name': pick_name('any'),    'role': 'Son Kullanıcı Temsilcisi'},
]

# --- Yardımcılar ---
def kadro_by_gender(gender):
    return [k for k in kadro if k['gender'] == gender]

def fill(template, vars):
    if not template:
        return template
    t = template
    for k, v in vars.items():
        t = t.replace('{' + k + '}', str(v))
    return t

# --- Weighted reason seçimi ---
def pick_reason_weighted(mesele, reason_use_counts):
    """
    weight: reason'ın seçilme ağırlığı (1=nadir, 10=çok sık)
    max_per_scenario: senaryo boyunca en fazla kaç kez seçilebilir
    Aynı reason farklı karakterlerle tekrar seçilebilir.
    """
    available = [
        r for r in mesele['reasons']
        if reason_use_counts.get(r['reason_id'], 0) < r.get('max_per_scenario', 1)
    ]
    if not available:
        return None
    weights = [r.get('weight', 1) for r in available]
    return random.choices(available, weights=weights, k=1)[0]

# --- Senaryo render ---
def render(mesele_id, reason, karakter=None, dis_kisi=None):
    mesele = mesele_tipleri[mesele_id]

    if 'duration' in reason:
        duration = reason['duration']['value'] if reason['duration']['type'] == 'fixed' \
                   else random.choice(reason['duration']['options'])
    else:
        duration = ''

    body_vars = {}
    for var, opts in reason.get('body_vars', {}).items():
        body_vars[var] = random.choice(opts)

    name = karakter['name'] if karakter else (dis_kisi['name'] if dis_kisi else '')
    role = karakter['role'] if karakter else (dis_kisi['role'] if dis_kisi else '')

    vars = {'name': name, 'role': role, 'duration': duration, 'month': 'Kasım', **body_vars}

    sender = reason.get('sender', 'self')
    if sender == 'hr':
        hr_name = pick_name('female')
        from_name = hr_name
        from_role = reason.get('from_role', 'İK Uzmanı')
    elif sender == 'self':
        from_name, from_role = name, role
    elif sender == 'third_party':
        others = [k for k in kadro if k['name'] != name]
        other = random.choice(others) if others else kadro[0]
        from_name, from_role = other['name'], 'Ekip Üyesi'
    elif sender in ('client', 'end_user', 'sponsor', 'internal'):
        if dis_kisi:
            from_name, from_role = dis_kisi['name'], dis_kisi['role']
        else:
            relay = random.choice([k for k in kadro if k['name'] != name])
            from_name, from_role = relay['name'], 'İç Paydaş'
    else:
        from_name, from_role = name, role

    options = {}
    for key, val in reason['options'].items():
        options[key] = {
            'text': fill(val['text_template'], vars),
            'xp': val['xp'],
            'isEthical': val['isEthical']
        }

    return {
        'mesele_id': mesele_id,
        'reason_id': reason['reason_id'],
        'from': from_name,
        'fromRole': from_role,
        'subject': fill(reason['subject_template'], vars),
        'body': fill(reason['body_template'], vars),
        'options': options
    }

# --- Senaryo üretimi ---
# Demo: kaynak_erisilemezligi ve yazisiz_scope_degisikligi'nden dönüşümlü seç
# Gerçek senaryoda tüm mesele tiplerinden weighted seçim yapılır

reason_use_counts = {}  # {reason_id: kullanım sayısı}

plan = [
    ('kaynak_erisilemezligi', 'female'),
    ('yazisiz_scope_degisikligi', 'client'),
    ('kaynak_erisilemezligi', 'male'),
    ('yazisiz_scope_degisikligi', 'sponsor'),
    ('kaynak_erisilemezligi', 'male'),
    ('yazisiz_scope_degisikligi', 'end_user'),
    ('kaynak_erisilemezligi', 'any'),
]

scenarios = []
for mesele_id, karakter_tipi in plan:
    mesele = mesele_tipleri[mesele_id]
    reason = pick_reason_weighted(mesele, reason_use_counts)
    if reason is None:
        continue

    reason_use_counts[reason['reason_id']] = reason_use_counts.get(reason['reason_id'], 0) + 1

    # Karakteri seç — reason gender kısıtına uy
    if karakter_tipi in ('female', 'male', 'any'):
        gender = reason.get('gender', karakter_tipi)
        if gender == 'any':
            gender = karakter_tipi if karakter_tipi in ('female', 'male') else 'any'
        pool = kadro_by_gender(gender) if gender in ('female', 'male') else kadro
        karakter = random.choice(pool) if pool else random.choice(kadro)
        sc = render(mesele_id, reason, karakter=karakter)
    elif karakter_tipi == 'client':
        sc = render(mesele_id, reason, dis_kisi=dis_kisiler[0])
    elif karakter_tipi == 'sponsor':
        sc = render(mesele_id, reason, dis_kisi=dis_kisiler[1])
    elif karakter_tipi == 'end_user':
        sc = render(mesele_id, reason, dis_kisi=dis_kisiler[2])
    else:
        karakter = random.choice(kadro)
        sc = render(mesele_id, reason, karakter=karakter)

    scenarios.append(sc)

# --- Çıktılar ---
output = {
    'user_id': 'demo-user-001',
    'sector': SECTOR,
    'approach': APPROACH,
    'kadro': kadro,
    'dis_kisiler': dis_kisiler,
    'scenarios': scenarios
}

os.makedirs(f'{BASE}/data/personal_scenarios', exist_ok=True)
out_path = f'{BASE}/data/personal_scenarios/demo-user.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# --- game.html uyumlu format ---
OPTION_KEYS = {'medicine': 'A', 'distractor_1': 'B', 'distractor_2': 'C', 'poison': 'D'}
BASE_HOUR = 9

def to_time(idx):
    mins = idx * 47
    return f'{BASE_HOUR + mins // 60}:{str(mins % 60).zfill(2)}'

notifications = []
for i, sc in enumerate(scenarios):
    opts = [
        {
            'key': OPTION_KEYS[k],
            'text': v['text'],
            'xp': v['xp'],
            'isEthical': v['isEthical']
        }
        for k, v in sc['options'].items()
    ]
    notifications.append({
        'id': i + 1,
        'type': 'decision',
        'section': 1,
        'time': to_time(i),
        'from': sc['from'],
        'fromRole': sc['fromRole'],
        'subject': sc['subject'],
        'body': sc['body'],
        'options': opts
    })

game_output = {
    'id': 'personal-demo',
    'title': 'Kariyer Simülasyonu — Demo',
    'notifications': notifications
}

os.makedirs(f'{BASE}/data/scenarios', exist_ok=True)
game_path = f'{BASE}/data/scenarios/personal-demo.json'
with open(game_path, 'w', encoding='utf-8') as f:
    json.dump(game_output, f, ensure_ascii=False, indent=2)

print(f'Üretildi: {len(scenarios)} senaryo')
print(f'Kullanılan reason\'lar:')
for rid, count in sorted(reason_use_counts.items()):
    print(f'  {rid}: {count}x')
print('Kadro:')
for k in kadro:
    print(f'  {k["name"]} — {k["role"]} ({k["gender"]})')
print(f'\nDosya: {out_path}')
