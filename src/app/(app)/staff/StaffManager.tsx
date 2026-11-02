'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createStaff, updateStaff } from '@/lib/actions/admin';
import { formatDate } from '@/lib/format';
import type { Role, StaffProfile } from '@/lib/types';

export function StaffManager({ staff, meId, serviceKeyConfigured }: { staff: StaffProfile[]; meId: string; serviceKeyConfigured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [edit, setEdit] = useState({ fullName: '', role: 'cashier' as Role, active: true });

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError(null);
    startTransition(async () => {
      const res = await createStaff({
        fullName: String(f.get('fullName')), email: String(f.get('email')),
        password: String(f.get('password')), role: f.get('role') as Role,
      });
      if (!res.ok) return setError(res.error);
      toast.success(res.message ?? 'Staff member added.');
      form.reset();
      router.refresh();
    });
  }

  function onSave() {
    if (!editing) return;
    startTransition(async () => {
      const res = await updateStaff({ staffId: editing.id, ...edit });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success('Staff member updated.');
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="panel overflow-x-auto" aria-label="Staff list">
        <table className="table">
          <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Since</th><th scope="col"><span className="sr-only">Edit</span></th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={s.active ? '' : 'opacity-55'}>
                <td className="font-semibold">{s.full_name}{s.id === meId && <span className="ml-2 text-xs text-muted">(you)</span>}</td>
                <td>
                  {s.role === 'super_admin'
                    ? <span className="badge bg-neon-purple/15 text-[#c4a5ff] ring-1 ring-neon-purple/40"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Super admin</span>
                    : <span className="badge bg-white/5 text-muted ring-1 ring-white/10">Cashier</span>}
                </td>
                <td>{s.active ? <span className="text-success">Active</span> : <span className="text-muted">Disabled</span>}</td>
                <td className="text-muted">{formatDate(s.created_at)}</td>
                <td className="text-right">
                  <button className="btn-ghost min-h-[36px] px-3 text-sm" onClick={() => { setEditing(s); setEdit({ fullName: s.full_name, role: s.role, active: s.active }); }}>
                    <Pencil className="h-4 w-4" aria-hidden /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form onSubmit={onCreate} className="panel panel-pad space-y-4" aria-labelledby="add-staff">
        <h2 id="add-staff" className="heading flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-neon-orange" aria-hidden /> Add staff member</h2>
        {!serviceKeyConfigured && (
          <p className="rounded-xl border border-neon-gold/30 bg-neon-gold/10 p-3 text-sm text-neon-gold">
            Set SUPABASE_SERVICE_ROLE_KEY on the server to create logins here.
          </p>
        )}
        <div><label className="field-label" htmlFor="fullName">Full name</label><input id="fullName" name="fullName" required maxLength={100} className="input" /></div>
        <div><label className="field-label" htmlFor="email">Email (login)</label><input id="email" name="email" type="email" required className="input" autoComplete="off" /></div>
        <div>
          <label className="field-label" htmlFor="password">Temporary password</label>
          <input id="password" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" />
          <p className="field-help">At least 10 characters. They can change it with “Forgot password”.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="role">Role</label>
          <select id="role" name="role" className="input" defaultValue="cashier">
            <option value="cashier">Cashier</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
        <button className="btn-primary w-full" disabled={pending || !serviceKeyConfigured}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />} Create login
        </button>
      </form>

      <ConfirmDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit staff member"
        description="Disabling a member blocks all access immediately. Records they created are kept." confirmLabel="Save" pending={pending} onConfirm={onSave}>
        <div className="space-y-3">
          <div><label className="field-label" htmlFor="ed-name">Full name</label>
            <input id="ed-name" className="input" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></div>
          <div><label className="field-label" htmlFor="ed-role">Role</label>
            <select id="ed-role" className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
              <option value="cashier">Cashier</option><option value="super_admin">Super admin</option>
            </select></div>
          <label className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" className="h-5 w-5 accent-[#FF6B00]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
            <span>Account active</span>
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
