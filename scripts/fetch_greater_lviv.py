import urllib.request, urllib.parse, json, time, os

suburbs = [
    ('vynnyky', 'Винники', 'Винники, Львівський район', ['2.1', '4.2']),
    ('briukhovychi', 'Брюховичі', 'Брюховичі, Львівський район', ['1.1', '2.2']),
    ('rudne', 'Рудне', 'Рудно, Львівська міська громада', ['1.1', '6.1']),
    ('ryasne_ruske', 'Рясне-Руське', 'Рясне-Руське, Львівська область', ['4.1']),
    ('malehiv', 'Малехів', 'Малехів, Львівська область', ['2.2', '4.1']),
    ('dublyany', 'Дубляни', 'Дубляни, Львівська міська громада', ['2.2', '6.2']),
    ('sokilnyky', 'Сокільники', 'Сокільники, Сокільницька сільська громада', ['3.1', '5.1']),
    ('zymna_voda', 'Зимна Вода', 'Зимна Вода, Зимноводівська сільська громада', ['1.1', '6.1']),
    ('zubra', 'Зубра', 'Зубра, Солонківська сільська громада', ['3.1', '1.2']),
]

headers = {'User-Agent': 'PowerMapAppResearch/1.0'}
new_features = []

for sub_id, name, query, groups in suburbs:
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'polygon_geojson': '1',
        'limit': '1'
    })
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and 'geojson' in data[0]:
                item = data[0]
                new_features.append({
                    'type': 'Feature',
                    'id': sub_id,
                    'properties': {
                        'id': sub_id,
                        'name': name,
                        'center': [float(item['lat']), float(item['lon'])],
                        'primaryGroups': groups,
                        'keyStreets': [f'вул. Центральна ({name})', f'вул. Шевченка ({name})']
                    },
                    'geometry': item['geojson']
                })
                print(f'Fetched {name}')
            else:
                print(f'No geojson for {name}')
    except Exception as e:
        print(f'Error fetching {name}: {e}')
    time.sleep(1)

with open('/tmp/greater_lviv_suburbs.json', 'w', encoding='utf-8') as f:
    json.dump(new_features, f, ensure_ascii=False, indent=2)

print(f'Saved {len(new_features)} suburbs to /tmp/greater_lviv_suburbs.json')
