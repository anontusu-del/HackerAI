'use strict';

/*
 * GMB Pro Dashboard — server
 * Zero-dependency Node.js server
 * - Serves the dashboard UI from /public
 * - Proxies Google Places API (new Places API v1) so your API key stays server-side
 * - Stores saved business lists as JSON in /data
 * - Runs in DEMO mode (mock data) when GOOGLE_API_KEY is not set
 *
 * Run:  node server.js   (set GOOGLE_API_KEY in .env or environment)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = (process.env.GOOGLE_API_KEY || '').trim();
const DEMO = !API_KEY;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'saved-projects.json');

const PLACES_BASE = 'https://places.googleapis.com/v1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.regularOpeningHours',
  'places.photos',
  'places.types',
  'places.priceLevel',
  'places.editorialSummary',
  'nextPageToken',
].join(',');

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'businessStatus',
  'googleMapsUri',
  'websiteUri',
  'internationalPhoneNumber',
  'nationalPhoneNumber',
  'regularOpeningHours',
  'photos',
  'types',
  'priceLevel',
  'editorialSummary',
  'reviews',
  'plusCode',
  'addressComponents',
].join(',');

/* ---------- helpers ---------- */

function sendJson(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, msg, status = 500) {
  sendJson(res, { error: msg }, status);
}

function serveStatic(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ---------- saved projects storage ---------- */

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readSaved() {
  ensureDataFile();
  try {
    const list = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeSaved(list) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

/* ---------- Google Places API (new v1) ---------- */

async function placesSearch(query, regionCode, includedType, pageToken) {
  const body = { textQuery: query, pageSize: 20 };
  if (regionCode) body.regionCode = regionCode;
  if (includedType) body.includedType = includedType;
  if (pageToken) body.pageToken = pageToken;

  const resp = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error((data.error && data.error.message) || `Places API error (HTTP ${resp.status})`);
  }
  return data;
}

async function placesDetail(placeId, fields) {
  const url = `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(fields)}`;
  const resp = await fetch(url, {
    headers: { 'X-Goog-Api-Key': API_KEY },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error((data.error && data.error.message) || `Places API error (HTTP ${resp.status})`);
  }
  return data;
}

/* ---------- demo mode (mock data, no API key needed) ---------- */

const DEMO_CITIES = [
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { name: 'New York', country: 'USA', lat: 40.7128, lng: -74.006 },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
  { name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.978 },
  { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784 },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357 },
  { name: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011 },
  { name: 'Colombo', country: 'Sri Lanka', lat: 6.9271, lng: 79.8612 },
  { name: 'Kathmandu', country: 'Nepal', lat: 27.7172, lng: 85.324 },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lng: 101.6869 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0278, lng: 105.8342 },
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lng: 120.9842 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041 },
  { name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lng: 46.6753 },
  { name: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173 },
  { name: 'Kyiv', country: 'Ukraine', lat: 50.4501, lng: 30.5234 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 },
  { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473 },
  { name: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332 },
  { name: 'Sao Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
];

const DEMO_BRAND = ['Prime', 'Royal', 'Golden', 'City', 'Star', 'Green', 'Elite', 'Sunrise', 'Metro', 'Blue', 'Crown', 'Global', 'Luxury', 'Classic', 'Silver'];
const DEMO_SUFFIX = ['Services', 'Solutions', 'Center', 'Studio', 'House', 'Point', 'Zone', 'Shop', 'Agency', 'Care', 'Group', 'Hub'];

let demoCache = [];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const REGION_CITY = {
  US: 'New York', GB: 'London', JP: 'Tokyo', BD: 'Dhaka', IN: 'Mumbai', AE: 'Dubai',
  DE: 'Berlin', FR: 'Paris', CA: 'Toronto', AU: 'Sydney', SG: 'Singapore',
  TH: 'Bangkok', KR: 'Seoul', TR: 'Istanbul', EG: 'Cairo', PK: 'Karachi',
  LK: 'Colombo', NP: 'Kathmandu', MY: 'Kuala Lumpur', ID: 'Jakarta', VN: 'Hanoi',
  PH: 'Manila', ES: 'Madrid', IT: 'Rome', NL: 'Amsterdam', SA: 'Riyadh',
  RU: 'Moscow', UA: 'Kyiv', NG: 'Lagos', ZA: 'Johannesburg', MX: 'Mexico City', BR: 'Sao Paulo',
};

function demoSearch(query, regionCode, includedType) {
  const seedStr = `${query}|${regionCode}|${includedType}`;
  const rnd = makeRng(hashStr(seedStr));
  const mappedCity = REGION_CITY[regionCode] ? DEMO_CITIES.find((c) => c.name === REGION_CITY[regionCode]) : null;
  const city = mappedCity || DEMO_CITIES[hashStr(regionCode || query) % DEMO_CITIES.length];
  const q = capitalize((query || 'business').trim().split(/\s+/)[0]);
  const count = 8 + Math.floor(rnd() * 6);
  const places = [];

  for (let i = 0; i < count; i++) {
    const brand = DEMO_BRAND[Math.floor(rnd() * DEMO_BRAND.length)];
    const suffix = DEMO_SUFFIX[Math.floor(rnd() * DEMO_SUFFIX.length)];
    const name = rnd() < 0.5 ? `${brand} ${q} ${suffix}` : `${q} ${brand} ${suffix}`;
    const rating = Math.round((3.0 + rnd() * 2.0) * 10) / 10;
    const reviewCount = rnd() < 0.12 ? 0 : Math.floor(rnd() * 1400) + 3;
    const hasWebsite = rnd() > 0.25;
    const hasPhone = rnd() > 0.1;
    const hasHours = rnd() > 0.2;
    const hasPhotos = rnd() > 0.15;
    const hasSummary = rnd() > 0.45;
    const statusRoll = rnd();
    const status = statusRoll > 0.96 ? 'CLOSED_TEMPORARILY' : statusRoll > 0.9 ? 'CLOSED_PERMANENTLY' : 'OPERATIONAL';

    const place = {
      id: `demo-${i}`,
      displayName: { text: name, languageCode: 'en' },
      formattedAddress: `${10 + Math.floor(rnd() * 990)} Main Street, ${city.name}, ${city.country}`,
      location: { latitude: city.lat + (rnd() - 0.5) * 0.08, longitude: city.lng + (rnd() - 0.5) * 0.08 },
      rating,
      userRatingCount: reviewCount,
      businessStatus: status,
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + city.name)}`,
      types: [includedType || 'point_of_interest', 'establishment'],
      priceLevel: ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'][Math.floor(rnd() * 4)],
    };
    if (hasWebsite) place.websiteUri = `https://www.${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    if (hasPhone) place.internationalPhoneNumber = `+1-555-0${100 + Math.floor(rnd() * 900)}`;
    if (hasHours) {
      place.regularOpeningHours = {
        openNow: rnd() > 0.5,
        weekdayDescriptions: [
          'Monday: 9:00 AM – 9:00 PM',
          'Tuesday: 9:00 AM – 9:00 PM',
          'Wednesday: 9:00 AM – 9:00 PM',
          'Thursday: 9:00 AM – 9:00 PM',
          'Friday: 9:00 AM – 11:00 PM',
          'Saturday: 10:00 AM – 11:00 PM',
          'Sunday: 10:00 AM – 8:00 PM',
        ],
      };
    }
    if (hasPhotos) {
      place.photos = [
        { name: `places/demo-place-${i}/photos/DEMO-PHOTO-1`, widthPx: 1200, heightPx: 800 },
        { name: `places/demo-place-${i}/photos/DEMO-PHOTO-2`, widthPx: 1200, heightPx: 800 },
      ];
    }
    if (hasSummary) place.editorialSummary = { text: `${name} is a well-known ${q} in ${city.name}, serving local customers with quality service.` };
    places.push(place);
  }

  demoCache = places;
  return { places, nextPageToken: null };
}

function demoDetail(placeId) {
  const found = demoCache.find((p) => p.id === placeId);
  if (!found) return null;
  const b = JSON.parse(JSON.stringify(found));
  b.reviews = [
    {
      relativePublishTimeDescription: '2 months ago',
      rating: 5,
      text: { text: 'Great experience, very professional staff and excellent service. Highly recommended!' },
      authorAttribution: { displayName: 'Rahim Ahmed' },
    },
    {
      relativePublishTimeDescription: '5 months ago',
      rating: 4,
      text: { text: 'Good quality and reasonable prices. A few minor improvements would make it perfect.' },
      authorAttribution: { displayName: 'Sarah Lee' },
    },
    {
      relativePublishTimeDescription: '1 year ago',
      rating: 4,
      text: { text: 'Solid choice in the area. Parking can be tricky at peak hours.' },
      authorAttribution: { displayName: 'John Miller' },
    },
  ];
  return b;
}

/* ---------- HTTP routes ---------- */

async function handleSearch(res, url) {
  const query = (url.searchParams.get('query') || '').trim();
  const regionCode = (url.searchParams.get('regionCode') || '').trim().toUpperCase();
  const includedType = (url.searchParams.get('includedType') || '').trim();
  const pageToken = (url.searchParams.get('pageToken') || '').trim();

  if (!query) return sendError(res, 'Search query is required', 400);

  if (DEMO) {
    return sendJson(res, demoSearch(query, regionCode, includedType));
  }
  try {
    const data = await placesSearch(query, regionCode, includedType, pageToken);
    return sendJson(res, data);
  } catch (e) {
    return sendError(res, e.message, 502);
  }
}

async function handleDetail(res, placeId) {
  if (!placeId) return sendError(res, 'Missing place id', 400);
  if (DEMO) {
    const d = demoDetail(placeId);
    if (!d) return sendError(res, 'Place not found', 404);
    return sendJson(res, d);
  }
  try {
    const data = await placesDetail(placeId, DETAIL_FIELDS);
    return sendJson(res, data);
  } catch (e) {
    return sendError(res, e.message, 502);
  }
}

function handleListSaved(res) {
  return sendJson(res, readSaved());
}

async function handleSave(req, res) {
  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    const name = (body.name || '').trim();
    const businesses = Array.isArray(body.businesses) ? body.businesses : [];
    if (!name) return sendError(res, 'Project name is required', 400);
    if (businesses.length === 0) return sendError(res, 'No businesses to save', 400);

    const list = readSaved();
    const project = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      query: (body.query || '').trim(),
      regionCode: (body.regionCode || '').trim(),
      createdAt: new Date().toISOString(),
      count: businesses.length,
      businesses,
    };
    list.unshift(project);
    if (list.length > 200) list.length = 200; // keep the file sane
    writeSaved(list);
    return sendJson(res, { ok: true, project, total: list.length });
  } catch (e) {
    return sendError(res, e.message, 400);
  }
}

function handleDelete(res, url) {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id', 400);
  const list = readSaved().filter((p) => p.id !== id);
  writeSaved(list);
  return sendJson(res, { ok: true, total: list.length });
}

/* ---------- server ---------- */

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = decodeURIComponent(url.pathname);

    // Defense-in-depth: reject any path containing a dot-dot segment
    if (p.split('/').includes('..')) {
      return sendError(res, 'Forbidden', 403);
    }

    // API routes
    if (req.method === 'GET' && p === '/api/config') {
      return sendJson(res, { demoMode: DEMO, mapsApiKey: API_KEY, name: 'GMB Pro Dashboard' });
    }
    if (req.method === 'GET' && p === '/api/search') {
      return handleSearch(res, url);
    }
    if (req.method === 'GET' && p.startsWith('/api/place/')) {
      return handleDetail(res, p.slice('/api/place/'.length));
    }
    if (req.method === 'GET' && p === '/api/saved') {
      return handleListSaved(res);
    }
    if (req.method === 'POST' && p === '/api/save') {
      return handleSave(req, res);
    }
    if (req.method === 'DELETE' && p === '/api/save') {
      return handleDelete(res, url);
    }
    if (p.startsWith('/api/')) {
      return sendError(res, 'Endpoint not found', 404);
    }

    // Static files
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      return res.end('Method not allowed');
    }

    let filePath;
    if (p === '/' || p === '') {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    } else {
      filePath = path.normalize(path.join(PUBLIC_DIR, p));
    }
    if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
      return sendError(res, 'Forbidden', 403);
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return serveStatic(filePath, res);
    }
    return serveStatic(path.join(PUBLIC_DIR, 'index.html'), res); // SPA fallback
  } catch (err) {
    return sendError(res, err.message || 'Server error', 500);
  }
});

server.listen(PORT, () => {
  const mode = DEMO ? 'DEMO (mock data — set GOOGLE_API_KEY for live data)' : 'LIVE (Google Places API)';
  console.log('==============================================');
  console.log('  GMB Pro Dashboard');
  console.log(`  Mode   : ${mode}`);
  console.log(`  URL    : http://localhost:${PORT}`);
  console.log('==============================================');
});



