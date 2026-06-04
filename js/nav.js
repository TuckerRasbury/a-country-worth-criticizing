// nav.js — injects the shared site nav and provides the toast utility.
// Loaded on every page, after store.js.

(function () {
  var NAV_HTML = [
    '<nav class="site-nav" role="navigation" aria-label="Site navigation">',
    '  <a class="nav-brand" href="index.html">The Ledger</a>',
    '  <div class="nav-links">',
    '    <a href="sources.html" data-page="sources">Sources</a>',
    '    <a href="index.html" data-page="platform">Platform</a>',
    '  </div>',
    '</nav>'
  ].join('\n');

  function getActivePage() {
    var path = window.location.pathname;
    if (path.endsWith('sources.html')) return 'sources';
    return 'platform';
  }

  function injectNav() {
    var container = document.getElementById('site-nav');
    if (!container) return;
    container.innerHTML = NAV_HTML;
    var active = getActivePage();
    var link = container.querySelector('[data-page="' + active + '"]');
    if (link) link.setAttribute('aria-current', 'page');
  }

  // ── Toast ───────────────────────────────────────────────────────────────

  var toastTimer = null;

  window.showToast = function (message, isError) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimer) clearTimeout(toastTimer);

    var toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' is-error' : '');
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    toastTimer = setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
    }, 3000);
  };

  document.addEventListener('DOMContentLoaded', injectNav);
}());
