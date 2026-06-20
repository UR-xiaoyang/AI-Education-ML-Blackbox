const { db } = require('./db');

const DEFAULT_SETTINGS = {
  allow_registration: 'false',
  turnstile_enabled: 'false',
  turnstile_site_key: '',
  turnstile_secret_key: ''
};

function getSetting(key) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

function getBooleanSetting(key) {
  return getSetting(key) === 'true';
}

function getPublicSettings() {
  return {
    allowRegistration: getBooleanSetting('allow_registration'),
    turnstileEnabled: getBooleanSetting('turnstile_enabled'),
    turnstileSiteKey: getSetting('turnstile_site_key') || process.env.TURNSTILE_SITE_KEY || ''
  };
}

function getAdminSettings() {
  return {
    ...getPublicSettings(),
    turnstileSecretConfigured: !!(getSetting('turnstile_secret_key') || process.env.TURNSTILE_SECRET_KEY)
  };
}

function getTurnstileSecretKey() {
  return getSetting('turnstile_secret_key') || process.env.TURNSTILE_SECRET_KEY || '';
}

function updateSettings(settings) {
  const allowedKeys = {
    allowRegistration: 'allow_registration',
    turnstileEnabled: 'turnstile_enabled',
    turnstileSiteKey: 'turnstile_site_key',
    turnstileSecretKey: 'turnstile_secret_key'
  };

  const stmt = db.prepare(
    "UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?"
  );

  Object.entries(allowedKeys).forEach(([inputKey, dbKey]) => {
    if (typeof settings[inputKey] === 'boolean') {
      stmt.run(settings[inputKey] ? 'true' : 'false', dbKey);
    }
    if (inputKey === 'turnstileSiteKey' && typeof settings[inputKey] === 'string') {
      stmt.run(settings[inputKey].trim(), dbKey);
    }
    if (inputKey === 'turnstileSecretKey' && typeof settings[inputKey] === 'string' && settings[inputKey].trim()) {
      stmt.run(settings[inputKey].trim(), dbKey);
    }
  });

  return getAdminSettings();
}

module.exports = {
  getBooleanSetting,
  getSetting,
  getAdminSettings,
  getPublicSettings,
  getTurnstileSecretKey,
  updateSettings
};
