/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dftbloiwlzpbvtdzkpap.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  if (!supabaseAnonKey) {
    console.error('Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
  } else {
    console.warn('Supabase credentials missing in environment. Using fallback values.');
  }
}

// Check for Stripe key format (common mistake)
if (supabaseAnonKey?.startsWith('pk_') || supabaseAnonKey?.startsWith('sb_')) {
  console.error('Error: The VITE_SUPABASE_ANON_KEY provided looks like a Stripe key. Supabase keys usually start with "eyJ". This will cause "Failed to fetch" errors.');
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
