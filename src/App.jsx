import { useState, useEffect } from "react";

const STORAGE_KEY = "video-shoots";
const EXPENSES_KEY = "monthly-expenses";

const initialForm = {
  date: "",
  clientName: "",
  phone: "",
  type: "חתונות / אירועים",
  location: "",
  price: "",
  paymentStatus: "לא שולם",
  notes: "",
};

export default function App() {
  const [view, setView] = useState("dashboard");
  const [shoots, setShoots] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [expenseForm, setExpenseForm] = useState({ month: getCurrentMonth(), amount: "", description: "" });
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);

  function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    const e = localStorage.getItem(EXPENSES_KEY);
    if (s) setShoots(JSON.parse(s));
    if (e) setExpenses(JSON.parse(e));
  }, []);

  function saveShoots(data) {
    setShoots(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function saveExpenses(data) {
    setExpenses(data);
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(data));
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function handleSubmitShoot() {
    if (!form.date || !form.clientName || !form.price) {
      showToast("נא למלא תאריך, שם לקוח ומחיר", "error");
      return;
    }
    if (editId) {
      const updated = shoots.map(s => s.id === editId ? { ...form, id: editId } : s);
      saveShoots(updated);
      showToast("יום הצילום עודכן ✓");
      setEditId(null);
    } else {
      const newShoot = { ...form, id: Date.now() };
      saveShoots([newShoot, ...shoots]);
      showToast("יום הצילום נשמר ✓");
    }
    setForm(initialForm);
    setView("history");
  }

  function handleEditShoot(shoot) {
    setForm({ ...shoot });
    setEditId(shoot.id);
    setView("form");
  }

  function handleDeleteShoot(id) {
    saveShoots(shoots.filter(s => s.id !== id));
    showToast("נמחק", "error");
  }

  function handleAddExpense() {
    if (!expenseForm.amount || !expenseForm.description) {
      showToast("נא למלא סכום ותיאור", "error");
      return;
    }
    const newExp = { ...expenseForm, id: Date.now() };
    saveExpenses([newExp, ...expenses]);
    setExpenseForm({ month: getCurrentMonth(), amount: "", description: "" });
    showToast("הוצאה נוספה ✓");
  }

  function handleDeleteExpense(id) {
    saveExpenses(expenses.filter(e => e.id !== id));
    showToast("נמחק", "error");
  }

  const totalIncome = shoots.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const netIncome = totalIncome - totalExpenses;

  const paidIncome = shoots.filter(s => s.paymentStatus === "שולם").reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const unpaidIncome = shoots.filter(s => s.paymentStatus !== "שולם").reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);

  const shootsByType = shoots.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});

  function fmt(n) {
    return Number(n).toLocaleString("he-IL") + " ₪";
  }

  const navItems = [
    { id: "dashboard", label: "לוח בקרה", icon: "◈" },
    { id: "form", label: "יום צילום חדש", icon: "+" },
    { id: "history", label: "היסטוריה", icon: "≡" },
    { id: "finances", label: "כספים", icon: "₪" },
  ];

  return (
    <div dir="rtl" style={styles.root}>
      <style>{globalStyles}</style>

      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "error" ? "#ff4444" : "#00c87a" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>▶</span>
            <span style={styles.logoText}>SHOOT<span style={styles.logoAccent}>DESK</span></span>
          </div>
          <nav style={styles.nav}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setView(item.id); if (item.id !== "form") { setEditId(null); setForm(initialForm); } }}
                style={{ ...styles.navBtn, ...(view === item.id ? styles.navBtnActive : {}) }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main style={styles.main}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div style={styles.fadeIn}>
            <h1 style={styles.pageTitle}>לוח בקרה</h1>
            <div style={styles.statsGrid}>
              <div style={{ ...styles.statCard, ...styles.statCardMain }}>
                <div style={styles.statLabel}>סה"כ הכנסות (ברוטו)</div>
                <div style={styles.statValue}>{fmt(totalIncome)}</div>
                <div style={styles.statSub}>{shoots.length} ימי צילום</div>
              </div>
              <div style={{ ...styles.statCard, background: "#0f1a12" }}>
                <div style={styles.statLabel}>הכנסה נטו</div>
                <div style={{ ...styles.statValue, color: netIncome >= 0 ? "#00c87a" : "#ff4444" }}>{fmt(netIncome)}</div>
                <div style={styles.statSub}>אחרי הוצאות</div>
              </div>
              <div style={{ ...styles.statCard, background: "#1a100f" }}>
                <div style={styles.statLabel}>סה"כ הוצאות</div>
                <div style={{ ...styles.statValue, color: "#ff6b4a" }}>{fmt(totalExpenses)}</div>
                <div style={styles.statSub}>{expenses.length} רשומות</div>
              </div>
              <div style={{ ...styles.statCard, background: "#0f1520" }}>
                <div style={styles.statLabel}>ממתין לתשלום</div>
                <div style={{ ...styles.statValue, color: "#f0b429" }}>{fmt(unpaidIncome)}</div>
                <div style={styles.statSub}>שולם: {fmt(paidIncome)}</div>
              </div>
            </div>

            <div style={styles.twoCol}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>סוגי צילומים</h3>
                {Object.keys(shootsByType).length === 0 ? (
                  <p style={styles.empty}>אין נתונים עדיין</p>
                ) : Object.entries(shootsByType).map(([type, count]) => (
                  <div key={type} style={styles.typeRow}>
                    <span style={styles.typeLabel}>{type}</span>
                    <div style={styles.typeBar}>
                      <div style={{ ...styles.typeBarFill, width: `${(count / shoots.length) * 100}%` }} />
                    </div>
                    <span style={styles.typeCount}>{count}</span>
                  </div>
                ))}
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>צילומים אחרונים</h3>
                {shoots.length === 0 ? (
                  <p style={styles.empty}>אין צילומים עדיין</p>
                ) : shoots.slice(0, 4).map(s => (
                  <div key={s.id} style={styles.recentRow}>
                    <div>
                      <div style={styles.recentName}>{s.clientName}</div>
                      <div style={styles.recentMeta}>{s.date} · {s.type}</div>
                    </div>
                    <div style={{ ...styles.recentPrice, color: s.paymentStatus === "שולם" ? "#00c87a" : "#f0b429" }}>
                      {fmt(s.price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FORM */}
        {view === "form" && (
          <div style={styles.fadeIn}>
            <h1 style={styles.pageTitle}>{editId ? "עריכת יום צילום" : "יום צילום חדש"}</h1>
            <div style={styles.formCard}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>תאריך *</label>
                  <input type="date" style={styles.input} value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>סוג צילום</label>
                  <select style={styles.input} value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option>חתונות / אירועים</option>
                    <option>תוכן לרשתות חברתיות</option>
                    <option>פרסומות / קומרשיאל</option>
                    <option>קליפים מוזיקליים</option>
                    <option>תדמית לעסקים</option>
                    <option>אחר</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>שם לקוח *</label>
                  <input type="text" placeholder="שם מלא" style={styles.input} value={form.clientName}
                    onChange={e => setForm({ ...form, clientName: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>טלפון</label>
                  <input type="tel" placeholder="050-0000000" style={styles.input} value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>מיקום</label>
                  <input type="text" placeholder="כתובת / מקום האירוע" style={styles.input} value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>מחיר (₪) *</label>
                  <input type="number" placeholder="0" style={styles.input} value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>סטטוס תשלום</label>
                  <select style={styles.input} value={form.paymentStatus}
                    onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                    <option>לא שולם</option>
                    <option>מקדמה שולמה</option>
                    <option>שולם</option>
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>הערות</label>
                <textarea placeholder="פרטים נוספים, הנחיות מיוחדות..." style={styles.textarea} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div style={styles.formActions}>
                <button style={styles.btnPrimary} onClick={handleSubmitShoot}>
                  {editId ? "עדכן יום צילום" : "שמור יום צילום"}
                </button>
                <button style={styles.btnSecondary} onClick={() => { setForm(initialForm); setEditId(null); setView("history"); }}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {view === "history" && (
          <div style={styles.fadeIn}>
            <div style={styles.pageHeader}>
              <h1 style={styles.pageTitle}>היסטוריית צילומים</h1>
              <button style={styles.btnPrimary} onClick={() => setView("form")}>+ יום צילום חדש</button>
            </div>
            {shoots.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>🎬</div>
                <p>עדיין אין ימי צילום. הוסף את הראשון!</p>
              </div>
            ) : (
              <div style={styles.shootList}>
                {shoots.map(s => (
                  <div key={s.id} style={styles.shootCard}>
                    <div style={styles.shootCardTop}>
                      <div>
                        <div style={styles.shootName}>{s.clientName}</div>
                        <div style={styles.shootMeta}>{s.date} · {s.location || "ללא מיקום"}</div>
                      </div>
                      <div style={styles.shootRight}>
                        <div style={styles.shootPrice}>{fmt(s.price)}</div>
                        <span style={{ ...styles.badge, background: s.paymentStatus === "שולם" ? "#00c87a22" : s.paymentStatus === "מקדמה שולמה" ? "#f0b42922" : "#ff444422", color: s.paymentStatus === "שולם" ? "#00c87a" : s.paymentStatus === "מקדמה שולמה" ? "#f0b429" : "#ff4444" }}>
                          {s.paymentStatus}
                        </span>
                      </div>
                    </div>
                    <div style={styles.shootCardBottom}>
                      <span style={styles.typeTag}>{s.type}</span>
                      {s.phone && <span style={styles.metaChip}>📞 {s.phone}</span>}
                      {s.notes && <span style={styles.metaChip} title={s.notes}>💬 הערות</span>}
                      <div style={styles.shootActions}>
                        <button style={styles.actionBtn} onClick={() => handleEditShoot(s)}>עריכה</button>
                        <button style={{ ...styles.actionBtn, color: "#ff4444" }} onClick={() => handleDeleteShoot(s.id)}>מחיקה</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FINANCES */}
        {view === "finances" && (
          <div style={styles.fadeIn}>
            <h1 style={styles.pageTitle}>כספים</h1>

            <div style={styles.statsGrid}>
              <div style={{ ...styles.statCard, ...styles.statCardMain }}>
                <div style={styles.statLabel}>ברוטו (הכנסות)</div>
                <div style={styles.statValue}>{fmt(totalIncome)}</div>
              </div>
              <div style={{ ...styles.statCard, background: "#1a100f" }}>
                <div style={styles.statLabel}>סה"כ הוצאות</div>
                <div style={{ ...styles.statValue, color: "#ff6b4a" }}>{fmt(totalExpenses)}</div>
              </div>
              <div style={{ ...styles.statCard, background: netIncome >= 0 ? "#0f1a12" : "#1a0f0f" }}>
                <div style={styles.statLabel}>נטו</div>
                <div style={{ ...styles.statValue, color: netIncome >= 0 ? "#00c87a" : "#ff4444" }}>{fmt(netIncome)}</div>
              </div>
            </div>

            <div style={styles.twoCol}>
              {/* Add Expense */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>הוסף הוצאה חודשית</h3>
                <div style={styles.formGroup}>
                  <label style={styles.label}>חודש</label>
                  <input type="month" style={styles.input} value={expenseForm.month}
                    onChange={e => setExpenseForm({ ...expenseForm, month: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>תיאור ההוצאה</label>
                  <input type="text" placeholder='למשל: "חיוב אשראי ינואר"' style={styles.input} value={expenseForm.description}
                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>סכום (₪)</label>
                  <input type="number" placeholder="0" style={styles.input} value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
                <button style={styles.btnPrimary} onClick={handleAddExpense}>הוסף הוצאה</button>
              </div>

              {/* Expense List */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>רשימת הוצאות</h3>
                {expenses.length === 0 ? (
                  <p style={styles.empty}>אין הוצאות רשומות</p>
                ) : expenses.map(e => (
                  <div key={e.id} style={styles.expenseRow}>
                    <div>
                      <div style={styles.expenseDesc}>{e.description}</div>
                      <div style={styles.expenseMeta}>{e.month}</div>
                    </div>
                    <div style={styles.expenseRight}>
                      <span style={styles.expenseAmount}>{fmt(e.amount)}</span>
                      <button style={styles.deleteBtn} onClick={() => handleDeleteExpense(e.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#080c0e",
    color: "#e8eaed",
    fontFamily: "'Heebo', 'Assistant', sans-serif",
    direction: "rtl",
  },
  header: {
    background: "#0d1117",
    borderBottom: "1px solid #1e2530",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    color: "#00c87a",
    fontSize: 18,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 2,
    color: "#ffffff",
  },
  logoAccent: {
    color: "#00c87a",
  },
  nav: {
    display: "flex",
    gap: 4,
  },
  navBtn: {
    background: "transparent",
    border: "none",
    color: "#7a8a9a",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
  },
  navBtnActive: {
    background: "#00c87a18",
    color: "#00c87a",
  },
  navIcon: {
    fontSize: 14,
  },
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 24px",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 28,
    letterSpacing: -0.5,
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: "#0d1117",
    border: "1px solid #1e2530",
    borderRadius: 14,
    padding: "22px 24px",
  },
  statCardMain: {
    background: "#001a0e",
    border: "1px solid #00c87a33",
  },
  statLabel: {
    fontSize: 12,
    color: "#7a8a9a",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 4,
  },
  statSub: {
    fontSize: 12,
    color: "#5a6a7a",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  card: {
    background: "#0d1117",
    border: "1px solid #1e2530",
    borderRadius: 14,
    padding: "24px",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#c0cad6",
    marginBottom: 18,
    letterSpacing: 0.5,
  },
  typeRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 13,
    color: "#8a9aaa",
    minWidth: 160,
  },
  typeBar: {
    flex: 1,
    height: 6,
    background: "#1a2530",
    borderRadius: 3,
    overflow: "hidden",
  },
  typeBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #00c87a, #00e08a)",
    borderRadius: 3,
    transition: "width 0.5s",
  },
  typeCount: {
    fontSize: 13,
    color: "#00c87a",
    fontWeight: 700,
    minWidth: 20,
    textAlign: "center",
  },
  recentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #1a2530",
  },
  recentName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#d0dae4",
  },
  recentMeta: {
    fontSize: 12,
    color: "#5a6a7a",
    marginTop: 3,
  },
  recentPrice: {
    fontSize: 15,
    fontWeight: 700,
  },
  formCard: {
    background: "#0d1117",
    border: "1px solid #1e2530",
    borderRadius: 16,
    padding: "32px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0 24px",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#7a8a9a",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    width: "100%",
    background: "#111820",
    border: "1px solid #1e2d3d",
    borderRadius: 8,
    color: "#e0eaf4",
    padding: "11px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border 0.15s",
  },
  textarea: {
    width: "100%",
    background: "#111820",
    border: "1px solid #1e2d3d",
    borderRadius: 8,
    color: "#e0eaf4",
    padding: "11px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical",
    minHeight: 90,
    boxSizing: "border-box",
  },
  formActions: {
    display: "flex",
    gap: 12,
    marginTop: 8,
  },
  btnPrimary: {
    background: "#00c87a",
    color: "#000",
    border: "none",
    borderRadius: 8,
    padding: "11px 24px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity 0.15s",
  },
  btnSecondary: {
    background: "transparent",
    color: "#7a8a9a",
    border: "1px solid #2a3540",
    borderRadius: 8,
    padding: "11px 20px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  shootList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  shootCard: {
    background: "#0d1117",
    border: "1px solid #1e2530",
    borderRadius: 12,
    padding: "18px 20px",
    transition: "border-color 0.15s",
  },
  shootCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  shootName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e0eaf4",
  },
  shootMeta: {
    fontSize: 12,
    color: "#5a6a7a",
    marginTop: 4,
  },
  shootRight: {
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
  },
  shootPrice: {
    fontSize: 18,
    fontWeight: 800,
    color: "#ffffff",
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 20,
  },
  shootCardBottom: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  typeTag: {
    fontSize: 12,
    color: "#00c87a",
    background: "#00c87a15",
    padding: "3px 10px",
    borderRadius: 20,
    fontWeight: 600,
  },
  metaChip: {
    fontSize: 12,
    color: "#7a8a9a",
    background: "#1a2530",
    padding: "3px 10px",
    borderRadius: 20,
  },
  shootActions: {
    marginRight: "auto",
    display: "flex",
    gap: 8,
  },
  actionBtn: {
    background: "transparent",
    border: "1px solid #2a3540",
    color: "#7a8a9a",
    padding: "4px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
  },
  expenseRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #1a2530",
  },
  expenseDesc: {
    fontSize: 14,
    color: "#d0dae4",
    fontWeight: 600,
  },
  expenseMeta: {
    fontSize: 12,
    color: "#5a6a7a",
    marginTop: 3,
  },
  expenseRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: 700,
    color: "#ff6b4a",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: "#5a6a7a",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 6px",
  },
  empty: {
    color: "#4a5a6a",
    fontSize: 14,
    textAlign: "center",
    padding: "20px 0",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#4a5a6a",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  toast: {
    position: "fixed",
    top: 80,
    right: "50%",
    transform: "translateX(50%)",
    color: "#000",
    fontWeight: 700,
    padding: "12px 28px",
    borderRadius: 10,
    zIndex: 999,
    fontSize: 14,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  },
  fadeIn: {
    animation: "fadeIn 0.2s ease",
  },
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  input:focus, select:focus, textarea:focus { border-color: #00c87a !important; }
  button:hover { opacity: 0.85; }
  ::-webkit-scrollbar { width: 6px; } 
  ::-webkit-scrollbar-track { background: #0d1117; }
  ::-webkit-scrollbar-thumb { background: #2a3540; border-radius: 3px; }
  @media (max-width: 700px) {
    .two-col { grid-template-columns: 1fr !important; }
    .form-grid { grid-template-columns: 1fr !important; }
    nav { gap: 2px !important; }
    nav button span:last-child { display: none; }
  }
`;
