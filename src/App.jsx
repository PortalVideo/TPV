import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://rgcebqgkrqpxjhcfyuiq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY2VicWdrcnFweGpoY2Z5dWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Njg1OTcsImV4cCI6MjA5MTA0NDU5N30.RJVxExApYB2CAFdA8dITiVRA0CFQ26eu1YlzScjSk3g";
const GCAL_CLIENT_ID = "1095246910350-16r6t0vqfoi9u3ivnqmtp376s876rf9q.apps.googleusercontent.com";
const GCAL_SCOPES = "https://www.googleapis.com/auth/calendar.events";

// ── Supabase helpers ──────────────────────────────────────────
async function sbFetch(path, options = {}, authToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${authToken || SUPABASE_KEY}`,
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
  if (!res.ok) throw new Error(data.error_description || data.msg || "Auth error");
  return data;
}

// ── Calendar helpers ──────────────────────────────────────────
async function gcalCreate(shoot, token) {
  if (!token) return null;
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `🎬 ${shoot.clientName}`,
        location: shoot.location || "",
        description: `סוג: ${shoot.type}\nמחיר: ${shoot.price}₪\nטלפון: ${shoot.phone || ""}\nהערות: ${shoot.notes || ""}`,
        start: { date: shoot.date }, end: { date: shoot.date }, colorId: "7",
      }),
    });
    if (res.status === 401) return null;
    const d = await res.json();
    return d.id || null;
  } catch { return null; }
}

async function gcalUpdate(shoot, token) {
  if (!token || !shoot.calendarEventId) return;
  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${shoot.calendarEventId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `🎬 ${shoot.clientName}`,
        location: shoot.location || "",
        description: `סוג: ${shoot.type}\nמחיר: ${shoot.price}₪\nטלפון: ${shoot.phone || ""}\nהערות: ${shoot.notes || ""}`,
        start: { date: shoot.date }, end: { date: shoot.date }, colorId: "7",
      }),
    });
  } catch {}
}

async function gcalDelete(eventId, token) {
  if (!token || !eventId) return;
  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
}

// ── Constants ─────────────────────────────────────────────────
const initialForm = { date: "", clientName: "", phone: "", type: "חתונות / אירועים", location: "", price: "", paymentStatus: "לא שולם", notes: "", calendarEventId: null };
const SHOOT_TYPES = ["חתונות / אירועים", "תוכן לרשתות חברתיות", "פרסומות / קומרשיאל", "קליפים מוזיקליים", "תדמית לעסקים", "אחר"];
const PAYMENT_STATUSES = ["לא שולם", "מקדמה שולמה", "שולם"];

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n) { return Number(n || 0).toLocaleString("he-IL") + " ₪"; }

function paymentStyle(status) {
  if (status === "שולם") return { bg: "#1a2e4a", color: "#4da8ff" };
  if (status === "מקדמה שולמה") return { bg: "#2a2a1a", color: "#f0c040" };
  return { bg: "#2a1a1a", color: "#ff6b6b" };
}

// ── Mini Calendar Component ───────────────────────────────────
function MiniCalendar({ shoots }) {
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const dayNames = ["א","ב","ג","ד","ה","ו","ש"];

  const shootDates = {};
  shoots.forEach(s => {
    if (s.date) {
      const d = new Date(s.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        shootDates[d.getDate()] = s;
      }
    }
  });

  const cells = [];
  const startDay = (firstDay + 1) % 7;
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div style={C.calWrap}>
      <div style={C.calHeader}>
        <button style={C.calNavBtn} onClick={() => setCurrent(new Date(year, month - 1, 1))}>‹</button>
        <span style={C.calTitle}>{monthNames[month]} {year}</span>
        <button style={C.calNavBtn} onClick={() => setCurrent(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div style={C.calGrid}>
        {dayNames.map(d => <div key={d} style={C.calDayName}>{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} style={{
            ...C.calCell,
            ...(d && isToday(d) ? C.calToday : {}),
            ...(d && shootDates[d] ? C.calHasShoot : {}),
            ...(d === null ? { background: "transparent" } : {}),
          }}>
            {d && <span style={{ fontSize: 13, fontWeight: isToday(d) ? 800 : 400 }}>{d}</span>}
            {d && shootDates[d] && <div style={C.calDot} title={shootDates[d].clientName} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);

  const [shoots, setShoots] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [expenseForm, setExpenseForm] = useState({ month: getCurrentMonth(), amount: "", description: "" });
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const [gcalToken, setGcalToken] = useState(null);
  const [gcalReady, setGcalReady] = useState(false);
  const [gcalMenuOpen, setGcalMenuOpen] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const gcalMenuRef = useRef(null);

  // Load Google Identity Services
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => setGcalReady(true);
    document.head.appendChild(script);
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tpv_session");
    if (saved) {
      try {
        const { user, access_token } = JSON.parse(saved);
        setUser(user);
        setAuthToken(access_token);
      } catch {}
    }
    const savedGcal = localStorage.getItem("tpv_gcal");
    if (savedGcal) setGcalToken(savedGcal);
  }, []);

  // Load data when logged in
  useEffect(() => {
    if (!authToken) return;
    loadData();
  }, [authToken]);

  // Close gcal menu on outside click
  useEffect(() => {
    function handle(e) {
      if (gcalMenuRef.current && !gcalMenuRef.current.contains(e.target)) setGcalMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        sbFetch("shoots?order=date.desc", {}, authToken),
        sbFetch("expenses?order=created_at.desc", {}, authToken),
      ]);
      setShoots((s || []).map(r => ({
        id: r.id, date: r.date, clientName: r.client_name, phone: r.phone || "",
        type: r.type, location: r.location || "", price: r.price,
        paymentStatus: r.payment_status, notes: r.notes || "", calendarEventId: r.calendar_event_id,
      })));
      setExpenses((e || []).map(r => ({ id: r.id, month: r.month, description: r.description, amount: r.amount })));
    } catch { showToast("שגיאה בטעינת נתונים", "error"); }
    setLoading(false);
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Auth ──
  async function handleLogin() {
    setAuthLoading(true);
    try {
      const data = await sbAuth("token?grant_type=password", { email: authForm.email, password: authForm.password });
      setUser(data.user);
      setAuthToken(data.access_token);
      localStorage.setItem("tpv_session", JSON.stringify({ user: data.user, access_token: data.access_token }));
    } catch (e) { showToast("שגיאה: " + e.message, "error"); }
    setAuthLoading(false);
  }

  async function handleRegister() {
    setAuthLoading(true);
    try {
      await sbAuth("signup", { email: authForm.email, password: authForm.password });
      showToast("נרשמת בהצלחה! בדוק את המייל שלך לאישור");
      setAuthView("login");
    } catch (e) { showToast("שגיאה: " + e.message, "error"); }
    setAuthLoading(false);
  }

  function handleGoogleLogin() {
    const redirectTo = encodeURIComponent("https://tpv-eight.vercel.app");
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  }

  // Handle OAuth redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const access_token = params.get("access_token");
      if (access_token) {
        fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${access_token}` },
        }).then(r => r.json()).then(user => {
          setUser(user);
          setAuthToken(access_token);
          localStorage.setItem("tpv_session", JSON.stringify({ user, access_token }));
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      }
    }
  }, []);

  function handleLogout() {
    setUser(null);
    setAuthToken(null);
    setShoots([]);
    setExpenses([]);
    localStorage.removeItem("tpv_session");
    localStorage.removeItem("tpv_gcal");
    setGcalToken(null);
  }

  // ── Google Calendar ──
  function connectGcal() {
    if (!gcalReady || !window.google) { showToast("Google עדיין נטען", "error"); return; }
    setGcalLoading(true);
    setGcalMenuOpen(false);
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GCAL_CLIENT_ID, scope: GCAL_SCOPES,
      callback: (r) => {
        setGcalLoading(false);
        if (r.access_token) {
          setGcalToken(r.access_token);
          localStorage.setItem("tpv_gcal", r.access_token);
          showToast("חובר ל־Google Calendar ✓");
        } else showToast("שגיאה בחיבור", "error");
      },
    });
    tokenClient.requestAccessToken();
  }

  function disconnectGcal() {
    setGcalToken(null);
    localStorage.removeItem("tpv_gcal");
    setGcalMenuOpen(false);
    showToast("התנתקת מ־Google Calendar");
  }

  // ── Shoots CRUD ──
  async function handleSubmitShoot() {
    if (!form.date || !form.clientName || !form.price) { showToast("נא למלא תאריך, שם לקוח ומחיר", "error"); return; }
    if (editId) {
      const existing = shoots.find(s => s.id === editId);
      let calendarEventId = existing?.calendarEventId || null;
      if (gcalToken) {
        if (calendarEventId) await gcalUpdate({ ...form, calendarEventId }, gcalToken);
        else calendarEventId = await gcalCreate(form, gcalToken);
      }
      const updated = { ...form, id: editId, calendarEventId };
      try {
        await sbFetch(`shoots?id=eq.${editId}`, {
          method: "PATCH",
          body: JSON.stringify({ date: form.date, client_name: form.clientName, phone: form.phone, type: form.type, location: form.location, price: parseFloat(form.price) || 0, payment_status: form.paymentStatus, notes: form.notes, calendar_event_id: calendarEventId }),
        }, authToken);
        setShoots(shoots.map(s => s.id === editId ? updated : s));
        showToast("עודכן ✓");
      } catch { showToast("שגיאה בעדכון", "error"); return; }
      setEditId(null);
    } else {
      let calendarEventId = gcalToken ? await gcalCreate(form, gcalToken) : null;
      try {
        const result = await sbFetch("shoots", {
          method: "POST",
          body: JSON.stringify({ date: form.date, client_name: form.clientName, phone: form.phone, type: form.type, location: form.location, price: parseFloat(form.price) || 0, payment_status: form.paymentStatus, notes: form.notes, calendar_event_id: calendarEventId }),
        }, authToken);
        setShoots([{ id: result[0].id, ...form, calendarEventId }, ...shoots]);
        showToast(gcalToken && calendarEventId ? "נשמר + נוסף ללוח שנה ✓" : "נשמר ✓");
      } catch { showToast("שגיאה בשמירה", "error"); return; }
    }
    setForm(initialForm);
    setView("history");
  }

  function handleEditShoot(shoot) { setForm({ ...shoot }); setEditId(shoot.id); setView("form"); }

  async function handleDeleteShoot(id) {
    const shoot = shoots.find(s => s.id === id);
    if (shoot?.calendarEventId && gcalToken) await gcalDelete(shoot.calendarEventId, gcalToken);
    try {
      await sbFetch(`shoots?id=eq.${id}`, { method: "DELETE" }, authToken);
      setShoots(shoots.filter(s => s.id !== id));
      showToast("נמחק", "error");
    } catch { showToast("שגיאה במחיקה", "error"); }
  }

  async function handleAddExpense() {
    if (!expenseForm.amount || !expenseForm.description) { showToast("נא למלא סכום ותיאור", "error"); return; }
    try {
      const result = await sbFetch("expenses", {
        method: "POST",
        body: JSON.stringify({ month: expenseForm.month, description: expenseForm.description, amount: parseFloat(expenseForm.amount) || 0 }),
      }, authToken);
      setExpenses([{ id: result[0].id, ...expenseForm }, ...expenses]);
      setExpenseForm({ month: getCurrentMonth(), amount: "", description: "" });
      showToast("הוצאה נוספה ✓");
    } catch { showToast("שגיאה בשמירה", "error"); }
  }

  async function handleDeleteExpense(id) {
    try {
      await sbFetch(`expenses?id=eq.${id}`, { method: "DELETE" }, authToken);
      setExpenses(expenses.filter(e => e.id !== id));
      showToast("נמחק", "error");
    } catch { showToast("שגיאה", "error"); }
  }

  // ── Stats ──
  const totalIncome = shoots.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  const totalExp = expenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const net = totalIncome - totalExp;
  const paid = shoots.filter(s => s.paymentStatus === "שולם").reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  const unpaid = shoots.filter(s => s.paymentStatus !== "שולם").reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  const byType = shoots.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc; }, {});

  const navItems = [
    { id: "dashboard", label: "בקרה", icon: "⊞" },
    { id: "form", label: "חדש", icon: "+" },
    { id: "history", label: "היסטוריה", icon: "☰" },
    { id: "finances", label: "כספים", icon: "₪" },
  ];

  // ── Login Screen ──
  if (!user) return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#080e1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Heebo',sans-serif" }}>
      <style>{globalStyles}</style>
      {toast && <div style={{ ...S.toast, background: toast.type === "error" ? "#c0392b" : "#1e6fbf" }}>{toast.msg}</div>}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 2, color: "#fff" }}>TAL PORAT <span style={{ color: "#4da8ff" }}>VIDEO</span></div>
        <div style={{ fontSize: 13, color: "#4a6a8a", marginTop: 6 }}>מערכת ניהול ימי צילום</div>
      </div>

      <div style={{ width: "100%", maxWidth: 360, background: "#0d1a2e", border: "1px solid #1a2a3a", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", marginBottom: 24, background: "#080e1a", borderRadius: 10, padding: 4 }}>
          {["login","register"].map(v => (
            <button key={v} onClick={() => setAuthView(v)}
              style={{ flex: 1, background: authView === v ? "#1e5ab8" : "transparent", color: authView === v ? "#fff" : "#4a6a8a", border: "none", borderRadius: 8, padding: "9px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {v === "login" ? "התחברות" : "הרשמה"}
            </button>
          ))}
        </div>

        <button onClick={handleGoogleLogin} style={{ width: "100%", background: "#fff", color: "#333", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>G</span> {authView === "login" ? "התחבר עם Google" : "הרשם עם Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#1a2a3a" }} />
          <span style={{ fontSize: 12, color: "#4a6a8a" }}>או עם מייל</span>
          <div style={{ flex: 1, height: 1, background: "#1a2a3a" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>אימייל</label>
          <input type="email" placeholder="your@email.com" style={S.input} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>סיסמה</label>
          <input type="password" placeholder="••••••••" style={S.input} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
            onKeyDown={e => e.key === "Enter" && (authView === "login" ? handleLogin() : handleRegister())} />
        </div>
        <button style={S.btnPrimary} onClick={authView === "login" ? handleLogin : handleRegister} disabled={authLoading}>
          {authLoading ? "..." : authView === "login" ? "התחבר" : "הרשם"}
        </button>
      </div>
    </div>
  );

  // ── Main App ──
  return (
    <div dir="rtl" style={S.root}>
      <style>{globalStyles}</style>
      {toast && <div style={{ ...S.toast, background: toast.type === "error" ? "#c0392b" : "#1e6fbf" }}>{toast.msg}</div>}

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={S.logoMain}>TAL PORAT</span>
            <span style={S.logoSub}>VIDEO</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Google Calendar button with dropdown */}
            <div style={{ position: "relative" }} ref={gcalMenuRef}>
              <button
                style={{ ...S.gcalBtn, background: gcalToken ? "#0f2a14" : "#0f2244", borderColor: gcalToken ? "#2a7a3a" : "#2a5aaa", color: gcalToken ? "#4dcc6a" : "#4da8ff" }}
                onClick={() => setGcalMenuOpen(o => !o)}
              >
                {gcalLoading ? "..." : gcalToken ? "🗓 מסונכרן ✓" : "🗓 לוח שנה"}
              </button>
              {gcalMenuOpen && (
                <div style={S.gcalMenu}>
                  {gcalToken ? (
                    <>
                      <div style={S.gcalMenuItem}>
                        <span style={{ color: "#4dcc6a", fontSize: 13 }}>✓ מחובר ל־Google Calendar</span>
                      </div>
                      <div style={S.gcalMenuDivider} />
                      <button style={{ ...S.gcalMenuBtn, color: "#ff6b6b" }} onClick={disconnectGcal}>
                        ✕ התנתק מלוח השנה
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={S.gcalMenuItem}>
                        <span style={{ color: "#8aabcc", fontSize: 13 }}>לא מחובר ל־Google Calendar</span>
                      </div>
                      <div style={S.gcalMenuDivider} />
                      <button style={S.gcalMenuBtn} onClick={connectGcal}>
                        🗓 חבר עכשיו
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Logout */}
            <button style={S.logoutBtn} onClick={handleLogout} title="התנתק">⏻</button>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#4a6a8a" }}>טוען...</div>
        ) : (
          <>
            {/* DASHBOARD */}
            {view === "dashboard" && (
              <div style={S.fadeIn}>
                <div style={S.sectionTitle}>סקירה כללית</div>
                <div style={S.statsGrid}>
                  <div style={{ ...S.statCard, gridColumn: "span 2", background: "linear-gradient(135deg,#1a3a6b,#0f2244)", border: "1px solid #2a5aaa" }}>
                    <div style={S.statLabel}>סה"כ הכנסות ברוטו</div>
                    <div style={{ ...S.statValue, fontSize: 28 }}>{fmt(totalIncome)}</div>
                    <div style={S.statSub}>{shoots.length} ימי צילום</div>
                  </div>
                  <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                    <div style={S.statLabel}>נטו</div>
                    <div style={{ ...S.statValue, fontSize: 18, color: net >= 0 ? "#4da8ff" : "#ff6b6b" }}>{fmt(net)}</div>
                  </div>
                  <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                    <div style={S.statLabel}>הוצאות</div>
                    <div style={{ ...S.statValue, fontSize: 18, color: "#8aabcc" }}>{fmt(totalExp)}</div>
                  </div>
                  <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                    <div style={S.statLabel}>ממתין</div>
                    <div style={{ ...S.statValue, fontSize: 18, color: "#f0c040" }}>{fmt(unpaid)}</div>
                  </div>
                  <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                    <div style={S.statLabel}>שולם</div>
                    <div style={{ ...S.statValue, fontSize: 18, color: "#4da8ff" }}>{fmt(paid)}</div>
                  </div>
                </div>

                <MiniCalendar shoots={shoots} />

                {Object.keys(byType).length > 0 && (
                  <div style={S.card}>
                    <div style={S.cardTitle}>סוגי צילומים</div>
                    {Object.entries(byType).map(([type, count]) => (
                      <div key={type} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: "#8aabcc" }}>{type}</span>
                          <span style={{ fontSize: 13, color: "#4da8ff", fontWeight: 700 }}>{count}</span>
                        </div>
                        <div style={{ height: 5, background: "#1a2a3a", borderRadius: 3 }}>
                          <div style={{ height: "100%", background: "linear-gradient(90deg,#2a6cc4,#4da8ff)", borderRadius: 3, width: `${(count / shoots.length) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={S.card}>
                  <div style={S.cardTitle}>צילומים אחרונים</div>
                  {shoots.length === 0 ? (
                    <div style={S.emptyState}><div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div><div style={{ color: "#4a6a8a", fontSize: 14 }}>אין צילומים עדיין</div></div>
                  ) : shoots.slice(0, 5).map(s => {
                    const ps = paymentStyle(s.paymentStatus);
                    return (
                      <div key={s.id} style={S.recentRow} onClick={() => handleEditShoot(s)}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#d0e0f0" }}>{s.clientName} {s.calendarEventId && "🗓"}</div>
                          <div style={{ fontSize: 12, color: "#4a6a8a", marginTop: 2 }}>{s.date} · {s.type}</div>
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{fmt(s.price)}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: ps.bg, color: ps.color }}>{s.paymentStatus}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FORM */}
            {view === "form" && (
              <div style={S.fadeIn}>
                <div style={S.sectionTitle}>{editId ? "עריכת יום צילום" : "יום צילום חדש"}</div>
                {gcalToken && <div style={S.gcalInfo}>🗓 יסונכרן אוטומטית ל־Google Calendar</div>}
                <div style={S.card}>
                  {[
                    { label: "תאריך *", key: "date", type: "date" },
                    { label: "שם לקוח *", key: "clientName", type: "text", placeholder: "שם מלא" },
                    { label: "טלפון", key: "phone", type: "tel", placeholder: "050-0000000" },
                    { label: "מיקום", key: "location", type: "text", placeholder: "כתובת / מקום האירוע" },
                    { label: "מחיר (₪) *", key: "price", type: "number", placeholder: "0" },
                  ].map(f => (
                    <div key={f.key} style={S.formGroup}>
                      <label style={S.label}>{f.label}</label>
                      <input type={f.type} placeholder={f.placeholder} style={S.input} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <div style={S.formGroup}>
                    <label style={S.label}>סוג צילום</label>
                    <select style={S.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      {SHOOT_TYPES.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>סטטוס תשלום</label>
                    <select style={S.input} value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                      {PAYMENT_STATUSES.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>הערות</label>
                    <textarea placeholder="פרטים נוספים..." style={{ ...S.input, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <button style={S.btnPrimary} onClick={handleSubmitShoot}>{editId ? "עדכן יום צילום" : "שמור יום צילום"}</button>
                  {editId && <button style={S.btnSecondary} onClick={() => { setForm(initialForm); setEditId(null); setView("history"); }}>ביטול</button>}
                </div>
              </div>
            )}

            {/* HISTORY */}
            {view === "history" && (
              <div style={S.fadeIn}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={S.sectionTitle}>היסטוריה</div>
                  <button style={S.btnSmall} onClick={() => { setForm(initialForm); setEditId(null); setView("form"); }}>+ חדש</button>
                </div>
                {shoots.length === 0 ? (
                  <div style={{ ...S.card, ...S.emptyState }}><div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div><div style={{ color: "#4a6a8a" }}>אין צילומים עדיין</div></div>
                ) : shoots.map(s => {
                  const ps = paymentStyle(s.paymentStatus);
                  return (
                    <div key={s.id} style={{ ...S.card, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#d0e0f0" }}>{s.clientName} {s.calendarEventId && <span style={{ fontSize: 13 }}>🗓</span>}</div>
                          <div style={{ fontSize: 12, color: "#4a6a8a", marginTop: 3 }}>{s.date}{s.location ? ` · ${s.location}` : ""}</div>
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginRight: 8 }}>{fmt(s.price)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: "#0f2244", color: "#4da8ff", fontWeight: 600 }}>{s.type}</span>
                        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: ps.bg, color: ps.color, fontWeight: 700 }}>{s.paymentStatus}</span>
                        {s.phone && <span style={{ fontSize: 11, color: "#4a6a8a" }}>📞 {s.phone}</span>}
                        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
                          <button style={S.actionBtnBlue} onClick={() => handleEditShoot(s)}>עריכה</button>
                          <button style={S.actionBtnRed} onClick={() => handleDeleteShoot(s.id)}>מחיקה</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FINANCES */}
            {view === "finances" && (
              <div style={S.fadeIn}>
                <div style={S.sectionTitle}>כספים</div>
                <div style={S.statsGrid}>
                  <div style={{ ...S.statCard, gridColumn: "span 2", background: "linear-gradient(135deg,#1a3a6b,#0f2244)", border: "1px solid #2a5aaa" }}>
                    <div style={S.statLabel}>ברוטו</div>
                    <div style={{ ...S.statValue, fontSize: 26 }}>{fmt(totalIncome)}</div>
                  </div>
                  <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                    <div style={S.statLabel}>הוצאות</div>
                    <div style={{ ...S.statValue, fontSize: 18, color: "#8aabcc" }}>{fmt(totalExp)}</div>
                  </div>
                  <div style={{ ...S.statCard, background: net >= 0 ? "#0f1e3a" : "#2a1a1a", border: "1px solid #1e3a5a" }}>
                    <div style={S.statLabel}>נטו</div>
                    <div style={{ ...S.statValue, fontSize: 18, color: net >= 0 ? "#4da8ff" : "#ff6b6b" }}>{fmt(net)}</div>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={S.cardTitle}>הוסף הוצאה חודשית</div>
                  <div style={S.formGroup}>
                    <label style={S.label}>חודש</label>
                    <input type="month" style={S.input} value={expenseForm.month} onChange={e => setExpenseForm({ ...expenseForm, month: e.target.value })} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>תיאור</label>
                    <input type="text" placeholder="חיוב אשראי, ציוד..." style={S.input} value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                  </div>
                  <div style={S.formGroup}>
                    <label style={S.label}>סכום (₪)</label>
                    <input type="number" placeholder="0" style={S.input} value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                  </div>
                  <button style={S.btnPrimary} onClick={handleAddExpense}>הוסף הוצאה</button>
                </div>
                {expenses.length > 0 && (
                  <div style={S.card}>
                    <div style={S.cardTitle}>רשימת הוצאות</div>
                    {expenses.map(e => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a2a3a" }}>
                        <div>
                          <div style={{ fontSize: 14, color: "#c0d0e0", fontWeight: 600 }}>{e.description}</div>
                          <div style={{ fontSize: 12, color: "#4a6a8a", marginTop: 2 }}>{e.month}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#8aabcc" }}>{fmt(e.amount)}</span>
                          <button style={{ background: "transparent", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 16 }} onClick={() => handleDeleteExpense(e.id)}>✕</button>
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
      <nav style={S.bottomNav}>
        {navItems.map(item => (
          <button key={item.id}
            onClick={() => { setView(item.id); if (item.id !== "form") { setEditId(null); setForm(initialForm); } }}
            style={{ ...S.navBtn, ...(view === item.id ? S.navBtnActive : {}) }}>
            <span style={S.navIcon}>{item.icon}</span>
            <span style={S.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Calendar Styles ───────────────────────────────────────────
const C = {
  calWrap: { background: "#0d1a2e", border: "1px solid #1a2a3a", borderRadius: 14, padding: 16, marginBottom: 14 },
  calHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  calTitle: { fontSize: 15, fontWeight: 700, color: "#d0e0f0" },
  calNavBtn: { background: "transparent", border: "none", color: "#4da8ff", fontSize: 20, cursor: "pointer", padding: "0 8px", fontFamily: "inherit" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 },
  calDayName: { textAlign: "center", fontSize: 11, color: "#4a6a8a", fontWeight: 700, padding: "4px 0" },
  calCell: { position: "relative", background: "#111d2e", borderRadius: 8, padding: "6px 4px", minHeight: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  calToday: { background: "#1e3a6b", border: "1px solid #4da8ff" },
  calHasShoot: { background: "#1a2a1a", border: "1px solid #2a5a3a" },
  calDot: { width: 5, height: 5, borderRadius: "50%", background: "#4dcc6a", marginTop: 2 },
};

// ── App Styles ────────────────────────────────────────────────
const S = {
  root: { minHeight: "100vh", background: "#080e1a", color: "#c0d0e0", fontFamily: "'Heebo',sans-serif", direction: "rtl", paddingBottom: 80 },
  header: { background: "#0a1628", borderBottom: "1px solid #1a2a3a", position: "sticky", top: 0, zIndex: 100, padding: "0 16px" },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, maxWidth: 700, margin: "0 auto" },
  logo: { display: "flex", alignItems: "baseline", gap: 6 },
  logoMain: { fontSize: 17, fontWeight: 900, letterSpacing: 2, color: "#ffffff" },
  logoSub: { fontSize: 12, fontWeight: 600, letterSpacing: 3, color: "#4da8ff" },
  gcalBtn: { border: "1px solid", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700 },
  gcalMenu: { position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#0d1a2e", border: "1px solid #1a2a3a", borderRadius: 10, padding: 8, minWidth: 200, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  gcalMenuItem: { padding: "8px 10px" },
  gcalMenuDivider: { height: 1, background: "#1a2a3a", margin: "6px 0" },
  gcalMenuBtn: { width: "100%", background: "transparent", border: "none", color: "#4da8ff", padding: "8px 10px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, textAlign: "right" },
  gcalInfo: { background: "#0f1e36", border: "1px solid #1e3a6a", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 13, color: "#6090c0" },
  logoutBtn: { background: "#1a2a3a", border: "none", color: "#4a6a8a", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" },
  main: { maxWidth: 700, margin: "0 auto", padding: "16px 14px" },
  sectionTitle: { fontSize: 22, fontWeight: 800, color: "#ffffff", marginBottom: 16, letterSpacing: -0.5 },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  statCard: { borderRadius: 14, padding: 16 },
  statLabel: { fontSize: 11, color: "#6090c0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: 800, color: "#ffffff", lineHeight: 1.1 },
  statSub: { fontSize: 12, color: "#4a6a8a", marginTop: 4 },
  card: { background: "#0d1a2e", border: "1px solid #1a2a3a", borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#6090c0", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 },
  recentRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a2a3a", cursor: "pointer" },
  formGroup: { marginBottom: 16 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "#6090c0", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.8 },
  input: { width: "100%", background: "#0a1628", border: "1px solid #1e3a5a", borderRadius: 10, color: "#d0e0f0", padding: "13px 14px", fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box", WebkitAppearance: "none" },
  btnPrimary: { width: "100%", background: "linear-gradient(135deg,#1e5ab8,#2a7ae0)", color: "#fff", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 },
  btnSecondary: { width: "100%", background: "transparent", color: "#6090c0", border: "1px solid #1e3a5a", borderRadius: 12, padding: 13, fontSize: 15, cursor: "pointer", fontFamily: "inherit" },
  btnSmall: { background: "#1e5ab8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  actionBtnBlue: { background: "#0f2244", border: "1px solid #2a5aaa", color: "#4da8ff", padding: "5px 14px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 },
  actionBtnRed: { background: "#2a1a1a", border: "1px solid #5a2a2a", color: "#ff6b6b", padding: "5px 14px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 },
  emptyState: { textAlign: "center", padding: "30px 20px" },
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#0a1628", borderTop: "1px solid #1a2a3a", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" },
  navBtn: { flex: 1, background: "transparent", border: "none", color: "#4a6a8a", padding: "10px 4px", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 },
  navBtnActive: { color: "#4da8ff" },
  navIcon: { fontSize: 20, lineHeight: 1 },
  navLabel: { fontSize: 10, fontWeight: 600, letterSpacing: 0.3 },
  toast: { position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", color: "#fff", fontWeight: 700, padding: "12px 24px", borderRadius: 10, zIndex: 999, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", whiteSpace: "nowrap" },
  fadeIn: { animation: "fadeIn 0.2s ease" },
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  input:focus, select:focus, textarea:focus { border-color: #2a6cc4 !important; outline: none; }
  button:active { opacity: 0.8; }
  select option { background: #0a1628; }
  body { -webkit-tap-highlight-color: transparent; }
`;
