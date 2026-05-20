// store.js — the only code that reads/writes localStorage
// All other JS files call store.init() first, then use the public API below.

var store = (function () {
  var KEYS = {
    resources: 'ledger_resources',
    platform:  'ledger_platform',
    drafts:    'ledger_drafts',
    seeded:    'ledger_seeded'
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
        localStorage.setItem(KEYS.drafts, JSON.stringify([]));
        localStorage.setItem(KEYS.seeded, '1');
      } catch (e) {
        showStorageError();
      }
    }).catch(function () {
      // Seed fetch failed (e.g. file:// protocol). Start with empty data.
      if (!localStorage.getItem(KEYS.resources)) {
        localStorage.setItem(KEYS.resources, JSON.stringify([]));
      }
      if (!localStorage.getItem(KEYS.platform)) {
        localStorage.setItem(KEYS.platform, JSON.stringify({ pillars: [] }));
      }
      if (!localStorage.getItem(KEYS.drafts)) {
        localStorage.setItem(KEYS.drafts, JSON.stringify([]));
      }
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
    // Toast is defined in nav.js; fall back to console if not available
    if (typeof window.showToast === 'function') {
      window.showToast(message, true);
    } else {
      console.error('[Ledger]', message);
    }
  }

  // ── Resources ──────────────────────────────────────────────────────────

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

  // ── Drafts ─────────────────────────────────────────────────────────────

  function getDrafts() {
    return read(KEYS.drafts) || [];
  }

  function saveDraft(draft) {
    var drafts = getDrafts();
    var idx = drafts.findIndex(function (d) { return d.id === draft.id; });
    draft.updated = new Date().toISOString();
    if (idx >= 0) {
      drafts[idx] = draft;
    } else {
      drafts.unshift(draft);
    }
    return write(KEYS.drafts, drafts);
  }

  function deleteDraft(id) {
    var drafts = getDrafts().filter(function (d) { return d.id !== id; });
    return write(KEYS.drafts, drafts);
  }

  // ── Platform ───────────────────────────────────────────────────────────

  function getPlatform() {
    return read(KEYS.platform) || { pillars: [] };
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  function generateId(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function exportData() {
    return {
      resources: getResources(),
      drafts: getDrafts(),
      exportedAt: new Date().toISOString()
    };
  }

  function resync() {
    // Clears seed flag and resource/platform data so init() re-fetches.
    // Drafts are intentionally preserved.
    localStorage.removeItem(KEYS.seeded);
    localStorage.removeItem(KEYS.resources);
    localStorage.removeItem(KEYS.platform);
    return init();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  return {
    init: init,
    resync: resync,
    PILLARS: PILLARS,
    getResources: getResources,
    saveResource: saveResource,
    deleteResource: deleteResource,
    getDrafts: getDrafts,
    saveDraft: saveDraft,
    deleteDraft: deleteDraft,
    getPlatform: getPlatform,
    generateId: generateId,
    exportData: exportData
  };
}());
