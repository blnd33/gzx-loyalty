'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
export function RefreshCard({token,initialVersion}:{token:string;initialVersion:string}) {
  const router=useRouter();const [pending,start]=useTransition();
  const version=useRef(initialVersion);
  const [connection,setConnection]=useState<'connecting'|'connected'|'offline'>('connecting');
  useEffect(()=>{version.current=initialVersion;},[initialVersion]);
  useEffect(()=>{
    let stopped=false;let busy=false;let timer:ReturnType<typeof setTimeout>;let request:AbortController|undefined;
    async function check() {
      if(stopped||busy)return;
      clearTimeout(timer);
      if(document.visibilityState!=='visible'){timer=setTimeout(check,2000);return;}
      busy=true;request=new AbortController();
      const timeout=setTimeout(()=>request?.abort(),8000);
      try {
        const response=await fetch(`/api/card/${encodeURIComponent(token)}`,{cache:'no-store',signal:request.signal});
        if(stopped)return;
        if(response.status===404){stopped=true;router.refresh();return;}
        if(!response.ok)throw new Error('Connection failed');
        const data=await response.json() as {version:string};
        setConnection('connected');
        if(data.version!==version.current){version.current=data.version;router.refresh();}
      }catch{if(!stopped)setConnection('offline');}
      finally{clearTimeout(timeout);busy=false;if(!stopped)timer=setTimeout(check,2000);}
    }
    void check();
    const onVisible=()=>{if(document.visibilityState==='visible')void check();};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('online',onVisible);
    return()=>{stopped=true;clearTimeout(timer);request?.abort();document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('online',onVisible);};
  },[router,token]);
  const status=connection==='connected'?'Live updates connected':connection==='offline'?'Connection lost — retrying automatically':'Connecting live updates…';
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"><span role="status" className="text-xs text-muted">{status}</span><button className="btn-ghost text-sm" disabled={pending} onClick={()=>start(()=>router.refresh())}><RefreshCw className={`h-4 w-4 ${pending?'animate-spin':''}`} />Refresh progress</button></div>;
}
