"use client";
import { FormEvent, useEffect, useState } from "react";
type Member = { email: string; role: "owner" | "admin" | "operator"; joined: boolean };
export default function AdminUsers({ currentEmail }: { currentEmail: string }) {
  const [users, setUsers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  async function refresh() {
    const response = await fetch("/api/users", { cache: "no-store" });
    const data = await response.json() as { users?: Member[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load users.");
    setUsers(data.users || []); setLoaded(true);
  }
  useEffect(() => { void refresh().catch(error => setMessage(error.message)); }, []);
  async function save(action: "save" | "remove", memberEmail: string, memberRole = role) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email: memberEmail, role: memberRole }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save user.");
      await refresh(); setRemoving(null);
      if (action === "save" && memberEmail === email) setEmail("");
      setMessage(action === "remove" ? "User access removed." : "User access saved. Share the control board link so they can sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); }
    finally { setBusy(false); }
  }
  function add(event: FormEvent) { event.preventDefault(); void save("save", email); }
  return <main className="control-page"><section className="control-card admin-card">
    <p className="control-eyebrow">NBHL broadcast controls</p><h1>Manage users</h1>
    <a className="admin-nav-link" href="/control">Back to control board</a>
    <p>Add the email they use to sign in to ChatGPT. Operators can run the broadcast; admins can also manage users.</p>
    <form className="admin-add-user" onSubmit={add}>
      <label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" disabled={busy} /></label>
      <label>Access<select value={role} onChange={event => setRole(event.target.value)} disabled={busy}><option value="operator">Operator</option><option value="admin">Admin</option></select></label>
      <button type="submit" disabled={busy || !email.trim()}>Add user</button>
    </form>
    <p className="admin-share-link">Control board link: <a href="/control">nbhl-obs-scorebug.mpdzs7g8b7.chatgpt.site/control</a></p>
    <div className="admin-user-list">
      {!loaded && <p>Loading users…</p>}
      {users.map(member => <div className="admin-user-row" key={member.email}>
        <div><strong>{member.email}</strong><small>{member.role === "owner" ? "Owner" : member.joined ? "Signed in" : "Ready to sign in"}</small></div>
        {member.role === "owner" || member.email === currentEmail ? <span>{member.role === "owner" ? "Owner · protected" : "Admin · you"}</span> : <>
          <label className="sr-only" htmlFor={`role-${member.email}`}>Access for {member.email}</label>
          <select id={`role-${member.email}`} value={member.role} disabled={busy} onChange={event => void save("save", member.email, event.target.value)}><option value="operator">Operator</option><option value="admin">Admin</option></select>
          {removing === member.email ? <div className="admin-remove-actions"><button disabled={busy} onClick={() => void save("remove", member.email)}>Confirm remove</button><button disabled={busy} onClick={() => setRemoving(null)}>Cancel</button></div> : <button disabled={busy} onClick={() => setRemoving(member.email)}>Remove</button>}
        </>}
      </div>)}
    </div>
    {message && <p className="control-message" role="status">{message}</p>}
  </section></main>;
}
