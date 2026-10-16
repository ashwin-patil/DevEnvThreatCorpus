(() => {
  const key = 'devenv-threat-corpus.theme';
  let theme = 'light', message = '';
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') theme = saved;
    else if (saved !== null) message = 'Saved theme preference was invalid. Light mode is in use; choose a theme to replace it.';
  } catch {
    message = 'Theme preference could not be read. Light mode is in use; switching still works for this page.';
  }
  document.documentElement.setAttribute('data-theme', theme);

  function mount() {
    const toggle = document.getElementById('theme-toggle');
    const notice = document.getElementById('theme-notice');
    const update = () => {
      document.documentElement.setAttribute('data-theme', theme);
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      toggle.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      notice.textContent = message;
      notice.hidden = !message;
    };
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(key, theme);
        message = '';
      } catch {
        message = 'Theme changed for this page only. The preference could not be saved in browser storage.';
      }
      update();
    });
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
