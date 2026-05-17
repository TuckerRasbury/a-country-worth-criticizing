// builder.js — powers the Policy Builder page (builder.html)

(function () {
  var SECTIONS = [
    { id: 'billTitle',             label: 'Bill Title',             placeholder: 'A short, descriptive name for this legislation' },
    { id: 'plainLanguageSummary',  label: 'Plain Language Summary', placeholder: 'What does this bill do, and who does it affect? (1–2 sentences)' },
    { id: 'congressionalFindings', label: 'Congressional Findings', placeholder: 'Why does this problem exist? Why does it demand a federal response? Use data and research here.' },
    { id: 'purposeAndScope',       label: 'Purpose and Scope',      placeholder: 'What is this bill trying to accomplish? What falls within or outside its reach?' },
    { id: 'definitions',           label: 'Definitions',            placeholder: 'Define key terms as used in this bill.' },
    { id: 'legislativeProvisions', label: 'Legislative Provisions', placeholder: 'SEC. 1. [SECTION TITLE]\n(a) IN GENERAL.—...\n\nSEC. 2. ...' },
    { id: 'implementation',        label: 'Implementation',         placeholder: 'Who enforces this? What agency or office? What timeline and milestones are required?' },
    { id: 'effectiveDate',         label: 'Effective Date',         placeholder: 'This Act shall take effect...' }
  ];

  var currentDraft = null;
  var autosaveTimer = null;
  var lastSavedAt = null;

  // ── Init ────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    store.init().then(function () {
      renderBillEditor();
      renderRefSidebar();
      renderRefPanel();
      loadDraftsList();
      bindDraftControls();
      bindExport();
      startAutosave();
    });
  });

  // ── Bill Editor ─────────────────────────────────────────────────────────

  function renderBillEditor() {
    var container = document.getElementById('bill-sections');
    if (!container) return;
    container.innerHTML = SECTIONS.map(function (s) {
      return '<div class="bill-section" data-section="' + s.id + '">' +
        '<div class="bill-section-label">' + escapeHtml(s.label) + '</div>' +
        '<textarea class="bill-textarea" id="section-' + s.id + '" name="' + s.id + '" ' +
          'placeholder="' + escapeAttr(s.placeholder) + '" ' +
          'aria-label="' + escapeAttr(s.label) + '" ' +
          'rows="4"></textarea>' +
        '</div>';
    }).join('');

    // Auto-resize textareas
    container.querySelectorAll('.bill-textarea').forEach(function (ta) {
      ta.addEventListener('input', function () {
        autoResize(ta);
        markDirty();
      });
      ta.addEventListener('blur', function () { saveCurrentDraft(); });
    });
  }

  function autoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function getSectionValues() {
    var values = {};
    SECTIONS.forEach(function (s) {
      var el = document.getElementById('section-' + s.id);
      values[s.id] = el ? el.value : '';
    });
    return values;
  }

  function setSectionValues(values) {
    SECTIONS.forEach(function (s) {
      var el = document.getElementById('section-' + s.id);
      if (el) {
        el.value = values && values[s.id] ? values[s.id] : '';
        autoResize(el);
      }
    });
  }

  // ── Draft Management ────────────────────────────────────────────────────

  function loadDraftsList() {
    var select = document.getElementById('draft-select');
    if (!select) return;
    var drafts = store.getDrafts();
    select.innerHTML = '<option value="new">+ New draft</option>' +
      drafts.map(function (d) {
        return '<option value="' + escapeAttr(d.id) + '">' + escapeHtml(d.title || 'Untitled Draft') + '</option>';
      }).join('');

    if (currentDraft) {
      select.value = currentDraft.id;
    }
  }

  function bindDraftControls() {
    var titleInput = document.getElementById('draft-title');
    var select = document.getElementById('draft-select');
    var saveBtn = document.getElementById('save-draft-btn');
    var deleteBtn = document.getElementById('delete-draft-btn');

    if (select) {
      select.addEventListener('change', function () {
        if (select.value === 'new') {
          newDraft();
        } else {
          loadDraft(select.value);
        }
      });
    }

    if (titleInput) {
      titleInput.addEventListener('input', markDirty);
      titleInput.addEventListener('blur', function () { saveCurrentDraft(); });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveCurrentDraft(true);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!currentDraft || !currentDraft.id) return;
        if (!confirm('Delete this draft permanently?')) return;
        store.deleteDraft(currentDraft.id);
        newDraft();
        loadDraftsList();
        showToast('Draft deleted.');
      });
    }
  }

  function newDraft() {
    currentDraft = {
      id: store.generateId('d'),
      title: '',
      sections: {},
      updated: new Date().toISOString()
    };
    var titleInput = document.getElementById('draft-title');
    if (titleInput) titleInput.value = '';
    setSectionValues({});
    updateAutosaveStatus('');
  }

  function loadDraft(id) {
    var drafts = store.getDrafts();
    var draft = drafts.find(function (d) { return d.id === id; });
    if (!draft) return;
    currentDraft = draft;
    var titleInput = document.getElementById('draft-title');
    if (titleInput) titleInput.value = draft.title || '';
    setSectionValues(draft.sections || {});
    updateAutosaveStatus('Saved ' + formatDate(draft.updated));
  }

  function saveCurrentDraft(explicit) {
    if (!currentDraft) {
      currentDraft = { id: store.generateId('d'), title: '', sections: {}, updated: null };
    }
    var titleInput = document.getElementById('draft-title');
    currentDraft.title = titleInput ? (titleInput.value.trim() || 'Untitled Draft') : 'Untitled Draft';
    currentDraft.sections = getSectionValues();

    var hasContent = Object.values(currentDraft.sections).some(function (v) { return v.trim(); });
    if (!hasContent && !currentDraft.title.trim()) return;

    var ok = store.saveDraft(currentDraft);
    if (ok) {
      lastSavedAt = new Date();
      updateAutosaveStatus('Saved ' + formatTime(lastSavedAt));
      loadDraftsList();
      if (explicit) showToast('Draft saved.');
    }
  }

  function markDirty() {
    updateAutosaveStatus('Unsaved changes');
  }

  function startAutosave() {
    setInterval(function () {
      if (currentDraft) saveCurrentDraft(false);
    }, 30000);

    // Start with a blank draft
    newDraft();
  }

  function updateAutosaveStatus(msg) {
    var el = document.getElementById('autosave-status');
    if (el) el.textContent = msg;
  }

  // ── Reference Sidebar (left) ────────────────────────────────────────────

  function renderRefSidebar() {
    var container = document.getElementById('ref-list');
    var searchInput = document.getElementById('ref-search');
    if (!container) return;

    function render(query) {
      var resources = store.getResources();
      if (query) {
        var q = query.toLowerCase();
        resources = resources.filter(function (r) {
          return (r.name || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q);
        });
      }
      container.innerHTML = resources.map(function (r) {
        var badge = r.type === 'link' ? '↗' : r.type === 'pdf' ? 'PDF' : '¶';
        return '<li class="ref-item' + (r.pinned ? ' is-pinned' : '') + '" data-id="' + escapeAttr(r.id) + '" role="button" tabindex="0" aria-pressed="' + (r.pinned ? 'true' : 'false') + '">' +
          '<span class="ref-item-badge">' + badge + '</span>' +
          '<span class="ref-item-name">' + escapeHtml(r.name || 'Untitled') + '</span>' +
          '</li>';
      }).join('') || '<li style="padding: var(--space-4) var(--space-5); font-size: var(--text-sm); color: var(--color-muted);">No resources in archive.</li>';

      container.querySelectorAll('.ref-item').forEach(function (item) {
        item.addEventListener('click', function () { togglePin(item.dataset.id); });
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePin(item.dataset.id); }
        });
      });
    }

    render('');

    if (searchInput) {
      var timer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { render(searchInput.value); }, 200);
      });
    }
  }

  function togglePin(id) {
    var resources = store.getResources();
    var r = resources.find(function (x) { return x.id === id; });
    if (!r) return;
    r.pinned = !r.pinned;
    store.saveResource(r);
    renderRefSidebar();
    renderRefPanel();
  }

  // ── Reference Panel (right) ─────────────────────────────────────────────

  function renderRefPanel() {
    var container = document.getElementById('ref-panel-content');
    if (!container) return;

    var pinned = store.getResources().filter(function (r) { return r.pinned; });

    if (pinned.length === 0) {
      container.innerHTML = '<p class="ref-panel-empty">Pin resources from the left sidebar to read them here while you draft.</p>';
      return;
    }

    container.innerHTML = pinned.map(function (r) {
      var badge = r.type === 'link' ? '↗' : r.type === 'pdf' ? 'PDF' : '¶';
      return '<div class="pinned-card" data-id="' + escapeAttr(r.id) + '" data-type="' + escapeAttr(r.type) + '" data-url="' + escapeAttr(r.url || '') + '">' +
        '<div class="pinned-card-header">' +
          '<span class="pinned-card-name">' + escapeHtml(r.name || 'Untitled') + '</span>' +
          '<span class="pinned-card-badge">' + badge + '</span>' +
        '</div>' +
        '<p class="pinned-card-notes">' + escapeHtml(r.notes || '') + '</p>' +
        '<button class="unpin-btn" data-id="' + escapeAttr(r.id) + '">Unpin</button>' +
        '</div>';
    }).join('');

    container.querySelectorAll('.pinned-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.classList.contains('unpin-btn')) {
          e.stopPropagation();
          togglePin(e.target.dataset.id);
          return;
        }
        if (card.dataset.type === 'link' && card.dataset.url) {
          window.open(card.dataset.url, '_blank', 'noopener');
        }
      });
    });
  }

  // ── Export ──────────────────────────────────────────────────────────────

  function bindExport() {
    var btn = document.getElementById('export-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      exportDraft('md');
    });

    var txtBtn = document.getElementById('export-txt-btn');
    if (txtBtn) {
      txtBtn.addEventListener('click', function () { exportDraft('txt'); });
    }
  }

  function exportDraft(format) {
    var titleInput = document.getElementById('draft-title');
    var title = (titleInput && titleInput.value.trim()) || 'Untitled Draft';
    var sections = getSectionValues();
    var content;

    if (format === 'md') {
      content = SECTIONS.map(function (s) {
        var val = sections[s.id] || '';
        if (!val.trim()) return '';
        return '## ' + s.label + '\n\n' + val;
      }).filter(Boolean).join('\n\n---\n\n');
      content = '# ' + title + '\n\n' + content;
    } else {
      content = title.toUpperCase() + '\n' + '='.repeat(title.length) + '\n\n' +
        SECTIONS.map(function (s) {
          var val = sections[s.id] || '';
          if (!val.trim()) return '';
          return s.label.toUpperCase() + '\n' + '-'.repeat(s.label.length) + '\n' + val;
        }).filter(Boolean).join('\n\n');
    }

    var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    var filename = (slug || 'draft') + '.' + format;
    var blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('Draft exported as ' + filename);
  }

  // ── Utilities ───────────────────────────────────────────────────────────

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function formatTime(date) {
    try {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}());
