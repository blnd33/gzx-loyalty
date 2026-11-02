'use client';
import { useState, useTransition } from 'react';
import { changePassword } from '@/lib/actions/session';
export function PasswordForm() {
  const [error,setError]=useState(''); const [pending,start]=useTransition();
  return <form className="panel panel-pad max-w-lg space-y-4" onSubmit={e=>{e.preventDefault(); const f=new FormData(e.currentTarget);
    if(f.get('password')!==f.get('confirm')) {setError('New passwords do not match.');return;}
    start(async()=>{const r=await changePassword(String(f.get('current')),String(f.get('password')));if(!r.ok)setError(r.error??'Failed.');else window.location.assign('/login?reset=1');});}}>
    <h1 className="heading text-2xl">My password</h1>
    <div><label htmlFor="current" className="field-label">Current password</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" required /></div>
    <div><label htmlFor="new-password" className="field-label">New password</label><input className="input" id="new-password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></div>
    <div><label htmlFor="confirm" className="field-label">Confirm new password</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /></div>
    {error&&<p role="alert" className="field-error">{error}</p>}<button className="btn-primary" disabled={pending}>Change password</button>
  </form>;
}
