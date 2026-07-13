"use client";
import { useEffect, useState } from "react";

import { API_BASE as API, safeFetch } from "@/lib/api";

function authH(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface Member { id: string; email: string; role: string; joined_at: string; status: string; }
interface Invite  { id: string; email: string; role: string; expires_at: string; accepted: number; }
interface Org     { id: string; name: string; plan: string; default_currency: string; }

export default function TeamPage() {
  const [token, setToken] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("cff.token");
    setToken(t);
    if (t) load(t);
    else setLoading(false);
  }, []);

  async function load(t: string) {
    setLoading(true);
    const h = { headers: authH(t) };
    const [o, m, i] = await Promise.all([
      safeFetch(`${API}/api/org`, h),
      safeFetch(`${API}/api/org/members`, h),
      safeFetch(`${API}/api/org/invites`, h),
    ]);
    if (o) setOrg(o);
    if (m) setMembers(m);
    if (i) setInvites(i);
    setLoading(false);
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await fetch(`${API}/api/org`, {
      method: "POST", headers: authH(token),
      body: JSON.stringify({ name: newOrgName }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.detail); return; }
    setOrg(data); setInfo("Organisation created!"); load(token);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(""); setInfo("");
    const res = await fetch(`${API}/api/org/invite`, {
      method: "POST", headers: authH(token),
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.detail); return; }
    setInfo(`Invite sent to ${inviteEmail}`);
    setInviteEmail(""); load(token);
  }

  async function changeRole(userId: string, role: string) {
    if (!token) return;
    await fetch(`${API}/api/org/members/${userId}/role`, {
      method: "PATCH", headers: authH(token), body: JSON.stringify({ role }),
    });
    load(token);
  }

  async function removeMember(userId: string) {
    if (!token || !confirm("Remove this member?")) return;
    await fetch(`${API}/api/org/members/${userId}`, {
      method: "DELETE", headers: authH(token),
    });
    load(token);
  }

  async function revokeInvite(inviteId: string) {
    if (!token) return;
    await fetch(`${API}/api/org/invites/${inviteId}`, {
      method: "DELETE", headers: authH(token),
    });
    load(token);
  }

  if (!token) return (
    <div className="bz-page"><p className="bz-empty">Sign in to manage your team.</p></div>
  );
  if (loading) return <div className="bz-page"><p className="bz-empty">Loading…</p></div>;

  return (
    <div className="bz-page">
      <h1 className="bz-page-title">Team & Organisation</h1>

      {error && <div className="bz-alert bz-alert--error">{error}</div>}
      {info  && <div className="bz-alert bz-alert--info">{info}</div>}

      {!org ? (
        <section className="bz-section">
          <h2 className="bz-section-title">Create your organisation</h2>
          <p className="bz-section-sub">
            Create an organisation to invite teammates and share forecasts.
          </p>
          <form onSubmit={createOrg} className="bz-form">
            <label className="bz-label">Organisation name</label>
            <input className="bz-input" value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              placeholder="e.g. Northwind Coffee Roasters" required />
            <button className="bz-btn bz-btn--primary" type="submit">Create</button>
          </form>
        </section>
      ) : (
        <>
          {/* Org header */}
          <section className="bz-section bz-org-header">
            <div className="bz-org-name">{org.name}</div>
            <span className="bz-plan-badge">{org.plan.toUpperCase()}</span>
          </section>

          {/* Members */}
          <section className="bz-section">
            <h2 className="bz-section-title">Members ({members.length})</h2>
            <table className="bz-table">
              <thead><tr>
                <th>Email</th><th>Role</th><th>Joined</th><th></th>
              </tr></thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>{m.email}</td>
                    <td>
                      <select className="bz-select" value={m.role}
                        onChange={e => changeRole(m.id, e.target.value)}>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td>{m.joined_at.slice(0, 10)}</td>
                    <td>
                      <button className="bz-btn bz-btn--ghost bz-btn--sm"
                        onClick={() => removeMember(m.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Invite */}
          <section className="bz-section">
            <h2 className="bz-section-title">Invite a teammate</h2>
            <form onSubmit={sendInvite} className="bz-form bz-form--row">
              <input className="bz-input bz-input--grow" type="email"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com" required />
              <select className="bz-select" value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button className="bz-btn bz-btn--primary" type="submit">Send invite</button>
            </form>
          </section>

          {/* Pending invites */}
          {invites.filter(i => !i.accepted).length > 0 && (
            <section className="bz-section">
              <h2 className="bz-section-title">Pending invites</h2>
              <table className="bz-table">
                <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th></th></tr></thead>
                <tbody>
                  {invites.filter(i => !i.accepted).map(inv => (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td>{inv.role}</td>
                      <td>{inv.expires_at.slice(0, 10)}</td>
                      <td>
                        <button className="bz-btn bz-btn--ghost bz-btn--sm"
                          onClick={() => revokeInvite(inv.id)}>Revoke</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
