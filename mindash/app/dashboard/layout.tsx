import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// 2차 방어선: /dashboard 하위 전체 라우트에서 승인 여부 재확인
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: prof } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle();
  const { data: adm } = await supabase
    .from('mindash_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // 행 없음 = 비-Mindash 멤버 → /pending (거기서 편입). 관리자는 통과.
  if (!adm && (!prof || prof.status !== 'approved')) redirect('/pending');

  return <>{children}</>;
}
