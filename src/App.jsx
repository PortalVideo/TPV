import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://rgcebqgkrqpxjhcfyuiq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY2VicWdrcnFweGpoY2Z5dWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Njg1OTcsImV4cCI6MjA5MTA0NDU5N30.RJVxExApYB2CAFdA8dITiVRA0CFQ26eu1YlzScjSk3g";
const GCAL_CLIENT_ID = "1095246910350-16r6t0vqfoi9u3ivnqmtp376s876rf9q.apps.googleusercontent.com";
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
  return text ? JSON.parse(text) : null;
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
const initialForm = { date: "", clientName: "", location: "", phone: "05", price: "", deposit: "", type: "חתונות / אירועים", notes: "", calendarEventId: null, package: null, drone: false, vintage: false };

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

// ── Mini Calendar ──────────────────────────────────────────────
function MiniCalendar({ shoots }) {
  const [cur, setCur] = useState(new Date());
  const y = cur.getFullYear(), m = cur.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m+1, 0).getDate();
  const MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const DAY_NAMES = ["א","ב","ג","ד","ה","ו","ש"];
  const shootDates = {};
  shoots.forEach(s => { if (!s.date) return; const d = new Date(s.date); if (d.getFullYear()===y && d.getMonth()===m) shootDates[d.getDate()] = s; });
  const td = new Date(); const isToday = d => d===td.getDate() && m===td.getMonth() && y===td.getFullYear();
  const cells = []; const start = (first+1)%7;
  for (let i=0;i<start;i++) cells.push(null);
  for (let d=1;d<=days;d++) cells.push(d);
  return (
    <div style={S.calWrap}>
      <div style={S.calHead}>
        <button style={S.calNav} onClick={()=>setCur(new Date(y,m-1,1))}>‹</button>
        <span style={S.calTitle}>{MONTHS[m]} {y}</span>
        <button style={S.calNav} onClick={()=>setCur(new Date(y,m+1,1))}>›</button>
      </div>
      <div style={S.calGrid}>
        {DAY_NAMES.map(d=><div key={d} style={S.calDayName}>{d}</div>)}
        {cells.map((d,i)=>(
          <div key={i} style={{ ...S.calCell, ...(d&&isToday(d)?S.calToday:{}), ...(d&&shootDates[d]?S.calHasShoot:{}), ...(d===null?{background:"transparent",border:"none"}:{}) }}>
            {d && <span style={{ fontSize: 12, fontWeight: isToday(d)?800:500, color: isToday(d)?"#fff": shootDates[d]?"#1d4ed8":"#334155" }}>{d}</span>}
            {d && shootDates[d] && <div style={S.calDot}/>}
          </div>
        ))}
      </div>
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
function ShootCard({ shoot, onEdit, onDelete, onUpdatePayment, animate }) {
  const [pressed, setPressed] = useState(false);
  const dep = parseFloat(shoot.deposit)||0;
  const total = parseFloat(shoot.price)||0;
  const rem = total - dep;
  return (
    <div style={{ ...S.shootCard, transform: pressed?"scale(0.98)":"scale(1)", opacity: animate?1:0, transition: "all 0.2s ease" }}
      onClick={()=>onEdit(shoot)} onMouseDown={()=>setPressed(true)} onMouseUp={()=>setPressed(false)} onMouseLeave={()=>setPressed(false)}
      onTouchStart={()=>setPressed(true)} onTouchEnd={()=>{ setPressed(false); }}>
      <div style={S.shootCardRow}>
        <div style={{ flex:1 }}>
          <div style={S.shootName}>{shoot.clientName}</div>
          <div style={S.shootMeta}>{shoot.date}{shoot.location?` · ${shoot.location}`:""}</div>
        </div>
        <div style={{ textAlign:"left", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
          <div style={S.shootPrice}>{fmt(shoot.price)}</div>
          <PayBadge shoot={shoot} onUpdate={s=>onUpdatePayment(shoot.id,s)}/>
        </div>
      </div>
      {dep > 0 && (
        <div style={S.shootFinRow}>
          <span style={S.shootFinTag}>מקדמה: {fmt(dep)}</span>
          <span style={S.shootFinTag}>יתרה: {fmt(rem)}</span>
        </div>
      )}
      <div style={S.shootBottom}>
        <span style={S.shootType}>{shoot.type}</span>
        {shoot.phone && <span style={S.shootPhone}>{shoot.phone}</span>}
        <div style={{ marginRight:"auto", display:"flex", gap:6 }}>
          <button style={S.editBtn} onClick={e=>{e.stopPropagation();onEdit(shoot);}}>עריכה</button>
          <button style={S.deleteBtn} onClick={e=>{e.stopPropagation();onDelete(shoot.id);}}>מחיקה</button>
        </div>
      </div>
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
  const [modal, setModal] = useState(null); // "new-event" | "new-expense" | "monthly" | "yearly"
  const [mounted, setMounted] = useState(false);

  useEffect(()=>{ setTimeout(()=>setMounted(true),100); },[]);

  useEffect(()=>{
    const s=document.createElement("script"); s.src="https://accounts.google.com/gsi/client"; s.onload=()=>setGcalReady(true); document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    const saved=localStorage.getItem("tpv_session");
    if(saved){ try{ const {user,access_token}=JSON.parse(saved); setUser(user); setAuthToken(access_token); }catch{} }
    const gcal=localStorage.getItem("tpv_gcal"); if(gcal) setGcalToken(gcal);
    const hash=window.location.hash;
    if(hash.includes("access_token")){
      const params=new URLSearchParams(hash.replace("#",""));
      const at=params.get("access_token");
      if(at){ fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${at}`}}).then(r=>r.json()).then(u=>{ setUser(u); setAuthToken(at); localStorage.setItem("tpv_session",JSON.stringify({user:u,access_token:at})); window.history.replaceState({},"",window.location.pathname); }); }
    }
  },[]);

  useEffect(()=>{ if(authToken) loadData(); },[authToken]);

  async function loadData(){
    setLoading(true);
    try{
      const [s,e]=await Promise.all([sbFetch("shoots?order=date.desc",{},authToken),sbFetch("expenses?order=created_at.desc",{},authToken)]);
      setShoots((s||[]).map(r=>({id:r.id,date:r.date,clientName:r.client_name,phone:r.phone||"",type:r.type,location:r.location||"",price:r.price,deposit:r.deposit||0,paymentStatus:r.payment_status||"לא שולם",notes:r.notes||"",calendarEventId:r.calendar_event_id,package:r.package||null,drone:r.drone||false,vintage:r.vintage||false})));
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
      const r=await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events",{method:"POST",headers:{Authorization:`Bearer ${gcalToken}`,"Content-Type":"application/json"},body:JSON.stringify({summary:`🎬 ${shoot.clientName}`,location:shoot.location||"",description:`סוג: ${shoot.type}\nסכום: ${fmt(shoot.price)}\nמקדמה: ${fmt(shoot.deposit||0)}\nטלפון: ${shoot.phone||""}`,start:{date:shoot.date},end:{date:shoot.date},colorId:"7"})});
      if(r.status===401){setGcalToken(null);localStorage.removeItem("tpv_gcal");return null;}
      const d=await r.json(); return d.id||null;
    }catch{return null;}
  }

  async function gcalUpdate(shoot){
    if(!gcalToken||!shoot.calendarEventId) return;
    try{ await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${shoot.calendarEventId}`,{method:"PUT",headers:{Authorization:`Bearer ${gcalToken}`,"Content-Type":"application/json"},body:JSON.stringify({summary:`🎬 ${shoot.clientName}`,location:shoot.location||"",description:`סוג: ${shoot.type}\nסכום: ${fmt(shoot.price)}`,start:{date:shoot.date},end:{date:shoot.date},colorId:"7"})}); }catch{}
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
        await sbFetch(`shoots?id=eq.${editId}`,{method:"PATCH",body:JSON.stringify({date:form.date,client_name:form.clientName,phone:form.phone,type:form.type,location:form.location,price:parseFloat(form.price)||0,deposit:parseFloat(form.deposit)||0,payment_status:form.paymentStatus||"לא שולם",notes:form.notes,calendar_event_id:calId,package:form.package||null,drone:form.drone||false,vintage:form.vintage||false})},authToken);
        setShoots(shoots.map(s=>s.id===editId?updated:s)); showToast("עודכן ✓"); setModal(null); setView("history");
      }catch{ showToast("שגיאה","error"); return; }
      setEditId(null);
    } else {
      let calId=gcalToken?await gcalCreate(form):null;
      try{
        const res=await sbFetch("shoots",{method:"POST",body:JSON.stringify({date:form.date,client_name:form.clientName,phone:form.phone,type:form.type,location:form.location,price:parseFloat(form.price)||0,deposit:parseFloat(form.deposit)||0,payment_status:"לא שולם",notes:form.notes,calendar_event_id:calId,package:form.package||null,drone:form.drone||false,vintage:form.vintage||false})},authToken);
        setShoots([{id:res[0].id,...form,paymentStatus:"לא שולם",calendarEventId:calId},...shoots]);
        showToast(gcalToken&&calId?"נשמר + לוח שנה ✓":"נשמר ✓"); setModal(null);
      }catch{ showToast("שגיאה","error"); return; }
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
  const totalIncome = shoots.reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const totalExp = expenses.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const net = totalIncome - totalExp;
  const paid = shoots.filter(s=>s.paymentStatus==="שולם").reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const unpaid = shoots.filter(s=>s.paymentStatus!=="שולם").reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "טל";

  // Monthly summary
  const curMonth = getCurrentMonth();
  const monthlyIncome = shoots.filter(s=>s.date?.startsWith(curMonth)).reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const monthlyExp = expenses.filter(e=>e.month===curMonth).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);

  // Yearly summary
  const curYear = new Date().getFullYear().toString();
  const yearlyIncome = shoots.filter(s=>s.date?.startsWith(curYear)).reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const yearlyExp = expenses.filter(e=>e.month?.startsWith(curYear)).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);

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
    <div style={S.root}>
      <style>{CSS}</style>
      {toast&&<div style={{...S.toast,background:toast.type==="error"?"#ef4444":"#1d4ed8"}}>{toast.msg}</div>}

      {/* Overlays for side panels */}
      {(menuOpen||settingsOpen)&&<div style={S.sideOverlay} onClick={()=>{setMenuOpen(false);setSettingsOpen(false);}}/>}

      {/* Side Menu */}
      <div style={{...S.sideMenu,transform:menuOpen?"translateX(0)":"translateX(100%)"}}>
        <div style={S.sideHeader}>תפריט</div>
        {[{label:"דף הבית",v:"home"},{label:"היסטוריה",v:"history"},{label:"כספים",v:"finances"}].map(item=>(
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

      {/* Header */}
      <header style={S.header}>
        <button style={S.headerBtn} onClick={()=>{setSettingsOpen(false);setMenuOpen(o=>!o);}}>{Icon.menu}</button>
        <div style={S.headerLogo}>Tal Porat <span style={{color:"#3b82f6"}}>Video</span></div>
        <button style={S.headerBtn} onClick={()=>{setMenuOpen(false);setSettingsOpen(o=>!o);}}>{Icon.settings}</button>
      </header>

      {/* Screens */}
      <div style={{position:"relative",minHeight:"calc(100vh - 56px - 70px)"}}>

        {/* HOME */}
        <Screen visible={view==="home"}>
          <div style={S.main}>
            <div style={S.greeting}>היי {firstName} 👋</div>

            {/* Quick Actions */}
            <div style={S.quickGrid}>
              {[
                {icon:Icon.newEvent, label:"אירוע חדש", action:()=>{setForm(initialForm);setEditId(null);setModal("new-event");}},
                {icon:Icon.expense, label:"הוצאה חדשה", action:()=>setModal("new-expense")},
                {icon:Icon.chart, label:"סיכום חודשי", action:()=>setModal("monthly")},
                {icon:Icon.yearly, label:"ייצוא דוח", action:()=>setModal("export")},
              ].map((q,i)=>(
                <button key={i} style={S.quickBtn} onClick={q.action} className="press-scale">
                  <span style={{color:"#1d4ed8"}}>{q.icon}</span>
                  <span style={S.quickLabel}>{q.label}</span>
                </button>
              ))}
            </div>

            {/* Future shoots */}
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>אירועים קרובים</span>
              <button style={S.sectionLink} onClick={()=>setView("history")}>הכל</button>
            </div>
            {futureShoot.length===0 ? (
              <div style={S.emptyCard}><div style={S.emptyIcon}>{Icon.calendar}</div><div style={S.emptyText}>אין אירועים קרובים</div></div>
            ) : futureShoot.slice(0,3).map((s,i)=>(
              <ShootCard key={s.id} shoot={s} animate={mounted} onEdit={handleEditShoot} onDelete={handleDeleteShoot} onUpdatePayment={handleUpdatePayment}/>
            ))}

            {/* Calendar */}
            <MiniCalendar shoots={shoots}/>

            {/* Past shoots */}
            {pastShoots.length>0&&(
              <>
                <div style={S.sectionHeader}>
                  <span style={S.sectionTitle}>אירועים קודמים</span>
                  <button style={S.sectionLink} onClick={()=>setView("history")}>הכל</button>
                </div>
                {pastShoots.slice(0,3).map(s=>(
                  <ShootCard key={s.id} shoot={s} animate={mounted} onEdit={handleEditShoot} onDelete={handleDeleteShoot} onUpdatePayment={handleUpdatePayment}/>
                ))}
              </>
            )}
          </div>
        </Screen>

        {/* HISTORY */}
        <Screen visible={view==="history"}>
          <div style={S.main}>
            <div style={S.pageTitle}>היסטוריה</div>
            {loading ? <div style={S.loading}>טוען...</div> :
             shoots.length===0 ? <div style={S.emptyCard}><div style={S.emptyIcon}>{Icon.history}</div><div style={S.emptyText}>אין צילומים עדיין</div></div> :
             shoots.map(s=><ShootCard key={s.id} shoot={s} animate={mounted} onEdit={handleEditShoot} onDelete={handleDeleteShoot} onUpdatePayment={handleUpdatePayment}/>)
            }
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

            <div style={S.glassCard}>
              <div style={S.cardTitle}>הוסף הוצאה</div>
              <FormGroup label="חודש"><input type="month" style={S.input} value={expForm.month} onChange={e=>setExpForm({...expForm,month:e.target.value})}/></FormGroup>
              <FormGroup label="תיאור"><input type="text" placeholder="חיוב אשראי, ציוד..." style={S.input} value={expForm.description} onChange={e=>setExpForm({...expForm,description:e.target.value})}/></FormGroup>
              <FormGroup label="סכום (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})}/></FormGroup>
              <button style={S.submitBtn} onClick={handleAddExpense}>הוסף הוצאה</button>
            </div>

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

      {/* Bottom Nav - RTL: + / בית / היסטוריה / כספים */}
      <nav style={S.bottomNav}>
        {/* Plus button - far left in RTL */}
        <button style={S.navPlus} className="press-scale" onClick={()=>{setForm(initialForm);setEditId(null);setModal("new-event");}}>
          {Icon.plus}
        </button>

        {[
          {v:"home",icon:Icon.home,label:"בית"},
          {v:"history",icon:Icon.history,label:"היסטוריה"},
          {v:"finances",icon:Icon.finance,label:"כספים"},
        ].map(item=>(
          <button key={item.v} style={{...S.navItem,...(view===item.v?S.navItemActive:{})}} onClick={()=>setView(item.v)}>
            <span style={{color:view===item.v?"#1d4ed8":"#94a3b8",display:"flex"}}>{item.icon}</span>
            <span style={{...S.navLabel,color:view===item.v?"#1d4ed8":"#94a3b8"}}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Modals ── */}

      {/* New Event */}
      <Modal open={modal==="new-event"} onClose={()=>{setModal(null);setEditId(null);setForm(initialForm);}} title={editId?"עריכת אירוע":"אירוע חדש"}>
        {gcalToken&&<div style={S.gcalBadge}>🗓 יסונכרן ל-Google Calendar</div>}
        <FormGroup label="תאריך"><input type="date" style={S.input} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></FormGroup>
        <FormGroup label="שם לקוח"><input type="text" placeholder="שם מלא" style={S.input} value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})}/></FormGroup>
        <FormGroup label="מקום"><input type="text" placeholder="אולם / כתובת / מיקום" style={S.input} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></FormGroup>
        <FormGroup label="טלפון"><input type="tel" inputMode="numeric" placeholder="05X-XXXXXXX" style={S.input} value={form.phone} onChange={e=>{ let v=e.target.value.replace(/\D/g,""); if(v.length>0&&!v.startsWith("05")) v="05"+v.replace(/^0+/,""); setForm({...form,phone:v}); }}/></FormGroup>
        <FormGroup label="סכום עסקה (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></FormGroup>
        <FormGroup label="מקדמה ששולמה (₪)"><input type="number" inputMode="numeric" placeholder="0" style={S.input} value={form.deposit} onChange={e=>setForm({...form,deposit:e.target.value})}/></FormGroup>
        {form.price&&form.deposit&&<div style={S.remainBadge}>יתרה לגביה: {fmt((parseFloat(form.price)||0)-(parseFloat(form.deposit)||0))}</div>}
        <FormGroup label="סוג צילום">
          <div style={S.typeGrid}>
            {SHOOT_TYPES.map(t=>(
              <button key={t} style={{...S.typeChip,...(form.type===t?S.typeChipActive:{})}} onClick={()=>setForm({...form,type:t})}>{t}</button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="חבילה">
          <div style={{display:"flex",gap:10}}>
            {["חבילה ראשונה","חבילה שנייה"].map(p=>(
              <button key={p} style={{flex:1,padding:"11px 8px",borderRadius:12,fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer",transition:"all 0.15s",background:form.package===p?"linear-gradient(135deg,#1d4ed8,#3b82f6)":"rgba(248,250,252,0.9)",color:form.package===p?"#fff":"#64748b",border:form.package===p?"1px solid #1d4ed8":"1px solid rgba(226,232,240,0.8)"}}
                onClick={()=>{ const isSecond=p==="חבילה שנייה"; setForm({...form,package:p,drone:isSecond?true:form.drone,vintage:isSecond?true:form.vintage}); }}>
                {p}
              </button>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="תוספות">
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[{key:"drone",label:"צילום רחפן"},{key:"vintage",label:'צילום וינטג' בקלטת'}].map(cb=>(
              <label key={cb.key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}}>
                <div onClick={()=>setForm({...form,[cb.key]:!form[cb.key]})} style={{width:22,height:22,borderRadius:6,border:form[cb.key]?"2px solid #1d4ed8":"2px solid rgba(203,213,225,0.9)",background:form[cb.key]?"#1d4ed8":"rgba(248,250,252,0.9)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",flexShrink:0}}>
                  {form[cb.key]&&<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{fontSize:14,fontWeight:600,color:"#334155"}}>{cb.label}</span>
              </label>
            ))}
          </div>
        </FormGroup>
        <FormGroup label="הערות"><textarea placeholder="פרטים נוספים..." style={{...S.input,minHeight:72,resize:"vertical"}} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></FormGroup>
        <button style={S.submitBtn} onClick={handleSubmitShoot}>{editId?"עדכן אירוע":"שמור אירוע"}</button>
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

      {/* Export Modal */}
      <Modal open={modal==="export"} onClose={()=>setModal(null)} title="ייצוא דוח">
        <div style={{marginBottom:16,color:"#64748b",fontSize:14}}>בחר איזה דוח לייצא:</div>
        <button style={{...S.submitBtn,marginBottom:12,background:"linear-gradient(135deg,#166534,#16a34a)"}} onClick={()=>{
          const rows = [["תאריך","לקוח","סוג","מיקום","טלפון","סכום","מקדמה","יתרה","סטטוס","הערות"],...shoots.map(s=>[s.date,s.clientName,s.type,s.location,s.phone,s.price,s.deposit,(parseFloat(s.price)||0)-(parseFloat(s.deposit)||0),s.paymentStatus,s.notes])];
          const csv = rows.map(r=>r.map(c=>'"'+(c||"")+'"').join(",")).join("
");
          const blob = new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
          const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="צילומים.csv"; a.click();
          setModal(null);
        }}>📊 ייצוא לאקסל (CSV)</button>
        <button style={{...S.submitBtn,background:"linear-gradient(135deg,#1e3a8a,#2563eb)"}} onClick={()=>{
          const year = new Date().getFullYear();
          const monthlyData = Array.from({length:12},(_,i)=>{
            const m = String(i+1).padStart(2,"0");
            const key = year+"-"+m;
            const inc = shoots.filter(s=>s.date?.startsWith(key)).reduce((s,r)=>s+(parseFloat(r.price)||0),0);
            const exp = expenses.filter(e=>e.month===key).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
            return [key,inc,exp,inc-exp];
          });
          const rows = [["חודש","הכנסות","הוצאות","נטו"],...monthlyData];
          const csv = rows.map(r=>r.map(c=>'"'+(c||"")+'"').join(",")).join("
");
          const blob = new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
          const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="דוח-שנתי-"+year+".csv"; a.click();
          setModal(null);
        }}>📈 דוח שנתי</button>
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
  main:{maxWidth:520,margin:"0 auto",padding:"16px 16px calc(120px + env(safe-area-inset-bottom))"},

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
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderTop:"1px solid rgba(219,234,254,0.6)",display:"flex",alignItems:"center",justifyContent:"space-around",padding:"12px 8px",paddingBottom:"calc(16px + env(safe-area-inset-bottom))",zIndex:40},
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
  shootCard:{background:"rgba(255,255,255,0.78)",backdropFilter:"blur(12px)",border:"1px solid rgba(219,234,254,0.6)",borderRadius:18,padding:16,marginBottom:10,cursor:"pointer",transition:"all 0.18s ease"},
  shootCardRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8},
  shootName:{fontSize:15,fontWeight:700,color:"#0f172a",marginBottom:3},
  shootMeta:{fontSize:12,color:"#94a3b8"},
  shootPrice:{fontSize:16,fontWeight:800,color:"#0f172a",marginBottom:6},
  shootFinRow:{display:"flex",gap:12,marginBottom:8,padding:"7px 10px",background:"rgba(239,246,255,0.6)",borderRadius:10},
  shootFinTag:{fontSize:12,color:"#3b82f6",fontWeight:600},
  shootBottom:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  shootType:{fontSize:11,padding:"3px 10px",borderRadius:20,background:"rgba(219,234,254,0.7)",color:"#1d4ed8",fontWeight:700},
  shootPhone:{fontSize:11,color:"#94a3b8"},
  actionBtn:{background:"rgba(248,250,252,0.9)",border:"1px solid rgba(226,232,240,0.6)",color:"#334155",padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:14,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",minWidth:32},
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
  input:{width:"100%",background:"rgba(248,250,252,0.9)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:12,color:"#1e293b",padding:"13px 14px",fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",display:"block"},
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
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.2); border-radius: 4px; }
`;
