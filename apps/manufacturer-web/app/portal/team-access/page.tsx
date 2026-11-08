"use client";

import { useEffect, useState, type FormEvent } from "react";
import { UserPlus, UsersRound, X } from "lucide-react";
import "../ops.css";
import "./team-access.css";

const API = process.env.NEXT_PUBLIC_PAN_API_URL || "http://localhost:4000/api";
const roles = ["ADMIN", "OPERATOR", "ANALYST", "FINANCE", "SUPPORT"];
type Member = { id: string; role: string; user: { id: string; fullName: string; email: string; emailVerifiedAt: string | null } };
type Invitation = { id: string; email: string; role: string; expiresAt: string };

export default function TeamAccessPage() {
  const [token, setToken] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(API + path, { ...init, headers: { Authorization: "Bearer " + token, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Workspace access request failed.");
    return data;
  }

  async function load(currentToken = token) {
    const response = await fetch(API + "/v1/manufacturer/team", { headers: { Authorization: "Bearer " + currentToken } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Could not load team access.");
    setMembers(data.members);
    setInvitations(data.invitations);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("pan_access_token") || "";
    setToken(saved);
    if (saved) void load(saved).catch(error => setNotice(error instanceof Error ? error.message : "Could not load team access."));
    else setNotice("Sign in to your manufacturer workspace to manage access.");
  }, []);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await request("/v1/manufacturer/team/invitations", { method: "POST", body: JSON.stringify({ email, role }) });
      setEmail("");
      await load();
      setNotice("Invitation sent. It expires in seven days.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not invite team member."); }
    finally { setBusy(false); }
  }

  async function changeRole(userId: string, nextRole: string) {
    try {
      await request("/v1/manufacturer/team/" + encodeURIComponent(userId) + "/role", { method: "POST", body: JSON.stringify({ role: nextRole }) });
      await load();
      setNotice("Workspace role updated.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update role."); }
  }

  async function revoke(id: string) {
    try {
      await request("/v1/manufacturer/team/invitations/" + encodeURIComponent(id) + "/revoke", { method: "POST" });
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not revoke invitation."); }
  }

  async function remove(userId: string) {
    if (!window.confirm("Remove this person from the workspace?")) return;
    try {
      await request("/v1/manufacturer/team/" + encodeURIComponent(userId), { method: "DELETE" });
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove team member."); }
  }

  return <main className="ops-shell team-access-shell">
    <aside><a className="ops-brand" href="/portal">✳ <b>pan.</b><small>MANUFACTURER</small></a><p>WORKSPACE</p><a href="/portal">Overview &amp; products</a><a href="/portal/company">Company profile</a><a href="/portal/issuance">Code studio</a><a href="/portal/team-access" aria-current="page">Team &amp; roles</a></aside>
    <section>
      <header><span>Manufacturer workspace / Team &amp; roles</span><a href="/portal">Return to overview ↗</a></header>
      <div className="ops-content team-access-content">
        <div className="ops-eyebrow">ACCESS CONTROL</div><h1>People &amp; permissions.</h1><p className="ops-subtitle">Assign only the access each colleague needs. The API enforces every role.</p>
        {notice && <p className="team-access-notice" role="status">{notice}</p>}
        <section className="ops-card"><h2><UserPlus size={17} /> Invite a colleague</h2><form className="team-access-invite" onSubmit={invite}><label>Work email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="colleague@company.com" /></label><label>Workspace role<select value={role} onChange={event => setRole(event.target.value)}>{roles.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><button disabled={busy || !token}>{busy ? "Sending…" : "Send invitation"}</button></form></section>
        <section className="ops-card"><h2><UsersRound size={17} /> Active members</h2><div className="team-access-list">{members.map(member => <article key={member.id}><div><b>{member.user.fullName}</b><span>{member.user.email} · {member.user.emailVerifiedAt ? "Verified" : "Unverified"}</span></div>{member.role === "OWNER" ? <strong>OWNER</strong> : <><select value={member.role} onChange={event => void changeRole(member.user.id, event.target.value)}>{roles.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><button type="button" className="team-remove" aria-label={"Remove " + member.user.fullName} onClick={() => void remove(member.user.id)}><X size={15} /></button></>}</article>)}</div></section>
        <section className="ops-card"><h2>Pending invitations</h2>{invitations.length ? <div className="team-access-list">{invitations.map(invitation => <article key={invitation.id}><div><b>{invitation.email}</b><span>{invitation.role.replaceAll("_", " ")} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span></div><button type="button" onClick={() => void revoke(invitation.id)}>Revoke</button></article>)}</div> : <p className="ops-hint">No invitations are waiting for acceptance.</p>}</section>
      </div>
    </section>
  </main>;
}
