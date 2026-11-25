import json, re, math

# 1. Load districts & suburbs GeoJSON
with open('src/data/districts.json') as f:
    districts_geojson = json.load(f)

def point_in_poly(x, y, poly):
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def dist_km(lat1, lon1, lat2, lon2):
    dlat = (lat2 - lat1) * 111.0
    dlon = (lon2 - lon1) * 71.5
    return math.sqrt(dlat * dlat + dlon * dlon)

district_polys = []
district_centers = {}
for feat in districts_geojson['features']:
    props = feat['properties']
    geo = feat['geometry']
    d_name = props['name']
    d_id = feat['id']
    center = props.get('center')
    district_centers[d_name] = center
    district_centers[d_id] = center
    polys = []
    if geo['type'] == 'Polygon':
        polys = [geo['coordinates'][0]]
    elif geo['type'] == 'MultiPolygon':
        polys = [p[0] for p in geo['coordinates']]
    district_polys.append({
        'id': d_id,
        'name': d_name,
        'center': center,
        'polys': polys
    })

def find_settlement(lat, lon):
    for d in district_polys:
        for p in d['polys']:
            if point_in_poly(lon, lat, p):
                return d['name']
    return None

def stem(w):
    w = re.sub(r'(івського|івська|івське|івські|ського|ської|ському|ських|ські|ська|ське|цького|цької|цькому|цьких|цькі|цька|цьке)$', '', w)
    w = re.sub(r'(ового|ової|овому|ових|ові|ова|ове|ного|ної|ному|них|ні|на|не)$', '', w)
    w = re.sub(r'(ого|ому|ими|их|ій|им|ою|ем|ям|ам|ах|ях|ів|ей|а|я|у|ю|е|є|и|і|ї)$', '', w)
    return w

def normalize_name(s):
    if not s: return ''
    s = s.lower().strip()
    s = s.replace('ґ', 'г').replace('’', "'").replace('ʼ', "'").replace('`', "'")
    s = re.sub(r'^(вул\.|просп\.|пл\.|пров\.|проїзд|вулиця|проспект|площа|провулок|набережна)\s*', '', s)
    s = re.sub(r'\s+(вулиця|проспект|площа|провулок)$', '', s)
    s = re.sub(r'[\'\"«»\.\-]', ' ', s)
    s = re.sub(r'\b[а-яіїє]\b', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def extract_stems(s):
    norm = normalize_name(s)
    stems = []
    for t in norm.split():
        if len(t) >= 3:
            st = stem(t)
            if len(st) >= 3:
                stems.append(st)
    return set(stems)

GENERIC_STEMS = {'геро', 'святог', 'княз', 'княгин', 'генерал', 'академик', 'гетьман', 'отц', 'митрополит', 'полковник', 'професор', 'бичн', 'нов', 'стар', 'велик', 'мал'}

# 2. Load OSM roads with geometry
with open('/tmp/lviv_osm_roads_with_geometry.json') as f:
    osm_roads = json.load(f)

print(f'Total OSM ways: {len(osm_roads)}')

# Unique parsed OSM ways
osm_unique_ways = []
seen_osm_ids = set()
ways_by_norm = {}

for r in osm_roads:
    if r['id'] in seen_osm_ids: continue
    geom = r.get('geometry', [])
    if len(geom) < 2: continue
    tags = r.get('tags', {})
    name = tags.get('name')
    if not name: continue

    seen_osm_ids.add(r['id'])

    pts = [[round(p['lat'], 5), round(p['lon'], 5)] for p in geom]
    w_lat = sum(p[0] for p in pts) / len(pts)
    w_lon = sum(p[1] for p in pts) / len(pts)

    names_to_index = [name]
    if 'old_name' in tags: names_to_index.append(tags['old_name'])
    if 'name:uk' in tags: names_to_index.append(tags['name:uk'])

    all_stems = set()
    for nm in names_to_index:
        all_stems.update(extract_stems(nm))

    w_obj = {
        'id': r['id'],
        'name': name,
        'norm': normalize_name(name),
        'stems': all_stems,
        'lat': w_lat,
        'lon': w_lon,
        'pts': pts
    }
    osm_unique_ways.append(w_obj)

    for nm in names_to_index:
        norm = normalize_name(nm)
        if norm:
            if norm not in ways_by_norm:
                ways_by_norm[norm] = []
            ways_by_norm[norm].append(w_obj)

print(f'Unique OSM ways: {len(osm_unique_ways)}, distinct norm names: {len(ways_by_norm)}')

def cluster_ways(ways, max_dist_km=1.8):
    clusters = []
    for w in ways:
        assigned = False
        for c in clusters:
            if any(dist_km(w['lat'], w['lon'], member['lat'], member['lon']) <= max_dist_km for member in c['ways']):
                c['ways'].append(w)
                assigned = True
                break
        if not assigned:
            clusters.append({'ways': [w]})

    result = []
    for c in clusters:
        lines = [w['pts'] for w in c['ways']]
        all_pts = []
        for line in lines:
            all_pts.extend(line)
        c_lat = round(sum(p[0] for p in all_pts) / len(all_pts), 5)
        c_lon = round(sum(p[1] for p in all_pts) / len(all_pts), 5)
        settlement = find_settlement(c_lat, c_lon)
        result.append({
            'lat': c_lat,
            'lon': c_lon,
            'lines': lines,
            'ways': c['ways'],
            'settlement': settlement,
            'ways_count': len(c['ways']),
            'pts_count': len(all_pts)
        })
    return result

# 3. Load LOE streets
with open('src/data/streets.json') as f:
    loe_streets = json.load(f)

matched_count = 0
fallback_count = 0

updated_streets = []
all_geometries = {}

for st in loe_streets:
    st_name = st['name']
    st_norm = normalize_name(st_name)
    st_stems = extract_stems(st_name)
    st_city = st.get('cityName') or 'Львів'
    st_dist = st.get('district') or 'Львів'

    # Filter candidates
    candidates = []

    # 1. Include exact norm matches
    if st_norm in ways_by_norm:
        candidates.extend(ways_by_norm[st_norm])

    # 2. ALSO include distinctive stem matches (so names like 'вул. Франка І.' match 'вулиця Івана Франка')
    distinct = st_stems - GENERIC_STEMS
    target_stems = distinct if len(distinct) > 0 else st_stems
    if target_stems:
        for w in osm_unique_ways:
            if target_stems.issubset(w['stems']):
                candidates.append(w)

    if candidates:
        clusters = cluster_ways(candidates)
        best_cluster = None
        best_score = -999

        for c in clusters:
            score = 0
            if any(w['norm'] == st_norm for w in c['ways']):
                score += 80
            c_settle = c['settlement'] or ''

            if st_city != 'Львів' and st_city in c_settle:
                score += 150
            elif st_city == 'Львів' and any(d in c_settle for d in ['район', 'Львів']):
                if st_dist in c_settle:
                    score += 120
                else:
                    score += 70
            elif st_dist in c_settle:
                score += 80
            elif st_city != 'Львів' and 'район' in c_settle:
                score -= 80

            target_center = district_centers.get(st_city) or district_centers.get(st_dist)
            if target_center:
                d = dist_km(c['lat'], c['lon'], target_center[0], target_center[1])
                score -= min(d * 5, 50)

            if score > best_score:
                best_score = score
                best_cluster = c

        if best_cluster and best_score >= 10:
            matched_count += 1
            updated_streets.append({
                'id': st['id'],
                'name': st['name'],
                'district': best_cluster['settlement'] if (st_city != 'Львів' and best_cluster['settlement']) else st['district'],
                'group': st['group'],
                'lat': best_cluster['lat'],
                'lon': best_cluster['lon'],
                'buildings': st.get('buildings', '1-80'),
                'cityId': st.get('cityId'),
                'cityName': st.get('cityName')
            })
            all_geometries[st['id']] = best_cluster['lines']
            continue

    fallback_count += 1
    # Fallback to existing
    updated_streets.append({
        'id': st['id'],
        'name': st['name'],
        'district': st['district'],
        'group': st['group'],
        'lat': st['lat'],
        'lon': st['lon'],
        'buildings': st.get('buildings', '1-80'),
        'cityId': st.get('cityId'),
        'cityName': st.get('cityName')
    })

print(f'Total LOE streets: {len(updated_streets)}')
print(f'Matched with real OSM geometry & exact location: {matched_count} ({matched_count/len(loe_streets)*100:.1f}%)')
print(f'Fallbacks: {fallback_count}')

# Write updated streets.json
with open('src/data/streets.json', 'w', encoding='utf-8') as f:
    json.dump(updated_streets, f, ensure_ascii=False, indent=2)

# Write all geometries
with open('src/data/allStreetGeometries.json', 'w', encoding='utf-8') as f:
    json.dump(all_geometries, f, ensure_ascii=False)

print('Successfully updated src/data/streets.json and src/data/allStreetGeometries.json!')

# Check heroiv maidanu, franka, konovaltsia
for test_id in ['38490', '12540', '12742', '12470', '12712']:
    s = [x for x in updated_streets if x['id'] == test_id][0]
    lines = all_geometries.get(test_id, [])
    print(f"VERIFIED {test_id}: {s['name']} | {s.get('cityName')} ({s.get('district')}) -> [{s['lat']}, {s['lon']}], lines: {len(lines)}")
