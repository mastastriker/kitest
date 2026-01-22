const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.querySelector('.theme-toggle span');

const themeStorageKey = 'theme-preference';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.checked = theme === 'dark';
  }
  if (themeLabel) {
    themeLabel.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
}

function getPreferredTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

applyTheme(getPreferredTheme());

if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    const nextTheme = themeToggle.checked ? 'dark' : 'light';
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  });
}
