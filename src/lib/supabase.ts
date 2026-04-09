/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dftbloiwlzpbvtdzkpap.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_R8VVr-tBSixyWnk_F5bFIg_FyvAPfPi';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials missing in environment. Using fallback values provided in chat.');
}

// Check for Stripe key format (common mistake)
if (supabaseAnonKey?.startsWith('pk_') || supabaseAnonKey?.startsWith('sb_')) {
  console.warn('Warning: The VITE_SUPABASE_ANON_KEY provided looks like a Stripe key. Supabase keys usually start with "eyJ".');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Test connection
supabase.auth.getSession().catch(err => {
  console.error('Supabase connection test failed:', err.message);
  if (err.message === 'Failed to fetch') {
    console.error('This usually means the Supabase URL is incorrect or the service is unreachable.');
  }
});
