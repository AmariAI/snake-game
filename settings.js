(() => {
  'use strict';

  const STORAGE_KEY = 'snake-clash-mobile-friendly';
  const openButton = document.getElementById('settings-open');
  const dialog = document.getElementById('settings-dialog');
  const toggle = document.getElementById('mobile-friendly-toggle');

  // Load the clan quick-access panel on pages that already include settings.js.
  const clansScript = document.createElement('script');
  clansScript.src = 'clans.js';
  clansScript.defer = true;
  document.body.appendChild(clansScript);

  if (!openButton || !dialog || !toggle) return;

  let enabled = false;
  try { enabled = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { /* use default */ }
  toggle.checked = enabled;
  document.body.classList.toggle('mobile-friendly', enabled);

  openButton.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });
  toggle.addEventListener('change', () => {
    document.body.classList.toggle('mobile-friendly', toggle.checked);
    try { localStorage.setItem(STORAGE_KEY, String(toggle.checked)); } catch { /* setting remains active for this page */ }
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
})();
