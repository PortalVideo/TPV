import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://rgcebqgkrqpxjhcfyuiq.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY2VicWdrcnFweGpoY2Z5dWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Njg1OTcsImV4cCI6MjA5MTA0NDU5N30.RJVxExApYB2CAFdA8dITiVRA0CFQ26eu1YlzScjSk3g";
const GCAL_CLIENT_ID = process.env.REACT_APP_GCAL_CLIENT_ID || "1095246910350-16r6t0vqfoi9u3ivnqmtp376s876rf9q.apps.googleusercontent.com";
const GCAL_SCOPES = "https://www.googleapis.com/auth/calendar.events";

async function sbFetch(path, options = {}, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  if (!text) return null;
  const parsed = JSON.parse(text);
  // Supabase sometimes returns [] for POST even with return=representation — retry with select
  if (Array.isArray(parsed) && parsed.length === 0 && options.method === "POST") {
    const sel = await fetch(`${SUPABASE_URL}/rest/v1/${path.split("?")[0]}?order=id.desc&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}`, "Content-Type": "application/json" },
    });
    const selText = await sel.text();
    return selText ? JSON.parse(selText) : null;
  }
  return parsed;
}

async function sbAuth(action, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${action}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "שגיאת התחברות");
  return data;
}

const SHOOT_TYPES = ["חתונות / אירועים", "תוכן לרשתות חברתיות", "פרסומות / קומרשיאל", "קליפים מוזיקליים", "תדמית לעסקים", "אחר"];
const initialForm = { date: "", clientName: "", location: "", phone: "05", price: "", deposit: "", type: "חתונות / אירועים", notes: "", calendarEventId: null, package: "", drone: false, vintage: false, depositPaid: false, fullPaid: false, productionStatus: "", remind90: false };

function fmt(n) { return Number(n || 0).toLocaleString("he-IL") + " ₪"; }
function getCurrentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function today() { return new Date().toISOString().split("T")[0]; }

// ── SVG Icons (line style) ────────────────────────────────────
const Icon = {
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  history: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  finance: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  plus: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  menu: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  expense: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  chart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  yearly: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  newEvent: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
};

// ── Animated Screen Wrapper ────────────────────────────────────
function Screen({ children, visible }) {
  const [mounted, setMounted] = useState(visible);
  const [opacity, setOpacity] = useState(visible ? 1 : 0);
  useEffect(() => {
    if (visible) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setOpacity(1))); }
    else { setOpacity(0); const t = setTimeout(() => setMounted(false), 280); return () => clearTimeout(t); }
  }, [visible]);
  if (!mounted) return null;
  return <div style={{ opacity, transition: "opacity 0.28s ease", position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%" }}>{children}</div>;
}

// ── Floating Modal ─────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (open) { requestAnimationFrame(() => requestAnimationFrame(() => setShow(true))); }
    else { setShow(false); }
  }, [open]);
  if (!open && !show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", opacity: show ? 1 : 0, transition: "opacity 0.28s ease" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: 520, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", borderRadius: "24px 24px 0 0", padding: "0 0 env(safe-area-inset-bottom)", boxShadow: "0 -8px 40px rgba(15,23,42,0.15)", transform: show ? "translateY(0)" : "translateY(100%)", transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }} onClick={onClose}>{Icon.close}</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{title}</div>
          <div style={{ width: 28 }} />
        </div>
        <div style={{ padding: "16px 20px 32px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Calendar (Month + Year view) ──────────────────────────────
function MiniCalendar({ shoots }) {
  const [cur, setCur] = useState(new Date());
  const [calView, setCalView] = useState("month"); // "month" | "year"
  const y = cur.getFullYear(), m = cur.getMonth();
  const MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const DAY_NAMES = ["א","ב","ג","ד","ה","ו","ש"];
  const td = new Date();

  // Shoots per month for year view
  const shootsPerMonth = {};
  shoots.forEach(s => {
    if (!s.date) return;
    const key = s.date.slice(0,7);
    shootsPerMonth[key] = (shootsPerMonth[key]||0) + 1;
  });

  // Month view cells
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m+1, 0).getDate();
  const shootDates = {};
  shoots.forEach(s => { if (!s.date) return; const d = new Date(s.date); if (d.getFullYear()===y && d.getMonth()===m) shootDates[d.getDate()] = s; });
  const isToday = d => d===td.getDate() && m===td.getMonth() && y===td.getFullYear();
  const cells = []; const start = (first+1)%7;
  for (let i=0;i<start;i++) cells.push(null);
  for (let d=1;d<=days;d++) cells.push(d);

  return (
    <div style={S.calWrap}>
      <div style={S.calHead}>
        {calView==="month" ? (
          <>
            <button style={S.calNav} onClick={()=>setCur(new Date(y,m-1,1))}>‹</button>
            <button style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setCalView("year")}>
              <span style={{...S.calTitle,color:"#1d4ed8",textDecoration:"underline",textDecorationStyle:"dotted"}}>{MONTHS[m]} {y}</span>
            </button>
            <button style={S.calNav} onClick={()=>setCur(new Date(y,m+1,1))}>›</button>
          </>
        ) : (
          <>
            <button style={S.calNav} onClick={()=>setCur(new Date(y-1,0,1))}>‹</button>
            <button style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setCalView("month")}>
              <span style={{...S.calTitle,color:"#1d4ed8"}}>{y}</span>
            </button>
            <button style={S.calNav} onClick={()=>setCur(new Date(y+1,0,1))}>›</button>
          </>
        )}
      </div>

      {calView==="month" ? (
        <div style={S.calGrid}>
          {DAY_NAMES.map(d=><div key={d} style={S.calDayName}>{d}</div>)}
          {cells.map((d,i)=>(
            <div key={i} style={{ ...S.calCell, ...(d&&isToday(d)?S.calToday:{}), ...(d&&shootDates[d]?S.calHasShoot:{}), ...(d===null?{background:"transparent",border:"none"}:{}) }}>
              {d && <span style={{ fontSize: 12, fontWeight: isToday(d)?800:500, color: isToday(d)?"#fff": shootDates[d]?"#1d4ed8":"#334155" }}>{d}</span>}
              {d && shootDates[d] && <div style={S.calDot}/>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}}>
          {MONTHS.map((mn,i)=>{
            const key = `${y}-${String(i+1).padStart(2,"0")}`;
            const count = shootsPerMonth[key]||0;
            const isCurMonth = i===td.getMonth() && y===td.getFullYear();
            return (
              <button key={i} onClick={()=>{setCur(new Date(y,i,1));setCalView("month");}} style={{
                padding:"10px 6px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",
                background:isCurMonth?"linear-gradient(135deg,#1d4ed8,#3b82f6)":count>0?"rgba(239,246,255,0.9)":"rgba(248,250,252,0.6)",
                position:"relative",transition:"all 0.15s"
              }}>
                <div style={{fontSize:13,fontWeight:600,color:isCurMonth?"#fff":count>0?"#1d4ed8":"#64748b"}}>{mn}</div>
                {count>0&&<div style={{fontSize:10,marginTop:2,fontWeight:700,color:isCurMonth?"rgba(255,255,255,0.8)":"#3b82f6"}}>{count} 🎬</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Payment Badge ──────────────────────────────────────────────
function PayBadge({ shoot, onUpdate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const status = shoot.paymentStatus || "לא שולם";
  const cfg = { "שולם": { bg:"#eff6ff", color:"#1d4ed8", border:"#bfdbfe", label:"שולם במלואו" }, "מקדמה": { bg:"#fefce8", color:"#92400e", border:"#fde68a", label:"מקדמה" }, "לא שולם": { bg:"#fef2f2", color:"#991b1b", border:"#fecaca", label:"לא שולם" } };
  const c = cfg[status] || cfg["לא שולם"];
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={e=>{ e.stopPropagation(); setOpen(o=>!o); }} style={{ ...S.payBadge, background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>
        {c.label} ▾
      </button>
      {open && (
        <div style={S.payMenu}>
          {["לא שולם","מקדמה","שולם"].map(s => {
            const sc = cfg[s];
            return (
              <button key={s} style={{ ...S.payMenuItem, color: status===s ? "#1d4ed8":"#334155", fontWeight: status===s?700:500 }}
                onClick={e=>{ e.stopPropagation(); onUpdate(s); setOpen(false); }}>
                <span style={{ width:16, display:"inline-flex", opacity: status===s?1:0 }}>{Icon.check}</span>
                {sc.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shoot Card ─────────────────────────────────────────────────
// ── Minimal Home Card (read-only) ─────────────────────────────
function HomeCard({ shoot }) {
  const isFuture = shoot.date >= today();
  const daysSince = shoot.date ? Math.floor((new Date()-new Date(shoot.date))/(1000*60*60*24)) : 0;
  const daysLeft = 90 - daysSince;
  const showDeadline = !isFuture && shoot.productionStatus !== "סגור" && daysSince <= 100;
  const deadlineUrgent = daysLeft <= 14 && daysLeft > 0;
  const deadlinePassed = daysLeft <= 0;
  return (
    <div style={{...S.shootCard,padding:"12px 14px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{shoot.clientName}</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>
            {shoot.date}{shoot.location?" · "+shoot.location:""}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {showDeadline&&(
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:deadlinePassed?"rgba(254,242,242,0.9)":deadlineUrgent?"rgba(255,247,237,0.9)":"rgba(241,245,249,0.8)",color:deadlinePassed?"#dc2626":deadlineUrgent?"#c2410c":"#64748b",fontWeight:700}}>
              {deadlinePassed?`פג! +${Math.abs(daysLeft)}י`:`${daysLeft}י`}
            </span>
          )}
          <div style={{fontSize:10,padding:"3px 8px",borderRadius:12,background:isFuture?"rgba(239,246,255,0.9)":"rgba(241,245,249,0.8)",color:isFuture?"#1d4ed8":"#94a3b8",fontWeight:600}}>{isFuture?"קרוב":"עבר"}</div>
        </div>
      </div>
    </div>
  );
}

// ── Expandable Event Card (history page) ──────────────────────
function ShootCard({ shoot, onEdit, onDelete, onUpdatePayment, onUpdateProduction, animate, expandable=true }) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prodMenuOpen, setProdMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef(null);
  const prodRef = useRef(null);
  const dep = parseFloat(shoot.deposit)||0;
  const total = parseFloat(shoot.price)||0;
  const rem = total - dep;

  useEffect(() => {
    const h = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (prodRef.current && !prodRef.current.contains(e.target)) setProdMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const PROD_CFG = {"צולם":{bg:"rgba(239,246,255,0.9)",color:"#1d4ed8"},"בעריכה":{bg:"rgba(254,249,195,0.9)",color:"#854d0e"},"נשלח ללקוח":{bg:"rgba(220,252,231,0.9)",color:"#166534"},"סגור":{bg:"rgba(241,245,249,0.9)",color:"#64748b"}};
  const daysSince = shoot.date ? Math.floor((new Date()-new Date(shoot.date))/(1000*60*60*24)) : 0;
  const isLate = shoot.productionStatus==="צולם" && daysSince>7;
  const prodColor = shoot.productionStatus ? (PROD_CFG[shoot.productionStatus]||PROD_CFG["צולם"]) : null;

  function PencilMenu() {
    return (
      <div ref={menuRef} style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
        <button onClick={e=>{e.stopPropagation();setMenuOpen(o=>!o);}} style={{background:"rgba(248,250,252,0.9)",border:"1px solid rgba(226,232,240,0.7)",borderRadius:8,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",flexShrink:0}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        {menuOpen&&(
          <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,background:"#fff",border:"1px solid rgba(226,232,240,0.8)",borderRadius:12,padding:6,zIndex:200,boxShadow:"0 8px 24px rgba(15,23,42,0.15)",minWidth:120}}>
            <button onClick={()=>{setMenuOpen(false);onEdit(shoot);}} style={{width:"100%",background:"transparent",border:"none",textAlign:"right",padding:"9px 12px",fontSize:13,color:"#1d4ed8",cursor:"pointer",fontFamily:"inherit",fontWeight:600,borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              עריכה
            </button>
            <button onClick={()=>{setMenuOpen(false);setConfirmDelete(true);}} style={{width:"100%",background:"transparent",border:"none",textAlign:"right",padding:"9px 12px",fontSize:13,color:"#ef4444",cursor:"pointer",fontFamily:"inherit",fontWeight:600,borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              מחיקה
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{...S.shootCard,opacity:animate?1:0,marginBottom:8}}>
      {/* Always visible: collapsed row */}
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:expandable?"pointer":"default"}} onClick={()=>expandable&&setExpanded(o=>!o)}>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{shoot.clientName}</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>
            {shoot.date}{shoot.location?" · "+shoot.location:""}
          </div>
        </div>
        {/* Package + production + deadline badges always visible */}
        <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
          {shoot.package&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"rgba(219,234,254,0.7)",color:"#1e40af",fontWeight:600}}>{shoot.package}</span>}
          {shoot.productionStatus&&prodColor&&(
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:isLate?"rgba(254,242,242,0.9)":prodColor.bg,color:isLate?"#dc2626":prodColor.color,fontWeight:700}}>{isLate?"⚠️":""}{shoot.productionStatus}</span>
          )}
          {(()=>{
            if(shoot.date>=today()||shoot.productionStatus==="סגור") return null;
            const ds=Math.floor((new Date()-new Date(shoot.date))/(1000*60*60*24));
            const dl=90-ds;
            if(ds>100) return null;
            return <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:dl<=0?"rgba(254,242,242,0.9)":dl<=14?"rgba(255,247,237,0.9)":"rgba(241,245,249,0.8)",color:dl<=0?"#dc2626":dl<=14?"#c2410c":"#64748b",fontWeight:700}}>{dl<=0?`פג! +${Math.abs(dl)}י`:`${dl}י`}</span>;
          })()}
          <PencilMenu/>
          {expandable&&<span style={{fontSize:14,color:"#94a3b8",transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s",display:"flex"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>}
        </div>
      </div>

      {/* Expanded content */}
      {expanded&&(
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(226,232,240,0.5)"}}>
          {/* Tags */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            <span style={S.shootType}>{shoot.type}</span>
            {shoot.drone&&<span style={{...S.shootType,background:"rgba(240,249,255,0.8)",color:"#0369a1"}}>🚁</span>}
            {shoot.vintage&&<span style={{...S.shootType,background:"rgba(254,249,240,0.8)",color:"#92400e"}}>📼</span>}
            {shoot.depositPaid&&<span style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:"rgba(254,249,195,0.8)",color:"#854d0e",fontWeight:700}}>✓ מקדמה</span>}
            {shoot.fullPaid&&<span style={{fontSize:11,padding:"3px 8px",borderRadius:20,background:"rgba(220,252,231,0.8)",color:"#166534",fontWeight:700}}>✓ שולם</span>}
          </div>

          {/* Finance */}
          <div style={{display:"flex",gap:16,marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{fmt(total)}</span>
            {dep>0&&<span style={{fontSize:12,color:"#64748b"}}>מקדמה: <strong style={{color:"#1d4ed8"}}>{fmt(dep)}</strong></span>}
            {dep>0&&<span style={{fontSize:12,color:"#64748b"}}>יתרה: <strong style={{color:"#0369a1"}}>{fmt(rem)}</strong></span>}
          </div>

          {/* Production status dropdown */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>הפקה:</span>
            <div ref={prodRef} style={{position:"relative"}}>
              <button onClick={e=>{e.stopPropagation();setProdMenuOpen(o=>!o);}} style={{background:shoot.productionStatus?(PROD_CFG[shoot.productionStatus]?.bg||"rgba(241,245,249,0.8)"):"rgba(241,245,249,0.8)",border:"1px solid rgba(226,232,240,0.7)",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:shoot.productionStatus?(PROD_CFG[shoot.productionStatus]?.color||"#64748b"):"#94a3b8",display:"flex",alignItems:"center",gap:4}}>
                {shoot.productionStatus||"לא הוגדר"} ▾
              </button>
              {prodMenuOpen&&(
                <div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"#fff",border:"1px solid rgba(226,232,240,0.8)",borderRadius:10,padding:6,zIndex:100,boxShadow:"0 8px 24px rgba(15,23,42,0.12)",minWidth:140}}>
                  {["צולם","בעריכה","נשלח ללקוח","סגור"].map(s=>(
                    <button key={s} onClick={e=>{e.stopPropagation();onUpdateProduction(shoot.id,s);setProdMenuOpen(false);}} style={{width:"100%",background:shoot.productionStatus===s?"rgba(239,246,255,0.9)":"transparent",border:"none",textAlign:"right",padding:"8px 12px",fontSize:13,color:shoot.productionStatus===s?"#1d4ed8":"#334155",cursor:"pointer",fontFamily:"inherit",fontWeight:shoot.productionStatus===s?700:500,borderRadius:8}}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action icons only */}
          <div style={{display:"flex",gap:10}}>
            {shoot.phone&&<button onClick={e=>{e.stopPropagation();window.open("tel:"+shoot.phone);}} style={S.iconOnlyBtn} title={shoot.phone}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></button>}
            {shoot.phone&&<button onClick={e=>{e.stopPropagation();const p=(shoot.phone||"").replace(/[^0-9]/g,"");const m=encodeURIComponent("היי "+shoot.clientName+"! מאשר את יום הצילום שלנו בתאריך "+shoot.date+(shoot.location?" ב"+shoot.location:"")+". מחכה לראותך! טל פורת וידאו");window.open("https://wa.me/972"+p.replace(/^0/,"")+"?text="+m);}} style={{...S.iconOnlyBtn,color:"#128c7e"}} title="WhatsApp"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>}
            {shoot.location&&<button onClick={e=>{e.stopPropagation();window.open("https://waze.com/ul?q="+encodeURIComponent(shoot.location)+"&navigate=yes");}} style={{...S.iconOnlyBtn,color:"#166534"}} title="Waze"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C12.95 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg></button>}
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setConfirmDelete(false)}>
          <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(4px)"}}/>
          <div style={{position:"relative",background:"#fff",borderRadius:20,padding:28,maxWidth:320,width:"100%",boxShadow:"0 20px 60px rgba(15,23,42,0.2)",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:48,height:48,borderRadius:24,background:"rgba(254,242,242,0.9)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
            <div style={{fontSize:17,fontWeight:800,color:"#0f172a",marginBottom:8}}>מחיקת אירוע</div>
            <div style={{fontSize:14,color:"#64748b",marginBottom:24}}>האם אתה בטוח שברצונך למחוק את האירוע של <strong>{shoot.clientName}</strong>?</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"12px",borderRadius:12,border:"1px solid rgba(226,232,240,0.8)",background:"rgba(248,250,252,0.9)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#64748b"}}>ביטול</button>
              <button onClick={e=>{e.stopPropagation();setConfirmDelete(false);onDelete(shoot.id);}} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#dc2626,#ef4444)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",color:"#fff"}}>מחק</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [authForm, setAuthForm] = useState({ email:"", password:"" });
  const [authLoading, setAuthLoading] = useState(false);
  const [shoots, setShoots] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [expForm, setExpForm] = useState({ month:getCurrentMonth(), amount:"", description:"" });
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gcalToken, setGcalToken] = useState(null);
  const [gcalReady, setGcalReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [eventType, setEventType] = useState(null); // "shoot" | "pizza"
  const [pizzaForm, setPizzaForm] = useState({ date:"", clientName:"", phone:"05", price:"", deposit:"", depositPaid:false, fullPaid:false, remind90:false, notes:"" });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [gcalExpired, setGcalExpired] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(()=>{ setTimeout(()=>setMounted(true),100); },[]);

  // Check biometric support
  useEffect(()=>{
    if(window.PublicKeyCredential) setBiometricSupported(true);
  },[]);

  // Lock on visibility change (app goes to background)
  useEffect(()=>{
    if(!biometricSupported||!user) return;
    let hiddenAt=null;
    const handle=()=>{
      if(document.hidden){ hiddenAt=Date.now(); }
      else if(hiddenAt&&(Date.now()-hiddenAt)>600000){ setBiometricLocked(true); } // 10 min
    };
    document.addEventListener("visibilitychange",handle);
    return ()=>document.removeEventListener("visibilitychange",handle);
  },[biometricSupported,user]);

  async function unlockBiometric(){
    try{
      // Use WebAuthn to verify identity
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      await navigator.credentials.get({
        publicKey:{
          challenge,
          timeout:60000,
          userVerification:"required",
          rpId:window.location.hostname
        }
      });
      setBiometricLocked(false);
    } catch(e){
      // If WebAuthn fails (not registered), just unlock
      setBiometricLocked(false);
    }
  }

  useEffect(()=>{
    const s=document.createElement("script"); s.src="https://accounts.google.com/gsi/client"; s.onload=()=>setGcalReady(true); document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    const gcal=localStorage.getItem("tpv_gcal"); if(gcal) setGcalToken(gcal);
    // Handle OAuth redirect
    const hash=window.location.hash;
    if(hash.includes("access_token")){
      const params=new URLSearchParams(hash.replace("#",""));
      const at=params.get("access_token");
      const rt=params.get("refresh_token");
      if(at){ fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${at}`}}).then(r=>r.json()).then(u=>{ setUser(u); setAuthToken(at); localStorage.setItem("tpv_session",JSON.stringify({user:u,access_token:at,refresh_token:rt})); window.history.replaceState({},"",window.location.pathname); }); return; }
    }
    // Restore session and auto-refresh
    const saved=localStorage.getItem("tpv_session");
    if(saved){
      try{
        const {user,access_token,refresh_token}=JSON.parse(saved);
        // Try to refresh token
        if(refresh_token){
          fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token})})
            .then(r=>r.json()).then(d=>{
              if(d.access_token){
                setUser(d.user||user); setAuthToken(d.access_token);
                localStorage.setItem("tpv_session",JSON.stringify({user:d.user||user,access_token:d.access_token,refresh_token:d.refresh_token||refresh_token}));
              } else { setUser(user); setAuthToken(access_token); }
            }).catch(()=>{ setUser(user); setAuthToken(access_token); });
        } else { setUser(user); setAuthToken(access_token); }
      }catch{}
    }
  },[]);

  useEffect(()=>{ if(authToken) loadData(); },[authToken]);

  // Auto-connect Google Calendar after user logs in
  useEffect(()=>{
    if(user && gcalReady && window.google && !gcalToken){
      const saved = localStorage.getItem("tpv_gcal");
      if(!saved){
        const tc = window.google.accounts.oauth2.initTokenClient({
          client_id: GCAL_CLIENT_ID, scope: GCAL_SCOPES,
          callback:(r)=>{ if(r.access_token){ setGcalToken(r.access_token); localStorage.setItem("tpv_gcal",r.access_token); } }
        });
        tc.requestAccessToken({prompt:""});
      }
    }
  },[user,gcalReady]);

  async function loadData(){
    setLoading(true);
    try{
      const [s,e]=await Promise.all([sbFetch("shoots?order=date.desc",{},authToken),sbFetch("expenses?order=created_at.desc",{},authToken)]);
      setShoots((s||[]).map(r=>({id:r.id,date:r.date,clientName:r.client_name,phone:r.phone||"",type:r.type,location:r.location||"",price:r.price,deposit:r.deposit||0,paymentStatus:r.payment_status||"לא שולם",notes:r.notes||"",calendarEventId:r.calendar_event_id,package:r.package||"",drone:r.drone||false,vintage:r.vintage||false,depositPaid:r.deposit_paid||false,fullPaid:r.full_paid||false,productionStatus:r.production_status||"",remind90:r.remind90||false})));
      setExpenses((e||[]).map(r=>({id:r.id,month:r.month,description:r.description,amount:r.amount})));
    }catch(err){ console.error('load error',err); }
    setLoading(false);
  }

  function showToast(msg,type="success"){ setToast({msg,type}); setTimeout(()=>setToast(null),3000); }
  function handleGoogleLogin(){ window.location.href=`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent("https://tpv-eight.vercel.app")}`; }

  async function handleLogin(){
    setAuthLoading(true);
    try{ const d=await sbAuth("token?grant_type=password",{email:authForm.email,password:authForm.password}); setUser(d.user); setAuthToken(d.access_token); localStorage.setItem("tpv_session",JSON.stringify({user:d.user,access_token:d.access_token})); }
    catch(e){ showToast(e.message,"error"); }
    setAuthLoading(false);
  }

  async function handleRegister(){
    setAuthLoading(true);
    try{ await sbAuth("signup",{email:authForm.email,password:authForm.password}); showToast("נרשמת! בדוק את המייל לאישור"); setAuthView("login"); }
    catch(e){ showToast(e.message,"error"); }
    setAuthLoading(false);
  }

  function handleLogout(){ setUser(null); setAuthToken(null); setShoots([]); setExpenses([]); localStorage.removeItem("tpv_session"); localStorage.removeItem("tpv_gcal"); setGcalToken(null); setMenuOpen(false); }

  function connectGcal(){
    if(!gcalReady||!window.google){ showToast("Google עדיין נטען","error"); return; }
    const tc=window.google.accounts.oauth2.initTokenClient({ client_id:GCAL_CLIENT_ID,scope:GCAL_SCOPES,callback:(r)=>{ if(r.access_token){ setGcalToken(r.access_token); localStorage.setItem("tpv_gcal",r.access_token); showToast("חובר ל-Google Calendar ✓"); setSettingsOpen(false); } else showToast("שגיאה","error"); } });
    tc.requestAccessToken();
  }

  async function gcalCreate(shoot){
    if(!gcalToken) return null;
    try{
      const r=await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events",{method:"POST",headers:{Authorization:`Bearer ${gcalToken}`,"Content-Type":"application/json"},body:JSON.stringify({summary:`🎬 ${shoot.clientName}`,location:shoot.location||"",description:`סוג: ${shoot.type}\nסכום: ${fmt(shoot.price)}\nמקדמה: ${fmt(shoot.deposit||0)}\nטלפון: ${shoot.phone||""}`,start:{date:shoot.date},end:{date:shoot.date},colorId:"11"})});
      if(r.status===401){setGcalToken(null);localStorage.removeItem("tpv_gcal");setGcalExpired(true);return null;}
      const d=await r.json(); return d.id||null;
    }catch{return null;}
  }

  async function gcalUpdate(shoot){
    if(!gcalToken||!shoot.calendarEventId) return;
    try{ await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${shoot.calendarEventId}`,{method:"PUT",headers:{Authorization:`Bearer ${gcalToken}`,"Content-Type":"application/json"},body:JSON.stringify({summary:`🎬 ${shoot.clientName}`,location:shoot.location||"",description:`סוג: ${shoot.type}\nסכום: ${fmt(shoot.price)}`,start:{date:shoot.date},end:{date:shoot.date},colorId:"11"})}); }catch{}
  }

  async function gcalDelete(id){ if(!gcalToken||!id) return; try{ await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${gcalToken}`}}); }catch{} }

  async function handleSubmitShoot(){
    if(!form.date||!form.clientName||!form.price){ showToast("נא למלא תאריך, שם לקוח וסכום","error"); return; }
    if(editId){
      const ex=shoots.find(s=>s.id===editId);
      let calId=ex?.calendarEventId||null;
      if(gcalToken){ if(calId) await gcalUpdate({...form,calendarEventId:calId}); else calId=await gcalCreate(form); }
      const updated={...form,id:editId,calendarEventId:calId};
      try{
        await sbFetch(`shoots?id=eq.${editId}`,{method:"PATCH",body:JSON.stringify({date:form.date,client_name:form.clientName,phone:form.phone,type:form.type,location:form.location,price:parseFloat(form.price)||0,deposit:parseFloat(form.deposit)||0,payment_status:form.paymentStatus||"לא שולם",notes:form.notes,calendar_event_id:calId,package:form.package,drone:form.drone,vintage:form.vintage,deposit_paid:form.depositPaid||false,full_paid:form.fullPaid||false,production_status:form.productionStatus||"",remind90:form.remind90||false})},authToken);
        setShoots(shoots.map(s=>s.id===editId?updated:s)); showToast("עודכן ✓"); setModal(null); setView("history");
      }catch{ showToast("שגיאה","error"); return; }
      setEditId(null);
    } else {
      let calId=gcalToken?await gcalCreate(form):null;
      try{
        const res=await sbFetch("shoots",{method:"POST",body:JSON.stringify({date:form.date,client_name:form.clientName,phone:form.phone,type:form.type,location:form.location,price:parseFloat(form.price)||0,deposit:parseFloat(form.deposit)||0,payment_status:"לא שולם",notes:form.notes,calendar_event_id:calId,package:form.package,drone:form.drone,vintage:form.vintage,deposit_paid:form.depositPaid||false,full_paid:form.fullPaid||false,production_status:"",remind90:form.remind90||false})},authToken);
        const newId=res?.[0]?.id??null;
        const newShoot={id:newId,date:form.date,clientName:form.clientName,phone:form.phone||"",type:form.type,location:form.location||"",price:parseFloat(form.price)||0,deposit:parseFloat(form.deposit)||0,paymentStatus:"לא שולם",notes:form.notes||"",calendarEventId:calId,package:form.package||"",drone:form.drone||false,vintage:form.vintage||false,depositPaid:form.depositPaid||false,fullPaid:form.fullPaid||false,productionStatus:"",remind90:form.remind90||false};
        setShoots([newShoot,...shoots]);
        showToast(gcalToken&&calId?"נשמר + לוח שנה ✓":"נשמר ✓"); setModal(null);
      }catch(err){ console.error("shoot save error",err); showToast("שגיאה: "+(err?.message||""),"error"); return; }
    }
    setForm(initialForm);
  }

  async function handleDeleteShoot(id){
    const shoot=shoots.find(s=>s.id===id);
    if(shoot?.calendarEventId&&gcalToken) await gcalDelete(shoot.calendarEventId);
    try{ await sbFetch(`shoots?id=eq.${id}`,{method:"DELETE"},authToken); setShoots(shoots.filter(s=>s.id!==id)); showToast("נמחק","error"); }
    catch{ showToast("שגיאה","error"); }
  }

  async function handleUpdatePayment(id,status){
    try{ await sbFetch(`shoots?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({payment_status:status})},authToken); setShoots(shoots.map(s=>s.id===id?{...s,paymentStatus:status}:s)); showToast("עודכן ✓"); }
    catch{ showToast("שגיאה","error"); }
  }

  async function handleUpdateProductionStatus(id, status){
    try{
      await sbFetch(`shoots?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({production_status:status})},authToken);
      setShoots(shoots.map(s=>s.id===id?{...s,productionStatus:status}:s));
      showToast("סטטוס עודכן ✓");
    }catch{ showToast("שגיאה","error"); }
  }

  async function handleAddExpense(){
    if(!expForm.amount||!expForm.description){ showToast("נא למלא סכום ותיאור","error"); return; }
    try{
      const res=await sbFetch("expenses",{method:"POST",body:JSON.stringify({month:expForm.month,description:expForm.description,amount:parseFloat(expForm.amount)||0})},authToken);
      setExpenses([{id:res[0].id,...expForm},...expenses]);
      setExpForm({month:getCurrentMonth(),amount:"",description:""});
      showToast("הוצאה נוספה ✓"); setModal(null);
    }catch{ showToast("שגיאה","error"); }
  }

  async function handleDeleteExpense(id){
    try{ await sbFetch(`expenses?id=eq.${id}`,{method:"DELETE"},authToken); setExpenses(expenses.filter(e=>e.id!==id)); showToast("נמחק","error"); }
    catch{ showToast("שגיאה","error"); }
  }

  function handleEditShoot(shoot){ setForm({...shoot}); setEditId(shoot.id); setModal("new-event"); }

  // Stats
  const todayStr = today();
  const futureShoot = shoots.filter(s=>s.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date));
  const pastShoots = shoots.filter(s=>s.date<todayStr).sort((a,b)=>b.date.localeCompare(a.date));
  // Only count money actually received
  const totalIncome = shoots.reduce((sum,r)=>{
    const price = parseFloat(r.price)||0;
    const dep = parseFloat(r.deposit)||0;
    if (r.fullPaid) return sum + price; // full payment = full price
    if (r.depositPaid) return sum + dep; // deposit only
    return sum; // nothing paid yet
  },0);
  const totalExpected = shoots.reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const totalExp = expenses.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const net = totalIncome - totalExp;
  const paid = shoots.filter(s=>s.fullPaid).reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const unpaid = totalExpected - paid;
  const rawName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "טל";
  const firstName = /^[a-zA-Z]/.test(rawName) ? "טל" : rawName;

  // Monthly summary
  const curMonth = getCurrentMonth();
  const monthlyIncome = shoots.filter(s=>s.date?.startsWith(curMonth)).reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const monthlyExp = expenses.filter(e=>e.month===curMonth).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);

  // Yearly summary
  const curYear = new Date().getFullYear().toString();
  const yearlyIncome = shoots.filter(s=>s.date?.startsWith(curYear)).reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const yearlyExp = expenses.filter(e=>e.month?.startsWith(curYear)).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);

  // ── Biometric Lock Screen ─────────────────────────────────
  if(user && biometricLocked) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#dbeafe,#eff6ff)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Heebo',sans-serif",direction:"rtl",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800;900&display=swap');`}</style>
      <div style={{fontSize:20,fontWeight:900,color:"#1e3a8a",marginBottom:8}}>Tal Porat <span style={{color:"#3b82f6"}}>Video</span></div>
      <div style={{fontSize:14,color:"#64748b",marginBottom:40}}>האפליקציה נעולה</div>
      <button onClick={unlockBiometric} style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"#fff",border:"none",borderRadius:20,padding:"18px 40px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 8px 24px rgba(29,78,216,0.3)",display:"flex",alignItems:"center",gap:10}}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Face ID / Touch ID
      </button>
      <button onClick={()=>setBiometricLocked(false)} style={{marginTop:16,background:"transparent",border:"none",color:"#94a3b8",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>הזן סיסמה במקום</button>
    </div>
  );

  // ── Login ──────────────────────────────────────────────────
  if(!user) return (
    <div style={S.loginRoot}>
      <style>{CSS}</style>
      {toast&&<div style={{...S.toast,background:toast.type==="error"?"#ef4444":"#1d4ed8"}}>{toast.msg}</div>}
      <div style={{...S.loginCard,opacity:mounted?1:0,transform:mounted?"translateY(0)":"translateY(20px)",transition:"all 0.4s ease"}}>
        <div style={S.loginLogo}>Tal Porat <span style={{color:"#3b82f6"}}>Video</span></div>
        <div style={S.loginSub}>מערכת ניהול ימי צילום</div>
        <div style={S.authTabs}>
          {["login","register"].map(v=>(
            <button key={v} onClick={()=>setAuthView(v)} style={{...S.authTab,...(authView===v?S.authTabActive:{})}}>
              {v==="login"?"התחברות":"הרשמה"}
            </button>
          ))}
        </div>
        <button onClick={handleGoogleLogin} style={S.googleBtn}>
          <span style={{fontSize:17,fontWeight:900,color:"#4285f4",fontFamily:"Arial"}}>G</span>
          {authView==="login"?"התחבר עם Google":"הרשם עם Google"}
        </button>
        <div style={S.divider}><div style={S.divLine}/><span style={S.divText}>או</span><div style={S.divLine}/></div>
        <input type="email" placeholder="אימייל" style={S.authInput} value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/>
        <input type="password" placeholder="סיסמה" style={{...S.authInput,marginTop:10}} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&(authView==="login"?handleLogin():handleRegister())}/>
        <button style={S.authBtn} onClick={authView==="login"?handleLogin:handleRegister} disabled={authLoading}>
          {authLoading?"...":authView==="login"?"התחבר":"הרשם"}
        </button>
      </div>
    </div>
  );

  // ── App ────────────────────────────────────────────────────
  return (
    <div style={S.root} className="app-root">
      <style>{CSS}</style>
      {toast&&<div style={{...S.toast,background:toast.type==="error"?"#ef4444":"#1d4ed8"}}>{toast.msg}</div>}

      {/* Overlays for side panels */}
      {(menuOpen||settingsOpen)&&<div style={S.sideOverlay} onClick={()=>{setMenuOpen(false);setSettingsOpen(false);}}/>}

      {/* Side Menu */}
      <div style={{...S.sideMenu,transform:menuOpen?"translateX(0)":"translateX(100%)"}}>
        <div style={S.sideHeader}>תפריט</div>
        {[{label:"דף הבית",v:"home"},{label:"לוח אירועים",v:"history"},{label:"פיננסי",v:"finances"}].map(item=>(
          <button key={item.v} style={{...S.sideItem,color:view===item.v?"#1d4ed8":"#334155",fontWeight:view===item.v?700:500}} onClick={()=>{setView(item.v);setMenuOpen(false);}}>
            {item.label} <span style={S.sideArrow}>{Icon.arrow}</span>
          </button>
        ))}
        <div style={S.sideDivider}/>
        <button style={{...S.sideItem,color:"#ef4444"}} onClick={handleLogout}>
          <span style={{marginLeft:8,display:"inline-flex"}}>{Icon.logout}</span> התנתק
        </button>
      </div>

      {/* Settings Panel */}
      <div style={{...S.settingsPanel,transform:settingsOpen?"translateX(0)":"translateX(-100%)"}}>
        <div style={S.sideHeader}>הגדרות</div>
        <div style={S.settingRow}>
          <div>
            <div style={S.settingLabel}>Google Calendar</div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{gcalToken?"מחובר ומסונכרן ✓":"לא מחובר"}</div>
          </div>
          {gcalToken
            ? <button style={S.settingBtnRed} onClick={()=>{setGcalToken(null);localStorage.removeItem("tpv_gcal");showToast("התנתקת");}}>התנתק</button>
            : <button style={S.settingBtnBlue} onClick={connectGcal}>חבר</button>
          }
        </div>
        <div style={S.settingRow}>
          <div>
            <div style={S.settingLabel}>חשבון</div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{user?.email}</div>
          </div>
        </div>
        <div style={S.sideDivider}/>
        <button style={{...S.sideItem,color:"#ef4444",marginTop:8}} onClick={handleLogout}>
          <span style={{marginLeft:8,display:"inline-flex"}}>{Icon.logout}</span> התנתק
        </button>
      </div>

      {/* GCal expired banner */}
      {gcalExpired&&(
        <div style={{background:"linear-gradient(135deg,#fef2f2,#fee2e2)",borderBottom:"1px solid #fecaca",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,zIndex:45,position:"sticky",top:56}}>
          <span style={{fontSize:13,color:"#991b1b",fontWeight:600}}>⚠️ החיבור ל-Google Calendar פג</span>
          <button onClick={()=>{setGcalExpired(false);connectGcal();}} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>חבר מחדש</button>
        </div>
      )}

      {/* Header */}
      <header style={S.header} className="app-header">
        <button style={S.headerBtn} onClick={()=>{setSettingsOpen(false);setMenuOpen(o=>!o);}}>{Icon.menu}</button>
        <div style={S.headerLogo}>Tal Porat <span style={{color:"#3b82f6"}}>Video</span></div>
        <button style={S.headerBtn} onClick={()=>{setMenuOpen(false);setSettingsOpen(o=>!o);}}>{Icon.settings}</button>
      </header>

      {/* Desktop Sidebar - hidden on mobile via CSS */}
      <div className="app-sidebar" style={{display:"none"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.8,marginBottom:16,paddingRight:16}}>ניווט</div>
        {[{v:"home",label:"בית",icon:Icon.home},{v:"history",label:"לוח אירועים",icon:Icon.history},{v:"finances",label:"פיננסי",icon:Icon.finance}].map(item=>(
          <button key={item.v} className={"desktop-nav-item"+(view===item.v?" active":"")} onClick={()=>setView(item.v)}>
            <span style={{display:"flex",color:view===item.v?"#1d4ed8":"#64748b"}}>{item.icon}</span>
            {item.label}
          </button>
        ))}
        <button className="desktop-nav-plus press-scale" style={{...S.submitBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:16}}
          onClick={()=>{setForm(initialForm);setEditId(null);setEventType(null);setModal("new-event");}}>
          <span style={{display:"flex"}}>{Icon.plus}</span> אירוע חדש
        </button>
        <div style={{marginTop:"auto",paddingTop:16,borderTop:"1px solid rgba(219,234,254,0.5)"}}>
          <div style={{fontSize:12,color:"#94a3b8",marginBottom:4}}>מחובר:</div>
          <div style={{fontSize:13,fontWeight:600,color:"#334155",wordBreak:"break-all"}}>{user?.email}</div>
        </div>
      </div>

      {/* Screens */}
      <div style={{position:"relative",minHeight:"calc(100vh - 56px - 70px)"}} className="app-main-content">

        {/* HOME */}
        <Screen visible={view==="home"}>
          <div style={S.main}>
            <div style={S.greeting}>היי {firstName} 👋</div>

            {/* Quick Actions */}
            <div style={S.quickGrid}>
              {[
                {icon:Icon.newEvent, label:"אירוע חדש", action:()=>{setForm(initialForm);setEditId(null);setEventType(null);setModal("new-event");}},
                {icon:Icon.expense, label:"הוצאה חדשה", action:()=>setModal("new-expense")},
                {icon:Icon.chart, label:"סיכום חודשי", action:()=>setModal("monthly")},
                {icon:Icon.yearly, label:"סיכום שנתי", action:()=>setModal("yearly")},
              ].map((q,i)=>(
                <button key={i} style={S.quickBtn} onClick={q.action} className="press-scale">
                  <span style={{color:"#1d4ed8"}}>{q.icon}</span>
                  <span style={S.quickLabel}>{q.label}</span>
                </button>
              ))}
            </div>

            {/* Future shoots - minimal */}
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>אירועים קרובים</span>
              <button style={S.sectionLink} onClick={()=>setView("history")}>הכל</button>
            </div>
            {futureShoot.length===0 ? (
              <div style={S.emptyCard}><div style={S.emptyIcon}>{Icon.calendar}</div><div style={S.emptyText}>אין אירועים קרובים</div></div>
            ) : futureShoot.slice(0,3).map(s=><HomeCard key={s.id} shoot={s}/>)}

            {/* Calendar */}
            <MiniCalendar shoots={shoots}/>

            {/* Past shoots - minimal */}
            {pastShoots.length>0&&(
              <>
                <div style={S.sectionHeader}>
                  <span style={S.sectionTitle}>אירועים קודמים</span>
                  <button style={S.sectionLink} onClick={()=>setView("history")}>הכל</button>
                </div>
                {pastShoots.slice(0,3).map(s=><HomeCard key={s.id} shoot={s}/>)}
              </>
            )}

            {/* Deadline alerts */}
            {(()=>{
              const alerts = pastShoots.filter(s=>{
                if(s.productionStatus==="סגור") return false;
                const ds=Math.floor((new Date()-new Date(s.date))/(1000*60*60*24));
                return ds>=30 && ds<=100;
              });
              if(alerts.length===0) return null;
              return (
                <div style={{background:"rgba(255,247,237,0.9)",border:"1px solid rgba(253,186,116,0.5)",borderRadius:16,padding:14,marginTop:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#c2410c",marginBottom:10}}>⏰ {alerts.length} אירוע{alerts.length>1?"ים":""} ממתינ{alerts.length>1?"ים":""} לעריכה</div>
                  {alerts.map(s=>{
                    const ds=Math.floor((new Date()-new Date(s.date))/(1000*60*60*24));
                    const dl=90-ds;
                    return (
                      <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(253,186,116,0.3)"}}>
                        <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{s.clientName}</span>
                        <span style={{fontSize:12,fontWeight:700,color:dl<=0?"#dc2626":dl<=14?"#c2410c":"#92400e"}}>{dl<=0?`פג לפני ${Math.abs(dl)} ימים`:`${dl} ימים נותרו`}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Screen>

        {/* HISTORY - לוח אירועים עם tabs */}
        <Screen visible={view==="history"}>
          <div style={S.main}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0 12px"}}>
              <div style={S.pageTitle}>לוח אירועים</div>
            </div>
            {/* Search + Filter */}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <div style={{flex:1,position:"relative"}}>
                <svg style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none"}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="חיפוש לפי שם..." style={{...S.input,paddingRight:34,fontSize:14,padding:"9px 34px 9px 12px"}} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              </div>
              <select style={{...S.input,width:"auto",fontSize:13,padding:"9px 10px"}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
                <option value="">הכל</option>
                {SHOOT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* Tabs */}
            {(()=>{
              const filtered = shoots.filter(s=>(!searchQuery||s.clientName?.toLowerCase().includes(searchQuery.toLowerCase()))&&(!filterType||s.type===filterType));
              const filtFuture = filtered.filter(s=>s.date>=today()).sort((a,b)=>a.date>b.date?1:-1);
              const filtPast = filtered.filter(s=>s.date<today()).sort((a,b)=>b.date>a.date?1:-1);
              return (
                <>
                  <div style={{display:"flex",background:"rgba(241,245,249,0.8)",borderRadius:12,padding:4,marginBottom:14,gap:4}}>
                    {[{id:"future",label:`עתידיים (${filtFuture.length})`},{id:"past",label:`עבר (${filtPast.length})`}].map(tab=>(
                      <button key={tab.id} onClick={()=>setFilterType(prev=>{ window._histTab=tab.id; return prev; })||( window._histTab=tab.id)||setSearchQuery(q=>q)} style={{flex:1,padding:"9px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:(!window._histTab&&tab.id==="future")||(window._histTab===tab.id)?"#fff":"transparent",color:(!window._histTab&&tab.id==="future")||(window._histTab===tab.id)?"#1d4ed8":"#64748b",boxShadow:(!window._histTab&&tab.id==="future")||(window._histTab===tab.id)?"0 1px 4px rgba(15,23,42,0.08)":"none",transition:"all 0.15s"}}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {loading ? <div style={S.loading}>טוען...</div> :
                   ((!window._histTab||window._histTab==="future") ? filtFuture : filtPast).length===0 ?
                   <div style={S.emptyCard}><div style={S.emptyIcon}>{Icon.history}</div><div style={S.emptyText}>אין אירועים</div></div> :
                   ((!window._histTab||window._histTab==="future") ? filtFuture : filtPast).map(s=>(
                     <ShootCard key={s.id} shoot={s} animate={mounted} onEdit={handleEditShoot} onDelete={handleDeleteShoot} onUpdatePayment={handleUpdatePayment} onUpdateProduction={handleUpdateProductionStatus}/>
                   ))
                  }
                </>
              );
            })()}
          </div>
        </Screen>

        {/* FINANCES */}
        <Screen visible={view==="finances"}>
          <div style={S.main}>
            <div style={S.pageTitle}>כספים</div>
            <div style={S.finGrid}>
              <div style={{...S.finCard,gridColumn:"span 2",background:"linear-gradient(135deg,#1d4ed8,#2563eb)",border:"none"}}>
                <div style={{...S.finLabel,color:"rgba(255,255,255,0.7)"}}>סה"כ הכנסות ברוטו</div>
                <div style={{...S.finVal,fontSize:26,color:"#fff"}}>{fmt(totalIncome)}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:4}}>{shoots.length} ימי צילום</div>
              </div>
              <div style={S.finCard}>
                <div style={S.finLabel}>נטו</div>
                <div style={{...S.finVal,color:net>=0?"#1d4ed8":"#ef4444"}}>{fmt(net)}</div>
              </div>
              <div style={S.finCard}>
                <div style={S.finLabel}>הוצאות</div>
                <div style={{...S.finVal,color:"#64748b"}}>{fmt(totalExp)}</div>
              </div>
              <div style={S.finCard}>
                <div style={S.finLabel}>שולם</div>
                <div style={{...S.finVal,color:"#1d4ed8"}}>{fmt(paid)}</div>
              </div>
              <div style={S.finCard}>
                <div style={S.finLabel}>ממתין</div>
                <div style={{...S.finVal,color:"#92400e"}}>{fmt(unpaid)}</div>
              </div>
            </div>

            <button style={{...S.submitBtn,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={()=>setModal("new-expense")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              הוסף הוצאה חדשה
            </button>

            {expenses.length>0&&(
              <div style={S.glassCard}>
                <div style={S.cardTitle}>הוצאות</div>
                {expenses.map(e=>(
                  <div key={e.id} style={S.expRow}>
                    <div><div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>{e.description}</div><div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{e.month}</div></div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:15,fontWeight:700,color:"#64748b"}}>{fmt(e.amount)}</span>
                      <button style={S.iconBtn} onClick={()=>handleDeleteExpense(e.id)}>{Icon.close}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Screen>
      </div>

      {/* Bottom Nav - RTL: בית / היסטוריה / כספים / + */}
      <nav style={S.bottomNav} className="app-bottom-nav">
        {[
          {v:"home",icon:Icon.home,label:"בית"},
          {v:"history",icon:Icon.history,label:"לוח אירועים"},
          {v:"finances",icon:Icon.finance,label:"פיננסי"},
        ].map(item=>(
          <button key={item.v} style={{...S.navItem,...(view===item.v?S.navItemActive:{})}} onClick={()=>setView(item.v)}>
            <span style={{color:view===item.v?"#1d4ed8":"#94a3b8",display:"flex"}}>{item.icon}</span>
            <span style={{...S.navLabel,color:view===item.v?"#1d4ed8":"#94a3b8"}}>{item.label}</span>
          </button>
        ))}

        {/* Plus button - far left in RTL */}
        <button style={S.navPlus} className="press-scale" onClick={()=>{setForm(initialForm);setEditId(null);setEventType(null);setModal("new-event");}}>
          {Icon.plus}
        </button>
      </nav>

      {/* ── Modals ── */}

      {/* New Event */}
      <Modal open={modal==="new-event"} onClose={()=>{setModal(null);setEditId(null);setForm(initialForm);setEventType(null);}} title={editId?"עריכת אירוע":eventType===null?"אירוע חדש":eventType==="shoot"?"🎬 צילום":"🍕 פיצות"}>

        {/* Step 1: Choose event type (only for new events) */}
        {!editId && eventType===null && (
          <div style={{display:"flex",gap:12,marginBottom:4}}>
            {[{id:"shoot",icon:"🎬",label:"צילום"},{id:"pizza",icon:"🍕",label:"פיצות"}].map(t=>(
              <button key={t.id} onClick={()=>setEventType(t.id)} style={{flex:1,padding:"28px 0",borderRadius:18,border:"1px solid rgba(226,232,240,0.8)",background:"rgba(248,250,252,0.9)",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:10,transition:"all 0.15s"}}>
                <span style={{fontSize:36}}>{t.icon}</span>
                <span style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Shoot form */}
        {(editId || eventType==="shoot") && (
          <>
            {gcalToken&&<div style={S.gcalBadge}>🗓 יסונכרן ל-Google Calendar</div>}
            <FormGroup label="תאריך"><input type="date" style={S.input} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></FormGroup>
            <FormGroup label="שם לקוח"><input type="text" placeholder="שם מלא" style={S.input} value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})}/></FormGroup>
            <FormGroup label="מקום"><input type="text" placeholder="אולם / כתובת / מיקום" style={S.input} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></FormGroup>
            <FormGroup label="טלפון"><input type="tel" inputMode="numeric" placeholder="05X-XXXXXXX" style={S.input} value={form.phone} onChange={e=>{ let v=e.target.value.replace(/\D/g,""); if(v.length>0&&!v.startsWith("05")) v="05"+v.replace(/^0+/,""); setForm({...form,phone:v}); }}/></FormGroup>
            <FormGroup label="סכום עסקה (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></FormGroup>
            <FormGroup label="מקדמה ששולמה (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={form.deposit} onChange={e=>setForm({...form,deposit:e.target.value})}/></FormGroup>
            {form.price&&form.deposit&&<div style={S.remainBadge}>יתרה לגביה: {fmt((parseFloat(form.price)||0)-(parseFloat(form.deposit)||0))}</div>}
            {/* Payment checkboxes - side by side */}
            <FormGroup label="תשלומים שהתקבלו">
              <div style={{display:"flex",gap:10}}>
                {[{key:"depositPaid",label:"מקדמה",amount:parseFloat(form.deposit)||0},{key:"fullPaid",label:"תשלום מלא",amount:(parseFloat(form.price)||0)-(parseFloat(form.deposit)||0)}].map(item=>(
                  <button key={item.key} onClick={()=>setForm({...form,[item.key]:!form[item.key]})} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,background:form[item.key]?"rgba(220,252,231,0.9)":"rgba(248,250,252,0.9)",border:form[item.key]?"1px solid #86efac":"1px solid rgba(226,232,240,0.8)",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                    <div style={{width:18,height:18,borderRadius:5,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:form[item.key]?"#16a34a":"#fff",border:form[item.key]?"2px solid #16a34a":"2px solid #cbd5e1"}}>
                      {form[item.key]&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:form[item.key]?"#166534":"#334155"}}>{item.label}</div>
                      {item.amount>0&&<div style={{fontSize:11,color:form[item.key]?"#16a34a":"#94a3b8"}}>{fmt(item.amount)}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </FormGroup>
            {/* Shoot type - dropdown */}
            <FormGroup label="סוג צילום">
              <select style={S.input} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                {SHOOT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </FormGroup>
            {/* Package */}
            <FormGroup label="חבילה">
              <div style={{display:"flex",gap:10}}>
                {["חבילה 1","חבילה 2"].map(p=>(
                  <button key={p} onClick={()=>{ const isP2=p==="חבילה 2"; setForm({...form,package:form.package===p?"":p,drone:isP2?true:form.drone,vintage:isP2?true:form.vintage}); }} style={{flex:1,padding:"11px 0",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:form.package===p?"2px solid #1d4ed8":"1px solid rgba(226,232,240,0.8)",background:form.package===p?"rgba(239,246,255,0.95)":"rgba(248,250,252,0.9)",color:form.package===p?"#1d4ed8":"#64748b",transition:"all 0.15s"}}>{p}</button>
                ))}
              </div>
            </FormGroup>
            {/* Extras - side by side */}
            <FormGroup label="תוספות">
              <div style={{display:"flex",gap:10}}>
                {[{key:"drone",label:"רחפן 🚁"},{key:"vintage",label:"וינטג׳ 📼"}].map(item=>(
                  <button key={item.key} onClick={()=>setForm({...form,[item.key]:!form[item.key]})} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,background:form[item.key]?"rgba(239,246,255,0.95)":"rgba(248,250,252,0.9)",border:form[item.key]?"1px solid #bfdbfe":"1px solid rgba(226,232,240,0.8)",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                    <div style={{width:18,height:18,borderRadius:5,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:form[item.key]?"#1d4ed8":"#fff",border:form[item.key]?"2px solid #1d4ed8":"2px solid #cbd5e1"}}>
                      {form[item.key]&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span style={{fontSize:13,fontWeight:600,color:form[item.key]?"#1d4ed8":"#334155"}}>{item.label}</span>
                  </button>
                ))}
              </div>
            </FormGroup>
            {/* 90-day reminder toggle */}
            <FormGroup label="תזכורת עריכה">
              <button onClick={()=>setForm({...form,remind90:!form.remind90})} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:form.remind90?"rgba(239,246,255,0.95)":"rgba(248,250,252,0.9)",border:form.remind90?"1px solid #bfdbfe":"1px solid rgba(226,232,240,0.8)",cursor:"pointer",fontFamily:"inherit",width:"100%",transition:"all 0.15s"}}>
                <div style={{width:18,height:18,borderRadius:5,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:form.remind90?"#1d4ed8":"#fff",border:form.remind90?"2px solid #1d4ed8":"2px solid #cbd5e1"}}>
                  {form.remind90&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{fontSize:13,fontWeight:600,color:form.remind90?"#1d4ed8":"#334155"}}>הזכר לי לערוך תוך 90 יום</span>
              </button>
            </FormGroup>
            <FormGroup label="הערות"><textarea placeholder="פרטים נוספים..." style={{...S.input,minHeight:72,resize:"vertical"}} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></FormGroup>
            <button style={S.submitBtn} onClick={handleSubmitShoot}>{editId?"עדכן אירוע":"שמור אירוע"}</button>
          </>
        )}

        {/* Pizza form */}
        {eventType==="pizza" && (
          <>
            <FormGroup label="תאריך"><input type="date" style={S.input} value={pizzaForm.date} onChange={e=>setPizzaForm({...pizzaForm,date:e.target.value})}/></FormGroup>
            <FormGroup label="שם לקוח"><input type="text" placeholder="שם מלא" style={S.input} value={pizzaForm.clientName} onChange={e=>setPizzaForm({...pizzaForm,clientName:e.target.value})}/></FormGroup>
            <FormGroup label="טלפון"><input type="tel" inputMode="numeric" placeholder="05X-XXXXXXX" style={S.input} value={pizzaForm.phone} onChange={e=>{ let v=e.target.value.replace(/\D/g,""); if(v.length>0&&!v.startsWith("05")) v="05"+v.replace(/^0+/,""); setPizzaForm({...pizzaForm,phone:v}); }}/></FormGroup>
            <FormGroup label="סכום עסקה (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={pizzaForm.price} onChange={e=>setPizzaForm({...pizzaForm,price:e.target.value})}/></FormGroup>
            <FormGroup label="מקדמה ששולמה (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={pizzaForm.deposit} onChange={e=>setPizzaForm({...pizzaForm,deposit:e.target.value})}/></FormGroup>
            {pizzaForm.price&&pizzaForm.deposit&&<div style={S.remainBadge}>יתרה לגביה: {fmt((parseFloat(pizzaForm.price)||0)-(parseFloat(pizzaForm.deposit)||0))}</div>}
            <FormGroup label="תשלומים שהתקבלו">
              <div style={{display:"flex",gap:10}}>
                {[{key:"depositPaid",label:"מקדמה",amount:parseFloat(pizzaForm.deposit)||0},{key:"fullPaid",label:"תשלום מלא",amount:(parseFloat(pizzaForm.price)||0)-(parseFloat(pizzaForm.deposit)||0)}].map(item=>(
                  <button key={item.key} onClick={()=>setPizzaForm({...pizzaForm,[item.key]:!pizzaForm[item.key]})} style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,background:pizzaForm[item.key]?"rgba(220,252,231,0.9)":"rgba(248,250,252,0.9)",border:pizzaForm[item.key]?"1px solid #86efac":"1px solid rgba(226,232,240,0.8)",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                    <div style={{width:18,height:18,borderRadius:5,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:pizzaForm[item.key]?"#16a34a":"#fff",border:pizzaForm[item.key]?"2px solid #16a34a":"2px solid #cbd5e1"}}>
                      {pizzaForm[item.key]&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:pizzaForm[item.key]?"#166534":"#334155"}}>{item.label}</div>
                      {item.amount>0&&<div style={{fontSize:11,color:pizzaForm[item.key]?"#16a34a":"#94a3b8"}}>{fmt(item.amount)}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </FormGroup>
            <FormGroup label="תזכורת עריכה">
              <button onClick={()=>setPizzaForm({...pizzaForm,remind90:!pizzaForm.remind90})} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:pizzaForm.remind90?"rgba(255,247,237,0.95)":"rgba(248,250,252,0.9)",border:pizzaForm.remind90?"1px solid #fed7aa":"1px solid rgba(226,232,240,0.8)",cursor:"pointer",fontFamily:"inherit",width:"100%",transition:"all 0.15s"}}>
                <div style={{width:18,height:18,borderRadius:5,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:pizzaForm.remind90?"#ea580c":"#fff",border:pizzaForm.remind90?"2px solid #ea580c":"2px solid #cbd5e1"}}>
                  {pizzaForm.remind90&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{fontSize:13,fontWeight:600,color:pizzaForm.remind90?"#ea580c":"#334155"}}>הזכר לי לערוך תוך 90 יום</span>
              </button>
            </FormGroup>
            <FormGroup label="הערות"><textarea placeholder="פרטים נוספים..." style={{...S.input,minHeight:72,resize:"vertical"}} value={pizzaForm.notes} onChange={e=>setPizzaForm({...pizzaForm,notes:e.target.value})}/></FormGroup>
            <button style={{...S.submitBtn,background:"linear-gradient(135deg,#ea580c,#f97316)"}} onClick={async()=>{
              if(!pizzaForm.date||!pizzaForm.clientName||!pizzaForm.price){showToast("נא למלא תאריך, שם לקוח וסכום","error");return;}
              try{
                const res=await sbFetch("shoots",{method:"POST",body:JSON.stringify({date:pizzaForm.date,client_name:pizzaForm.clientName,phone:pizzaForm.phone,type:"פיצות 🍕",location:"",price:parseFloat(pizzaForm.price)||0,deposit:parseFloat(pizzaForm.deposit)||0,payment_status:"לא שולם",notes:pizzaForm.notes,calendar_event_id:null,package:"",drone:false,vintage:false,deposit_paid:pizzaForm.depositPaid,full_paid:pizzaForm.fullPaid,production_status:"",remind90:pizzaForm.remind90})},authToken);
                setShoots([{id:res[0].id,date:pizzaForm.date,clientName:pizzaForm.clientName,phone:pizzaForm.phone,type:"פיצות 🍕",location:"",price:pizzaForm.price,deposit:pizzaForm.deposit,paymentStatus:"לא שולם",notes:pizzaForm.notes,calendarEventId:null,package:"",drone:false,vintage:false,depositPaid:pizzaForm.depositPaid,fullPaid:pizzaForm.fullPaid,productionStatus:"",remind90:pizzaForm.remind90},...shoots]);
                showToast("אירוע פיצות נשמר ✓");
                setPizzaForm({date:"",clientName:"",phone:"05",price:"",deposit:"",depositPaid:false,fullPaid:false,remind90:false,notes:""});
                setEventType(null);setModal(null);
              }catch{showToast("שגיאה בשמירה","error");}
            }}>שמור אירוע פיצות 🍕</button>
          </>
        )}
      </Modal>

      {/* New Expense */}
      <Modal open={modal==="new-expense"} onClose={()=>setModal(null)} title="הוצאה חדשה">
        <FormGroup label="חודש"><input type="month" style={S.input} value={expForm.month} onChange={e=>setExpForm({...expForm,month:e.target.value})}/></FormGroup>
        <FormGroup label="תיאור"><input type="text" placeholder="חיוב אשראי, ציוד..." style={S.input} value={expForm.description} onChange={e=>setExpForm({...expForm,description:e.target.value})}/></FormGroup>
        <FormGroup label="סכום (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})}/></FormGroup>
        <button style={S.submitBtn} onClick={handleAddExpense}>הוסף הוצאה</button>
      </Modal>

      {/* Monthly Summary */}
      <Modal open={modal==="monthly"} onClose={()=>setModal(null)} title="סיכום חודשי">
        <div style={S.summaryMonth}>{new Date().toLocaleDateString("he-IL",{month:"long",year:"numeric"})}</div>
        <div style={S.summaryGrid}>
          <div style={S.summaryCard}><div style={S.summaryLabel}>הכנסות</div><div style={{...S.summaryVal,color:"#1d4ed8"}}>{fmt(monthlyIncome)}</div></div>
          <div style={S.summaryCard}><div style={S.summaryLabel}>הוצאות</div><div style={{...S.summaryVal,color:"#64748b"}}>{fmt(monthlyExp)}</div></div>
          <div style={{...S.summaryCard,gridColumn:"span 2",background:"linear-gradient(135deg,#eff6ff,#dbeafe)"}}>
            <div style={S.summaryLabel}>נטו</div>
            <div style={{...S.summaryVal,fontSize:24,color:monthlyIncome-monthlyExp>=0?"#1d4ed8":"#ef4444"}}>{fmt(monthlyIncome-monthlyExp)}</div>
          </div>
        </div>
        <div style={S.summaryShootCount}>{shoots.filter(s=>s.date?.startsWith(curMonth)).length} צילומים החודש</div>
      </Modal>

      {/* All Events Modal */}
      <Modal open={modal==="all-events"} onClose={()=>setModal(null)} title="כל האירועים">
        {[...shoots].sort((a,b)=>a.date>b.date?1:-1).map(s=>(
          <div key={s.id} style={{padding:"12px 0",borderBottom:"1px solid rgba(226,232,240,0.6)",cursor:"pointer"}} onClick={()=>{setModal(null);handleEditShoot(s);}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0f172a"}}>{s.clientName}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{s.date}{s.location?" · "+s.location:""}</div>
              </div>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#0f172a"}}>{fmt(s.price)}</div>
                <div style={{fontSize:10,marginTop:4,padding:"2px 8px",borderRadius:10,background:s.date>=today()?"rgba(219,234,254,0.7)":"rgba(241,245,249,0.8)",color:s.date>=today()?"#1d4ed8":"#94a3b8",fontWeight:600,textAlign:"center"}}>{s.date>=today()?"עתידי":"עבר"}</div>
              </div>
            </div>
          </div>
        ))}
        {shoots.length===0&&<div style={{textAlign:"center",padding:"30px",color:"#94a3b8"}}>אין אירועים</div>}
      </Modal>

      {/* Yearly Summary */}
      <Modal open={modal==="yearly"} onClose={()=>setModal(null)} title="סיכום שנתי">
        <div style={S.summaryMonth}>{curYear}</div>
        <div style={S.summaryGrid}>
          <div style={S.summaryCard}><div style={S.summaryLabel}>הכנסות</div><div style={{...S.summaryVal,color:"#1d4ed8"}}>{fmt(yearlyIncome)}</div></div>
          <div style={S.summaryCard}><div style={S.summaryLabel}>הוצאות</div><div style={{...S.summaryVal,color:"#64748b"}}>{fmt(yearlyExp)}</div></div>
          <div style={{...S.summaryCard,gridColumn:"span 2",background:"linear-gradient(135deg,#eff6ff,#dbeafe)"}}>
            <div style={S.summaryLabel}>נטו שנתי</div>
            <div style={{...S.summaryVal,fontSize:24,color:yearlyIncome-yearlyExp>=0?"#1d4ed8":"#ef4444"}}>{fmt(yearlyIncome-yearlyExp)}</div>
          </div>
        </div>
        <div style={S.summaryShootCount}>{shoots.filter(s=>s.date?.startsWith(curYear)).length} צילומים ב-{curYear}</div>
      </Modal>
    </div>
  );
}

// ── Form Group Helper ──────────────────────────────────────────
function FormGroup({label,children}){
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>{label}</label>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const S = {
  root:{minHeight:"100vh",background:"linear-gradient(160deg,#dbeafe 0%,#f0f9ff 50%,#eff6ff 100%)",direction:"rtl",fontFamily:"'Heebo',sans-serif",paddingBottom:80,overflowX:"hidden"},
  loginRoot:{minHeight:"100vh",background:"linear-gradient(160deg,#1e3a8a,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Heebo',sans-serif",direction:"rtl"},
  main:{maxWidth:520,margin:"0 auto",padding:"16px 16px 24px",paddingBottom:"calc(100px + env(safe-area-inset-bottom))"},

  // Header
  header:{background:"rgba(255,255,255,0.8)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderBottom:"1px solid rgba(219,234,254,0.6)",position:"sticky",top:0,zIndex:40,display:"flex",alignItems:"center",justifyContent:"space-between",height:56,padding:"0 16px"},
  headerLogo:{fontSize:16,fontWeight:900,color:"#1e3a8a",letterSpacing:0.3},
  headerBtn:{background:"rgba(239,246,255,0.8)",border:"1px solid rgba(191,219,254,0.5)",color:"#1d4ed8",width:38,height:38,borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},

  // Side panels
  sideOverlay:{position:"fixed",inset:0,background:"rgba(15,23,42,0.3)",backdropFilter:"blur(4px)",zIndex:50,transition:"opacity 0.28s ease"},
  sideMenu:{position:"fixed",top:0,right:0,bottom:0,width:260,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(20px)",zIndex:60,padding:"72px 20px 40px",boxShadow:"-4px 0 24px rgba(15,23,42,0.1)",transition:"transform 0.32s cubic-bezier(0.4,0,0.2,1)"},
  settingsPanel:{position:"fixed",top:0,left:0,bottom:0,width:280,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(20px)",zIndex:60,padding:"72px 20px 40px",boxShadow:"4px 0 24px rgba(15,23,42,0.1)",transition:"transform 0.32s cubic-bezier(0.4,0,0.2,1)"},
  sideHeader:{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:20},
  sideItem:{width:"100%",background:"transparent",border:"none",textAlign:"right",padding:"14px 0",fontSize:15,color:"#334155",cursor:"pointer",fontFamily:"inherit",fontWeight:500,borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"},
  sideArrow:{color:"#94a3b8",display:"flex"},
  sideDivider:{height:1,background:"#e2e8f0",margin:"12px 0"},
  settingRow:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid #f1f5f9"},
  settingLabel:{fontSize:14,fontWeight:600,color:"#334155"},
  settingBtnBlue:{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},
  settingBtnRed:{background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},

  // Bottom nav
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderTop:"1px solid rgba(219,234,254,0.6)",display:"flex",alignItems:"center",justifyContent:"space-around",padding:"14px 8px",paddingBottom:"calc(20px + env(safe-area-inset-bottom))",zIndex:40,boxShadow:"0 -4px 20px rgba(15,23,42,0.06)"},
  navItem:{flex:1,background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 0",fontFamily:"inherit",transition:"all 0.15s ease"},
  navItemActive:{},
  navLabel:{fontSize:10,fontWeight:600},
  navPlus:{width:52,height:52,borderRadius:26,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 16px rgba(29,78,216,0.4)",color:"#fff",flexShrink:0,transition:"transform 0.15s ease,box-shadow 0.15s ease"},

  // Login
  loginCard:{width:"100%",maxWidth:360,background:"rgba(255,255,255,0.12)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:24,padding:28},
  loginLogo:{fontSize:22,fontWeight:900,color:"#fff",textAlign:"center",marginBottom:4,letterSpacing:0.5},
  loginSub:{fontSize:13,color:"rgba(255,255,255,0.65)",textAlign:"center",marginBottom:24},
  authTabs:{display:"flex",background:"rgba(255,255,255,0.1)",borderRadius:12,padding:4,marginBottom:18,gap:4},
  authTab:{flex:1,background:"transparent",border:"none",color:"rgba(255,255,255,0.6)",padding:"9px",fontSize:14,fontWeight:600,cursor:"pointer",borderRadius:9,fontFamily:"inherit",transition:"all 0.2s"},
  authTabActive:{background:"rgba(255,255,255,0.2)",color:"#fff"},
  googleBtn:{width:"100%",background:"#fff",color:"#1e293b",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"},
  divider:{display:"flex",alignItems:"center",gap:10,marginBottom:14},
  divLine:{flex:1,height:1,background:"rgba(255,255,255,0.2)"},
  divText:{fontSize:12,color:"rgba(255,255,255,0.4)"},
  authInput:{width:"100%",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.25)",borderRadius:12,color:"#fff",padding:"12px 14px",fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  authBtn:{width:"100%",background:"#fff",color:"#1d4ed8",border:"none",borderRadius:12,padding:14,fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginTop:14,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"},

  // Home
  greeting:{fontSize:24,fontWeight:800,color:"#0f172a",padding:"18px 0 14px"},
  quickGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20},
  quickBtn:{background:"rgba(255,255,255,0.75)",backdropFilter:"blur(12px)",border:"1px solid rgba(219,234,254,0.7)",borderRadius:16,padding:"14px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8,fontFamily:"inherit",transition:"all 0.18s ease"},
  quickLabel:{fontSize:12,fontWeight:700,color:"#334155"},

  sectionHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,marginTop:4},
  sectionTitle:{fontSize:15,fontWeight:800,color:"#0f172a"},
  sectionLink:{background:"transparent",border:"none",color:"#3b82f6",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},

  // Shoot card
  shootCard:{background:"rgba(255,255,255,0.85)",backdropFilter:"blur(10px)",border:"1px solid rgba(226,232,240,0.5)",borderRadius:16,padding:"14px 16px",marginBottom:8,transition:"all 0.18s ease"},
  shootCardRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8},
  shootName:{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:3},
  shootMeta:{fontSize:12,color:"#94a3b8"},
  shootPrice:{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:6},
  shootFinRow:{display:"flex",gap:12,marginBottom:8,padding:"7px 10px",background:"rgba(239,246,255,0.6)",borderRadius:10},
  shootFinTag:{fontSize:12,color:"#3b82f6",fontWeight:600},
  shootBottom:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  shootType:{fontSize:11,padding:"3px 10px",borderRadius:20,background:"rgba(219,234,254,0.7)",color:"#1d4ed8",fontWeight:700},
  shootPhone:{fontSize:11,color:"#94a3b8"},
  editBtn:{background:"rgba(239,246,255,0.8)",border:"1px solid rgba(191,219,254,0.5)",color:"#1d4ed8",padding:"4px 12px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600},
  deleteBtn:{background:"rgba(254,242,242,0.8)",border:"1px solid rgba(254,202,202,0.5)",color:"#ef4444",padding:"4px 12px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600},

  // Payment
  payBadge:{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,cursor:"pointer",fontFamily:"inherit"},
  payMenu:{position:"absolute",top:"calc(100% + 6px)",left:0,background:"rgba(255,255,255,0.98)",backdropFilter:"blur(20px)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:14,padding:8,minWidth:180,zIndex:100,boxShadow:"0 8px 32px rgba(15,23,42,0.12)"},
  payMenuItem:{width:"100%",background:"transparent",border:"none",textAlign:"right",padding:"9px 10px",fontSize:13,color:"#334155",cursor:"pointer",fontFamily:"inherit",borderRadius:8,display:"flex",alignItems:"center",gap:8},

  // Calendar
  calWrap:{background:"rgba(255,255,255,0.75)",backdropFilter:"blur(12px)",border:"1px solid rgba(219,234,254,0.6)",borderRadius:20,padding:16,marginBottom:16,marginTop:4},
  calHead:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  calTitle:{fontSize:14,fontWeight:700,color:"#0f172a"},
  calNav:{background:"transparent",border:"none",color:"#3b82f6",fontSize:22,cursor:"pointer",padding:"0 6px",fontFamily:"inherit",lineHeight:1},
  calGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3},
  calDayName:{textAlign:"center",fontSize:10,color:"#94a3b8",fontWeight:700,padding:"3px 0"},
  calCell:{background:"rgba(248,250,252,0.6)",borderRadius:8,padding:"5px 2px",minHeight:32,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"1px solid transparent"},
  calToday:{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"none"},
  calHasShoot:{background:"rgba(239,246,255,0.9)",border:"1px solid rgba(191,219,254,0.6)"},
  calDot:{width:4,height:4,borderRadius:"50%",background:"#3b82f6",marginTop:2},

  // Form
  input:{width:"100%",background:"rgba(248,250,252,0.9)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:12,color:"#1e293b",padding:"12px 14px",fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  typeGrid:{display:"flex",flexWrap:"wrap",gap:8},
  typeChip:{background:"rgba(248,250,252,0.9)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:20,padding:"7px 14px",fontSize:13,color:"#64748b",cursor:"pointer",fontFamily:"inherit",fontWeight:600,transition:"all 0.15s"},
  typeChipActive:{background:"rgba(239,246,255,0.9)",border:"1px solid #bfdbfe",color:"#1d4ed8"},
  submitBtn:{width:"100%",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"#fff",border:"none",borderRadius:14,padding:15,fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(29,78,216,0.3)",marginTop:4},
  gcalBadge:{background:"rgba(239,246,255,0.9)",border:"1px solid rgba(191,219,254,0.6)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#1d4ed8",fontWeight:600,marginBottom:16},
  remainBadge:{background:"rgba(239,246,255,0.9)",border:"1px solid rgba(191,219,254,0.6)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#1d4ed8",fontWeight:700,textAlign:"center",marginBottom:14},

  // Finances
  pageTitle:{fontSize:22,fontWeight:800,color:"#0f172a",padding:"16px 0 12px"},
  finGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16},
  finCard:{background:"rgba(255,255,255,0.75)",backdropFilter:"blur(12px)",border:"1px solid rgba(219,234,254,0.6)",borderRadius:18,padding:16},
  finLabel:{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6},
  finVal:{fontSize:18,fontWeight:800,color:"#0f172a"},
  glassCard:{background:"rgba(255,255,255,0.75)",backdropFilter:"blur(12px)",border:"1px solid rgba(219,234,254,0.6)",borderRadius:20,padding:18,marginBottom:14},
  cardTitle:{fontSize:14,fontWeight:800,color:"#0f172a",marginBottom:14},
  expRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(241,245,249,0.8)"},
  iconBtn:{background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:4},

  // Summary modals
  summaryMonth:{fontSize:16,fontWeight:700,color:"#64748b",marginBottom:16,textAlign:"center"},
  summaryGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14},
  summaryCard:{background:"rgba(248,250,252,0.9)",borderRadius:14,padding:14,border:"1px solid rgba(226,232,240,0.6)"},
  summaryLabel:{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6},
  summaryVal:{fontSize:20,fontWeight:800,color:"#0f172a"},
  summaryShootCount:{textAlign:"center",fontSize:14,color:"#64748b",fontWeight:600},

  // Utils
  emptyCard:{background:"rgba(255,255,255,0.6)",borderRadius:18,padding:"32px 20px",textAlign:"center",marginBottom:12,border:"1px solid rgba(219,234,254,0.5)"},
  emptyIcon:{color:"#bfdbfe",display:"flex",justifyContent:"center",marginBottom:10,transform:"scale(1.4)"},
  emptyText:{fontSize:14,color:"#94a3b8",fontWeight:500},
  loading:{textAlign:"center",padding:"40px",color:"#94a3b8",fontSize:14},
  toast:{position:"fixed",top:66,left:"50%",transform:"translateX(-50%)",color:"#fff",fontWeight:700,padding:"11px 22px",borderRadius:12,zIndex:999,fontSize:14,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",whiteSpace:"nowrap",transition:"all 0.3s ease"},
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input:focus, select:focus, textarea:focus { border-color: #3b82f6 !important; outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
  select option { background: #fff; color: #1e293b; }
  body { -webkit-tap-highlight-color: transparent; overflow-x: hidden; }
  .press-scale:active { transform: scale(0.95) !important; }
  button { transition: opacity 0.15s ease, transform 0.15s ease; }
  button:active { opacity: 0.8; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.2); border-radius: 4px; }

  /* ── Desktop layout ── */
  @media (min-width: 768px) {
    .app-root { display: grid !important; grid-template-columns: 260px 1fr !important; grid-template-rows: 56px 1fr !important; min-height: 100vh !important; }
    .app-header { grid-column: 1 / -1 !important; grid-row: 1 !important; }
    .app-sidebar { grid-column: 1 !important; grid-row: 2 !important; display: flex !important; flex-direction: column !important; background: rgba(255,255,255,0.85) !important; backdrop-filter: blur(20px) !important; border-left: 1px solid rgba(219,234,254,0.6) !important; padding: 24px 16px !important; position: sticky !important; top: 56px !important; height: calc(100vh - 56px) !important; overflow-y: auto !important; }
    .app-main-content { grid-column: 2 !important; grid-row: 2 !important; padding: 24px 32px !important; max-width: 800px !important; }
    .app-bottom-nav { display: none !important; }
    .desktop-nav-item { display: flex !important; align-items: center !important; gap: 12px !important; padding: 12px 16px !important; border-radius: 12px !important; cursor: pointer !important; font-size: 15px !important; font-weight: 600 !important; border: none !important; background: transparent !important; width: 100% !important; text-align: right !important; font-family: inherit !important; color: #334155 !important; transition: all 0.15s !important; margin-bottom: 4px !important; }
    .desktop-nav-item:hover { background: rgba(239,246,255,0.8) !important; color: #1d4ed8 !important; }
    .desktop-nav-item.active { background: rgba(239,246,255,0.9) !important; color: #1d4ed8 !important; }
    .desktop-nav-plus { width: 100% !important; border-radius: 12px !important; margin-top: 8px !important; }
  }
  @media (max-width: 767px) {
    .app-sidebar { display: none !important; }
    .desktop-nav-item { display: none !important; }
  }
`;
