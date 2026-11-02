'use server';
import { cookies, headers } from 'next/headers';
import { login, changeOwnPassword } from '@/lib/data-store';
import { getStaff } from '@/lib/auth';
import { secureCookies } from '@/lib/deployment';
export async function signIn(email: string, password: string) {
  try {
    const address=process.env.TRUST_PROXY==='1' ? (await headers()).get('x-real-ip') || 'unknown' : 'local';
    const result=await login(String(email).trim(),String(password),address);
    if(!result) return {ok:false,error:'Incorrect email or password, or this account is disabled.'};
    (await cookies()).set('lounge_session',result.token,{httpOnly:true,sameSite:'lax',secure:secureCookies(),path:'/',maxAge:7*86400});
    return {ok:true};
  } catch(error) {
    console.error('Local sign-in failed:',error instanceof Error?error.message:'Unknown error');
    return {ok:false,error:error instanceof Error&&error.message==='LOGIN_RATE_LIMITED'?'Too many sign-in attempts. Wait 15 minutes and try again.':'Sign in failed. Please try again.'};
  }
}
export async function changePassword(current: string,password: string) {
  const staff=await getStaff(); if(!staff) return {ok:false,error:'Please sign in again.'};
  if(typeof current!=='string'||current.length>200||typeof password!=='string'||password.length<10||password.length>72) return {ok:false,error:'Use a new password between 10 and 72 characters.'};
  if(!await changeOwnPassword(staff.id,current,password)) return {ok:false,error:'Current password is incorrect.'};
  (await cookies()).delete('lounge_session'); return {ok:true};
}
