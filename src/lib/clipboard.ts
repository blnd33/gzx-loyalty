'use client';
export async function copyText(text:string):Promise<void> {
  if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return;}catch{/* Use the LAN-compatible fallback. */}}
  const focus=document.activeElement as HTMLElement|null;
  const field=document.createElement('textarea');field.value=text;field.readOnly=true;
  field.style.cssText='position:fixed;left:-9999px;top:0;';document.body.appendChild(field);
  try{field.select();field.setSelectionRange(0,text.length);if(!document.execCommand('copy'))throw new Error('Copy failed');}
  finally{field.remove();focus?.focus();}
}
