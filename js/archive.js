// archive.js — powers the Archive page (index.html)

(function () {
  var state = {
    activePillar: null,   // null = All Resources
    searchQuery: '',
    typeFilter: 'all',
    dateFilter: 'all'
  };

  var searchTimer = null;

  // ── Type display helpers ────────────────────────────────────────────────

  var TYPE_BADGE = { link: '↗', pdf: 'PDF', text: '¶' };
  var TYPE_LABEL = { link: 'Link', pdf: 'PDF', text: 'Text' };

  // ── Init ────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    store.init().then(function () {
      renderPillarSidebar();
      renderCards();
      bindSearch();
      bindFilters();
      bindAddResource();
      bindViewerModal();
      bindResync();
    });
  });

  // ── Sidebar ─────────────────────────────────────────────────────────────

  function renderPillarSidebar() {
    var list = document.getElementById('pillar-list');
    if (!list) return;

    var allBtn = list.querySelector('[data-pillar="all"]');
    if (allBtn) {
      allBtn.addEventListener('click', function () {
        state.activePillar = null;
        updateActiveButton(allBtn);
        renderCards();
      });
    }

    store.PILLARS.forEach(function (pillar) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = pillar.label;
      btn.dataset.pillar = pillar.id;
      btn.addEventListener('click', function () {
        state.activePillar = pillar.id;
        updateActiveButton(btn);
        renderCards();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    // Set initial active
    if (allBtn) allBtn.classList.add('active');
  }

  function updateActiveButton(activeBtn) {
    var list = document.getElementById('pillar-list');
    if (!list) return;
    list.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b === activeBtn);
    });
    updateArchiveTitle();
  }

  function updateArchiveTitle() {
    var el = document.getElementById('archive-title');
    if (!el) return;
    if (!state.activePillar) {
      el.innerHTML = 'The Archive';
      return;
    }
    var pillar = store.PILLARS.find(function (p) { return p.id === state.activePillar; });
    el.innerHTML = pillar
      ? 'Archive — <span class="active-pillar-name">' + escapeHtml(pillar.label) + '</span>'
      : 'The Archive';
  }

  // ── Filtering ───────────────────────────────────────────────────────────

  function getFilteredResources() {
    var resources = store.getResources();
    var q = state.searchQuery.toLowerCase().trim();

    return resources.filter(function (r) {
      // Pillar filter
      if (state.activePillar && (!r.pillars || !r.pillars.includes(state.activePillar))) {
        return false;
      }
      // Type filter
      if (state.typeFilter !== 'all' && r.type !== state.typeFilter) {
        return false;
      }
      // Date filter
      if (state.dateFilter !== 'all') {
        var d = new Date(r.date);
        var now = new Date();
        if (state.dateFilter === 'thisyear' && d.getFullYear() !== now.getFullYear()) return false;
        if (state.dateFilter === 'thismonth') {
          if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
        }
      }
      // Search
      if (q) {
        var nameMatch = (r.name || '').toLowerCase().includes(q);
        var notesMatch = (r.notes || '').toLowerCase().includes(q);
        var contentMatch = (r.content || '').toLowerCase().includes(q);
        if (!nameMatch && !notesMatch && !contentMatch) return false;
      }
      return true;
    });
  }

  // ── Render Cards ────────────────────────────────────────────────────────

  function renderCards() {
    var grid = document.getElementById('card-grid');
    var countEl = document.getElementById('resource-count');
    if (!grid) return;

    var filtered = getFilteredResources();
    if (countEl) {
      countEl.textContent = filtered.length + ' resource' + (filtered.length !== 1 ? 's' : '');
    }

    if (filtered.length === 0) {
      grid.innerHTML = renderEmptyState();
      return;
    }

    grid.innerHTML = filtered.map(renderCard).join('');
    bindCardInteractions(grid);
  }

  function renderEmptyState() {
    var hasData = store.getResources().length > 0;
    if (hasData) {
      return '<div class="empty-state">' +
        '<div class="empty-icon">⌕</div>' +
        '<p class="empty-title">No resources match your filters</p>' +
        '<p class="empty-desc">Try clearing the search or selecting a different pillar.</p>' +
        '</div>';
    }
    return '<div class="empty-state">' +
      '<div class="empty-icon">📚</div>' +
      '<p class="empty-title">Your archive is empty</p>' +
      '<p class="empty-desc">Add your first resource using the button above. Links, PDFs, and text excerpts all live here.</p>' +
      '</div>';
  }

  function renderCard(r) {
    var badge = TYPE_BADGE[r.type] || r.type;
    var pillarsHtml = (r.pillars || []).map(function (pid) {
      var p = store.PILLARS.find(function (x) { return x.id === pid; });
      return '<span class="tag">' + escapeHtml(p ? p.label : pid) + '</span>';
    }).join('');

    var bodyHtml = '';
    if (r.type === 'text' && r.content) {
      bodyHtml = '<div class="card-body"><pre>' + escapeHtml(r.content) + '</pre></div>';
    } else if (r.type === 'pdf') {
      bodyHtml = '<div class="card-body card-pdf-container">' +
        '<iframe src="' + (r.dataUrl || r.url || '') + '" title="' + escapeHtml(r.name) + '"></iframe>' +
        '</div>';
    }

    var actionsHtml = '<div class="card-actions">' +
      (r.type === 'link'
        ? '<a class="btn btn-sm btn-secondary" href="' + escapeAttr(r.url) + '" target="_blank" rel="noopener">Open link ↗</a>'
        : '') +
      '<button class="btn btn-sm btn-ghost" data-action="delete" data-id="' + escapeAttr(r.id) + '">Remove</button>' +
      '</div>';

    return '<article class="resource-card" data-id="' + escapeAttr(r.id) + '" data-type="' + escapeAttr(r.type) + '" data-url="' + escapeAttr(r.url || '') + '">' +
      '<span class="card-type-badge" aria-label="' + escapeAttr(TYPE_LABEL[r.type] || r.type) + '">' + escapeHtml(badge) + '</span>' +
      '<h3 class="card-title">' + escapeHtml(r.name || 'Untitled') + '</h3>' +
      '<p class="card-meta">' + escapeHtml(r.date || '') + '</p>' +
      '<p class="card-notes">' + escapeHtml(r.notes || '') + '</p>' +
      '<div class="card-tags">' + pillarsHtml + '</div>' +
      bodyHtml +
      actionsHtml +
      '</article>';
  }

  function bindCardInteractions(grid) {
    grid.querySelectorAll('.resource-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        // Delete button
        if (e.target.dataset.action === 'delete') {
          e.stopPropagation();
          if (confirm('Remove this resource from the archive?')) {
            store.deleteResource(e.target.dataset.id);
            renderCards();
            showToast('Resource removed.');
          }
          return;
        }
        // Link: navigate in new tab
        if (card.dataset.type === 'link') {
          var url = card.dataset.url;
          if (url) window.open(url, '_blank', 'noopener');
          return;
        }
        // PDF: open viewer modal
        if (card.dataset.type === 'pdf') {
          openViewerModal(card.dataset.id);
          return;
        }
        // Text: toggle expand
        if (card.dataset.type === 'text') {
          card.classList.toggle('is-expanded');
        }
      });
    });
  }

  // ── Search + Filters ────────────────────────────────────────────────────

  function bindSearch() {
    var input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.searchQuery = input.value;
        renderCards();
      }, 220);
    });
  }

  function bindFilters() {
    var typeSelect = document.getElementById('filter-type');
    var dateSelect = document.getElementById('filter-date');
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        state.typeFilter = typeSelect.value;
        renderCards();
      });
    }
    if (dateSelect) {
      dateSelect.addEventListener('change', function () {
        state.dateFilter = dateSelect.value;
        renderCards();
      });
    }
  }

  // ── Add Resource Modal ──────────────────────────────────────────────────

  var modalState = { step: 1, type: null };

  function bindAddResource() {
    var openBtn = document.getElementById('add-resource-btn');
    var modal = document.getElementById('add-resource-modal');
    var closeBtn = document.getElementById('modal-close');
    var form = document.getElementById('add-resource-form');

    if (!openBtn || !modal) return;

    openBtn.addEventListener('click', function () {
      resetModal();
      modal.showModal();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () { modal.close(); });
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.close();
    });

    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') modal.close();
    });

    // Type cards
    modal.querySelectorAll('.type-card').forEach(function (card) {
      function selectCard() {
        modal.querySelectorAll('.type-card').forEach(function (c) {
          c.classList.remove('selected');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
        modalState.type = card.dataset.type;
        showIntakeField(card.dataset.type);
      }
      card.addEventListener('click', selectCard);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(); }
      });
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitResource(form);
      });
    }
  }

  function resetModal() {
    modalState.type = null;
    var form = document.getElementById('add-resource-form');
    if (form) form.reset();
    document.querySelectorAll('.type-card').forEach(function (c) { c.classList.remove('selected'); });
    document.querySelectorAll('.intake-field').forEach(function (el) { el.style.display = 'none'; });
    var meta = document.getElementById('modal-metadata');
    if (meta) meta.style.display = 'none';
    // Set today's date
    var dateInput = document.getElementById('resource-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    // Reset pillar checkboxes
    renderPillarCheckboxes();
  }

  function showIntakeField(type) {
    document.querySelectorAll('.intake-field').forEach(function (el) { el.style.display = 'none'; });
    var field = document.getElementById('intake-' + type);
    if (field) field.style.display = '';
    var meta = document.getElementById('modal-metadata');
    if (meta) meta.style.display = '';
  }

  function renderPillarCheckboxes() {
    var container = document.getElementById('pillar-checkboxes');
    if (!container) return;
    container.innerHTML = store.PILLARS.map(function (p) {
      return '<label class="checkbox-item">' +
        '<input type="checkbox" name="pillars" value="' + escapeAttr(p.id) + '">' +
        escapeHtml(p.label) +
        '</label>';
    }).join('');
  }

  function submitResource(form) {
    if (!modalState.type) {
      showToast('Please select a resource type.', true);
      return;
    }

    var resource = {
      id: store.generateId('r'),
      type: modalState.type,
      name: form.querySelector('#resource-name').value.trim(),
      date: form.querySelector('#resource-date').value,
      notes: form.querySelector('#resource-notes').value.trim(),
      pillars: Array.from(form.querySelectorAll('input[name="pillars"]:checked')).map(function (cb) { return cb.value; })
    };

    if (!resource.name) {
      showToast('Please enter a resource name.', true);
      return;
    }

    if (modalState.type === 'link') {
      var url = form.querySelector('#intake-url').value.trim();
      if (!url) { showToast('Please enter a URL.', true); return; }
      resource.url = url;
      finishSave(resource);

    } else if (modalState.type === 'text') {
      var content = form.querySelector('#intake-text-content').value.trim();
      if (!content) { showToast('Please enter some text.', true); return; }
      resource.content = content;
      finishSave(resource);

    } else if (modalState.type === 'pdf') {
      var fileInput = form.querySelector('#intake-pdf-file');
      var file = fileInput && fileInput.files[0];
      if (!file) { showToast('Please select a PDF file.', true); return; }

      var MAX_PDF_BYTES = 750 * 1024;
      if (file.size > MAX_PDF_BYTES) {
        showToast('PDF is too large (max 750 KB). Consider linking to it instead.', true);
        return;
      }

      var reader = new FileReader();
      reader.onload = function (evt) {
        resource.dataUrl = evt.target.result;
        resource.fileName = file.name;
        if (!resource.name) resource.name = file.name.replace(/\.pdf$/i, '');
        finishSave(resource);
      };
      reader.readAsDataURL(file);
    }
  }

  function finishSave(resource) {
    store.saveResource(resource);
    document.getElementById('add-resource-modal').close();
    renderCards();
    showToast('Resource added to the Archive.');
  }

  // ── Re-sync ─────────────────────────────────────────────────────────────

  function bindResync() {
    var btn = document.getElementById('resync-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!confirm('Re-sync will reload all resources from the source file. Resources you added manually in the browser will be lost. Continue?')) return;
      btn.disabled = true;
      btn.textContent = 'Syncing…';
      store.resync().then(function () {
        renderCards();
        btn.disabled = false;
        btn.textContent = '↺ Re-sync archive';
        showToast('Archive re-synced from source.');
      });
    });
  }

  // ── PDF Viewer Modal ────────────────────────────────────────────────────

  function bindViewerModal() {
    var modal = document.getElementById('viewer-modal');
    var closeBtn = document.getElementById('viewer-close');
    if (!modal) return;
    if (closeBtn) closeBtn.addEventListener('click', function () { modal.close(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
  }

  function openViewerModal(resourceId) {
    var modal = document.getElementById('viewer-modal');
    var titleEl = document.getElementById('viewer-title');
    var body = document.getElementById('viewer-body');
    if (!modal || !body) return;

    var resource = store.getResources().find(function (r) { return r.id === resourceId; });
    if (!resource) return;

    if (titleEl) titleEl.textContent = resource.name || 'Resource';

    if (resource.type === 'pdf' && resource.dataUrl) {
      body.innerHTML = '<iframe class="viewer-iframe" src="' + resource.dataUrl + '" title="' + escapeAttr(resource.name) + '"></iframe>';
    } else if (resource.type === 'pdf' && resource.url) {
      window.open(resource.url, '_blank', 'noopener');
      return;
    } else if (resource.type === 'text') {
      body.innerHTML = '<div class="viewer-text">' + escapeHtml(resource.content || '') + '</div>';
    }

    modal.showModal();
  }

  // ── Utilities ───────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}());
