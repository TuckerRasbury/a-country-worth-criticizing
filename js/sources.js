// sources.js — powers the Sources page (sources.html)

(function () {
  var state = {
    activeTab: 'url',
    pending: null   // { name, type, url, rawText, claims: [{id, text, pillar, stance}] }
  };

  // ── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    store.init().then(function () {
      checkApiKey();
      bindApiKeyForm();
      bindTabs();
      bindAnalyze();
      bindClaimsActions();
      renderSourceHistory();
      renderPositionsPreview();
    });
  });

  // ── API Key ───────────────────────────────────────────────────────────────

  function checkApiKey() {
    var banner = document.getElementById('api-key-banner');
    if (!banner) return;
    banner.style.display = store.getApiKey() ? 'none' : '';
  }

  function bindApiKeyForm() {
    var form = document.getElementById('api-key-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('api-key-input');
      var key = input ? input.value.trim() : '';
      if (!key) return;
      store.saveApiKey(key);
      var banner = document.getElementById('api-key-banner');
      if (banner) banner.style.display = 'none';
      showToast('API key saved.');
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  function bindTabs() {
    document.querySelectorAll('.intake-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.dataset.tab;
        if (!tab) return;
        state.activeTab = tab;
        document.querySelectorAll('.intake-tab').forEach(function (b) {
          b.classList.toggle('active', b.dataset.tab === tab);
          b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
        });
        var urlPanel = document.getElementById('tab-url');
        var textPanel = document.getElementById('tab-text');
        if (urlPanel) urlPanel.style.display = tab === 'url' ? '' : 'none';
        if (textPanel) textPanel.style.display = tab === 'text' ? '' : 'none';
      });
    });
  }

  // ── Analyze ───────────────────────────────────────────────────────────────

  function bindAnalyze() {
    var btn = document.getElementById('analyze-btn');
    if (btn) btn.addEventListener('click', analyzeSource);

    var urlInput = document.getElementById('source-url');
    if (urlInput) {
      urlInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') analyzeSource();
      });
    }
  }

  function analyzeSource() {
    if (!store.getApiKey()) {
      var banner = document.getElementById('api-key-banner');
      if (banner) banner.style.display = '';
      showToast('Add your Anthropic API key first.', true);
      return;
    }

    var sourceName = (document.getElementById('source-name').value || '').trim();

    if (state.activeTab === 'url') {
      var url = (document.getElementById('source-url').value || '').trim();
      if (!url) { showToast('Please enter a URL.', true); return; }
      setExtractionStatus(true, 'Fetching page…');
      disableAnalyzeBtn(true);
      ai.fetchUrl(url)
        .then(function (text) {
          setExtractionStatus(true, 'Extracting claims…');
          return ai.extractClaims(text).then(function (claims) {
            finishExtraction({ name: sourceName || url, type: 'link', url: url, rawText: text.slice(0, 5000) }, claims);
          });
        })
        .catch(function (err) {
          setExtractionStatus(false);
          disableAnalyzeBtn(false);
          if (err && err.needsPaste) {
            showToast('Can\'t fetch that URL — paste the text in the "Paste Text" tab.', true);
            var textTabBtn = document.querySelector('[data-tab="text"]');
            if (textTabBtn) textTabBtn.click();
          } else {
            showToast('Error: ' + (err.message || 'Something went wrong.'), true);
          }
        });

    } else {
      var text = (document.getElementById('source-text').value || '').trim();
      if (!text) { showToast('Please paste some text.', true); return; }
      setExtractionStatus(true, 'Extracting claims…');
      disableAnalyzeBtn(true);
      ai.extractClaims(text)
        .then(function (claims) {
          finishExtraction({
            name: sourceName || ('Pasted text — ' + new Date().toLocaleDateString()),
            type: 'text',
            rawText: text.slice(0, 5000)
          }, claims);
        })
        .catch(function (err) {
          setExtractionStatus(false);
          disableAnalyzeBtn(false);
          showToast('Error: ' + (err.message || 'Something went wrong.'), true);
        });
    }
  }

  function setExtractionStatus(visible, message) {
    var el = document.getElementById('extraction-status');
    var msg = document.getElementById('extraction-message');
    if (!el) return;
    el.style.display = visible ? '' : 'none';
    if (msg && message) msg.textContent = message;
  }

  function disableAnalyzeBtn(disabled) {
    var btn = document.getElementById('analyze-btn');
    if (btn) btn.disabled = disabled;
  }

  function finishExtraction(sourceInfo, rawClaims) {
    setExtractionStatus(false);
    disableAnalyzeBtn(false);

    var claims = rawClaims.map(function (c) {
      return { id: store.generateId('c'), text: c.text, pillar: c.pillar, stance: 'pending' };
    });

    state.pending = { name: sourceInfo.name, type: sourceInfo.type, url: sourceInfo.url || '', rawText: sourceInfo.rawText || '', claims: claims };

    renderClaimCards(state.pending);

    var claimsSection = document.getElementById('claims-section');
    if (claimsSection) claimsSection.style.display = '';

    var label = document.getElementById('claims-source-label');
    if (label) label.textContent = 'From: ' + sourceInfo.name;
  }

  // ── Claim Cards ───────────────────────────────────────────────────────────

  function renderClaimCards(source) {
    var container = document.getElementById('claims-list');
    if (!container) return;

    if (!source.claims || source.claims.length === 0) {
      container.innerHTML = '<p style="font-family:var(--font-sans);color:var(--color-muted);font-size:var(--text-sm);">No substantive claims were extracted from this source.</p>';
      return;
    }

    container.innerHTML = source.claims.map(renderClaimCard).join('');
  }

  function renderClaimCard(claim) {
    var pillarOptions = store.PILLARS.map(function (p) {
      return '<option value="' + escapeAttr(p.id) + '"' + (p.id === claim.pillar ? ' selected' : '') + '>' +
        escapeHtml(p.label) + '</option>';
    }).join('');

    var stanceClass = claim.stance === 'agree' ? ' stance-agree'
      : claim.stance === 'disagree' ? ' stance-disagree'
      : claim.stance === 'skipped' ? ' stance-skipped' : '';

    var stanceLabel = claim.stance === 'agree' ? 'Agree'
      : claim.stance === 'disagree' ? 'Disagree'
      : claim.stance === 'skipped' ? 'Skipped' : '';

    return '<div class="claim-card' + stanceClass + '" data-claim-id="' + escapeAttr(claim.id) + '">' +
      '<p class="claim-text">' + escapeHtml(claim.text) + '</p>' +
      '<div class="claim-meta">' +
        '<select class="claim-pillar-select" data-claim-id="' + escapeAttr(claim.id) + '" aria-label="Policy pillar">' +
          pillarOptions +
        '</select>' +
        (stanceLabel ? '<span class="claim-stance-label">' + stanceLabel + '</span>' : '') +
      '</div>' +
      '<div class="claim-actions">' +
        '<button class="stance-btn' + (claim.stance === 'agree' ? ' active-agree' : '') + '" ' +
          'data-action="agree" data-claim-id="' + escapeAttr(claim.id) + '" type="button">Agree</button>' +
        '<button class="stance-btn' + (claim.stance === 'disagree' ? ' active-disagree' : '') + '" ' +
          'data-action="disagree" data-claim-id="' + escapeAttr(claim.id) + '" type="button">Disagree</button>' +
        '<button class="stance-btn' + (claim.stance === 'skipped' ? ' active-skip' : '') + '" ' +
          'data-action="skip" data-claim-id="' + escapeAttr(claim.id) + '" type="button">Skip</button>' +
      '</div>' +
    '</div>';
  }

  function bindClaimsActions() {
    document.addEventListener('click', function (e) {
      var action = e.target.dataset.action;
      var claimId = e.target.dataset.claimId;
      if (!action || !claimId || !state.pending) return;

      var claim = state.pending.claims.find(function (c) { return c.id === claimId; });
      if (!claim) return;

      if (action === 'agree') claim.stance = 'agree';
      else if (action === 'disagree') claim.stance = 'disagree';
      else if (action === 'skip') claim.stance = 'skipped';
      else return;

      var card = document.querySelector('[data-claim-id="' + claimId + '"].claim-card');
      if (card) {
        var tmp = document.createElement('div');
        tmp.innerHTML = renderClaimCard(claim);
        card.replaceWith(tmp.firstElementChild);
      }
    });

    document.addEventListener('change', function (e) {
      if (!e.target.classList.contains('claim-pillar-select')) return;
      var claimId = e.target.dataset.claimId;
      if (!claimId || !state.pending) return;
      var claim = state.pending.claims.find(function (c) { return c.id === claimId; });
      if (claim) claim.pillar = e.target.value;
    });

    var saveBtn = document.getElementById('save-source-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveSource);

    var discardBtn = document.getElementById('discard-source-btn');
    if (discardBtn) discardBtn.addEventListener('click', discardSource);
  }

  // ── Save / Discard ────────────────────────────────────────────────────────

  function saveSource() {
    if (!state.pending) return;

    var source = {
      id: store.generateId('s'),
      name: state.pending.name,
      type: state.pending.type,
      url: state.pending.url || '',
      rawText: state.pending.rawText || '',
      addedAt: new Date().toISOString(),
      claims: state.pending.claims.map(function (c) {
        return { id: c.id, text: c.text, pillar: c.pillar, stance: c.stance };
      })
    };

    store.saveSource(source);

    // Update positions with evidence from acted-on claims
    state.pending.claims.forEach(function (claim) {
      if (claim.stance === 'pending' || claim.stance === 'skipped') return;

      var pos = store.getPosition(claim.pillar) || {
        id: 'pos-' + claim.pillar,
        pillar: claim.pillar,
        statement: '',
        evidence: [],
        counters: [],
        updatedAt: new Date().toISOString()
      };

      pos.evidence = pos.evidence || [];
      pos.counters = pos.counters || [];

      var evidenceItem = { sourceId: source.id, claim: claim.text, stance: claim.stance };
      if (claim.stance === 'agree') {
        pos.evidence.push(evidenceItem);
      } else if (claim.stance === 'disagree') {
        pos.counters.push(evidenceItem);
      }

      store.savePosition(pos);
    });

    // Reset intake
    state.pending = null;
    var claimsSection = document.getElementById('claims-section');
    var claimsList = document.getElementById('claims-list');
    var sourceUrl = document.getElementById('source-url');
    var sourceText = document.getElementById('source-text');
    var sourceName = document.getElementById('source-name');
    if (claimsSection) claimsSection.style.display = 'none';
    if (claimsList) claimsList.innerHTML = '';
    if (sourceUrl) sourceUrl.value = '';
    if (sourceText) sourceText.value = '';
    if (sourceName) sourceName.value = '';

    renderSourceHistory();
    renderPositionsPreview();
    showToast('Source saved. Positions updated.');
  }

  function discardSource() {
    state.pending = null;
    var claimsSection = document.getElementById('claims-section');
    var claimsList = document.getElementById('claims-list');
    if (claimsSection) claimsSection.style.display = 'none';
    if (claimsList) claimsList.innerHTML = '';
  }

  // ── Source History ────────────────────────────────────────────────────────

  function renderSourceHistory() {
    var sources = store.getSources();
    var historyEl = document.getElementById('source-history');
    var listEl = document.getElementById('source-list');
    if (!historyEl || !listEl) return;

    historyEl.style.display = sources.length > 0 ? '' : 'none';

    listEl.innerHTML = sources.map(function (src) {
      var agreeCount = (src.claims || []).filter(function (c) { return c.stance === 'agree'; }).length;
      var disagreeCount = (src.claims || []).filter(function (c) { return c.stance === 'disagree'; }).length;
      var total = (src.claims || []).length;
      var date = src.addedAt ? new Date(src.addedAt).toLocaleDateString() : '';

      return '<div class="source-item">' +
        '<div class="source-item-info">' +
          '<div class="source-item-name">' + escapeHtml(src.name || 'Untitled') + '</div>' +
          '<div class="source-item-meta">' +
            '<span>' + date + '</span>' +
            '<span>' + total + ' claim' + (total !== 1 ? 's' : '') + '</span>' +
            (agreeCount ? '<span style="color:var(--color-accent);">↑ ' + agreeCount + ' agreed</span>' : '') +
            (disagreeCount ? '<span style="color:var(--color-muted);">↓ ' + disagreeCount + ' challenged</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="source-item-actions">' +
          '<button class="btn btn-sm btn-ghost" data-action="delete-source" data-source-id="' + escapeAttr(src.id) + '" type="button">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('[data-action="delete-source"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Remove this source? Claims already added to your positions will remain.')) return;
        store.deleteSource(btn.dataset.sourceId);
        renderSourceHistory();
        showToast('Source removed.');
      });
    });
  }

  // ── Positions Preview ─────────────────────────────────────────────────────

  function renderPositionsPreview() {
    var container = document.getElementById('positions-preview');
    if (!container) return;

    var positions = store.getPositions().filter(function (p) {
      return p.statement || (p.evidence && p.evidence.length > 0);
    });

    if (positions.length === 0) {
      container.innerHTML = '<p style="font-family:var(--font-sans);font-size:var(--text-sm);color:var(--color-muted);line-height:1.5;">Agree with extracted claims to start building your positions.</p>';
      return;
    }

    container.innerHTML = positions.map(function (pos) {
      var pillar = store.PILLARS.find(function (p) { return p.id === pos.pillar; });
      var label = pillar ? pillar.label : pos.pillar;
      var evidenceCount = (pos.evidence || []).length;

      return '<div class="position-preview-item">' +
        '<div class="position-preview-pillar">' + escapeHtml(label) + '</div>' +
        (pos.statement ? '<div class="position-preview-statement">' + escapeHtml(pos.statement) + '</div>' : '') +
        (evidenceCount > 0
          ? '<div class="position-preview-count">' + evidenceCount + ' evidence claim' + (evidenceCount !== 1 ? 's' : '') + '</div>'
          : '') +
      '</div>';
    }).join('');
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}());
