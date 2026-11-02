'use client';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
export function CustomerShare({url,path}:{url:string;path:string}) {
  return <section className="panel panel-pad mb-5 flex flex-wrap items-center justify-between gap-4" aria-label="Customer access"><div><h2 className="heading text-base">Customer access</h2><p className="mt-1 text-sm text-muted">Share their private link or printed QR. Customers can view progress without a staff login.</p></div><div className="flex flex-wrap gap-2"><a href={path} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm"><ExternalLink className="h-4 w-4" />Customer view</a><button className="btn-ghost text-sm" onClick={async()=>{try{await navigator.clipboard.writeText(url);toast.success('Customer link copied.');}catch{toast.error('Could not copy. Open Customer view and copy its address.');}}}><Copy className="h-4 w-4" />Copy customer link</button></div></section>;
}
