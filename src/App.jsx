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
const initialForm = { date: "", clientName: "", location: "", phone: "05", price: "", deposit: "", type: "חתונות / אירועים", notes: "", calendarEventId: null };

function fmt(n) { return Number(n || 0).toLocaleString("he-IL") + " ₪"; }
function getCurrentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }

// ── Mini Calendar ─────────────────────────────────────────────
function MiniCalendar({ shoots }) {
  const [cur, setCur] = useState(new Date());
  const y = cur.getFullYear(), m = cur.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m+1, 0).getDate();
  const months = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const dayNames = ["א","ב","ג","ד","ה","ו","ש"];
  const shootDates = {};
  shoots.forEach(s => {
    if (!s.date) return;
    const d = new Date(s.date);
    if (d.getFullYear()===y && d.getMonth()===m) shootDates[d.getDate()] = s;
  });
  const today = new Date();
  const isToday = d => d===today.getDate() && m===today.getMonth() && y===today.getFullYear();
  const cells = [];
  const start = (first+1)%7;
  for (let i=0;i<start;i++) cells.push(null);
  for (let d=1;d<=days;d++) cells.push(d);
  return (
    <div style={gl.calWrap}>
      <div style={gl.calHeader}>
        <button style={gl.calNav} onClick={()=>setCur(new Date(y,m-1,1))}>‹</button>
        <span style={gl.calTitle}>{months[m]} {y}</span>
        <button style={gl.calNav} onClick={()=>setCur(new Date(y,m+1,1))}>›</button>
      </div>
      <div style={gl.calGrid}>
        {dayNames.map(d=><div key={d} style={gl.calDayName}>{d}</div>)}
        {cells.map((d,i)=>(
          <div key={i} style={{...gl.calCell, ...(d&&isToday(d)?gl.calToday:{}), ...(d&&shootDates[d]?gl.calShoot:{}), ...(d===null?{background:"transparent",border:"none"}:{})}}>
            {d&&<span style={{fontSize:12,fontWeight:isToday(d)?800:500,color:isToday(d)?"#fff":shootDates[d]?"#4da8ff":"#334"}}>{d}</span>}
            {d&&shootDates[d]&&<div style={gl.calDot}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Payment Status Badge ──────────────────────────────────────
function PayBadge({ shoot, onUpdate }) {
  const [open, setOpen] = useState(false);
  const total = parseFloat(shoot.price)||0;
  const deposit = parseFloat(shoot.deposit)||0;
  const remaining = total - deposit;
  const status = shoot.paymentStatus || "לא שולם";
  const colors = { "שולם": {bg:"#e8f8f0",color:"#1a7a4a",border:"#b8e8d0"}, "מקדמה": {bg:"#fff8e0",color:"#a07800",border:"#f0d888"}, "לא שולם": {bg:"#fef0f0",color:"#c03030",border:"#f8c0c0"} };
  const c = colors[status] || colors["לא שולם"];
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{...gl.payBadge, background:c.bg, color:c.color, border:`1px solid ${c.border}`}}>
        {status} ▾
      </button>
      {open && (
        <div style={gl.payMenu}>
          <div style={gl.payMenuTitle}>עדכון תשלום</div>
          {deposit>0&&<div style={gl.payInfo}>מקדמה: {fmt(deposit)}</div>}
          {remaining>0&&<div style={gl.payInfo}>יתרה: {fmt(remaining)}</div>}
          <div style={gl.payMenuDivider}/>
          {["לא שולם","מקדמה","שולם"].map(s=>(
            <button key={s} style={{...gl.payMenuItem, fontWeight:status===s?700:400, color:status===s?"#2563eb":"#334"}}
              onClick={()=>{ onUpdate(s); setOpen(false); }}>
              {s==="שולם"?"✓ שולם במלואו":s==="מקדמה"?"◐ מקדמה התקבלה":"✗ לא שולם"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
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
  const [expenseForm, setExpenseForm] = useState({ month:getCurrentMonth(), amount:"", description:"" });
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gcalToken, setGcalToken] = useState(null);
  const [gcalReady, setGcalReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      const [s,e]=await Promise.all([sbFetch("shoots?order=date.desc",{},authToken), sbFetch("expenses?order=created_at.desc",{},authToken)]);
      setShoots((s||[]).map(r=>({id:r.id,date:r.date,clientName:r.client_name,phone:r.phone||"",type:r.type,location:r.location||"",price:r.price,deposit:r.deposit||0,paymentStatus:r.payment_status||"לא שולם",notes:r.notes||"",calendarEventId:r.calendar_event_id})));
      setExpenses((e||[]).map(r=>({id:r.id,month:r.month,description:r.description,amount:r.amount})));
    }catch{ showToast("שגיאה בטעינה","error"); }
    setLoading(false);
  }

  function showToast(msg,type="success"){ setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

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

  function handleGoogleLogin(){ window.location.href=`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent("https://tpv-eight.vercel.app")}`; }

  function handleLogout(){ setUser(null); setAuthToken(null); setShoots([]); setExpenses([]); localStorage.removeItem("tpv_session"); localStorage.removeItem("tpv_gcal"); setGcalToken(null); setMenuOpen(false); }

  function connectGcal(){
    if(!gcalReady||!window.google){ showToast("Google עדיין נטען","error"); return; }
    const tc=window.google.accounts.oauth2.initTokenClient({ client_id:GCAL_CLIENT_ID, scope:GCAL_SCOPES, callback:(r)=>{ if(r.access_token){ setGcalToken(r.access_token); localStorage.setItem("tpv_gcal",r.access_token); showToast("חובר ל-Google Calendar ✓"); setSettingsOpen(false); } else showToast("שגיאה בחיבור","error"); } });
    tc.requestAccessToken();
  }

  function disconnectGcal(){ setGcalToken(null); localStorage.removeItem("tpv_gcal"); showToast("התנתקת מ-Google Calendar"); }

  async function gcalCreate(shoot){
    if(!gcalToken) return null;
    try{
      const res=await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events",{method:"POST",headers:{Authorization:`Bearer ${gcalToken}`,"Content-Type":"application/json"},body:JSON.stringify({summary:`🎬 ${shoot.clientName}`,location:shoot.location||"",description:`סוג: ${shoot.type}\nסכום: ${shoot.price}₪\nמקדמה: ${shoot.deposit||0}₪\nטלפון: ${shoot.phone||""}`,start:{date:shoot.date},end:{date:shoot.date},colorId:"7"})});
      if(res.status===401){setGcalToken(null);localStorage.removeItem("tpv_gcal");return null;}
      const d=await res.json(); return d.id||null;
    }catch{return null;}
  }

  async function gcalUpdate(shoot){
    if(!gcalToken||!shoot.calendarEventId) return;
    try{ await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${shoot.calendarEventId}`,{method:"PUT",headers:{Authorization:`Bearer ${gcalToken}`,"Content-Type":"application/json"},body:JSON.stringify({summary:`🎬 ${shoot.clientName}`,location:shoot.location||"",description:`סוג: ${shoot.type}\nסכום: ${shoot.price}₪`,start:{date:shoot.date},end:{date:shoot.date},colorId:"7"})}); }catch{}
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
        await sbFetch(`shoots?id=eq.${editId}`,{method:"PATCH",body:JSON.stringify({date:form.date,client_name:form.clientName,phone:form.phone,type:form.type,location:form.location,price:parseFloat(form.price)||0,deposit:parseFloat(form.deposit)||0,payment_status:form.paymentStatus||"לא שולם",notes:form.notes,calendar_event_id:calId})},authToken);
        setShoots(shoots.map(s=>s.id===editId?updated:s)); showToast("עודכן בהצלחה ✓");
      }catch{ showToast("שגיאה בעדכון","error"); return; }
      setEditId(null);
    } else {
      let calId=gcalToken?await gcalCreate(form):null;
      try{
        const res=await sbFetch("shoots",{method:"POST",body:JSON.stringify({date:form.date,client_name:form.clientName,phone:form.phone,type:form.type,location:form.location,price:parseFloat(form.price)||0,deposit:parseFloat(form.deposit)||0,payment_status:"לא שולם",notes:form.notes,calendar_event_id:calId})},authToken);
        setShoots([{id:res[0].id,...form,paymentStatus:"לא שולם",calendarEventId:calId},...shoots]);
        showToast(gcalToken&&calId?"נשמר + נוסף ללוח שנה ✓":"נשמר בהצלחה ✓");
      }catch{ showToast("שגיאה בשמירה","error"); return; }
    }
    setForm(initialForm); setView("home");
  }

  async function handleDeleteShoot(id){
    const shoot=shoots.find(s=>s.id===id);
    if(shoot?.calendarEventId&&gcalToken) await gcalDelete(shoot.calendarEventId);
    try{ await sbFetch(`shoots?id=eq.${id}`,{method:"DELETE"},authToken); setShoots(shoots.filter(s=>s.id!==id)); showToast("נמחק","error"); }
    catch{ showToast("שגיאה","error"); }
  }

  async function handleUpdatePayment(id, status){
    try{
      await sbFetch(`shoots?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({payment_status:status})},authToken);
      setShoots(shoots.map(s=>s.id===id?{...s,paymentStatus:status}:s));
      showToast("סטטוס תשלום עודכן ✓");
    }catch{ showToast("שגיאה","error"); }
  }

  async function handleAddExpense(){
    if(!expenseForm.amount||!expenseForm.description){ showToast("נא למלא סכום ותיאור","error"); return; }
    try{
      const res=await sbFetch("expenses",{method:"POST",body:JSON.stringify({month:expenseForm.month,description:expenseForm.description,amount:parseFloat(expenseForm.amount)||0})},authToken);
      setExpenses([{id:res[0].id,...expenseForm},...expenses]);
      setExpenseForm({month:getCurrentMonth(),amount:"",description:""});
      showToast("הוצאה נוספה ✓");
    }catch{ showToast("שגיאה","error"); }
  }

  async function handleDeleteExpense(id){
    try{ await sbFetch(`expenses?id=eq.${id}`,{method:"DELETE"},authToken); setExpenses(expenses.filter(e=>e.id!==id)); showToast("נמחק","error"); }
    catch{ showToast("שגיאה","error"); }
  }

  function handleEditShoot(shoot){ setForm({...shoot}); setEditId(shoot.id); setView("new"); }

  const totalIncome=shoots.reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const totalExp=expenses.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const net=totalIncome-totalExp;
  const paid=shoots.filter(s=>s.paymentStatus==="שולם").reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const unpaid=shoots.filter(s=>s.paymentStatus!=="שולם").reduce((s,r)=>s+(parseFloat(r.price)||0),0);
  const remaining=shoots.filter(s=>s.paymentStatus==="מקדמה").reduce((s,r)=>s+((parseFloat(r.price)||0)-(parseFloat(r.deposit)||0)),0);
  const nextShoot=shoots.filter(s=>s.date>=new Date().toISOString().split("T")[0]).slice(-1)[0];
  const firstName=user?.user_metadata?.full_name?.split(" ")[0]||user?.email?.split("@")[0]||"טל";

  // ── Login ──────────────────────────────────────────────────
  if(!user) return (
    <div style={gl.loginRoot}>
      <style>{CSS}</style>
      {toast&&<div style={{...gl.toast,background:toast.type==="error"?"#ef4444":"#2563eb"}}>{toast.msg}</div>}
      <div style={gl.loginCard}>
        <div style={gl.loginLogo}>טל פורת וידאו</div>
        <div style={gl.loginSub}>מערכת ניהול ימי צילום</div>
        <div style={gl.authTabs}>
          {["login","register"].map(v=>(
            <button key={v} onClick={()=>setAuthView(v)} style={{...gl.authTab,..  (authView===v?gl.authTabActive:{})}}>
              {v==="login"?"התחברות":"הרשמה"}
            </button>
          ))}
        </div>
        <button onClick={handleGoogleLogin} style={gl.googleBtn}>
          <span style={{fontSize:18,fontWeight:900,color:"#4285f4"}}>G</span>
          {authView==="login"?"התחבר עם Google":"הרשם עם Google"}
        </button>
        <div style={gl.divider}><div style={gl.dividerLine}/><span style={gl.dividerText}>או</span><div style={gl.dividerLine}/></div>
        <input type="email" placeholder="אימייל" style={gl.authInput} value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/>
        <input type="password" placeholder="סיסמה" style={gl.authInput} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&(authView==="login"?handleLogin():handleRegister())}/>
        <button style={gl.authBtn} onClick={authView==="login"?handleLogin:handleRegister} disabled={authLoading}>
          {authLoading?"...":authView==="login"?"התחבר":"הרשם"}
        </button>
      </div>
    </div>
  );

  // ── App ────────────────────────────────────────────────────
  return (
    <div style={gl.root}>
      <style>{CSS}</style>
      {toast&&<div style={{...gl.toast,background:toast.type==="error"?"#ef4444":"#2563eb"}}>{toast.msg}</div>}

      {/* Overlays */}
      {menuOpen&&<div style={gl.overlay} onClick={()=>setMenuOpen(false)}/>}
      {settingsOpen&&<div style={gl.overlay} onClick={()=>setSettingsOpen(false)}/>}

      {/* Side Menu */}
      {menuOpen&&(
        <div style={gl.sideMenu}>
          <div style={gl.sideMenuTitle}>תפריט</div>
          <button style={gl.sideMenuItem} onClick={()=>{setView("home");setMenuOpen(false);}}>🏠 דף הבית</button>
          <button style={gl.sideMenuItem} onClick={()=>{setView("history");setMenuOpen(false);}}>📋 היסטוריה</button>
          <button style={gl.sideMenuItem} onClick={()=>{setView("finances");setMenuOpen(false);}}>💰 כספים</button>
          <div style={gl.sideMenuDivider}/>
          <button style={{...gl.sideMenuItem,color:"#ef4444"}} onClick={handleLogout}>⏻ התנתק</button>
        </div>
      )}

      {/* Settings Panel */}
      {settingsOpen&&(
        <div style={gl.settingsPanel}>
          <div style={gl.sideMenuTitle}>הגדרות</div>
          <div style={gl.settingRow}>
            <span style={gl.settingLabel}>Google Calendar</span>
            {gcalToken
              ? <button style={gl.settingBtnRed} onClick={()=>{disconnectGcal();setSettingsOpen(false);}}>התנתק</button>
              : <button style={gl.settingBtnBlue} onClick={connectGcal}>חבר</button>
            }
          </div>
          {gcalToken&&<div style={gl.settingConnected}>✓ מחובר ומסונכרן</div>}
          <div style={gl.settingRow}>
            <span style={gl.settingLabel}>חשבון</span>
            <span style={{fontSize:12,color:"#64748b"}}>{user?.email}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={gl.header}>
        <button style={gl.headerBtn} onClick={()=>{setSettingsOpen(false);setMenuOpen(o=>!o);}}>☰</button>
        <div style={gl.headerLogo}>טל פורת וידאו</div>
        <button style={gl.headerBtn} onClick={()=>{setMenuOpen(false);setSettingsOpen(o=>!o);}}>⚙</button>
      </header>

      {/* Main */}
      <main style={gl.main}>
        {loading?(
          <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}>טוען...</div>
        ):(
        <>

        {/* HOME */}
        {view==="home"&&(
          <div style={gl.fadeIn}>
            <div style={gl.greeting}>היי {firstName} 👋</div>

            {/* Next shoot card */}
            {nextShoot&&(
              <div style={gl.nextCard}>
                <div style={gl.nextLabel}>הצילום הבא שלך</div>
                <div style={gl.nextName}>{nextShoot.clientName}</div>
                <div style={gl.nextDate}>{nextShoot.date} · {nextShoot.location||nextShoot.type}</div>
                <div style={gl.nextPrice}>{fmt(nextShoot.price)}</div>
              </div>
            )}

            {/* Stats row */}
            <div style={gl.statsRow}>
              <div style={{...gl.statPill,background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.25)"}}>
                <div style={gl.statPillLabel}>ברוטו</div>
                <div style={{...gl.statPillVal,color:"#2563eb"}}>{fmt(totalIncome)}</div>
              </div>
              <div style={{...gl.statPill,background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.25)"}}>
                <div style={gl.statPillLabel}>נטו</div>
                <div style={{...gl.statPillVal,color:"#10b981"}}>{fmt(net)}</div>
              </div>
              <div style={{...gl.statPill,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)"}}>
                <div style={gl.statPillLabel}>ממתין</div>
                <div style={{...gl.statPillVal,color:"#f59e0b"}}>{fmt(unpaid)}</div>
              </div>
            </div>

            {/* Quick actions */}
            <div style={gl.quickRow}>
              {[
                {icon:"📅",label:"לוח שנה",action:()=>{}},
                {icon:"📊",label:"דוח הכנסות",action:()=>setView("finances")},
                {icon:"➕",label:"הוצאה",action:()=>setView("finances")},
                {icon:"📋",label:"כל הצילומים",action:()=>setView("history")},
              ].map(q=>(
                <button key={q.label} style={gl.quickBtn} onClick={q.action}>
                  <span style={gl.quickIcon}>{q.icon}</span>
                  <span style={gl.quickLabel}>{q.label}</span>
                </button>
              ))}
            </div>

            <MiniCalendar shoots={shoots}/>

            {/* Recent shoots */}
            <div style={gl.sectionHeader}>
              <span style={gl.sectionTitle}>צילומים אחרונים</span>
              <button style={gl.sectionLink} onClick={()=>setView("history")}>הכל ›</button>
            </div>
            {shoots.length===0?(
              <div style={gl.empty}><div style={{fontSize:36,marginBottom:8}}>🎬</div><div>אין צילומים עדיין</div></div>
            ):shoots.slice(0,4).map(s=>(
              <div key={s.id} style={gl.shootCard} onClick={()=>handleEditShoot(s)}>
                <div style={gl.shootCardLeft}>
                  <div style={gl.shootName}>{s.clientName}</div>
                  <div style={gl.shootMeta}>{s.date}{s.location?` · ${s.location}`:""}</div>
                </div>
                <div style={gl.shootCardRight}>
                  <div style={gl.shootPrice}>{fmt(s.price)}</div>
                  <PayBadge shoot={s} onUpdate={status=>handleUpdatePayment(s.id,status)}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NEW SHOOT FORM */}
        {view==="new"&&(
          <div style={gl.fadeIn}>
            <div style={gl.formTitle}>{editId?"עריכת צילום":"אירוע חדש"}</div>
            {gcalToken&&<div style={gl.gcalBadge}>🗓 יסונכרן ל-Google Calendar</div>}

            <div style={gl.formSection}>
              <div style={gl.formSectionTitle}>פרטי האירוע</div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>תאריך</label>
                <input type="date" style={gl.formInput} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
              </div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>שם לקוח</label>
                <input type="text" placeholder="שם מלא" style={gl.formInput} value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})}/>
              </div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>מקום</label>
                <input type="text" placeholder="כתובת / אולם / מיקום" style={gl.formInput} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
              </div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>טלפון</label>
                <input type="tel" inputMode="numeric" placeholder="05X-XXXXXXX" style={gl.formInput} value={form.phone}
                  onChange={e=>{ let v=e.target.value.replace(/\D/g,""); if(!v.startsWith("05")) v="05"+v.replace(/^0*/,""); setForm({...form,phone:v}); }}/>
              </div>
            </div>

            <div style={gl.formSection}>
              <div style={gl.formSectionTitle}>פרטים כספיים</div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>סכום עסקה (₪)</label>
                <input type="number" inputMode="numeric" placeholder="0" style={gl.formInput} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
              </div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>מקדמה ששולמה (₪)</label>
                <input type="number" inputMode="numeric" placeholder="0" style={gl.formInput} value={form.deposit} onChange={e=>setForm({...form,deposit:e.target.value})}/>
              </div>
              {form.price&&form.deposit&&(
                <div style={gl.remainingBadge}>
                  יתרה לגביה: {fmt((parseFloat(form.price)||0)-(parseFloat(form.deposit)||0))}
                </div>
              )}
            </div>

            <div style={gl.formSection}>
              <div style={gl.formSectionTitle}>סוג צילום</div>
              <div style={gl.typeGrid}>
                {SHOOT_TYPES.map(t=>(
                  <button key={t} style={{...gl.typeChip,...(form.type===t?gl.typeChipActive:{})}} onClick={()=>setForm({...form,type:t})}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={gl.formSection}>
              <div style={gl.formSectionTitle}>הערות</div>
              <textarea placeholder="פרטים נוספים, הנחיות מיוחדות..." style={gl.formTextarea} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
            </div>

            <button style={gl.submitBtn} onClick={handleSubmitShoot}>
              {editId?"עדכן אירוע":"שמור אירוע"}
            </button>
            {editId&&(
              <button style={gl.cancelBtn} onClick={()=>{setForm(initialForm);setEditId(null);setView("history");}}>
                ביטול
              </button>
            )}
          </div>
        )}

        {/* HISTORY */}
        {view==="history"&&(
          <div style={gl.fadeIn}>
            <div style={gl.pageTitle}>היסטוריה</div>
            {shoots.length===0?(
              <div style={gl.empty}><div style={{fontSize:40,marginBottom:10}}>🎬</div><div>אין צילומים עדיין</div></div>
            ):shoots.map(s=>{
              const dep=parseFloat(s.deposit)||0;
              const total=parseFloat(s.price)||0;
              const rem=total-dep;
              return(
                <div key={s.id} style={gl.histCard}>
                  <div style={gl.histCardTop}>
                    <div>
                      <div style={gl.histName}>{s.clientName} {s.calendarEventId&&"🗓"}</div>
                      <div style={gl.histMeta}>{s.date}{s.location?` · ${s.location}`:""}</div>
                    </div>
                    <div style={{textAlign:"left"}}>
                      <div style={gl.histPrice}>{fmt(s.price)}</div>
                      <PayBadge shoot={s} onUpdate={status=>handleUpdatePayment(s.id,status)}/>
                    </div>
                  </div>
                  {dep>0&&(
                    <div style={gl.histFinRow}>
                      <span style={gl.histFinLabel}>מקדמה: {fmt(dep)}</span>
                      <span style={gl.histFinLabel}>יתרה: {fmt(rem)}</span>
                    </div>
                  )}
                  <div style={gl.histBottom}>
                    <span style={gl.histType}>{s.type}</span>
                    {s.phone&&<span style={gl.histPhone}>📞 {s.phone}</span>}
                    <div style={{marginRight:"auto",display:"flex",gap:8}}>
                      <button style={gl.editBtn} onClick={()=>handleEditShoot(s)}>עריכה</button>
                      <button style={gl.deleteBtn} onClick={()=>handleDeleteShoot(s.id)}>מחיקה</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FINANCES */}
        {view==="finances"&&(
          <div style={gl.fadeIn}>
            <div style={gl.pageTitle}>כספים</div>
            <div style={gl.finGrid}>
              <div style={{...gl.finCard,gridColumn:"span 2",background:"linear-gradient(135deg,#1d4ed8,#2563eb)"}}>
                <div style={gl.finLabel}>סה"כ הכנסות ברוטו</div>
                <div style={{...gl.finVal,fontSize:28,color:"#fff"}}>{fmt(totalIncome)}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginTop:4}}>{shoots.length} ימי צילום</div>
              </div>
              <div style={gl.finCard}>
                <div style={gl.finLabel}>נטו</div>
                <div style={{...gl.finVal,color:net>=0?"#10b981":"#ef4444"}}>{fmt(net)}</div>
              </div>
              <div style={gl.finCard}>
                <div style={gl.finLabel}>הוצאות</div>
                <div style={{...gl.finVal,color:"#64748b"}}>{fmt(totalExp)}</div>
              </div>
              <div style={gl.finCard}>
                <div style={gl.finLabel}>שולם</div>
                <div style={{...gl.finVal,color:"#10b981"}}>{fmt(paid)}</div>
              </div>
              <div style={gl.finCard}>
                <div style={gl.finLabel}>יתרות לגביה</div>
                <div style={{...gl.finVal,color:"#f59e0b"}}>{fmt(remaining)}</div>
              </div>
            </div>

            <div style={gl.glassCard}>
              <div style={gl.formSectionTitle}>הוסף הוצאה חודשית</div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>חודש</label>
                <input type="month" style={gl.formInput} value={expenseForm.month} onChange={e=>setExpenseForm({...expenseForm,month:e.target.value})}/>
              </div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>תיאור</label>
                <input type="text" placeholder="חיוב אשראי, ציוד..." style={gl.formInput} value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})}/>
              </div>
              <div style={gl.formGroup}>
                <label style={gl.formLabel}>סכום (₪)</label>
                <input type="number" inputMode="numeric" placeholder="0" style={gl.formInput} value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})}/>
              </div>
              <button style={gl.submitBtn} onClick={handleAddExpense}>הוסף הוצאה</button>
            </div>

            {expenses.length>0&&(
              <div style={gl.glassCard}>
                <div style={gl.formSectionTitle}>רשימת הוצאות</div>
                {expenses.map(e=>(
                  <div key={e.id} style={gl.expRow}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>{e.description}</div>
                      <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{e.month}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:15,fontWeight:700,color:"#64748b"}}>{fmt(e.amount)}</span>
                      <button style={{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16}} onClick={()=>handleDeleteExpense(e.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        </>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={gl.bottomNav}>
        <button style={{...gl.navItem,...(view==="home"?gl.navItemActive:{})}} onClick={()=>setView("home")}>
          <span style={gl.navIcon}>🏠</span>
          <span style={gl.navLabel}>בית</span>
        </button>
        <button style={{...gl.navItem,...(view==="finances"?gl.navItemActive:{})}} onClick={()=>setView("finances")}>
          <span style={gl.navIcon}>💰</span>
          <span style={gl.navLabel}>כספים</span>
        </button>
        <button style={gl.navPlus} onClick={()=>{setForm(initialForm);setEditId(null);setView("new");}}>
          <span style={{fontSize:28,fontWeight:300,color:"#fff",lineHeight:1}}>+</span>
        </button>
        <button style={{...gl.navItem,...(view==="history"?gl.navItemActive:{})}} onClick={()=>setView("history")}>
          <span style={gl.navIcon}>📋</span>
          <span style={gl.navLabel}>היסטוריה</span>
        </button>
        <button style={{...gl.navItem}} onClick={()=>{setMenuOpen(false);setSettingsOpen(o=>!o);}}>
          <span style={gl.navIcon}>⚙️</span>
          <span style={gl.navLabel}>הגדרות</span>
        </button>
      </nav>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const gl = {
  // Layout
  root:{minHeight:"100vh",background:"linear-gradient(160deg,#dbeafe 0%,#eff6ff 40%,#f0f9ff 100%)",direction:"rtl",fontFamily:"'Heebo',sans-serif",paddingBottom:90,position:"relative"},
  loginRoot:{minHeight:"100vh",background:"linear-gradient(160deg,#1e3a8a 0%,#1d4ed8 50%,#2563eb 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Heebo',sans-serif",direction:"rtl"},
  main:{maxWidth:520,margin:"0 auto",padding:"16px 16px 0"},

  // Header
  header:{background:"rgba(255,255,255,0.75)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.5)",position:"sticky",top:0,zIndex:50,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,maxWidth:"100%"},
  headerLogo:{fontSize:16,fontWeight:800,color:"#1e3a8a",letterSpacing:0.5},
  headerBtn:{background:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.8)",color:"#1e3a8a",width:38,height:38,borderRadius:12,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"},

  // Bottom Nav
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.85)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.6)",display:"flex",alignItems:"center",justifyContent:"space-around",padding:"8px 8px",paddingBottom:"calc(8px + env(safe-area-inset-bottom))",zIndex:50},
  navItem:{flex:1,background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 0",fontFamily:"inherit"},
  navItemActive:{},
  navIcon:{fontSize:22},
  navLabel:{fontSize:10,fontWeight:600,color:"#94a3b8"},
  navPlus:{width:56,height:56,borderRadius:28,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(37,99,235,0.4)",marginBottom:8,flexShrink:0},

  // Overlays & Menus
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.3)",zIndex:60,backdropFilter:"blur(4px)"},
  sideMenu:{position:"fixed",top:0,right:0,bottom:0,width:260,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)",zIndex:70,padding:"60px 20px 20px",boxShadow:"-4px 0 30px rgba(0,0,0,0.1)"},
  settingsPanel:{position:"fixed",top:56,left:0,right:0,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)",zIndex:70,padding:"20px",boxShadow:"0 4px 30px rgba(0,0,0,0.1)",borderBottom:"1px solid rgba(255,255,255,0.6)"},
  sideMenuTitle:{fontSize:18,fontWeight:800,color:"#1e293b",marginBottom:20},
  sideMenuItem:{width:"100%",background:"transparent",border:"none",textAlign:"right",padding:"14px 0",fontSize:16,color:"#334155",cursor:"pointer",fontFamily:"inherit",fontWeight:600,borderBottom:"1px solid #f1f5f9"},
  sideMenuDivider:{height:1,background:"#e2e8f0",margin:"12px 0"},
  settingRow:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid #f1f5f9"},
  settingLabel:{fontSize:15,fontWeight:600,color:"#334155"},
  settingBtnBlue:{background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},
  settingBtnRed:{background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",borderRadius:8,padding:"6px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},
  settingConnected:{fontSize:12,color:"#10b981",marginTop:4},

  // Login
  loginCard:{width:"100%",maxWidth:360,background:"rgba(255,255,255,0.15)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:24,padding:28},
  loginLogo:{fontSize:22,fontWeight:900,color:"#fff",textAlign:"center",marginBottom:4},
  loginSub:{fontSize:13,color:"rgba(255,255,255,0.7)",textAlign:"center",marginBottom:24},
  authTabs:{display:"flex",background:"rgba(255,255,255,0.1)",borderRadius:12,padding:4,marginBottom:20},
  authTab:{flex:1,background:"transparent",border:"none",color:"rgba(255,255,255,0.7)",padding:"9px",fontSize:14,fontWeight:600,cursor:"pointer",borderRadius:9,fontFamily:"inherit"},
  authTabActive:{background:"rgba(255,255,255,0.2)",color:"#fff"},
  googleBtn:{width:"100%",background:"#fff",color:"#333",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10},
  divider:{display:"flex",alignItems:"center",gap:10,marginBottom:16},
  dividerLine:{flex:1,height:1,background:"rgba(255,255,255,0.2)"},
  dividerText:{fontSize:12,color:"rgba(255,255,255,0.5)"},
  authInput:{width:"100%",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:12,color:"#fff",padding:"13px 14px",fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:12},
  authBtn:{width:"100%",background:"#fff",color:"#1d4ed8",border:"none",borderRadius:12,padding:14,fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginTop:4},

  // Home
  greeting:{fontSize:24,fontWeight:800,color:"#1e293b",padding:"16px 0 12px"},
  nextCard:{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",borderRadius:20,padding:20,marginBottom:16,boxShadow:"0 8px 32px rgba(37,99,235,0.3)"},
  nextLabel:{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6},
  nextName:{fontSize:20,fontWeight:800,color:"#fff",marginBottom:4},
  nextDate:{fontSize:13,color:"rgba(255,255,255,0.8)",marginBottom:8},
  nextPrice:{fontSize:22,fontWeight:800,color:"#fff"},

  statsRow:{display:"flex",gap:10,marginBottom:16},
  statPill:{flex:1,borderRadius:16,padding:"12px 10px",textAlign:"center"},
  statPillLabel:{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4},
  statPillVal:{fontSize:15,fontWeight:800},

  quickRow:{display:"flex",gap:10,marginBottom:16},
  quickBtn:{flex:1,background:"rgba(255,255,255,0.7)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.8)",borderRadius:16,padding:"12px 6px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,fontFamily:"inherit"},
  quickIcon:{fontSize:20},
  quickLabel:{fontSize:10,fontWeight:700,color:"#334155"},

  sectionHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12},
  sectionTitle:{fontSize:16,fontWeight:800,color:"#1e293b"},
  sectionLink:{background:"transparent",border:"none",color:"#2563eb",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},

  shootCard:{background:"rgba(255,255,255,0.7)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.8)",borderRadius:16,padding:16,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"},
  shootCardLeft:{flex:1},
  shootName:{fontSize:15,fontWeight:700,color:"#1e293b",marginBottom:3},
  shootMeta:{fontSize:12,color:"#94a3b8"},
  shootCardRight:{textAlign:"left",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8},
  shootPrice:{fontSize:16,fontWeight:800,color:"#1e293b"},

  // Form
  formTitle:{fontSize:22,fontWeight:800,color:"#1e293b",padding:"16px 0 12px"},
  gcalBadge:{background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#2563eb",fontWeight:600,marginBottom:16},
  formSection:{background:"rgba(255,255,255,0.7)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.8)",borderRadius:20,padding:18,marginBottom:14},
  formSectionTitle:{fontSize:13,fontWeight:800,color:"#64748b",textTransform:"uppercase",letterSpacing:0.8,marginBottom:14},
  formGroup:{marginBottom:14},
  formLabel:{display:"block",fontSize:12,fontWeight:700,color:"#64748b",marginBottom:6,letterSpacing:0.3},
  formInput:{width:"100%",background:"rgba(248,250,252,0.8)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:12,color:"#1e293b",padding:"12px 14px",fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  formTextarea:{width:"100%",background:"rgba(248,250,252,0.8)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:12,color:"#1e293b",padding:"12px 14px",fontSize:15,fontFamily:"inherit",outline:"none",resize:"vertical",minHeight:80,boxSizing:"border-box"},
  typeGrid:{display:"flex",flexWrap:"wrap",gap:8},
  typeChip:{background:"rgba(248,250,252,0.8)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:20,padding:"8px 14px",fontSize:13,color:"#64748b",cursor:"pointer",fontFamily:"inherit",fontWeight:600},
  typeChipActive:{background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.4)",color:"#2563eb"},
  remainingBadge:{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#b45309",fontWeight:700,textAlign:"center"},
  submitBtn:{width:"100%",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"#fff",border:"none",borderRadius:14,padding:16,fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:10,boxShadow:"0 4px 20px rgba(37,99,235,0.3)"},
  cancelBtn:{width:"100%",background:"rgba(255,255,255,0.7)",color:"#64748b",border:"1px solid rgba(226,232,240,0.8)",borderRadius:14,padding:14,fontSize:15,cursor:"pointer",fontFamily:"inherit"},

  // History
  pageTitle:{fontSize:22,fontWeight:800,color:"#1e293b",padding:"16px 0 12px"},
  histCard:{background:"rgba(255,255,255,0.7)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.8)",borderRadius:18,padding:16,marginBottom:12},
  histCardTop:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10},
  histName:{fontSize:16,fontWeight:700,color:"#1e293b",marginBottom:3},
  histMeta:{fontSize:12,color:"#94a3b8"},
  histPrice:{fontSize:17,fontWeight:800,color:"#1e293b",marginBottom:6},
  histFinRow:{display:"flex",gap:16,marginBottom:10,padding:"8px 12px",background:"rgba(248,250,252,0.8)",borderRadius:10},
  histFinLabel:{fontSize:12,color:"#64748b",fontWeight:600},
  histBottom:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"},
  histType:{fontSize:11,padding:"4px 10px",borderRadius:20,background:"rgba(37,99,235,0.1)",color:"#2563eb",fontWeight:700},
  histPhone:{fontSize:11,color:"#94a3b8"},
  editBtn:{background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.2)",color:"#2563eb",padding:"5px 14px",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600},
  deleteBtn:{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444",padding:"5px 14px",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600},

  // Payment badge
  payBadge:{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,cursor:"pointer",fontFamily:"inherit"},
  payMenu:{position:"absolute",top:"calc(100% + 6px)",left:0,background:"rgba(255,255,255,0.98)",backdropFilter:"blur(20px)",border:"1px solid rgba(226,232,240,0.8)",borderRadius:14,padding:10,minWidth:200,zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.12)"},
  payMenuTitle:{fontSize:12,fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,padding:"4px 8px",marginBottom:6},
  payInfo:{fontSize:12,color:"#64748b",padding:"2px 8px"},
  payMenuDivider:{height:1,background:"#f1f5f9",margin:"8px 0"},
  payMenuItem:{width:"100%",background:"transparent",border:"none",textAlign:"right",padding:"9px 8px",fontSize:14,color:"#334155",cursor:"pointer",fontFamily:"inherit",borderRadius:8},

  // Finances
  finGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16},
  finCard:{background:"rgba(255,255,255,0.7)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.8)",borderRadius:18,padding:16},
  finLabel:{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6},
  finVal:{fontSize:20,fontWeight:800,color:"#1e293b"},
  glassCard:{background:"rgba(255,255,255,0.7)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.8)",borderRadius:20,padding:18,marginBottom:14},
  expRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(241,245,249,0.8)"},

  // Calendar
  calWrap:{background:"rgba(255,255,255,0.7)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.8)",borderRadius:20,padding:16,marginBottom:14},
  calHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  calTitle:{fontSize:15,fontWeight:700,color:"#1e293b"},
  calNav:{background:"transparent",border:"none",color:"#2563eb",fontSize:22,cursor:"pointer",padding:"0 8px",fontFamily:"inherit"},
  calGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4},
  calDayName:{textAlign:"center",fontSize:11,color:"#94a3b8",fontWeight:700,padding:"4px 0"},
  calCell:{position:"relative",background:"rgba(248,250,252,0.8)",borderRadius:10,padding:"6px 2px",minHeight:34,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"1px solid transparent"},
  calToday:{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"1px solid transparent"},
  calShoot:{background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.3)"},
  calDot:{width:5,height:5,borderRadius:"50%",background:"#2563eb",marginTop:2},

  // Utils
  empty:{textAlign:"center",padding:"40px 20px",color:"#94a3b8",fontSize:14},
  toast:{position:"fixed",top:66,left:"50%",transform:"translateX(-50%)",color:"#fff",fontWeight:700,padding:"12px 24px",borderRadius:12,zIndex:999,fontSize:14,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",whiteSpace:"nowrap"},
  fadeIn:{animation:"fadeIn 0.2s ease"},
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  input:focus, select:focus, textarea:focus { border-color: #2563eb !important; outline: none; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  button:active { transform: scale(0.97); }
  select option { background: #fff; color: #1e293b; }
  body { -webkit-tap-highlight-color: transparent; }
  input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(37,99,235,0.2); border-radius: 4px; }
`;
