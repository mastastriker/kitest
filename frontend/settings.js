const providerForm = document.getElementById('provider-form');
const providerMessage = document.getElementById('provider-message');
const keyMessage = document.getElementById('key-message');
const providerInputs = Array.from(document.querySelectorAll('input[name="trend-provider"]'));
const statusPills = Array.from(document.querySelectorAll('[data-status]'));
const keyForms = Array.from(document.querySelectorAll('.key-form'));

const state = {
  settings: { trendProvider: 'openai' },
  providerStatus: { openai: false, grok: false },
};

const setMessage = (el, message, isError = false) => {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('text-danger', isError);
};

const updateStatusPills = () => {
  statusPills.forEach((pill) => {
    const provider = pill.dataset.status;
    const isSet = Boolean(state.providerStatus[provider]);
    pill.textContent = isSet ? 'gesetzt' : 'nicht gesetzt';
    pill.classList.toggle('is-set', isSet);
  });
};

const updateProviderInputs = () => {
  providerInputs.forEach((input) => {
    const isAvailable = Boolean(state.providerStatus[input.value]);
    input.disabled = !isAvailable;
    input.checked = state.settings.trendProvider === input.value;
  });

  if (!state.providerStatus[state.settings.trendProvider]) {
    setMessage(
      providerMessage,
      `Der aktuell ausgewählte Provider (${state.settings.trendProvider}) hat keinen API-Key.`,
      true
    );
  } else {
    setMessage(providerMessage, '');
  }
};

const loadSettings = async () => {
  const res = await fetch('/api/settings');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Settings konnten nicht geladen werden.');
  }
  state.settings = data.settings || state.settings;
  state.providerStatus = data.providerStatus || state.providerStatus;
  updateStatusPills();
  updateProviderInputs();
};

providerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selected = providerInputs.find((input) => input.checked);
  if (!selected) {
    setMessage(providerMessage, 'Bitte wähle einen Trend Provider aus.', true);
    return;
  }
  setMessage(providerMessage, 'Speichere Auswahl ...');
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trendProvider: selected.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Auswahl konnte nicht gespeichert werden.');
    }
    state.settings = data.settings || state.settings;
    state.providerStatus = data.providerStatus || state.providerStatus;
    updateStatusPills();
    updateProviderInputs();
    setMessage(providerMessage, 'Auswahl gespeichert.');
  } catch (error) {
    setMessage(providerMessage, error.message, true);
  }
});

keyForms.forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const provider = form.dataset.provider;
    const input = form.querySelector('input[name="api-key"]');
    const value = input?.value?.trim();
    if (!value) {
      setMessage(keyMessage, 'Bitte einen API-Key eingeben.', true);
      return;
    }
    setMessage(keyMessage, `Speichere ${provider} API-Key ...`);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'API-Key konnte nicht gespeichert werden.');
      }
      input.value = '';
      state.providerStatus = data.providerStatus || state.providerStatus;
      updateStatusPills();
      updateProviderInputs();
      setMessage(keyMessage, 'API-Key gespeichert.');
    } catch (error) {
      setMessage(keyMessage, error.message, true);
    }
  });
});

loadSettings().catch((error) => {
  setMessage(providerMessage, error.message, true);
});
