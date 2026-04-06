import { useState, useEffect } from "react";

// Supabase config
const SUPABASE_URL = "https://rgcebqgkrqpxjhcfyuiq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnY2VicWdrcnFweGpoY2Z5dWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Njg1OTcsImV4cCI6MjA5MTA0NDU5N30.RJVxExApYB2CAFdA8dITiVRA0CFQ26eu1YlzScjSk3g";

const GCAL_TOKEN_KEY = "gcal_token";
const GOOGLE_CLIENT_ID = "1095246910350-16r6t0vqfoi9u3ivnqmtp376s876rf9q.apps.googleusercontent.com";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const initialForm = {
  date: "", clientName: "", phone: "", type: "חתונות / אירועים",
  location: "", price: "", paymentStatus: "לא שולם", notes: "", calendarEventId: null,
};

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [shoots, setShoots] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [expenseForm, setExpenseForm] = useState({ month: getCurrentMonth(), amount: "", description: "" });
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [gToken, setGToken] = useState(null);
  const [gLoading, setGLoading] = useState(false);
  const [gapiReady, setGapiReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const [shootsData, expensesData] = await Promise.all([
          sbFetch("shoots?order=date.desc"),
          sbFetch("expenses?order=created_at.desc"),
        ]);
        setShoots((shootsData || []).map(s => ({
          id: s.id, date: s.date, clientName: s.client_name, phone: s.phone || "",
          type: s.type, location: s.location || "", price: s.price,
          paymentStatus: s.payment_status, notes: s.notes || "", calendarEventId: s.calendar_event_id,
        })));
        setExpenses((expensesData || []).map(e => ({
          id: e.id, month: e.month, description: e.description, amount: e.amount,
        })));
      } catch (err) {
        showToast("שגיאה בטעינת נתונים", "error");
      }
      setLoading(false);
    }
    loadData();

    // Load Google token
    const t = localStorage.getItem(GCAL_TOKEN_KEY);
    if (t) setGToken(t);

    // Load Google Identity Services
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => setGapiReady(true);
    document.head.appendChild(script);
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Google Calendar
  function handleGoogleSignIn() {
    if (!gapiReady || !window.google) { showToast("Google עדיין נטען, נסה שוב", "error"); return; }
    setGLoading(true);
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: GOOGLE_SCOPES,
      callback: (response) => {
        setGLoading(false);
        if (response.access_token) {
          setGToken(response.access_token);
          localStorage.setItem(GCAL_TOKEN_KEY, response.access_token);
          showToast("חובר ל־Google Calendar ✓");
        } else { showToast("שגיאה בחיבור לגוגל", "error"); }
      },
    });
    tokenClient.requestAccessToken();
  }

  function handleGoogleSignOut() { setGToken(null); localStorage.removeItem(GCAL_TOKEN_KEY); showToast("התנתקת מ־Google Calendar"); }

  async function createCalendarEvent(shoot) {
    if (!gToken) return null;
    try {
      const event = {
        summary: `🎬 צילום — ${shoot.clientName}`, location: shoot.location || "",
        description: `סוג: ${shoot.type}\nמחיר: ${shoot.price}₪\nטלפון: ${shoot.phone || ""}\nהערות: ${shoot.notes || ""}`,
        start: { date: shoot.date }, end: { date: shoot.date }, colorId: "7",
      };
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST", headers: { Authorization: `Bearer ${gToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (res.status === 401) { setGToken(null); localStorage.removeItem(GCAL_TOKEN_KEY); return null; }
      const data = await res.json();
      return data.id || null;
    } catch { return null; }
  }

  async function updateCalendarEvent(shoot) {
    if (!gToken || !shoot.calendarEventId) return;
    try {
      const event = {
        summary: `🎬 צילום — ${shoot.clientName}`, location: shoot.location || "",
        description: `סוג: ${shoot.type}\nמחיר: ${shoot.price}₪\nטלפון: ${shoot.phone || ""}\nהערות: ${shoot.notes || ""}`,
        start: { date: shoot.date }, end: { date: shoot.date }, colorId: "7",
      };
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${shoot.calendarEventId}`, {
        method: "PUT", headers: { Authorization: `Bearer ${gToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch {}
  }

  async function deleteCalendarEvent(eventId) {
    if (!gToken || !eventId) return;
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${gToken}` },
      });
    } catch {}
  }

  // CRUD for shoots
  async function handleSubmitShoot() {
    if (!form.date || !form.clientName || !form.price) { showToast("נא למלא תאריך, שם לקוח ומחיר", "error"); return; }

    if (editId) {
      const existingShoot = shoots.find(s => s.id === editId);
      let calendarEventId = existingShoot?.calendarEventId || null;
      if (gToken) {
        if (calendarEventId) await updateCalendarEvent({ ...form, calendarEventId });
        else { calendarEventId = await createCalendarEvent(form); }
      }
      const updatedShoot = { ...form, id: editId, calendarEventId };
      try {
        await sbFetch(`shoots?id=eq.${editId}`, {
          method: "PATCH",
          body: JSON.stringify({
            date: form.date, client_name: form.clientName, phone: form.phone,
            type: form.type, location: form.location, price: parseFloat(form.price) || 0,
            payment_status: form.paymentStatus, notes: form.notes, calendar_event_id: calendarEventId,
          }),
        });
        setShoots(shoots.map(s => s.id === editId ? updatedShoot : s));
        showToast(gToken ? "עודכן + לוח שנה גוגל ✓" : "יום הצילום עודכן ✓");
      } catch { showToast("שגיאה בעדכון", "error"); return; }
      setEditId(null);
    } else {
      let calendarEventId = null;
      if (gToken) calendarEventId = await createCalendarEvent(form);
      try {
        const result = await sbFetch("shoots", {
          method: "POST",
          body: JSON.stringify({
            date: form.date, client_name: form.clientName, phone: form.phone,
            type: form.type, location: form.location, price: parseFloat(form.price) || 0,
            payment_status: form.paymentStatus, notes: form.notes, calendar_event_id: calendarEventId,
          }),
        });
        const newShoot = {
          id: result[0].id, date: form.date, clientName: form.clientName, phone: form.phone,
          type: form.type, location: form.location, price: form.price,
          paymentStatus: form.paymentStatus, notes: form.notes, calendarEventId,
        };
        setShoots([newShoot, ...shoots]);
        showToast(gToken && calendarEventId ? "נשמר + נוסף ללוח שנה ✓" : "יום הצילום נשמר ✓");
      } catch { showToast("שגיאה בשמירה", "error"); return; }
    }
    setForm(initialForm);
    setView("history");
  }

  function handleEditShoot(shoot) { setForm({ ...shoot }); setEditId(shoot.id); setView("form"); }

  async function handleDeleteShoot(id) {
    const shoot = shoots.find(s => s.id === id);
    if (shoot?.calendarEventId && gToken) await deleteCalendarEvent(shoot.calendarEventId);
    try {
      await sbFetch(`shoots?id=eq.${id}`, { method: "DELETE" });
      setShoots(shoots.filter(s => s.id !== id));
      showToast("נמחק" + (shoot?.calendarEventId && gToken ? " + הוסר מלוח שנה" : ""), "error");
    } catch { showToast("שגיאה במחיקה", "error"); }
  }

  async function handleAddExpense() {
    if (!expenseForm.amount || !expenseForm.description) { showToast("נא למלא סכום ותיאור", "error"); return; }
    try {
      const result = await sbFetch("expenses", {
        method: "POST",
        body: JSON.stringify({ month: expenseForm.month, description: expenseForm.description, amount: parseFloat(expenseForm.amount) || 0 }),
      });
      setExpenses([{ id: result[0].id, ...expenseForm }, ...expenses]);
      setExpenseForm({ month: getCurrentMonth(), amount: "", description: "" });
      showToast("הוצאה נוספה ✓");
    } catch { showToast("שגיאה בשמירה", "error"); }
  }

  async function handleDeleteExpense(id) {
    try {
      await sbFetch(`expenses?id=eq.${id}`, { method: "DELETE" });
      setExpenses(expenses.filter(e => e.id !== id));
      showToast("נמחק", "error");
    } catch { showToast("שגיאה במחיקה", "error"); }
  }

  const totalIncome = shoots.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const netIncome = totalIncome - totalExpenses;
  const paidIncome = shoots.filter(s => s.paymentStatus === "שולם").reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const unpaidIncome = shoots.filter(s => s.paymentStatus !== "שולם").reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const shootsByType = shoots.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc; }, {});
  function fmt(n) { return Number(n).toLocaleString("he-IL") + " ₪"; }

  const paymentColor = (status) => {
    if (status === "שולם") return { bg: "#1a2e4a", color: "#4da8ff" };
    if (status === "מקדמה שולמה") return { bg: "#2a2a1a", color: "#f0c040" };
    return { bg: "#2a1a1a", color: "#ff6b6b" };
  };

  const navItems = [
    { id: "dashboard", label: "בקרה", icon: "⊞" },
    { id: "form", label: "חדש", icon: "+" },
    { id: "history", label: "היסטוריה", icon: "☰" },
    { id: "finances", label: "כספים", icon: "₪" },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080e1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Heebo',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@700;900&display=swap');`}</style>
      <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2, color: "#fff" }}>TAL PORAT <span style={{ color: "#4da8ff" }}>VIDEO</span></div>
      <div style={{ marginTop: 20, color: "#4a6a8a", fontSize: 14 }}>טוען נתונים...</div>
    </div>
  );

  return (
    <div dir="rtl" style={S.root}>
      <style>{globalStyles}</style>

      {toast && <div style={{ ...S.toast, background: toast.type === "error" ? "#c0392b" : "#1e6fbf" }}>{toast.msg}</div>}

      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={S.logoMain}>TAL PORAT</span>
            <span style={S.logoSub}>VIDEO</span>
          </div>
          {gToken ? (
            <button style={S.gcalSmall} onClick={handleGoogleSignOut}>
              <span style={S.gcalDot} /> Calendar
            </button>
          ) : (
            <button style={S.gcalSmall} onClick={handleGoogleSignIn} disabled={gLoading}>
              {gLoading ? "..." : "🗓 חבר"}
            </button>
          )}
        </div>
      </header>

      <main style={S.main}>

        {view === "dashboard" && (
          <div style={S.fadeIn}>
            <div style={S.sectionTitle}>סקירה כללית</div>
            {!gToken && (
              <div style={S.gcalBanner}>
                <span style={{ fontSize: 13 }}>🗓 חבר Google Calendar לסנכרון אוטומטי</span>
                <button style={S.gcalBannerBtn} onClick={handleGoogleSignIn} disabled={gLoading}>{gLoading ? "..." : "חבר"}</button>
              </div>
            )}
            <div style={S.statsGrid}>
              <div style={{ ...S.statCard, gridColumn: "span 2", background: "linear-gradient(135deg,#1a3a6b,#0f2244)", border: "1px solid #2a5aaa" }}>
                <div style={S.statLabel}>סה"כ הכנסות ברוטו</div>
                <div style={{ ...S.statValue, fontSize: 30 }}>{fmt(totalIncome)}</div>
                <div style={S.statSub}>{shoots.length} ימי צילום</div>
              </div>
              <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                <div style={S.statLabel}>נטו</div>
                <div style={{ ...S.statValue, color: netIncome >= 0 ? "#4da8ff" : "#ff6b6b" }}>{fmt(netIncome)}</div>
              </div>
              <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                <div style={S.statLabel}>הוצאות</div>
                <div style={{ ...S.statValue, color: "#8aabcc" }}>{fmt(totalExpenses)}</div>
              </div>
              <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                <div style={S.statLabel}>ממתין</div>
                <div style={{ ...S.statValue, color: "#f0c040", fontSize: 18 }}>{fmt(unpaidIncome)}</div>
              </div>
              <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                <div style={S.statLabel}>שולם</div>
                <div style={{ ...S.statValue, color: "#4da8ff", fontSize: 18 }}>{fmt(paidIncome)}</div>
              </div>
            </div>
            {Object.keys(shootsByType).length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}>סוגי צילומים</div>
                {Object.entries(shootsByType).map(([type, count]) => (
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
                const pc = paymentColor(s.paymentStatus);
                return (
                  <div key={s.id} style={S.recentRow} onClick={() => handleEditShoot(s)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#d0e0f0" }}>{s.clientName} {s.calendarEventId && "🗓"}</div>
                      <div style={{ fontSize: 12, color: "#4a6a8a", marginTop: 2 }}>{s.date} · {s.type}</div>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{fmt(s.price)}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: pc.bg, color: pc.color }}>{s.paymentStatus}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "form" && (
          <div style={S.fadeIn}>
            <div style={S.sectionTitle}>{editId ? "עריכת יום צילום" : "יום צילום חדש"}</div>
            {gToken && <div style={S.gcalInfo}>🗓 יסונכרן אוטומטית ל־Google Calendar</div>}
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
                  {["חתונות / אירועים","תוכן לרשתות חברתיות","פרסומות / קומרשיאל","קליפים מוזיקליים","תדמית לעסקים","אחר"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>סטטוס תשלום</label>
                <select style={S.input} value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                  {["לא שולם","מקדמה שולמה","שולם"].map(o => <option key={o}>{o}</option>)}
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

        {view === "history" && (
          <div style={S.fadeIn}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={S.sectionTitle}>היסטוריה</div>
              <button style={S.btnSmall} onClick={() => { setForm(initialForm); setEditId(null); setView("form"); }}>+ חדש</button>
            </div>
            {shoots.length === 0 ? (
              <div style={{ ...S.card, ...S.emptyState }}><div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div><div style={{ color: "#4a6a8a" }}>אין צילומים עדיין</div></div>
            ) : shoots.map(s => {
              const pc = paymentColor(s.paymentStatus);
              return (
                <div key={s.id} style={{ ...S.card, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#d0e0f0" }}>{s.clientName} {s.calendarEventId && <span style={{ fontSize: 13 }}>🗓</span>}</div>
                      <div style={{ fontSize: 12, color: "#4a6a8a", marginTop: 3 }}>{s.date}{s.location ? ` · ${s.location}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginRight: 8 }}>{fmt(s.price)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: "#0f2244", color: "#4da8ff", fontWeight: 600 }}>{s.type}</span>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: pc.bg, color: pc.color, fontWeight: 700 }}>{s.paymentStatus}</span>
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

        {view === "finances" && (
          <div style={S.fadeIn}>
            <div style={S.sectionTitle}>כספים</div>
            <div style={S.statsGrid}>
              <div style={{ ...S.statCard, gridColumn: "span 2", background: "linear-gradient(135deg,#1a3a6b,#0f2244)", border: "1px solid #2a5aaa" }}>
                <div style={S.statLabel}>ברוטו</div>
                <div style={{ ...S.statValue, fontSize: 28 }}>{fmt(totalIncome)}</div>
              </div>
              <div style={{ ...S.statCard, background: "#111d2e", border: "1px solid #1e3a5a" }}>
                <div style={S.statLabel}>הוצאות</div>
                <div style={{ ...S.statValue, color: "#8aabcc" }}>{fmt(totalExpenses)}</div>
              </div>
              <div style={{ ...S.statCard, background: netIncome >= 0 ? "#0f1e3a" : "#2a1a1a", border: "1px solid #1e3a5a" }}>
                <div style={S.statLabel}>נטו</div>
                <div style={{ ...S.statValue, color: netIncome >= 0 ? "#4da8ff" : "#ff6b6b" }}>{fmt(netIncome)}</div>
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
      </main>

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

const S = {
  root: { minHeight: "100vh", background: "#080e1a", color: "#c0d0e0", fontFamily: "'Heebo',sans-serif", direction: "rtl", paddingBottom: 80 },
  header: { background: "#0a1628", borderBottom: "1px solid #1a2a3a", position: "sticky", top: 0, zIndex: 100, padding: "0 16px" },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, maxWidth: 700, margin: "0 auto" },
  logo: { display: "flex", alignItems: "baseline", gap: 6 },
  logoMain: { fontSize: 18, fontWeight: 900, letterSpacing: 2, color: "#ffffff" },
  logoSub: { fontSize: 13, fontWeight: 600, letterSpacing: 3, color: "#4da8ff" },
  gcalSmall: { background: "#0f2244", border: "1px solid #2a5aaa", color: "#4da8ff", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 },
  gcalDot: { width: 7, height: 7, borderRadius: "50%", background: "#4da8ff", display: "inline-block", marginLeft: 4 },
  gcalBanner: { background: "#0f1e36", border: "1px solid #1e3a6a", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  gcalBannerBtn: { background: "#2a6cc4", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  gcalInfo: { background: "#0f1e36", border: "1px solid #1e3a6a", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 13, color: "#6090c0" },
  main: { maxWidth: 700, margin: "0 auto", padding: "16px 14px" },
  sectionTitle: { fontSize: 22, fontWeight: 800, color: "#ffffff", marginBottom: 16, letterSpacing: -0.5 },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  statCard: { borderRadius: 14, padding: "16px" },
  statLabel: { fontSize: 11, color: "#6090c0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: 800, color: "#ffffff", lineHeight: 1.1 },
  statSub: { fontSize: 12, color: "#4a6a8a", marginTop: 4 },
  card: { background: "#0d1a2e", border: "1px solid #1a2a3a", borderRadius: 14, padding: "16px", marginBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#6090c0", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.8 },
  recentRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1a2a3a", cursor: "pointer" },
  formGroup: { marginBottom: 16 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "#6090c0", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.8 },
  input: { width: "100%", background: "#0a1628", border: "1px solid #1e3a5a", borderRadius: 10, color: "#d0e0f0", padding: "13px 14px", fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box", WebkitAppearance: "none" },
  btnPrimary: { width: "100%", background: "linear-gradient(135deg,#1e5ab8,#2a7ae0)", color: "#fff", border: "none", borderRadius: 12, padding: "15px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 },
  btnSecondary: { width: "100%", background: "transparent", color: "#6090c0", border: "1px solid #1e3a5a", borderRadius: 12, padding: "13px", fontSize: 15, cursor: "pointer", fontFamily: "inherit" },
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
  button:active { opacity: 0.8; transform: scale(0.98); }
  select option { background: #0a1628; }
  body { -webkit-tap-highlight-color: transparent; }
`;
