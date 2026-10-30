"use client";
import "../auth-flow.css";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") || ""; const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const [done,setDone]=useState(false); const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");try{const r=await fetch(API+"/v1/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Could not reset password");setDone(true);setMessage(d.message);}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}
  return <main className="auth-flow"><section><div className="auth-flow-mark">✳</div><p className="auth-flow-kicker">ACCOUNT SECURITY</p><h1>Choose a new password.</h1>{done?<p>{message}</p>:<form onSubmit={submit}><label>New password<input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters"/></label><button disabled={busy||!token}>{busy?"Saving…":"Update password"}</button>{message&&<p>{message}</p>}</form>}<a href="/portal">Return to sign in ↗</a></section></main>;
}
