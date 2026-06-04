// platform.js — powers the Platform page (index.html)

(function () {

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    store.init().then(function () {
      renderPlatformSections();
      renderPillarNav();
      bindScrollSpy();
    });
  });

  // ── Platform Sections ─────────────────────────────────────────────────────

  function renderPlatformSections() {
    var container = document.getElementById('platform-sections');
    if (!container) return;

    var positions = store.getPositions();
    var sources = store.getSources();

    container.innerHTML = store.PILLARS.map(function (pillar) {
      var pos = positions.find(function (p) { return p.pillar === pillar.id; });
      return renderPillarSection(pillar, pos || null, sources);
    }).join('');

    bindPositionEditors();
  }

  function renderPillarSection(pillar, pos, sources) {
    var statement = pos && pos.statement ? pos.statement : '';
    var evidence  = pos && pos.evidence  ? pos.evidence  : [];
    var counters  = pos && pos.counters  ? pos.counters  : [];

    var statementHtml = statement
      ? '<blockquote class="belief-statement" id="stmt-' + escapeAttr(pillar.id) + '">' + escapeHtml(statement) + '</blockquote>'
      : '<p class="belief-forthcoming" id="stmt-' + escapeAttr(pillar.id) + '">Position not yet defined.</p>';

    var editorHtml =
      '<div class="position-editor" id="editor-' + escapeAttr(pillar.id) + '" style="display:none;">' +
        '<textarea class="position-editor-textarea" rows="4" ' +
          'placeholder="State your position on ' + escapeAttr(pillar.label) + '…">' +
          escapeHtml(statement) +
        '</textarea>' +
        '<div class="position-editor-actions">' +
          '<button class="btn btn-primary btn-sm" type="button" ' +
            'data-action="save-position" data-pillar="' + escapeAttr(pillar.id) + '">Save</button>' +
          '<button class="btn btn-secondary btn-sm" type="button" ' +
            'data-action="cancel-editor" data-pillar="' + escapeAttr(pillar.id) + '" ' +
            'style="margin-left:var(--space-2);">Cancel</button>' +
        '</div>' +
      '</div>';

    var evidenceHtml = '';
    if (evidence.length > 0) {
      evidenceHtml = '<div class="evidence-block">' +
        '<p class="evidence-heading">Evidence</p>' +
        evidence.map(function (e) {
          var src = sources.find(function (s) { return s.id === e.sourceId; });
          return '<div class="evidence-item">' +
            '<p class="evidence-claim">' + escapeHtml(e.claim) + '</p>' +
            '<p class="evidence-source">— ' + escapeHtml(src ? src.name : 'Unknown source') + '</p>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    var countersHtml = '';
    if (counters.length > 0) {
      countersHtml =
        '<details class="counters-block">' +
          '<summary class="counters-summary">Challenges considered (' + counters.length + ')</summary>' +
          '<div class="counters-list">' +
          counters.map(function (c) {
            var src = sources.find(function (s) { return s.id === c.sourceId; });
            return '<div class="counter-item">' +
              '<p class="counter-claim">' + escapeHtml(c.claim) + '</p>' +
              '<p class="counter-source">— ' + escapeHtml(src ? src.name : 'Unknown source') + '</p>' +
            '</div>';
          }).join('') +
          '</div>' +
        '</details>';
    }

    return '<section class="pillar-section" id="' + escapeAttr(pillar.id) + '">' +
      '<header class="pillar-section-header">' +
        '<div>' +
          '<p class="pillar-label">Policy Pillar</p>' +
          '<h2 class="pillar-name">' + escapeHtml(pillar.label) + '</h2>' +
        '</div>' +
        '<button class="btn btn-sm btn-ghost edit-position-btn" type="button" ' +
          'data-pillar="' + escapeAttr(pillar.id) + '" ' +
          'aria-label="Edit position for ' + escapeAttr(pillar.label) + '">Edit</button>' +
      '</header>' +
      '<div class="belief-block">' + statementHtml + editorHtml + '</div>' +
      evidenceHtml +
      countersHtml +
    '</section>';
  }

  // ── Position Editors ──────────────────────────────────────────────────────

  function bindPositionEditors() {
    document.querySelectorAll('.edit-position-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleEditor(btn.dataset.pillar, true);
      });
    });

    document.addEventListener('click', function (e) {
      var action = e.target.dataset.action;
      var pillarId = e.target.dataset.pillar;
      if (!action || !pillarId) return;

      if (action === 'save-position') {
        var editor = document.getElementById('editor-' + pillarId);
        if (!editor) return;
        var textarea = editor.querySelector('textarea');
        var newStatement = (textarea ? textarea.value : '').trim();

        var pos = store.getPosition(pillarId) || {
          id: 'pos-' + pillarId, pillar: pillarId, evidence: [], counters: []
        };
        pos.statement = newStatement;
        store.savePosition(pos);

        var stmtEl = document.getElementById('stmt-' + pillarId);
        if (stmtEl) {
          var replacement = document.createElement(newStatement ? 'blockquote' : 'p');
          replacement.className = newStatement ? 'belief-statement' : 'belief-forthcoming';
          replacement.id = 'stmt-' + pillarId;
          replacement.textContent = newStatement || 'Position not yet defined.';
          stmtEl.replaceWith(replacement);
        }
        toggleEditor(pillarId, false);
        showToast('Position saved.');
      }

      if (action === 'cancel-editor') {
        toggleEditor(pillarId, false);
      }
    });
  }

  function toggleEditor(pillarId, show) {
    var editor = document.getElementById('editor-' + pillarId);
    var stmtEl = document.getElementById('stmt-' + pillarId);
    if (editor) editor.style.display = show ? '' : 'none';
    if (stmtEl) stmtEl.style.display = show ? 'none' : '';
    if (show && editor) {
      var ta = editor.querySelector('textarea');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
  }

  // ── Pillar Nav ────────────────────────────────────────────────────────────

  function renderPillarNav() {
    var nav = document.getElementById('pillar-nav-list');
    if (!nav) return;
    nav.innerHTML = store.PILLARS.map(function (p) {
      return '<li><a href="#' + escapeAttr(p.id) + '">' + escapeHtml(p.label) + '</a></li>';
    }).join('');
    bindScrollSpy();
  }

  // ── Scroll Spy ────────────────────────────────────────────────────────────

  function bindScrollSpy() {
    var nav = document.getElementById('pillar-nav-list');
    if (!nav || !window.IntersectionObserver) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          nav.querySelectorAll('a').forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-52px 0px -60% 0px', threshold: 0 });

    document.querySelectorAll('.pillar-section').forEach(function (s) {
      observer.observe(s);
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}());
