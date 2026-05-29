import { createClient } from '@supabase/supabase-js';

// Vite는 VITE_ 접두사가 붙은 환경변수만 클라이언트에 노출합니다.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 환경변수가 둘 다 채워져 있으면 Supabase 모드, 아니면 localStorage 모드로 동작합니다.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
