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
      .order('created_at', { ascending: false }),
    supabase.from('mindash_admins').select('user_id'),
  ]);

  const adminSet = new Set((admins ?? []).map((a: { user_id: string }) => a.user_id));
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
      createdAt: p.created_at,
      approvedAt: p.approved_at,
      isAdmin: adminSet.has(p.id),
    })
  );

  const pending = rows.filter((r) => r.status === 'pending').length;
  const approved = rows.filter((r) => r.status === 'approved').length;

  return (
    <>
      <h1 className="dash-hello">사용자 관리 🛡️</h1>
      <p className="body-lg" style={{ marginTop: 8 }}>
        전체 {rows.length}명 · 승인 대기 <b>{pending}</b>명 · 승인됨 {approved}명. 가입한 사용자를 승인해야 앱을 사용할 수 있어요.
      </p>
      <div style={{ marginTop: 24 }}>
        <AdminUsers rows={rows} currentUserId={user?.id ?? ''} />
      </div>
    </>
  );
}
