// 서버 전용(service_role) Supabase 클라이언트. 클라이언트 컴포넌트/브라우저 번들에서 import 금지.
// 모듈 로드 시 인스턴스를 만들지 않는다 — 키가 없어도 빌드·기동이 안전해야 하므로 지연 생성한다.
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // 키 미설정 → 호출부가 친절한 에러로 처리
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
