"use client";
import "../auth-flow.css";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
export default function AcceptInvitationPage() {
  const [token,setToken]=useState("");useEffect(()=>{setToken(new URLSearchParams(window.location.search).get("token")||"");},[]);const [fullName,setFullName]=useState("");const [password,setPassword]=useState("");const [message,setMessage]=useState("");const [done,setDone]=useState(false);const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);try{const r=await fetch(API+"/v1/manufacturer/invitations/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,fullName,password})});const d=await r.json();if(!r.ok)throw new Error(d.message||"Invitation could not be accepted");setDone(true);setMessage("Your invitation has been accepted. You can now sign in to the workspace.");}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}
  return <main className="auth-flow"><section><div className="auth-flow-mark">✳</div><p className="auth-flow-kicker">PAN WORKSPACE INVITATION</p><h1>Join your team.</h1>{done?<p>{message}</p>:<form onSubmit={submit}><label>Your full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} /></label><label>Create a password<input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)} /></label><button disabled={busy||!token}>{busy?"Accepting…":"Accept invitation"}</button>{message&&<p>{message}</p>}</form>}<a href="/portal">Go to manufacturer sign in ↗</a></section></main>;
}
