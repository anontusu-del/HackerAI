'use strict';

/* ============================================================
   GMB Pro Dashboard — frontend logic (vanilla JS, no build step)
   ============================================================ */

/* ---------- global state ---------- */
const state = {
  cfg: { demoMode: true, mapsApiKey: '' },
  raw: [],            // raw Places API objects of the current page
  current: [],        // normalized + analyzed businesses (current page)
  saved: [],          // saved projects
  markers: [],
  map: null,
  infowindow: null,
  pageStack: [],      // request history for prev/next pagination
  lastNextToken: null,
  viewingSavedId: null,
};

/* ---------- tiny helpers ---------- */
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg, kind = 'ok') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${kind}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3400);
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function starsHtml(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.round(r);
  let s = '';
  for (let i = 0; i < 5; i++) s += i < full ? '★' : '☆';
  return s;
}

/* ---------- country + category data ---------- */
const COUNTRIES = [
  ['AF', 'Afghanistan'], ['AL', 'Albania'], ['DZ', 'Algeria'], ['AR', 'Argentina'], ['AM', 'Armenia'],
  ['AU', 'Australia'], ['AT', 'Austria'], ['AZ', 'Azerbaijan'], ['BH', 'Bahrain'], ['BD', 'Bangladesh'],
  ['BY', 'Belarus'], ['BE', 'Belgium'], ['BO', 'Bolivia'], ['BA', 'Bosnia and Herzegovina'], ['BR', 'Brazil'],
  ['BG', 'Bulgaria'], ['KH', 'Cambodia'], ['CM', 'Cameroon'], ['CA', 'Canada'], ['CL', 'Chile'],
  ['CN', 'China'], ['CO', 'Colombia'], ['CR', 'Costa Rica'], ['HR', 'Croatia'], ['CU', 'Cuba'],
  ['CY', 'Cyprus'], ['CZ', 'Czech Republic'], ['DK', 'Denmark'], ['DO', 'Dominican Republic'], ['EC', 'Ecuador'],
  ['EG', 'Egypt'], ['SV', 'El Salvador'], ['EE', 'Estonia'], ['ET', 'Ethiopia'], ['FI', 'Finland'],
  ['FR', 'France'], ['GE', 'Georgia'], ['DE', 'Germany'], ['GH', 'Ghana'], ['GR', 'Greece'],
  ['GT', 'Guatemala'], ['HN', 'Honduras'], ['HK', 'Hong Kong'], ['HU', 'Hungary'], ['IS', 'Iceland'],
  ['IN', 'India'], ['ID', 'Indonesia'], ['IR', 'Iran'], ['IQ', 'Iraq'], ['IE', 'Ireland'],
  ['IL', 'Israel'], ['IT', 'Italy'], ['JM', 'Jamaica'], ['JP', 'Japan'], ['JO', 'Jordan'],
  ['KZ', 'Kazakhstan'], ['KE', 'Kenya'], ['KW', 'Kuwait'], ['KG', 'Kyrgyzstan'], ['LA', 'Laos'],
  ['LV', 'Latvia'], ['LB', 'Lebanon'], ['LY', 'Libya'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'],
  ['MO', 'Macao'], ['MY', 'Malaysia'], ['MV', 'Maldives'], ['MT', 'Malta'], ['MX', 'Mexico'],
  ['MD', 'Moldova'], ['MN', 'Mongolia'], ['ME', 'Montenegro'], ['MA', 'Morocco'], ['MM', 'Myanmar'],
  ['NP', 'Nepal'], ['NL', 'Netherlands'], ['NZ', 'New Zealand'], ['NI', 'Nicaragua'], ['NG', 'Nigeria'],
  ['MK', 'North Macedonia'], ['NO', 'Norway'], ['OM', 'Oman'], ['PK', 'Pakistan'], ['PA', 'Panama'],
  ['PY', 'Paraguay'], ['PE', 'Peru'], ['PH', 'Philippines'], ['PL', 'Poland'], ['PT', 'Portugal'],
  ['QA', 'Qatar'], ['RO', 'Romania'], ['RU', 'Russia'], ['RW', 'Rwanda'], ['SA', 'Saudi Arabia'],
  ['SN', 'Senegal'], ['RS', 'Serbia'], ['SG', 'Singapore'], ['SK', 'Slovakia'], ['SI', 'Slovenia'],
  ['ZA', 'South Africa'], ['KR', 'South Korea'], ['ES', 'Spain'], ['LK', 'Sri Lanka'], ['SD', 'Sudan'],
  ['SE', 'Sweden'], ['CH', 'Switzerland'], ['SY', 'Syria'], ['TW', 'Taiwan'], ['TJ', 'Tajikistan'],
  ['TZ', 'Tanzania'], ['TH', 'Thailand'], ['TT', 'Trinidad and Tobago'], ['TN', 'Tunisia'], ['TR', 'Turkey'],
  ['TM', 'Turkmenistan'], ['UG', 'Uganda'], ['UA', 'Ukraine'], ['AE', 'United Arab Emirates'],
  ['GB', 'United Kingdom'], ['US', 'United States'], ['UY', 'Uruguay'], ['UZ', 'Uzbekistan'],
  ['VE', 'Venezuela'], ['VN', 'Vietnam'], ['YE', 'Yemen'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
];

const CATEGORIES = [
  ['', 'All business types'],
  ['restaurant', 'Restaurant'], ['cafe', 'Cafe'], ['bakery', 'Bakery'], ['bar', 'Bar'],
  ['hotel', 'Hotel'], ['lodging', 'Lodging'], ['hostel', 'Hostel'],
  ['gym', 'Gym'], ['beauty_salon', 'Beauty salon'], ['spa', 'Spa'], ['nail_salon', 'Nail salon'],
  ['hospital', 'Hospital'], ['doctor', 'Doctor'], ['dentist', 'Dentist'], ['pharmacy', 'Pharmacy'],
  ['physiotherapist', 'Physiotherapist'], ['veterinary_care', 'Veterinarian'], ['health', 'Health center'],
  ['school', 'School'], ['university', 'University'], ['childcare_agency', 'Day care'],
  ['bank', 'Bank'], ['atm', 'ATM'], ['money_transfer', 'Money transfer'],
  ['lawyer', 'Lawyer'], ['accountant', 'Accountant'], ['insurance_agency', 'Insurance agency'],
  ['real_estate_agency', 'Real estate agency'], ['travel_agency', 'Travel agency'],
  ['auto_repair', 'Car repair'], ['car_dealer', 'Car dealer'], ['car_rental', 'Car rental'],
  ['gas_station', 'Gas station'], ['car_wash', 'Car wash'],
  ['grocery_store', 'Grocery store'], ['supermarket', 'Supermarket'], ['shopping_mall', 'Shopping mall'],
  ['clothing_store', 'Clothing store'], ['electronics_store', 'Electronics store'],
  ['furniture_store', 'Furniture store'], ['jewelry_store', 'Jewelry store'], ['shoe_store', 'Shoe store'],
  ['hardware_store', 'Hardware store'], ['book_store', 'Book store'], ['florist', 'Florist'],
  ['pet_store', 'Pet store'], ['department_store', 'Department store'],
  ['movie_theater', 'Cinema'], ['stadium', 'Stadium'], ['park', 'Park'], ['museum', 'Museum'],
  ['art_gallery', 'Art gallery'], ['zoo', 'Zoo'], ['amusement_park', 'Amusement park'],
  ['night_club', 'Night club'], ['bowling_alley', 'Bowling alley'], ['casino', 'Casino'],
  ['airport', 'Airport'], ['bus_station', 'Bus station'], ['train_station', 'Train station'],
  ['police', 'Police station'], ['fire_station', 'Fire station'], ['post_office', 'Post office'],
  ['embassy', 'Embassy'], ['local_government_office', 'Government office'],
  ['laundry', 'Laundry'], ['locksmith', 'Locksmith'], ['moving_company', 'Moving company'],
  ['plumber', 'Plumber'], ['electrician', 'Electrician'], ['painter', 'Painter'],
  ['general_contractor', 'Contractor'], ['landscaper', 'Landscaper'],
  ['funeral_home', 'Funeral home'], ['library', 'Library'], ['convention_center', 'Convention center'],
];

const CATEGORY_LABEL = {};
CATEGORIES.forEach(([code, label]) => { CATEGORY_LABEL[code] = label; });

/* ---------- init ---------- */
async function init() {
  try {
    const res = await fetch('/api/config');
    state.cfg = await res.json();
  } catch {
    state.cfg = { demoMode: true, mapsApiKey: '' };
  }

  const badge = $('modeBadge');
  if (state.cfg.demoMode) {
    badge.textContent = 'DEMO MODE';
    badge.className = 'badge badge-demo';
  } else {
    badge.textContent = 'LIVE · PLACES API';
    badge.className = 'badge badge-live';
  }

  fillCountrySelect();
  fillCategorySelect();
  loadSavedList();

  $('btnSearch').addEventListener('click', () => doSearch(1));
  $('query').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(1); });
  $('btnNext').addEventListener('click', () => pageNext());
  $('btnPrev').addEventListener('click', () => pagePrev());
  $('btnExport').addEventListener('click', exportCSV);
  $('btnSaveList').addEventListener('click', saveCurrentList);
  $('btnSaved').addEventListener('click', openSavedModal);
  $('filterStatus').addEventListener('change', renderCurrent);
  $('filterComplete').addEventListener('change', renderCurrent);
  $('sortBy').addEventListener('change', renderCurrent);

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $('query').value = chip.dataset.q || '';
      $('country').value = chip.dataset.c || '';
      doSearch(1);
    });
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => $('detailModal').classList.add('hidden'));
  });
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  });

  if (!state.cfg.demoMode && state.cfg.mapsApiKey) {
    loadMapsScript();
  } else {
    $('mapPlaceholder').classList.remove('hidden');
  }
}

function fillCountrySelect() {
  const sel = $('country');
  sel.innerHTML = '<option value="">🌍 Any country</option>';
  COUNTRIES.forEach(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function fillCategorySelect() {
  const sel = $('category');
  sel.innerHTML = '';
  CATEGORIES.forEach(([code, label]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

/* ---------- Google Maps ---------- */
function loadMapsScript() {
  const s = document.createElement('script');
  s.async = true;
  s.defer = true;
  s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(state.cfg.mapsApiKey)}&libraries=places&callback=initMap`;
  s.onerror = () => {
    $('mapPlaceholder').classList.remove('hidden');
    $('mapPlaceholder').querySelector('p').innerHTML =
      'Google Maps failed to load. Check your API key and that the <b>Maps JavaScript API</b> is enabled.';
  };
  document.getElementById('mapsScript').replaceWith(s);
}

window.initMap = function initMap() {
  state.map = new google.maps.Map($('map'), {
    center: { lat: 23.8103, lng: 90.4125 },
    zoom: 12,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#0d1526' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1526' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#9fb0d0' }] },
      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#131c33' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d2a4d' }] },
      { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#16203c' }] },
      { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0a1a3a' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ],
  });
  state.infowindow = new google.maps.InfoWindow();
  $('map').classList.remove('hidden');
  $('mapPlaceholder').classList.add('hidden');
  renderMarkers();
};

function markerColor(score) {
  if (score >= 90) return '#34d399';
  if (score >= 55) return '#fbbf24';
  return '#f87171';
}

function renderMarkers() {
  if (!state.map || !window.google || !state.current.length) return;
  state.markers.forEach((m) => m.setMap(null));
  state.markers = [];
  const bounds = new google.maps.LatLngBounds();

  state.current.forEach((b) => {
    if (b.lat == null || b.lng == null) return;
    const marker = new google.maps.Marker({
      position: { lat: b.lat, lng: b.lng },
      map: state.map,
      title: b.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: markerColor(b.score),
        fillOpacity: 0.95,
        strokeColor: '#0b1120',
        strokeWeight: 2,
      },
    });
    marker.addListener('click', () => {
      state.infowindow.setContent(
        `<div style="font-family:Inter,sans-serif;color:#0b1120;min-width:190px">
           <b style="font-size:13px">${esc(b.name)}</b><br/>
           <span style="font-size:12px;color:#555">${esc(b.address)}</span><br/>
           <span style="font-size:12px">⭐ ${b.rating ?? '—'} &nbsp;·&nbsp; ${fmtNum(b.reviews)} reviews</span><br/>
           <span style="font-size:12px;color:#1a7f37"><b>${b.score}% complete</b></span><br/>
           <a href="#" onclick="window.openDetail('${esc(b.id)}');return false" style="font-size:12px;color:#1a56db">View details →</a>
         </div>`
      );
      state.infowindow.open(state.map, marker);
    });
    state.markers.push(marker);
    bounds.extend({ lat: b.lat, lng: b.lng });
  });

  if (state.markers.length === 1) {
    state.map.setCenter({ lat: state.current[0].lat, lng: state.current[0].lng });
    state.map.setZoom(13);
  } else if (state.markers.length > 1) {
    state.map.fitBounds(bounds);
  }
}

/* ---------- analysis: GMB completion score ---------- */
function analyze(b) {
  const checks = [
    ['Phone number', !!(b.phone)],
    ['Website', !!(b.website)],
    ['Opening hours', !!(b.hours && b.hours.length)],
    ['Photos', !!(b.photos && b.photos.length)],
    ['Description', !!(b.summary)],
    ['Has reviews', (b.reviews || 0) > 0],
  ];
  const present = checks.filter((c) => c[1]).map((c) => c[0]);
  const missing = checks.filter((c) => !c[1]).map((c) => c[0]);
  const score = Math.round((present.length / checks.length) * 100);
  const level = score >= 90 ? 'complete' : score >= 55 ? 'partial' : 'incomplete';
  return { score, level, present, missing };
}

function norm(p) {
  const b = {
    id: p.id || '',
    name: (p.displayName && p.displayName.text) || p.name || 'Unknown business',
    address: p.formattedAddress || '',
    lat: p.location ? p.location.latitude : null,
    lng: p.location ? p.location.longitude : null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? 0,
    status: p.businessStatus || 'UNKNOWN',
    mapsUrl: p.googleMapsUri || '',
    website: p.websiteUri || '',
    phone: p.internationalPhoneNumber || p.nationalPhoneNumber || '',
    hours: (p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || [],
    openNow: !!(p.regularOpeningHours && p.regularOpeningHours.openNow),
    photos: p.photos || [],
    types: p.types || [],
    price: p.priceLevel || '',
    summary: (p.editorialSummary && p.editorialSummary.text) || '',
    reviewsList: (p.reviews || []).map((r) => ({
      rating: r.rating,
      text: (r.text && r.text.text) || '',
      author: (r.authorAttribution && r.authorAttribution.displayName) || 'Google user',
      time: r.relativePublishTimeDescription || '',
    })),
  };
  Object.assign(b, analyze(b));
  return b;
}

function photoUrl(photo) {
  if (!photo || !photo.name) return '';
  return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${encodeURIComponent(state.cfg.mapsApiKey)}`;
}

/* ---------- search flow ---------- */
function searchRequest() {
  return {
    query: $('query').value.trim(),
    regionCode: $('country').value,
    includedType: $('category').value,
    pageToken: '',
  };
}

async function doSearch(reset) {
  const req = searchRequest();
  if (!req.query) {
    toast('Please type what you are searching for, e.g. "restaurant"', 'err');
    $('query').focus();
    return;
  }
  if (reset) {
    state.pageStack = [req];
    state.viewingSavedId = null;
  } else {
    state.pageStack.push(req);
  }
  await runSearch();
}

async function pageNext() {
  if (!state.lastNextToken) return;
  const nextReq = searchRequest();
  nextReq.pageToken = state.lastNextToken;
  state.pageStack.push(nextReq);
  await runSearch();
}

async function pagePrev() {
  if (state.pageStack.length <= 1) return;
  state.pageStack.pop();
  await runSearch();
}

async function runSearch() {
  const req = state.pageStack[state.pageStack.length - 1];
  setBusy(true);
  try {
    const params = new URLSearchParams({ query: req.query });
    if (req.regionCode) params.set('regionCode', req.regionCode);
    if (req.includedType) params.set('includedType', req.includedType);
    if (req.pageToken) params.set('pageToken', req.pageToken);
    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    state.raw = data.places || [];
    state.lastNextToken = data.nextPageToken || null;
    state.current = state.raw.map(norm);
    $('btnPrev').disabled = state.pageStack.length <= 1;
    $('btnNext').disabled = !state.lastNextToken;
    $('pageInfo').textContent = `Page ${state.pageStack.length}`;
    renderCurrent();
  } catch (e) {
    toast(e.message || 'Search failed', 'err');
  } finally {
    setBusy(false);
  }
}

function setBusy(on) {
  const btn = $('btnSearch');
  btn.disabled = on;
  btn.textContent = on ? 'Searching…' : 'Search';
}

/* ---------- rendering ---------- */
function filteredSorted() {
  const fStatus = $('filterStatus').value;
  const fComplete = $('filterComplete').value;
  const sort = $('sortBy').value;
  let list = state.current.slice();
  if (fStatus) list = list.filter((b) => b.status === fStatus);
  if (fComplete) list = list.filter((b) => b.level === fComplete);
  switch (sort) {
    case 'rating': list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
    case 'score': list.sort((a, b) => b.score - a.score); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: list.sort((a, b) => b.reviews - a.reviews);
  }
  return list;
}

function statusPill(status) {
  const map = {
    OPERATIONAL: ['st-operational', 'Open'],
    CLOSED_TEMPORARILY: ['st-temp', 'Temp. closed'],
    CLOSED_PERMANENTLY: ['st-closed', 'Closed'],
    UNKNOWN: ['st-unknown', 'Unknown'],
  };
  const [cls, label] = map[status] || map.UNKNOWN;
  return `<span class="status-pill ${cls}">${label}</span>`;
}

function renderCurrent() {
  const list = filteredSorted();
  $('resultCount').textContent = `${list.length} of ${state.current.length} results`;
  computeStats(list);
  renderCards(list);
  renderMarkers();
}

function computeStats(list) {
  $('statTotal').textContent = fmtNum(list.length);
  const rated = list.filter((b) => b.rating != null && b.reviews > 0);
  $('statAvg').textContent = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : '—';
  $('statReviews').textContent = fmtNum(list.reduce((s, b) => s + b.reviews, 0));
  $('statComplete').textContent = fmtNum(list.filter((b) => b.score >= 90).length);
  $('statNeeds').textContent = fmtNum(list.filter((b) => b.score < 55).length);
}

function scoreBadge(b) {
  const cls = b.level === 'complete' ? 'sc-complete' : b.level === 'partial' ? 'sc-partial' : 'sc-incomplete';
  return `<span class="score-badge ${cls}">${b.score}% Complete</span>`;
}

function typeLabel(b) {
  const t = b.types && b.types[0] ? b.types[0].replace(/_/g, ' ') : '';
  return esc(t || 'Business');
}

function cardHtml(b) {
  const avatarChar = (b.name[0] || 'B').toUpperCase();
  const missingHtml = b.missing.length
    ? `<div class="missing-chips">${b.missing.map((m) => `<span class="m-chip">Missing: ${esc(m)}</span>`).join('')}</div>`
    : `<div class="all-good"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>All key fields present</div>`;

  return `
  <article class="card" data-id="${esc(b.id)}">
    <div class="card-head">
      <div class="avatar">${esc(avatarChar)}</div>
      <div class="card-title">
        <h3 title="${esc(b.name)}">${esc(b.name)}</h3>
        <div class="types">${typeLabel(b)}${b.price ? ' · ' + b.price.replace('PRICE_LEVEL_', '').toLowerCase() : ''}</div>
      </div>
      ${statusPill(b.status)}
    </div>
    <div class="rating-row">
      <span class="stars">${starsHtml(b.rating)}</span>
      <b>${b.rating != null ? b.rating : '—'}</b>
      <span class="muted">(${fmtNum(b.reviews)} review${b.reviews === 1 ? '' : 's'})</span>
      ${scoreBadge(b)}
    </div>
    <div class="meta">
      <div title="${esc(b.address)}">📍 ${esc(b.address) || '<span class="val-missing">No address shown</span>'}</div>
      <div>📞 ${b.phone ? esc(b.phone) : '<span class="val-missing">No phone listed</span>'}</div>
      <div>🌐 ${b.website ? `<a href="${esc(b.website)}" target="_blank" rel="noopener">${esc(b.website.replace(/^https?:\/\//, ''))}</a>` : '<span class="val-missing">No website</span>'}</div>
    </div>
    ${missingHtml}
    <div class="card-actions">
      <button class="btn btn-ghost" onclick="openDetail('${esc(b.id)}')">View Details</button>
      <a class="btn btn-ghost" href="${esc(b.mapsUrl || 'https://www.google.com/maps')}" target="_blank" rel="noopener">Google Maps ↗</a>
    </div>
  </article>`;
}

function renderCards(list) {
  const box = $('results');
  if (!list.length) {
    box.innerHTML = `<div class="empty-state"><b>No results</b>Try another keyword, country or business type.</div>`;
    return;
  }
  box.innerHTML = list.map(cardHtml).join('');
}

/* ---------- details modal ---------- */
window.openDetail = async function openDetail(id) {
  const modal = $('detailModal');
  modal.classList.remove('hidden');
  $('dBody').innerHTML = '<div class="loading">Loading details…</div>';
  try {
    const res = await fetch(`/api/place/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load details');
    const b = norm(data);
    modal.querySelector('.modal-box').scrollTop = 0;
    $('dBody').innerHTML = detailHtml(b);
  } catch (e) {
    $('dBody').innerHTML = `<div class="loading">${esc(e.message)}</div>`;
  }
};

function detailHtml(b) {
  const photo = b.photos && b.photos.length ? b.photos[0] : null;
  const photoHtml = photo
    ? `<img class="d-photo" src="${esc(photoUrl(photo))}" alt="${esc(b.name)}" loading="lazy" />`
    : `<div class="d-photo-fallback">${esc((b.name[0] || 'B').toUpperCase())}</div>`;

  const checksHtml = [
    ['Phone number', b.phone],
    ['Website', b.website],
    ['Opening hours', b.hours.length],
    ['Photos', b.photos.length],
    ['Description', b.summary],
    ['Has reviews', b.reviews > 0],
  ].map(([label, ok]) => `
    <div class="check-item">
      <span class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span>
      <span>${label}</span>
      ${ok ? '' : '<span class="missing-name">(missing)</span>'}
    </div>`).join('');

  const hoursHtml = b.hours.length
    ? `<ul>${b.hours.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`
    : '<p class="muted" style="font-size:12px">Opening hours not provided on this listing.</p>';

  const reviewsHtml = b.reviewsList.length
    ? b.reviewsList.map((r) => `
      <div class="review-item">
        <div class="review-head">
          <span class="review-stars">${starsHtml(r.rating)}</span>
          <b>${esc(r.author)}</b>
          <span class="muted">· ${esc(r.time)}</span>
        </div>
        ${r.text ? `<div class="review-text">${esc(r.text)}</div>` : ''}
      </div>`).join('')
    : '<p class="muted" style="font-size:12px">No written reviews returned by the API.</p>';

  const ringColor = b.level === 'complete' ? 'var(--green)' : b.level === 'partial' ? 'var(--amber)' : 'var(--red)';

  return `
    ${photoHtml}
    <div class="d-head">
      <h2>${esc(b.name)}</h2>
      <div class="d-sub">${esc(b.address)}${b.status === 'CLOSED_PERMANENTLY' ? ' · ⛔ Permanently closed' : ''}</div>
      <div class="d-row">
        <span class="d-rating">⭐ ${b.rating != null ? b.rating : '—'} · ${fmtNum(b.reviews)} reviews</span>
        ${scoreBadge(b)}
        ${statusPill(b.status)}
      </div>
    </div>
    <div class="d-grid">
      <div class="d-card">
        <h4>Contact</h4>
        <ul>
          <li><span>📍</span><span>${esc(b.address) || '—'}</span></li>
          <li><span>📞</span><span>${b.phone ? esc(b.phone) : '<span class="val-missing">Not listed</span>'}</span></li>
          <li><span>🌐</span><span>${b.website ? `<a href="${esc(b.website)}" target="_blank" rel="noopener">${esc(b.website)}</a>` : '<span class="val-missing">Not listed</span>'}</span></li>
          <li><span>🗺️</span><span><a href="${esc(b.mapsUrl || 'https://www.google.com/maps')}" target="_blank" rel="noopener">Open in Google Maps ↗</a></span></li>
        </ul>
      </div>
      <div class="d-card">
        <h4>GMB Completion Score</h4>
        <div class="score-ring" style="border-color:${ringColor}">${b.score}%</div>
        <div class="check-list">${checksHtml}</div>
      </div>
      <div class="d-card d-full">
        <h4>Opening Hours</h4>
        ${hoursHtml}
      </div>
      <div class="d-card d-full">
        <h4>Latest Reviews</h4>
        ${reviewsHtml}
      </div>
    </div>`;
}

/* ---------- CSV export ---------- */
function exportCSV() {
  const list = filteredSorted();
  if (!list.length) {
    toast('Nothing to export yet — run a search first', 'err');
    return;
  }
  const headers = [
    'Business Name', 'Address', 'Country', 'Phone', 'Website', 'Rating',
    'Review Count', 'Business Status', 'GMB Completion %', 'Missing Fields',
    'Business Types', 'Google Maps URL',
  ];
  const rows = list.map((b) => [
    b.name, b.address, $('country').selectedOptions[0]?.textContent || '',
    b.phone, b.website, b.rating ?? '', b.reviews, b.status, b.score,
    b.missing.join('; '), b.types.join('; '), b.mapsUrl,
  ]);
  const csv = '\uFEFF' + [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gmb-report-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Exported ${rows.length} listings to CSV (Excel friendly)`);
}

/* ---------- saved lists ---------- */
async function loadSavedList() {
  try {
    const res = await fetch('/api/saved');
    state.saved = await res.json();
    $('savedCount').textContent = state.saved.length;
  } catch {
    state.saved = [];
  }
}

async function saveCurrentList() {
  if (!state.current.length) {
    toast('Nothing to save — run a search first', 'err');
    return;
  }
  const name = prompt('Give this list a project name (e.g. "Tokyo restaurants — July"):');
  if (!name) return;
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        query: $('query').value.trim(),
        regionCode: $('country').value,
        businesses: state.raw,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    await loadSavedList();
    toast(`Saved "${data.project.name}" (${data.project.count} businesses)`);
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function openSavedModal() {
  await loadSavedList();
  const modal = $('savedModal');
  modal.classList.remove('hidden');
  const box = $('sList');
  if (!state.saved.length) {
    box.innerHTML = `<div class="empty-state"><b>No saved lists yet</b>Search for businesses, then click "Save List".</div>`;
    return;
  }
  box.innerHTML = state.saved.map((p) => {
    const date = new Date(p.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const countryName = p.regionCode
      ? (COUNTRIES.find(([c]) => c === p.regionCode) || [])[1] || p.regionCode
      : 'All countries';
    return `
      <div class="saved-item">
        <div class="s-info">
          <div class="s-name">${esc(p.name)}</div>
          <div class="s-meta">${esc(p.query || '—')} · ${esc(countryName)} · ${date}</div>
        </div>
        <span class="s-count">${p.count} listings</span>
        <div class="s-actions">
          <button class="btn btn-ghost btn-sm" onclick="viewSaved('${p.id}')">View</button>
          <button class="btn btn-ghost btn-sm" onclick="exportSaved('${p.id}')">CSV</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteSaved('${p.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

window.viewSaved = async function viewSaved(id) {
  const p = state.saved.find((x) => x.id === id);
  if (!p) return;
  state.raw = p.businesses || [];
  state.current = state.raw.map(norm);
  state.lastNextToken = null;
  state.pageStack = [{ query: p.query || '', regionCode: p.regionCode || '', includedType: '', pageToken: '' }];
  state.viewingSavedId = id;
  $('query').value = p.query || '';
  $('country').value = p.regionCode || '';
  $('btnPrev').disabled = true;
  $('btnNext').disabled = true;
  $('pageInfo').textContent = 'Saved list';
  $('savedModal').classList.add('hidden');
  renderCurrent();
  toast(`Loaded "${p.name}" — ${p.count} listings`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.exportSaved = async function exportSaved(id) {
  const p = state.saved.find((x) => x.id === id);
  if (!p) return;
  const prev = state.current;
  state.raw = p.businesses || [];
  state.current = state.raw.map(norm);
  exportCSV();
  state.raw = [];
  state.current = prev;
};

window.deleteSaved = async function deleteSaved(id) {
  if (!confirm('Delete this saved list?')) return;
  try {
    const res = await fetch(`/api/save?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    await loadSavedList();
    openSavedModal();
    toast('List deleted');
  } catch (e) {
    toast(e.message, 'err');
  }
};

/* ---------- start ---------- */
document.addEventListener('DOMContentLoaded', init);


