// platform.js — powers the Platform page (platform.html)

(function () {
  var MAX_FURTHER_READING = 3;

  // ── Init ────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    store.init().then(function () {
      var platform = store.getPlatform();
      var resources = store.getResources();
      renderPlatform(platform, resources);
      renderPillarNav(platform);
      bindScrollSpy();
    });
  });

  // ── Render platform sections ────────────────────────────────────────────

  function renderPlatform(platform, resources) {
    var container = document.getElementById('platform-sections');
    if (!container) return;

    var pillars = (platform && platform.pillars) ? platform.pillars : [];

    if (pillars.length === 0) {
      container.innerHTML = '<p class="belief-forthcoming" style="padding: var(--space-8) 0;">Platform content is loading…</p>';
      return;
    }

    container.innerHTML = pillars.sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (pillar) {
      return renderPillarSection(pillar, resources);
    }).join('');
  }

  function renderPillarSection(pillar, resources) {
    var belief = pillar.belief || '';
    var isForthcoming = !belief || belief === 'Position forthcoming.';

    var beliefHtml = isForthcoming
      ? '<p class="belief-forthcoming">Position forthcoming.</p>'
      : '<blockquote class="belief-statement">' + escapeHtml(belief) + '</blockquote>';

    var legislationHtml = '';
    var legislation = pillar.legislation || [];
    if (legislation.length > 0) {
      legislationHtml = '<ul class="policy-list">' +
        legislation.map(function (leg) {
          return '<li class="policy-item">' +
            '<a href="' + escapeAttr(leg.url || '#') + '" target="_blank" rel="noopener">' + escapeHtml(leg.name || '') + ' ↗</a>' +
            (leg.note ? '<p class="policy-note">' + escapeHtml(leg.note) + '</p>' : '') +
            '</li>';
        }).join('') +
        '</ul>';
    } else {
      legislationHtml = '<p class="belief-forthcoming">Policies forthcoming.</p>';
    }

    // Further Reading from Archive
    var matching = (resources || []).filter(function (r) {
      return r.pillars && r.pillars.includes(pillar.id);
    }).slice(0, MAX_FURTHER_READING);

    var furtherReadingHtml = '';
    if (matching.length > 0) {
      furtherReadingHtml = '<div class="further-reading">' +
        '<p class="further-reading-header">Further Reading</p>' +
        '<div class="reading-list">' +
        matching.map(function (r) {
          var href = r.type === 'link' ? escapeAttr(r.url || '#') : '#';
          var target = r.type === 'link' ? ' target="_blank" rel="noopener"' : '';
          return '<a class="reading-item" href="' + href + '"' + target + '>' +
            '<div class="reading-item-name">' + escapeHtml(r.name || 'Untitled') + '</div>' +
            '<div class="reading-item-notes">' + escapeHtml(r.notes || '') + '</div>' +
            '</a>';
        }).join('') +
        '</div>' +
        '</div>';
    }

    return '<section class="pillar-section" id="' + escapeAttr(pillar.id) + '">' +
      '<header class="pillar-section-header">' +
        '<p class="pillar-label">Policy Pillar</p>' +
        '<h2 class="pillar-name">' + escapeHtml(pillar.label || '') + '</h2>' +
      '</header>' +
      '<div class="pillar-body">' +
        '<div class="belief-block">' +
          '<p class="belief-header">I Believe</p>' +
          beliefHtml +
        '</div>' +
        '<div class="policies-block">' +
          '<p class="policies-header">Policies That Prove It\'s Possible</p>' +
          legislationHtml +
        '</div>' +
      '</div>' +
      furtherReadingHtml +
      '</section>';
  }

  // ── Pillar Nav ──────────────────────────────────────────────────────────

  function renderPillarNav(platform) {
    var nav = document.getElementById('pillar-nav-list');
    if (!nav) return;

    var pillars = (platform && platform.pillars) ? platform.pillars : [];
    pillars = pillars.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

    nav.innerHTML = pillars.map(function (p) {
      return '<li><a href="#' + escapeAttr(p.id) + '">' + escapeHtml(p.label || '') + '</a></li>';
    }).join('');
  }

  // ── Scroll spy (IntersectionObserver) ──────────────────────────────────

  function bindScrollSpy() {
    var nav = document.getElementById('pillar-nav-list');
    if (!nav || !window.IntersectionObserver) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          nav.querySelectorAll('a').forEach(function (a) {
            var href = a.getAttribute('href');
            a.classList.toggle('is-active', href === '#' + id);
          });
        }
      });
    }, {
      rootMargin: '-' + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 52) + 'px 0px -60% 0px',
      threshold: 0
    });

    document.querySelectorAll('.pillar-section').forEach(function (section) {
      observer.observe(section);
    });
  }

  // ── Utilities ───────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}());
