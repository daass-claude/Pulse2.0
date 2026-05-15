import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-key';

export const supabase = createClient(url, key);

// Exposed so the UI can show a warning when env vars are missing from the build
export const SUPABASE_URL_CONFIGURED = url !== 'https://placeholder.supabase.co';
