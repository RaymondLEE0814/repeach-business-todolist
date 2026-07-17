import { createClient } from '@/lib/supabase/server';
import AdminUsers, { type AdminUserRow } from './AdminUsers';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: admins }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,email,full_name,status,created_at,approved_at')
      .eq('mindash_member', true) // Mindash 사용자만 (다른 사이트 가입자 제외)
      .order('created_at', { ascending: false }),
    supabase.from('mindash_admins').select('user_id'),
  ]);

  const adminSet = new Set((admins ?? []).map((a: { user_id: string }) => a.user_id));
  // plan 컬럼은 migration_plans.sql 실행 전에는 없을 수 있으므로 별도로 관대하게 조회(실패 시 전원 free)
  const { data: planRows } = await supabase.from('profiles').select('id,plan').eq('mindash_member', true);
  const planMap = new Map((planRows ?? []).map((p: { id: string; plan: string | null }) => [p.id, p.plan]));
  const rows: AdminUserRow[] = (profiles ?? []).map(
    (p: {
      id: string;
      email: string | null;
      full_name: string | null;
      status: string;
      created_at: string | null;
      approved_at: string | null;
    }) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      status: (p.status as AdminUserRow['status']) ?? 'pending',
      plan: planMap.get(p.id) === 'pro' ? 'pro' : 'free',
      createdAt: p.created_at,
      approvedAt: p.approved_at,
      isAdmin: adminSet.has(p.id),
    })
  );

  const approved = rows.filter((r) => r.status === 'approved').length;
  const blocked = rows.filter((r) => r.status === 'rejected').length;

  return (
    <>
      <h1 className="dash-hello">사용자 관리 🛡️</h1>
      <p className="body-lg" style={{ marginTop: 8 }}>
        전체 {rows.length}명 · 이용 중 {approved}명 · 차단 <b>{blocked}</b>명. 계정은 가입 즉시 이용할 수 있고, 필요하면 여기서 차단할 수 있어요.
      </p>
      <div style={{ marginTop: 24 }}>
        <AdminUsers rows={rows} currentUserId={user?.id ?? ''} />
      </div>
    </>
  );
}
