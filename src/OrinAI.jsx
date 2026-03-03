import { useState, useRef, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════
   ORIN AI — Performance Insights by Neuroid
   v6: In-memory users + API proxy
   ═══════════════════════════════════════ */

// In-memory user store — survives within session, no storage API needed
let _users = [
  { username: "laksh", password: "neuroid2024", role: "admin", name: "Laksh" },
  { username: "team", password: "orin@neuroid", role: "member", name: "Team Member" },
];
let _session = null;

function getUsers() { return _users; }
function saveUsers(u) { _users = u; }
function getSess() { return _session; }
function setSess(u) { _session = u; }
function clrSess() { _session = null; }

// API: /api/chat on Vercel (secure proxy), direct in Claude artifact
const API_URL = (typeof window !== "undefined" && (window.location.hostname.includes("vercel") || window.location.hostname === "localhost"))
  ? "/api/chat"
  : "https://api.anthropic.com/v1/messages";

const PF = { meta: { name: "Meta", icon: "\u{1F4D8}" }, google: { name: "Google", icon: "\u{1F50D}" }, shopify: { name: "Shopify", icon: "\u{1F6D2}" } };
const DRR = { "7": "7d", "14": "14d", "21": "21d", "30": "30d" };
function dateRange(d) { const e = new Date(), s = new Date(); s.setDate(e.getDate() - parseInt(d)); return { s: s.toISOString().split("T")[0], e: e.toISOString().split("T")[0] }; }

function sysPrompt() {
  return `You are Orin AI, the performance insights assistant built by Neuroid Media agency. You help the team extract and analyze performance data from Meta Ads, Google Ads, and Shopify via Windsor.ai MCP tools.

## BRAND IDENTIFICATION
User provides a brand keyword. You MUST:
1. FIRST call get_connectors to list all Windsor.ai connectors/accounts
2. Find accounts matching the brand keyword
3. Confirm found accounts, then pull data
If no match, list available accounts.

## DATA HANDLING
1. ALWAYS aggregate. NEVER dump raw rows.
2. Shopify: source "shopify", fields "order_total_price,order_count". SUM all rows. Size limit: add "date" to fields.
3. Meta: source "facebook", fields: spend,impressions,clicks,ctr,cpc,cpm,actions_purchase,action_values_purchase,actions_add_to_cart,actions_initiate_checkout. Campaign: +campaign. Ad set: +ad_group. Ad: +ad. Calculate ROAS/CPA.
4. Google: source "google_ads", fields: spend,impressions,clicks,ctr,cpc,conversions,conversion_value,cost_per_conversion.
5. WoW/MoM: Two calls, % change, side-by-side.

## FORMAT
**[Brand] — [Platform] ([Range])**
| Metric | Value |
|--------|-------|
Then 2-3 bullets.

NEVER show raw JSON. ALWAYS aggregate.
Tools: get_connectors (FIRST), get_data, get_fields, get_options.`;
}

/* ─── Login ─── */
function LoginModal({ onLogin }) {
  const [un, setUn] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState(""); const [shake, setShake] = useState(false);
  const [uf, setUf] = useState(false); const [pf, setPf] = useState(false);
  const go = () => {
    if (!un.trim() || !pw.trim()) { setErr("Enter both fields"); return; }
    const m = getUsers().find(u => u.username.toLowerCase() === un.trim().toLowerCase() && u.password === pw);
    if (m) { setSess(m); onLogin(m); } else { setErr("Invalid credentials"); setShake(true); setTimeout(() => setShake(false), 500); }
  };
  const iS = (f) => ({ width: "100%", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid " + (f ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.08)"), color: "#eee", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "all 0.3s", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, boxShadow: f ? "0 0 20px rgba(251,191,36,0.06)" : "none" });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(28px)", background: "rgba(9,9,11,0.75)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, padding: "36px 28px", borderRadius: 24, background: "rgba(18,18,24,0.95)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", animation: shake ? "shakeX 0.4s ease" : "modalIn 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 12px", background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 30px rgba(251,191,36,0.25)" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#09090b", fontFamily: "'Syne',sans-serif" }}>O</span>
          </div>
          <h2 style={{ color: "#fafafa", fontSize: 20, fontWeight: 800, margin: "0 0 4px", fontFamily: "'Syne',sans-serif" }}>Orin AI</h2>
          <p style={{ color: "#444", fontSize: 10, margin: 0, letterSpacing: 2.5, textTransform: "uppercase", fontFamily: "'Syne',sans-serif", fontWeight: 500 }}>Sign in to continue</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'Syne',sans-serif", fontWeight: 700, marginBottom: 6 }}>Username</label>
            <input type="text" value={un} onChange={e => { setUn(e.target.value); setErr(""); }} onFocus={() => setUf(true)} onBlur={() => setUf(false)} onKeyDown={e => e.key === "Enter" && go()} placeholder="Enter username" style={iS(uf)} autoFocus />
          </div>
          <div>
            <label style={{ display: "block", color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'Syne',sans-serif", fontWeight: 700, marginBottom: 6 }}>Password</label>
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }} onFocus={() => setPf(true)} onBlur={() => setPf(false)} onKeyDown={e => e.key === "Enter" && go()} placeholder="Enter password" style={iS(pf)} />
          </div>
          {err && <div style={{ fontSize: 12, color: "#ef4444", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, textAlign: "center" }}>{err}</div>}
          <button onClick={go} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)", color: "#09090b", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',sans-serif", boxShadow: "0 4px 20px rgba(251,191,36,0.25)", marginTop: 4 }}>Sign In</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Manage Users ─── */
function ManageUsers({ onClose, onUpdate }) {
  const [users, setUsers] = useState(getUsers());
  const [nu, setNu] = useState(""); const [np, setNp] = useState(""); const [nn, setNn] = useState(""); const [nr, setNr] = useState("member");
  const [msg, setMsg] = useState("");
  const add = () => {
    if (!nu.trim() || !np.trim()) return;
    if (users.find(u => u.username.toLowerCase() === nu.trim().toLowerCase())) { setMsg("Username exists!"); return; }
    const updated = [...users, { username: nu.trim().toLowerCase(), password: np.trim(), role: nr, name: nn.trim() || nu.trim() }];
    setUsers(updated); saveUsers(updated); if (onUpdate) onUpdate();
    setMsg("Added " + (nn.trim() || nu.trim()) + "!"); setNu(""); setNp(""); setNn("");
    setTimeout(() => setMsg(""), 2000);
  };
  const rm = i => { const updated = users.filter((_, idx) => idx !== i); setUsers(updated); saveUsers(updated); if (onUpdate) onUpdate(); };
  const fS = { width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#eee", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(28px)", background: "rgba(9,9,11,0.75)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto", padding: "28px 24px", borderRadius: 24, background: "rgba(18,18,24,0.95)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", animation: "modalIn 0.3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "#fafafa", fontSize: 17, fontWeight: 800, fontFamily: "'Syne',sans-serif", margin: 0 }}>Manage Team</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 22, padding: 0 }}>{"\u00D7"}</button>
        </div>
        <div style={{ marginBottom: 20 }}>{users.map((u, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 6 }}>
            <div><div style={{ color: "#eee", fontSize: 13, fontWeight: 600 }}>{u.name}</div><div style={{ color: "#555", fontSize: 10, fontFamily: "'Space Mono',monospace" }}>@{u.username} {"\u00B7"} {u.role}</div></div>
            <button onClick={() => rm(i)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>Remove</button>
          </div>
        ))}</div>
        <div style={{ padding: "16px 14px", borderRadius: 14, background: "rgba(251,191,36,0.03)", border: "1px solid rgba(251,191,36,0.1)" }}>
          <div style={{ color: "#fbbf24", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'Syne',sans-serif", fontWeight: 700, marginBottom: 10 }}>Add Member</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input type="text" value={nn} onChange={e => setNn(e.target.value)} placeholder="Display name" style={fS} />
            <input type="text" value={nu} onChange={e => setNu(e.target.value)} placeholder="Username" style={fS} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <input type="text" value={np} onChange={e => setNp(e.target.value)} placeholder="Password" style={fS} />
            <select value={nr} onChange={e => setNr(e.target.value)} style={{ ...fS, appearance: "none" }}><option value="member">Member</option><option value="admin">Admin</option></select>
          </div>
          <button onClick={add} disabled={!nu.trim() || !np.trim()} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: nu.trim() && np.trim() ? "linear-gradient(135deg,#fbbf24,#d97706)" : "rgba(255,255,255,0.05)", color: nu.trim() && np.trim() ? "#09090b" : "#444", fontSize: 12, fontWeight: 700, cursor: nu.trim() && np.trim() ? "pointer" : "default", fontFamily: "'Syne',sans-serif" }}>Add</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Markdown renderer ─── */
function Render({ text }) {
  if (!text) return null;
  const lines = text.split("\n"), els = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.includes("|") && i + 1 < lines.length && lines[i + 1] && /^\|[\s\-:|]+\|$/.test(lines[i + 1])) {
      const tl = []; let j = i; while (j < lines.length && lines[j].includes("|")) { tl.push(lines[j]); j++; }
      const hd = tl[0].split("|").map(h => h.trim()).filter(Boolean);
      const rw = tl.slice(2).map(r => r.split("|").map(c => c.trim()).filter(Boolean));
      els.push(<div key={"t" + i} style={{ margin: "12px 0", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(251,191,36,0.08)", background: "rgba(251,191,36,0.02)" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}><thead><tr>{hd.map((h, hi) => <th key={hi} style={{ padding: "10px 14px", textAlign: "left", borderBottom: "1px solid rgba(251,191,36,0.1)", color: "#fbbf24", fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, fontFamily: "'Syne',sans-serif", background: "rgba(251,191,36,0.04)" }}>{h}</th>)}</tr></thead><tbody>{rw.map((row, ri) => <tr key={ri} style={{ background: ri % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>{row.map((cell, ci) => { const b = cell.includes("**"); return <td key={ci} style={{ padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)", color: b ? "#fbbf24" : ci === 0 ? "#888" : "#eee", fontSize: 12.5, fontWeight: b ? 700 : ci === 0 ? 400 : 500, fontFamily: ci > 0 ? "'Space Mono',monospace" : "'DM Sans',sans-serif" }}>{cell.replace(/\*\*/g, "")}</td>; })}</tr>)}</tbody></table></div>);
      i = j; continue;
    }
    if (ln.startsWith("**") && ln.endsWith("**")) { els.push(<div key={"b" + i} style={{ color: "#fafafa", fontSize: 14, fontWeight: 700, margin: "14px 0 6px", fontFamily: "'Syne',sans-serif" }}>{ln.replace(/\*\*/g, "")}</div>); i++; continue; }
    if (/^[-*\u2022]\s/.test(ln)) { els.push(<div key={"l" + i} style={{ display: "flex", gap: 10, margin: "5px 0", paddingLeft: 4 }}><span style={{ color: "#fbbf24", flexShrink: 0, fontSize: 6, marginTop: 6 }}>{"\u25C6"}</span><span style={{ color: "#b0b0b0", fontSize: 12.5, lineHeight: 1.6 }}>{inl(ln.replace(/^[-*\u2022]\s/, ""))}</span></div>); i++; continue; }
    if (ln.trim() === "") { els.push(<div key={"e" + i} style={{ height: 8 }} />); i++; continue; }
    els.push(<div key={"p" + i} style={{ color: "#b0b0b0", fontSize: 12.5, lineHeight: 1.7, margin: "2px 0" }}>{inl(ln)}</div>); i++;
  }
  return <>{els}</>;
}
function inl(t) { const p = [], rx = /\*\*(.*?)\*\*/g; let l = 0, m; while ((m = rx.exec(t)) !== null) { if (m.index > l) p.push(<span key={l}>{t.slice(l, m.index)}</span>); p.push(<strong key={"s" + m.index} style={{ color: "#f5f5f5", fontWeight: 600 }}>{m[1]}</strong>); l = rx.lastIndex; } if (l < t.length) p.push(<span key={"e" + l}>{t.slice(l)}</span>); return p.length > 0 ? p : t; }

function Bubble({ msg }) {
  const u = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: u ? "flex-end" : "flex-start", marginBottom: 16 }}>
      {!u && <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 4, flexShrink: 0, boxShadow: "0 4px 16px rgba(251,191,36,0.3)" }}><span style={{ fontSize: 13, fontWeight: 800, color: "#09090b", fontFamily: "'Syne',sans-serif" }}>O</span></div>}
      <div style={{ maxWidth: u ? "75%" : "88%", padding: u ? "11px 16px" : "14px 16px", borderRadius: u ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: u ? "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)" : "rgba(255,255,255,0.03)", color: u ? "#09090b" : "#e0e0e0", fontSize: 13, lineHeight: 1.6, border: u ? "none" : "1px solid rgba(255,255,255,0.05)", backdropFilter: u ? "none" : "blur(24px)", boxShadow: u ? "0 4px 20px rgba(251,191,36,0.25)" : "0 2px 16px rgba(0,0,0,0.15)" }}>
        {msg.loading ? <div style={{ display: "flex", gap: 8, padding: "4px 0", alignItems: "center" }}><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(251,191,36,0.2)", borderTopColor: "#fbbf24", animation: "spin 0.7s linear infinite" }} /><span style={{ fontSize: 11, color: "#666", fontFamily: "'Syne',sans-serif", letterSpacing: .5, fontWeight: 500 }}>Orin AI is analyzing...</span></div> : u ? <span style={{ fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{msg.content}</span> : <Render text={msg.content} />}
      </div>
    </div>
  );
}

function QA({ label, icon, onClick }) {
  const [h, setH] = useState(false);
  return <button onClick={onClick} onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ background: h ? "rgba(251,191,36,0.07)" : "rgba(255,255,255,0.015)", border: "1px solid " + (h ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.05)"), borderRadius: 12, padding: "12px 14px", color: h ? "#fbbf24" : "#777", fontSize: 12, cursor: "pointer", textAlign: "left", transition: "all 0.3s", display: "flex", alignItems: "center", gap: 10, transform: h ? "translateY(-1px)" : "none" }}><span style={{ fontSize: 16, flexShrink: 0, filter: h ? "none" : "grayscale(0.6) brightness(0.7)", transition: "filter 0.3s" }}>{icon}</span><span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>{label}</span></button>;
}

/* ─── MAIN ─── */
export default function OrinAI() {
  const [user, setUser] = useState(getSess());
  const [mgr, setMgr] = useState(false);
  const [, forceUpdate] = useState(0);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [ld, setLd] = useState(false);
  const [bq, setBq] = useState("");
  const [rng, setRng] = useState("7");
  const [pl, setPl] = useState(["meta"]);
  const [ctx, setCtx] = useState(false);
  const [foc, setFoc] = useState(false);
  const [bf, setBf] = useState(false);
  const ref = useRef(null);

  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  const tP = p => setPl(v => v.includes(p) ? (v.length > 1 ? v.filter(x => x !== p) : v) : [...v, p]);
  const logout = () => { clrSess(); setUser(null); setMsgs([]); };

  const proc = useCallback(raw => {
    try {
      const d = JSON.parse(raw); if (!d.data || !Array.isArray(d.data) || !d.data.length) return null;
      const data = d.data, k = Object.keys(data[0]);
      if ((k.includes("order_total_price") || k.includes("order_count")) && data.length > 3) {
        let r = 0, o = 0; data.forEach(x => { r += parseFloat(x.order_total_price || 0); o += parseFloat(x.order_count || 1); });
        return "| Metric | Value |\n|--------|-------|\n| Total Revenue | \u20B9" + Math.round(r).toLocaleString("en-IN") + " |\n| Total Orders | " + Math.round(o) + " |\n| AOV | \u20B9" + Math.round(r / (o || 1)).toLocaleString("en-IN") + " |";
      }
      if ((k.includes("spend") || k.includes("impressions")) && data.length > 5 && !k.includes("campaign") && !k.includes("ad_group") && !k.includes("ad")) {
        const a = {}; k.forEach(x => { a[x] = 0; }); data.forEach(x => { k.forEach(y => { a[y] += parseFloat(x[y] || 0); }); });
        if (a.impressions > 0) { a.ctr = a.clicks / a.impressions * 100; a.cpm = a.spend / a.impressions * 1000; }
        if (a.clicks > 0) a.cpc = a.spend / a.clicks;
        const n = { spend: "Spend", impressions: "Impressions", clicks: "Clicks", ctr: "CTR", cpc: "CPC", cpm: "CPM", actions_purchase: "Purchases", action_values_purchase: "Purchase Value", actions_add_to_cart: "Add to Cart", actions_initiate_checkout: "Init. Checkout", conversions: "Conversions", conversion_value: "Conv. Value", cost_per_conversion: "Cost/Conv" };
        const f = (x, v) => { if (["spend", "action_values_purchase", "conversion_value"].includes(x)) return "\u20B9" + Math.round(v).toLocaleString("en-IN"); if (x === "ctr") return v.toFixed(2) + "%"; if (["cpc", "cpm", "cost_per_conversion"].includes(x)) return "\u20B9" + v.toFixed(2); return v % 1 === 0 ? v.toLocaleString() : v.toFixed(2); };
        let t = "| Metric | Value |\n|--------|-------|\n";
        k.filter(x => a[x] !== 0 && n[x]).forEach(x => { t += "| " + n[x] + " | " + f(x, a[x]) + " |\n"; });
        if (a.action_values_purchase && a.spend) t += "| **ROAS** | **" + (a.action_values_purchase / a.spend).toFixed(2) + "x** |\n";
        if (a.actions_purchase && a.spend) t += "| **CPA** | **\u20B9" + Math.round(a.spend / a.actions_purchase).toLocaleString("en-IN") + "** |\n";
        return t;
      }
      return null;
    } catch { return null; }
  }, []);

  const send = async text => {
    if (!text.trim() || ld) return;
    setMsgs(p => [...p, { role: "user", content: text.trim() }, { role: "assistant", loading: true, content: "" }]);
    setInput(""); setLd(true);
    try {
      const hist = msgs.filter(m => !m.loading).map(m => ({ role: m.role, content: m.content }));
      let e = text.trim();
      if (bq.trim()) e += "\n\n[BRAND: \"" + bq.trim() + "\". Use get_connectors first to find matching accounts, then pull data.]";
      else e += "\n\n[No brand set. If query mentions a brand, use get_connectors. Otherwise ask which brand.]";
      const dr = dateRange(rng); e += "\n[Date: " + dr.s + " to " + dr.e + " (" + rng + "d)]";
      e += "\n[Platforms: " + pl.map(p => PF[p].name).join(", ") + "]";
      const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system: sysPrompt(), messages: [...hist, { role: "user", content: e }], mcp_servers: [{ type: "url", url: "https://mcp.windsor.ai", name: "windsor-ai" }] }) });
      const data = await r.json(); let parts = [], hasT = false;
      if (data.content && Array.isArray(data.content)) { for (const b of data.content) { if (b.type === "text" && b.text) { parts.push(b.text); hasT = true; } else if (b.type === "mcp_tool_result") { const rs = (b.content || []).filter(c => c.type === "text").map(c => c.text); for (const rt of rs) { const fmt = proc(rt); if (fmt && !hasT) parts.push(fmt); } } } }
      const clean = parts.filter(p => { const t = p.trim(); return !(t.startsWith("[{") && t.endsWith("}]")) && !t.startsWith("{\"order_count\"") && !((t.match(/\{"order_count"/g) || []).length > 3) && !((t.match(/\{"spend"/g) || []).length > 5); });
      setMsgs(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: clean.join("\n\n") || "Couldn't retrieve data. Try a different brand keyword." }; return u; });
    } catch (err) { setMsgs(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: "Error: " + (err.message || "Connection failed.") }; return u; }); } finally { setLd(false); }
  };

  const qas = [
    { label: "Full performance summary", icon: "\u{1F4CA}", text: "Pull full performance summary with spend, purchases, ROAS, CPC, CPM" },
    { label: "WoW comparison", icon: "\u{1F4C8}", text: "Compare this week vs last week - spend, purchases, ROAS, CPC" },
    { label: "Campaign breakdown", icon: "\u{1F3AF}", text: "Campaign-level breakdown with spend, purchases, ROAS per campaign" },
    { label: "Revenue & orders", icon: "\u{1F6D2}", text: "Total Shopify orders and revenue summary" },
    { label: "Google Ads overview", icon: "\u{1F50D}", text: "Google Ads - spend, clicks, conversions, cost per conversion" },
    { label: "Creative fatigue", icon: "\u{1F3A8}", text: "Ad-level data to spot creative fatigue - CTR, CPC, frequency" },
  ];

  const tag = (t, gold) => <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: gold ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)", color: gold ? "#fbbf24" : "#555", border: "1px solid " + (gold ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"), letterSpacing: .3, fontFamily: "'Syne',sans-serif", whiteSpace: "nowrap" }}>{t}</span>;
  const btn = a => ({ padding: "5px 11px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid " + (a ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.06)"), background: a ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.02)", color: a ? "#fbbf24" : "#555", transition: "all 0.25s", fontFamily: "'Syne',sans-serif", letterSpacing: .3, whiteSpace: "nowrap" });

  return (
    <div style={{ width: "100%", height: "100vh", maxHeight: "100dvh", background: "#09090b", display: "flex", flexDirection: "column", fontFamily: "'DM Sans','Inter',-apple-system,sans-serif", overflow: "hidden", position: "relative" }}>
      {!user && <LoginModal onLogin={setUser} />}
      {mgr && <ManageUsers onClose={() => setMgr(false)} onUpdate={() => forceUpdate(n => n + 1)} />}

      {/* Ambient */}
      <div style={{ position: "absolute", top: -160, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Mono:wght@400;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalIn{from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes shakeX{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 24px rgba(251,191,36,0.15)}50%{box-shadow:0 0 32px rgba(251,191,36,0.25)}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(251,191,36,0.1);border-radius:4px}
        input::placeholder{color:#333}
        * { box-sizing: border-box; }
      `}</style>

      {/* ─── HEADER: 2 rows on mobile ─── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(9,9,11,0.85)", backdropFilter: "blur(24px)", flexShrink: 0, zIndex: 1 }}>
        {/* Row 1: Logo + user info + actions */}
        <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(251,191,36,0.3)", animation: "pulseGlow 4s ease-in-out infinite", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#09090b", fontFamily: "'Syne',sans-serif" }}>O</span>
            </div>
            <div>
              <div style={{ color: "#fafafa", fontWeight: 800, fontSize: 15, fontFamily: "'Syne',sans-serif", letterSpacing: -.3 }}>Orin AI</div>
              <div style={{ color: "#444", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Syne',sans-serif", fontWeight: 500 }}>Performance Insights</div>
            </div>
          </div>
          {/* Right side: user + buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 2 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fbbf24", fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>{(user.name || user.username)[0].toUpperCase()}</div>
                <span style={{ color: "#888", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{user.name}</span>
              </div>
            )}
            {user?.role === "admin" && <button onClick={() => setMgr(true)} style={btn(false)}>Team</button>}
            <button onClick={() => { setMsgs([]); setInput(""); }} style={btn(false)}>Clear</button>
            <button onClick={() => setCtx(!ctx)} style={btn(ctx)}>Filters</button>
            {user && <button onClick={logout} style={{ ...btn(false), color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}>Logout</button>}
          </div>
        </div>

        {/* Row 2: Filters — collapsible */}
        {ctx && (
          <div style={{ padding: "10px 16px 12px", borderTop: "1px solid rgba(255,255,255,0.03)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", animation: "fadeUp 0.2s ease" }}>
            {/* Brand */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 140, maxWidth: 240 }}>
              <label style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>Brand</label>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={bf || bq ? "#fbbf24" : "#333"} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input type="text" value={bq} onChange={e => setBq(e.target.value)} onFocus={() => setBf(true)} onBlur={() => setBf(false)} placeholder="Brand name..." style={{ width: "100%", padding: "7px 28px 7px 30px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid " + (bf ? "rgba(251,191,36,0.4)" : bq ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)"), color: "#eee", fontSize: 12, outline: "none", boxSizing: "border-box", transition: "all 0.25s", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }} />
                {bq && <button onClick={() => setBq("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, padding: 0 }}>{"\u00D7"}</button>}
              </div>
            </div>
            {/* Range */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>Range</label>
              <div style={{ display: "flex", gap: 3 }}>{Object.entries(DRR).map(([d, l]) => <button key={d} onClick={() => setRng(d)} style={btn(rng === d)}>{l}</button>)}</div>
            </div>
            {/* Platforms */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>Platforms</label>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{Object.entries(PF).map(([k, p]) => <button key={k} onClick={() => tP(k)} style={btn(pl.includes(k))}>{p.icon} {p.name}</button>)}</div>
            </div>
          </div>
        )}
      </div>

      {/* ─── CHAT ─── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", zIndex: 1, filter: user ? "none" : "blur(8px)", pointerEvents: user ? "auto" : "none", minHeight: 0 }}>
        {msgs.length === 0 ? (
          <div style={{ maxWidth: 500, margin: "0 auto", paddingTop: 24, animation: "fadeUp 0.5s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 14px", background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 36px rgba(251,191,36,0.25)", animation: "pulseGlow 4s ease-in-out infinite" }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#09090b", fontFamily: "'Syne',sans-serif" }}>O</span>
              </div>
              <h1 style={{ color: "#fafafa", fontSize: 26, fontWeight: 800, margin: "0 0 4px", fontFamily: "'Syne',sans-serif", letterSpacing: -.5 }}>Orin AI</h1>
              <p style={{ color: "#555", fontSize: 11, margin: 0, letterSpacing: 2.5, textTransform: "uppercase", fontFamily: "'Syne',sans-serif", fontWeight: 600 }}>Performance Insights by Neuroid</p>
              {user && <p style={{ color: "#666", fontSize: 12, margin: "8px 0 0", fontFamily: "'DM Sans',sans-serif" }}>Welcome back, <span style={{ color: "#fbbf24", fontWeight: 600 }}>{user.name}</span></p>}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 18, flexWrap: "wrap" }}>
              {bq ? tag(bq, true) : tag("No brand set", false)}
              {tag(rng + " days", false)}
              {pl.map(p => <span key={p}>{tag(PF[p]?.icon + " " + PF[p]?.name, false)}</span>)}
            </div>
            {!bq && <div style={{ textAlign: "center", margin: "0 auto 20px", padding: "14px 18px", borderRadius: 12, background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.1)", fontSize: 12, color: "#a78a1e", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, maxWidth: 400 }}>Tap <strong style={{ color: "#fbbf24" }}>Filters</strong> above and enter a brand name to begin.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{qas.map((q, i) => <QA key={i} label={q.label} icon={q.icon} onClick={() => send(q.text)} />)}</div>
          </div>
        ) : msgs.map((m, i) => <Bubble key={i} msg={m} />)}
        <div ref={ref} />
      </div>

      {/* ─── INPUT ─── */}
      <div style={{ padding: "8px 16px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(9,9,11,0.9)", backdropFilter: "blur(24px)", flexShrink: 0, zIndex: 1 }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 7, flexWrap: "wrap" }}>
          {bq ? tag(bq, true) : tag("No brand", false)}
          {tag(rng + "d", false)}
          {pl.map(p => <span key={p}>{tag(PF[p]?.icon + " " + PF[p]?.name, false)}</span>)}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} placeholder={bq ? "Ask Orin about " + bq + "..." : "Open Filters & set a brand first..."} disabled={ld || !user} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid " + (foc ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.06)"), color: "#eee", fontSize: 13, outline: "none", transition: "all 0.3s", fontFamily: "'DM Sans',sans-serif", fontWeight: 500, boxShadow: foc ? "0 0 20px rgba(251,191,36,0.05)" : "none", minWidth: 0 }} />
          <button onClick={() => send(input)} disabled={ld || !input.trim() || !user} style={{ width: 42, height: 42, borderRadius: 12, background: input.trim() ? "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)" : "rgba(255,255,255,0.03)", border: "1px solid " + (input.trim() ? "transparent" : "rgba(255,255,255,0.06)"), cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: input.trim() ? "#09090b" : "#333", opacity: ld ? .5 : 1, transition: "all 0.3s", boxShadow: input.trim() ? "0 4px 16px rgba(251,191,36,0.3)" : "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
