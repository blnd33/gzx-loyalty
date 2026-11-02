'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, Loader2, RefreshCw, ScanLine, ShieldAlert, Square } from 'lucide-react';
import { toast } from 'sonner';
import { parseQrPayload } from '@/lib/code';
import { lookupByCode, lookupByToken } from '@/lib/actions/lookup';

type Status = 'idle' | 'starting' | 'scanning' | 'resolving' | 'denied' | 'no-camera' | 'insecure' | 'error';

interface DetectorLike { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }

/** Method A: camera QR scanner (phones, tablets, webcams). Scanning never adds a punch. */
export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>(0);
  const busyRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const detectorRef = useRef<DetectorLike | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>('');
  const photoRef=useRef<HTMLInputElement>(null);
  const [readingPhoto,setReadingPhoto]=useState(false);

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stop, [stop]);

  // Stop the camera when the tab is hidden (saves battery, releases the device).
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && streamRef.current) {
        stop();
        setStatus('idle');
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [stop]);

  const handleText = useCallback(async (text: string) => {
    const now = Date.now();
    // Debounce: ignore the same code for 3 s and anything while a lookup is running.
    if (busyRef.current || (text === lastRef.current.text && now - lastRef.current.at < 3000)) return;
    lastRef.current = { text, at: now };
    const payload = parseQrPayload(text);
    if (payload.kind === 'invalid') {
      toast.error('This QR code is not a GZX loyalty card.');
      return;
    }
    busyRef.current = true;
    setStatus('resolving');
    navigator.vibrate?.(40);
    const res = payload.kind === 'token' ? await lookupByToken(payload.token) : await lookupByCode(payload.code);
    if (res.ok) {
      stop();
      router.push(`/customers/${res.data.customerId}`);
      return;
    }
    toast.error(res.error);
    busyRef.current = false;
    setStatus(streamRef.current ? 'scanning' : 'idle');
  }, [router, stop]);

  async function scanPhoto(file:File) {
    if(file.size>20*1024*1024){toast.error('Choose a photo smaller than 20 MB.');return;}
    stop();setStatus('idle');setReadingPhoto(true);
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.src=url;await img.decode();
      const scale=Math.min(1,1600/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Image could not be read');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const qr=jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});
      if(!qr){toast.error('No QR found. Try a clear, close photo of the code.');return;}
      await handleText(qr.data);
    }catch{toast.error('Could not read this photo. Choose another image or enter the card code.');}
    finally{URL.revokeObjectURL(url);setReadingPhoto(false);if(photoRef.current)photoRef.current.value='';}
  }

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (video.readyState >= 2 && !busyRef.current) {
      try {
        if (detectorRef.current) {
          const codes = await detectorRef.current.detect(video);
          if (codes[0]?.rawValue) await handleText(codes[0].rawValue);
        } else {
          const scale = Math.min(1, 720 / Math.max(video.videoWidth, 1));
          const w = Math.round(video.videoWidth * scale);
          const h = Math.round(video.videoHeight * scale);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(video, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (found?.data) await handleText(found.data);
        }
      } catch {
        /* a frame failing to decode is normal */
      }
    }
    if (streamRef.current) timerRef.current = window.setTimeout(tick, 120);
  }, [handleText]);

  const start = useCallback(async (deviceId?: string) => {
    if (!window.isSecureContext) {
      setStatus('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('no-camera');
      return;
    }
    stop();
    setStatus('starting');
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
      detectorRef.current = BD ? new BD({ formats: ['qr_code'] }) : null;

      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setCameras(devices);
      const active = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (active) setCameraId(active);

      busyRef.current = false;
      setStatus('scanning');
      tick();
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setStatus('no-camera');
      else {
        setStatus('error');
        setMessage(name === 'NotReadableError' ? 'The camera is being used by another app. Close it and try again.' : 'Could not start the camera.');
      }
    }
  }, [stop, tick]);

  const live = status === 'scanning' || status === 'resolving' || status === 'starting';

  return (
    <div>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[26rem] sm:aspect-square overflow-hidden rounded-2xl border border-line bg-black/60">
        <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${live ? '' : 'hidden'}`} aria-label="Camera preview" />
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {live && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-[62%] w-[62%]">
              {['left-0 top-0 border-l-4 border-t-4 rounded-tl-xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-xl',
                'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl'].map((c) => (
                <span key={c} className={`absolute h-10 w-10 border-neon-orange drop-shadow-[0_0_6px_#FF6B00] ${c}`} />
              ))}
              <span className="absolute inset-x-2 top-1/2 h-0.5 bg-neon-pink/80 shadow-[0_0_12px_#FF2E8B] motion-safe:animate-pulse" />
            </div>
          </div>
        )}

        {status === 'resolving' && (
          <div className="absolute inset-0 grid place-items-center bg-black/55" role="status">
            <span className="flex items-center gap-2 font-semibold"><Loader2 className="h-5 w-5 animate-spin" /> Opening card…</span>
          </div>
        )}

        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {status === 'denied' ? (
              <>
                <ShieldAlert className="h-10 w-10 text-danger" aria-hidden />
                <p className="font-semibold">Camera permission was denied</p>
                <p className="text-sm text-muted">
                  Allow camera access in your browser&apos;s site settings (the camera or lock icon in the address bar), then press
                  Try again. You can always use the 6-letter code instead.
                </p>
              </>
            ) : status === 'no-camera' ? (
              <>
                <CameraOff className="h-10 w-10 text-muted" aria-hidden />
                <p className="font-semibold">No camera found</p>
                <p className="text-sm text-muted">Use the 6-letter code instead.</p>
              </>
            ) : status === 'insecure' ? (
              <>
                <ShieldAlert className="h-10 w-10 text-neon-gold" aria-hidden />
                <p className="font-semibold">Camera needs HTTPS</p>
                <p className="text-sm text-muted">On lounge Wi-Fi, use Scan QR from photo below, or enter the 6-letter code.</p>
              </>
            ) : status === 'error' ? (
              <>
                <CameraOff className="h-10 w-10 text-danger" aria-hidden />
                <p className="text-sm text-muted">{message}</p>
              </>
            ) : (
              <>
                <ScanLine className="h-14 w-14 text-neon-orange drop-shadow-[0_0_10px_#FF6B00]" aria-hidden />
                <p className="text-sm text-muted">Point the camera at the QR code on the back of the card.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto mt-4 flex max-w-[26rem] flex-col gap-2">
        <input ref={photoRef} type="file" accept="image/*" capture="environment" aria-label="QR code photo" className="sr-only" onChange={e=>{const file=e.target.files?.[0];if(file)void scanPhoto(file);}} />
        <button className="btn-ghost btn-lg w-full" disabled={readingPhoto} onClick={()=>photoRef.current?.click()}>{readingPhoto?<Loader2 className="h-5 w-5 animate-spin" />:<Camera className="h-5 w-5" />}Scan QR from photo</button>
        {live ? (
          <button className="btn-ghost btn-lg w-full" onClick={() => { stop(); setStatus('idle'); }}>
            <Square className="h-5 w-5" aria-hidden /> Stop scanning
          </button>
        ) : (
          <button className="btn-primary btn-lg w-full" onClick={() => start(cameraId || undefined)}>
            {status === 'denied' || status === 'error' ? <RefreshCw className="h-5 w-5" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
            {status === 'denied' || status === 'error' ? 'Try again' : 'Scan QR code'}
          </button>
        )}
        {cameras.length > 1 && (
          <div>
            <label htmlFor="camera" className="sr-only">Camera</label>
            <select id="camera" className="input" value={cameraId}
              onChange={(e) => { setCameraId(e.target.value); start(e.target.value); }}>
              {cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
