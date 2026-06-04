// store.js — the only code that reads/writes localStorage
// All other JS files call store.init() first, then use the public API below.

var store = (function () {
  var KEYS = {
    resources: 'ledger_resources',
    platform:  'ledger_platform',
    seeded:    'ledger_seeded',
    positions: 'ledger_positions',
    sources:   'ledger_sources',
    days100:   'ledger_100days',
    apiKey:    'ledger_api_key'
  };

  var PILLARS = [
    { id: 'housing',          label: 'Housing and Homelessness' },
    { id: 'economic-justice', label: 'Economic Justice and Wages' },
    { id: 'voting-rights',    label: 'Voting Rights and Electoral Reform' },
    { id: 'education',        label: 'Education and Access' },
    { id: 'healthcare',       label: 'Healthcare' },
    { id: 'criminal-justice', label: 'Criminal Justice and Policing' },
    { id: 'civil-rights',     label: 'Civil Rights and Racial Equity' },
    { id: 'environment',      label: 'Environment and Climate' },
    { id: 'military',         label: 'Military and Federal Spending' },
    { id: 'immigration',      label: 'Immigration' },
    { id: 'arts-culture',     label: 'Arts, Culture, and Public Life' },
    { id: 'tech-data',        label: 'Technology and Data Rights' }
  ];

  // Async seed: fetch JSON files on first visit and write to localStorage.
  // Every page must await init() before calling any getter.
  function init() {
    if (localStorage.getItem(KEYS.seeded)) {
      return Promise.resolve();
    }
    return Promise.all([
      fetch('data/resources.json').then(function (r) { return r.json(); }),
      fetch('data/platform.json').then(function (r) { return r.json(); })
    ]).then(function (results) {
      try {
        localStorage.setItem(KEYS.resources, JSON.stringify(results[0]));
        localStorage.setItem(KEYS.platform, JSON.stringify(results[1]));
        // Seed initial positions from platform.json belief statements
        var seedPositions = (results[1].pillars || []).map(function (p) {
          return {
            id: 'pos-' + p.id,
            pillar: p.id,
            statement: (p.belief && p.belief !== 'Position forthcoming.') ? p.belief : '',
            evidence: [],
            counters: [],
            updatedAt: new Date().toISOString()
          };
        });
        localStorage.setItem(KEYS.positions, JSON.stringify(seedPositions));
        localStorage.setItem(KEYS.sources, JSON.stringify([]));
        localStorage.setItem(KEYS.seeded, '1');
      } catch (e) {
        showStorageError();
      }
    }).catch(function () {
      // Seed fetch failed (e.g. file:// protocol). Start with empty data.
      if (!localStorage.getItem(KEYS.resources))  localStorage.setItem(KEYS.resources,  JSON.stringify([]));
      if (!localStorage.getItem(KEYS.platform))   localStorage.setItem(KEYS.platform,   JSON.stringify({ pillars: [] }));
      if (!localStorage.getItem(KEYS.positions))  localStorage.setItem(KEYS.positions,  JSON.stringify([]));
      if (!localStorage.getItem(KEYS.sources))    localStorage.setItem(KEYS.sources,    JSON.stringify([]));
    });
  }

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        showStorageError('Storage is full. Export your data to free up space.');
      }
      return false;
    }
  }

  function showStorageError(msg) {
    var message = msg || 'Storage error. Your browser storage may be full.';
    if (typeof window.showToast === 'function') {
      window.showToast(message, true);
    } else {
      console.error('[Ledger]', message);
    }
  }

  // ── Resources (legacy — kept for backwards compat) ─────────────────────

  function getResources() {
    return read(KEYS.resources) || [];
  }

  function saveResource(resource) {
    var resources = getResources();
    var idx = resources.findIndex(function (r) { return r.id === resource.id; });
    if (idx >= 0) {
      resources[idx] = resource;
    } else {
      resource.id = resource.id || generateId('r');
      resource.date = resource.date || new Date().toISOString().slice(0, 10);
      resources.unshift(resource);
    }
    return write(KEYS.resources, resources);
  }

  function deleteResource(id) {
    var resources = getResources().filter(function (r) { return r.id !== id; });
    return write(KEYS.resources, resources);
  }

  // ── Positions ──────────────────────────────────────────────────────────

  function getPositions() {
    return read(KEYS.positions) || [];
  }

  function getPosition(pillarId) {
    return getPositions().find(function (p) { return p.pillar === pillarId; }) || null;
  }

  function savePosition(pos) {
    var positions = getPositions();
    var idx = positions.findIndex(function (p) { return p.pillar === pos.pillar; });
    pos.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      positions[idx] = pos;
    } else {
      positions.push(pos);
    }
    return write(KEYS.positions, positions);
  }

  // ── Sources ────────────────────────────────────────────────────────────

  function getSources() {
    return read(KEYS.sources) || [];
  }

  function saveSource(src) {
    var sources = getSources();
    var idx = sources.findIndex(function (s) { return s.id === src.id; });
    if (idx >= 0) {
      sources[idx] = src;
    } else {
      src.id = src.id || generateId('s');
      src.addedAt = src.addedAt || new Date().toISOString();
      sources.unshift(src);
    }
    return write(KEYS.sources, sources);
  }

  function deleteSource(id) {
    var sources = getSources().filter(function (s) { return s.id !== id; });
    return write(KEYS.sources, sources);
  }

  // ── First 100 Days ─────────────────────────────────────────────────────

  function get100Days() {
    return read(KEYS.days100) || null;
  }

  function save100Days(text) {
    return write(KEYS.days100, { content: text, savedAt: new Date().toISOString() });
  }

  // ── API Key ────────────────────────────────────────────────────────────

  function getApiKey() {
    return localStorage.getItem(KEYS.apiKey) || '';
  }

  function saveApiKey(key) {
    localStorage.setItem(KEYS.apiKey, key);
  }

  function clearApiKey() {
    localStorage.removeItem(KEYS.apiKey);
  }

  // ── Platform (seed data) ───────────────────────────────────────────────

  function getPlatform() {
    return read(KEYS.platform) || { pillars: [] };
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  function generateId(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function resync() {
    localStorage.removeItem(KEYS.seeded);
    localStorage.removeItem(KEYS.resources);
    localStorage.removeItem(KEYS.platform);
    localStorage.removeItem(KEYS.positions);
    localStorage.removeItem(KEYS.sources);
    localStorage.removeItem(KEYS.days100);
    return init();
  }

  function exportData() {
    return {
      positions: getPositions(),
      sources: getSources(),
      days100: get100Days(),
      exportedAt: new Date().toISOString()
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────

  return {
    init: init,
    resync: resync,
    PILLARS: PILLARS,
    // Resources (legacy)
    getResources: getResources,
    saveResource: saveResource,
    deleteResource: deleteResource,
    // Positions
    getPositions: getPositions,
    getPosition: getPosition,
    savePosition: savePosition,
    // Sources
    getSources: getSources,
    saveSource: saveSource,
    deleteSource: deleteSource,
    // First 100 Days
    get100Days: get100Days,
    save100Days: save100Days,
    // API key
    getApiKey: getApiKey,
    saveApiKey: saveApiKey,
    clearApiKey: clearApiKey,
    // Platform seed
    getPlatform: getPlatform,
    // Utilities
    generateId: generateId,
    exportData: exportData
  };
}());
