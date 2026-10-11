import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
window.CARBONWISE_SITE_URL = import.meta.env.VITE_SITE_URL || 'https://carbon-seven-gamma.vercel.app';

if (!url || !publishableKey) {
  window.CARBONWISE_SUPABASE_ERROR = 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your deployment environment.';
} else {
  window.CARBONWISE_SUPABASE = createClient(url, publishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
}

await import('./material-database.js');
await import('./calculation-engine.js');
await import('./app.js');
await import('./auth-app.js');
