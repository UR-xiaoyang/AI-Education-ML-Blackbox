// Cloudflare Turnstile Configuration
// Get your keys from: https://dash.cloudflare.com/turnstile
//
// SECURITY: Keys should be set via environment variables in production.
// Never commit real keys to version control.

const TURNSTILE_CONFIG = {
  siteKey: process.env.TURNSTILE_SITE_KEY || '',
  secretKey: process.env.TURNSTILE_SECRET_KEY || '',
  verifyUrl: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
};

module.exports = TURNSTILE_CONFIG;
