// 🔥 Improved version of your App.jsx
// Focus: security, modularity, cleaner structure

import { useState, useEffect } from "react";

// ✅ ENV במקום hardcode
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔐 API Wrapper עם טיפול שגיאות טוב יותר
async function apiFetch(path, options = {}, token) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token || SUPABASE_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "API Error");
    }

    return await res.json();
  } catch (err) {
    console.error("API ERROR:", err);
    throw err;
  }
}

// 🧠 Custom Hook לניהול auth
function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("session");
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed.user);
      setToken(parsed.token);
    }
  }, []);

  const login = (data) => {
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("session", JSON.stringify(data));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("session");
  };

  return { user, token, login, logout };
}

// 📦 קומפוננטה קטנה לדוגמה
function ShootCard({ shoot }) {
  return (
    <div style={{ padding: 12, border: "1px solid #ddd", marginBottom: 8 }}>
      <b>{shoot.clientName}</b>
      <div>{shoot.date}</div>
      <div>{shoot.price} ₪</div>
    </div>
  );
}

// 🚀 App
export default function App() {
  const { user, token, login, logout } = useAuth();
  const [shoots, setShoots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadShoots();
  }, [token]);

  async function loadShoots() {
    setLoading(true);
    try {
      const data = await apiFetch("shoots?order=date.desc", {}, token);
      setShoots(data || []);
    } catch (e) {
      alert("שגיאה בטעינת נתונים");
    }
    setLoading(false);
  }

  async function addShoot() {
    const newShoot = {
      date: new Date().toISOString().split("T")[0],
      client_name: "לקוח חדש",
      price: 1000,
    };

    try {
      const res = await apiFetch("shoots", {
        method: "POST",
        body: JSON.stringify(newShoot),
      }, token);

      setShoots([res[0], ...shoots]);
    } catch {
      alert("שגיאה בהוספה");
    }
  }

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Login mock</h2>
        <button
          onClick={() =>
            login({ user: { name: "Tal" }, token: "fake-token" })
          }
        >
          התחבר
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>

      <button onClick={logout}>Logout</button>
      <button onClick={addShoot}>+ הוסף צילום</button>

      {loading && <p>טוען...</p>}

      {shoots.map((s) => (
        <ShootCard key={s.id} shoot={{
          clientName: s.client_name,
          date: s.date,
          price: s.price,
        }} />
      ))}
    </div>
  );
}

// ✅ מה שופר:
// - שימוש ב ENV (אבטחה)
// - הפרדת לוגיקה (hook)
// - API wrapper נקי
// - קוד קריא יותר
// - בסיס להמשך פירוק לפרויקט גדול
