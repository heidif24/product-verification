"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, ShieldCheck } from "lucide-react";
import "../result.css";

export default function BrowserBarcodeScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let completed = false;

    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (!videoRef.current || cancelled) return;
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, result => {
          if (!result || cancelled || completed) return;
          completed = true;
          const raw = result.getText().trim();
          controlsRef.current?.stop();

          const pan1 = raw.match(/^PAN1:([A-Za-z0-9_-]{43})$/);
          const urlToken = raw.match(/\/v\/([A-Za-z0-9_-]{30,60})(?:[?#].*)?$/);
          const publicCode = raw.match(/PAN(?:U|C)?-[A-Fa-f0-9]{20}/i)?.[0];

          if (pan1) {
            router.replace("/v/" + pan1[1]);
          } else if (urlToken) {
            router.replace("/v/" + urlToken[1]);
          } else if (publicCode) {
            router.replace("/code/" + publicCode.toUpperCase());
          } else {
            completed = false;
            setError("This barcode is not a recognised PAN identity. Try the PAN label again or enter the printed product ID manually.");
          }
        });
        controlsRef.current = controls;
        if (cancelled) controls.stop();
        setStarting(false);
      } catch {
        if (!cancelled) {
          setError("Camera access is unavailable. Allow camera permission in your browser, use HTTPS, or enter the printed product ID manually.");
          setStarting(false);
        }
      }
    }

    void startScanner();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [router]);

  return <main className="verify-shell">
    <header className="verify-header">
      <Link className="verify-brand" href="/">
        <span className="verify-mark"><ShieldCheck size={20}/></span>
        <span><b>pan<span>.</span></b><small>PRODUCT AUTHENTICATION</small></span>
      </Link>
      <span className="secure-label"><Camera size={14}/> SECURE BARCODE SCAN</span>
    </header>
    <section className="verify-content result-content">
      <Link href="/" className="back-link"><ArrowLeft size={14}/> Back to verification</Link>
      <div className="verify-kicker"><span/> PAN PRODUCT SCANNER</div>
      <h1>Scan a PAN identity.</h1>
      <p className="verify-intro">Use this browser camera to scan a PAN1 Data Matrix label or an older PAN QR code. Your scan is sent to PAN for a live identity check.</p>
      <div className="result-card" style={{display:"grid",gap:16}}>
        <video ref={videoRef} autoPlay muted playsInline style={{width:"100%",maxHeight:380,aspectRatio:"4 / 3",objectFit:"cover",borderRadius:14,background:"#14251f"}}/>
        {starting && <p role="status">Starting your camera…</p>}
        {error && <p role="alert" className="result-footnote">{error}</p>}
        <p className="result-footnote">Camera access is used only to read the barcode. PAN does not request your location for verification.</p>
        <Link className="back-link" href="/">Enter a product ID manually instead</Link>
      </div>
    </section>
    <footer className="verify-footer"><span>© 2026 Product Authentication Network</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></footer>
  </main>;
}
