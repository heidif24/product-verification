"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
export default function VerifyEmailPage() {
  const params = useSearchParams(); const token = params.get("token") || "";
  const [message,setMessage] = useState("Verifying your email address…"); const [ok,setOk] = useState(false);
  useEffect(()=>{if(!token){setMessage("This verification link is incomplete.");return;}fetch(API+"/v1/auth/verify-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||"Verification failed");return d;}).then(d=>{setOk(true);setMessage(d.message);}).catch(e=>setMessage(e.message));},[token]);
  return <main className="auth-flow"><section><div className="auth-flow-mark">✳</div><p className="auth-flow-kicker">PAN MANUFACTURER ACCOUNT</p><h1>{ok?"Email confirmed.":"Confirming your email."}</h1><p>{message}</p><a href="/portal">Continue to manufacturer sign in ↗</a></section></main>;
}
