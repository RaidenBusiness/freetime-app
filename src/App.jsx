import { useState, useMemo, useEffect, useCallback } from "react";

// Supabase client (inline, no install needed via CDN)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path, options = {}) {
  const session = JSON.parse(localStorage.getItem("sb_session") || "null");
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    ...options.headers,
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error_description || "Request failed");
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function authSignUp(email, password, name) {
  const data = await sbFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { name } }),
  });
  return data;
}

async function authSignIn(email, password) {
  const data = await sbFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data;
}

async function authSignOut(token) {
  await sbFetch("/auth/v1/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PRIORITY_COLORS = ["#f59e0b","#10b981","#6366f1","#ef4444","#ec4899","#06b6d4"];

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function fmt12(h, m) {
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2,"0")} ${ampm}`;
}

function shiftHours(shift) {
  const [sh, sm] = shift.startTime.split(":").map(Number);
  const [eh, em] = shift.endTime.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

const initialShifts = [
  { id: 1, date: (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split("T")[0]; })(), startTime: "14:00", endTime: "22:00", label: "Work", travelMins: 20 },
  { id: 2, date: (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay() + 3); return d.toISOString().split("T")[0]; })(), startTime: "16:00", endTime: "23:00", label: "Work", travelMins: 20 },
  { id: 3, date: (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay() + 5); return d.toISOString().split("T")[0]; })(), startTime: "10:00", endTime: "18:00", label: "Work", travelMins: 20 },
];

const initialPriorities = [
  { id: 1, name: "Gym", color: "#f59e0b", days: ["Tue","Thu","Sat"], duration: 1.5, travelMins: 15 },
  { id: 2, name: "Reading", color: "#10b981", days: ["Mon","Wed","Fri","Sun"], duration: 1, travelMins: 0 },
  { id: 3, name: "Gaming", color: "#6366f1", days: ["Sat","Sun"], duration: 2, travelMins: 0 },
];

export default function FreeTime() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Auth state
  const [authed, setAuthed] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("sb_session") || "null");
    if (session?.access_token && session?.user) {
      setCurrentUser({ name: session.user.user_metadata?.name || session.user.email.split("@")[0], email: session.user.email, id: session.user.id });
      setAuthed(true);
    }
  }, []);

  // Load user data when authed
  useEffect(() => {
    if (!authed || !currentUser?.id) return;
    loadUserData();
  }, [authed, currentUser?.id]);

  const loadUserData = useCallback(async () => {
    if (!currentUser?.id) return;
    setDataLoading(true);
    try {
      const [shiftsRes, prioritiesRes, settingsRes] = await Promise.all([
        sbFetch(`/rest/v1/shifts?user_id=eq.${currentUser.id}&order=date.asc`),
        sbFetch(`/rest/v1/priorities?user_id=eq.${currentUser.id}&order=sort_order.asc`),
        sbFetch(`/rest/v1/user_settings?user_id=eq.${currentUser.id}`),
      ]);
      if (Array.isArray(shiftsRes) && shiftsRes.length > 0) {
        setShifts(shiftsRes.map(s => ({ id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, label: s.label, travelMins: s.travel_mins })));
      }
      if (Array.isArray(prioritiesRes) && prioritiesRes.length > 0) {
        setPriorities(prioritiesRes.map(p => ({ id: p.id, name: p.name, color: p.color, days: p.days, duration: p.duration, travelMins: p.travel_mins })));
      }
      if (Array.isArray(settingsRes) && settingsRes.length > 0) {
        setSleepHours(settingsRes[0].sleep_hours);
      }
    } catch (e) { console.error("Load error", e); }
    setDataLoading(false);
  }, [currentUser?.id]);

  async function handleAuth() {
    setAuthError("");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!authEmail.trim() || !authPassword.trim()) { setAuthError("Please fill in all fields."); return; }
    if (!emailRegex.test(authEmail.trim())) { setAuthError("Please enter a valid email address."); return; }
    if (authMode === "signup" && !authName.trim()) { setAuthError("Please enter your name."); return; }
    if (authPassword.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const data = await authSignUp(authEmail.trim(), authPassword, authName.trim());
        if (data.error || data.error_description) throw new Error(data.error_description || data.msg || data.error || "Signup failed");
        // Email confirmation is on — show confirmation screen instead of auto sign-in
        setSignupDone(true);
      } else {
        const session = await authSignIn(authEmail.trim(), authPassword);
        if (session.error || session.error_description) throw new Error(session.error_description || session.msg || session.error || "Login failed");
        if (keepSignedIn) localStorage.setItem("sb_session", JSON.stringify(session));
        else sessionStorage.setItem("sb_session", JSON.stringify(session));
        localStorage.setItem("sb_session", JSON.stringify(session));
        const name = session.user?.user_metadata?.name || authEmail.split("@")[0];
        setCurrentUser({ name, email: session.user.email, id: session.user.id });
        setAuthed(true);
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setAuthError("Please confirm your email before logging in. Check your inbox.");
      } else if (msg.toLowerCase().includes("invalid login")) {
        setAuthError("Incorrect email or password.");
      } else if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
        setAuthError("An account with this email already exists. Try logging in.");
      } else {
        setAuthError(msg || "Something went wrong. Please try again.");
      }
    }
    setAuthLoading(false);
  }

  async function handleSignOut() {
    const session = JSON.parse(localStorage.getItem("sb_session") || "null");
    if (session?.access_token) await authSignOut(session.access_token).catch(() => {});
    localStorage.removeItem("sb_session");
    sessionStorage.removeItem("sb_session");
    setAuthed(false);
    setCurrentUser(null);
    setShifts(initialShifts);
    setPriorities(initialPriorities);
    setSleepHours(8);
    setAuthEmail(""); setAuthPassword(""); setAuthName(""); setAuthError("");
  }
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState(initialShifts);
  const [priorities, setPriorities] = useState(initialPriorities);
  const [tab, setTab] = useState("home");
  const [selectedDay, setSelectedDay] = useState(today);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddPriority, setShowAddPriority] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const [newShift, setNewShift] = useState({ date: today.toISOString().split("T")[0], startTime: "09:00", endTime: "17:00", label: "Work", travelMins: 0 });
  const [newPriority, setNewPriority] = useState({ name: "", color: "#f59e0b", days: [], duration: 1, travelMins: 0 });
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editingPriorityId, setEditingPriorityId] = useState(null);
  const [sleepHours, setSleepHours] = useState(8);
  const [durationUnit, setDurationUnit] = useState("hrs");

  const weekStart = useMemo(() => addDays(getWeekStart(today), weekOffset * 7), [today, weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekShifts = useMemo(() =>
    shifts.filter(s => {
      const sd = new Date(s.date + "T00:00:00");
      return weekDays.some(d => isSameDay(d, sd));
    }), [shifts, weekDays]);

  const workDays = useMemo(() => new Set(weekShifts.map(s => s.date)), [weekShifts]);
  const freeDays = 7 - workDays.size;

  const totalWorkHours = useMemo(() =>
    weekShifts.reduce((acc, s) => acc + shiftHours(s), 0), [weekShifts]);
  const totalShiftTravelHours = useMemo(() =>
    weekShifts.reduce((acc, s) => acc + ((s.travelMins ?? 0) / 60), 0), [weekShifts]);
  const wakingHours = 24 - sleepHours;
  const totalPriorityHours = useMemo(() =>
    priorities.reduce((acc, p) => {
      const daysPerWeek = p.days.length === 0 ? 7 : p.days.length;
      return acc + (p.duration ?? 1) * daysPerWeek;
    }, 0), [priorities]);
  const totalPriorityTravelHours = useMemo(() =>
    priorities.reduce((acc, p) => {
      const daysPerWeek = p.days.length === 0 ? 7 : p.days.length;
      return acc + ((p.travelMins ?? 0) / 60) * daysPerWeek;
    }, 0), [priorities]);
  const totalFreeHours = Math.max(0, Math.round((7 * wakingHours - totalWorkHours - totalShiftTravelHours - totalPriorityHours - totalPriorityTravelHours) * 10) / 10);

  const selectedDateStr = selectedDay.toISOString().split("T")[0];
  const dayShifts = shifts.filter(s => s.date === selectedDateStr);
  const selectedDayAbbr = DAYS[selectedDay.getDay()];
  const dayPriorities = priorities.filter(p => p.days.length === 0 || p.days.includes(selectedDayAbbr));

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth())
      return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}`;
    return `${MONTHS[weekStart.getMonth()].slice(0,3)} ${weekStart.getDate()} – ${MONTHS[end.getMonth()].slice(0,3)} ${end.getDate()}`;
  })();

  async function addShift() {
    if (!newShift.date || !newShift.startTime || !newShift.endTime) return;
    const payload = { user_id: currentUser.id, date: newShift.date, start_time: newShift.startTime, end_time: newShift.endTime, label: newShift.label, travel_mins: newShift.travelMins };
    try {
      if (editingShiftId) {
        await sbFetch(`/rest/v1/shifts?id=eq.${editingShiftId}`, { method: "PATCH", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } });
        setShifts(prev => prev.map(s => s.id === editingShiftId ? { ...newShift, id: editingShiftId } : s));
        setEditingShiftId(null);
      } else {
        const res = await sbFetch("/rest/v1/shifts", { method: "POST", body: JSON.stringify(payload), headers: { Prefer: "return=representation" } });
        const created = Array.isArray(res) ? res[0] : res;
        setShifts(prev => [...prev, { ...newShift, id: created.id }]);
      }
    } catch (e) { console.error("Shift save error", e); }
    setShowAddShift(false);
    setNewShift({ date: today.toISOString().split("T")[0], startTime: "09:00", endTime: "17:00", label: "Work", travelMins: 0 });
  }

  function openEditShift(shift) {
    setNewShift({ date: shift.date, startTime: shift.startTime, endTime: shift.endTime, label: shift.label, travelMins: shift.travelMins ?? 0 });
    setEditingShiftId(shift.id);
    setShowAddShift(true);
  }

  async function deleteShift(id) {
    try {
      await sbFetch(`/rest/v1/shifts?id=eq.${id}`, { method: "DELETE" });
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (e) { console.error("Delete shift error", e); }
    setShowDeleteConfirm(null);
  }

  function addPriority() {
    if (!newPriority.name.trim()) return;
    if (editingPriorityId) {
      setPriorities(prev => prev.map(p => p.id === editingPriorityId ? { ...newPriority, id: editingPriorityId } : p));
      setEditingPriorityId(null);
    } else {
      setPriorities(prev => [...prev, { ...newPriority, id: Date.now() }]);
    }
    setShowAddPriority(false);
    setNewPriority({ name: "", color: "#f59e0b", days: [], duration: 1, travelMins: 0 });
  }

  function openEditPriority(p) {
    setNewPriority({ name: p.name, color: p.color, days: p.days, duration: p.duration ?? 1, travelMins: p.travelMins ?? 0 });
    setEditingPriorityId(p.id);
    setDurationUnit("hrs");
    setShowAddPriority(true);
  }

  function deletePriority(id) {
    setPriorities(prev => prev.filter(p => p.id !== id));
  }

  function togglePriorityDay(day) {
    setNewPriority(p => ({
      ...p,
      days: p.days.includes(day) ? p.days.filter(d => d !== day) : [...p.days, day]
    }));
  }

  const styles = {
    root: {
      minHeight: "100vh",
      background: "#0d0d14",
      display: "flex",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
    },
    app: {
      width: "100%",
      maxWidth: 430,
      minHeight: "100vh",
      background: "#0d0d14",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    },
    header: {
      padding: "52px 24px 20px",
      background: "linear-gradient(180deg, #13131f 0%, #0d0d14 100%)",
    },
    logo: {
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "0.18em",
      color: "#f59e0b",
      textTransform: "uppercase",
      marginBottom: 12,
    },
    greeting: {
      fontSize: 26,
      fontWeight: 700,
      color: "#fff",
      lineHeight: 1.2,
      marginBottom: 4,
    },
    subGreeting: {
      fontSize: 14,
      color: "#6b6b8a",
    },
    weekNav: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      marginTop: 24,
      marginBottom: 16,
    },
    weekLabel: { fontSize: 15, fontWeight: 600, color: "#fff" },
    navBtn: {
      background: "#1e1e2e",
      border: "none",
      color: "#9090aa",
      borderRadius: 10,
      width: 34,
      height: 34,
      cursor: "pointer",
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    dayStrip: {
      display: "flex",
      padding: "0 16px",
      gap: 6,
      marginBottom: 4,
    },
    dayPill: (isToday, isSelected, hasShift) => ({
      flex: 1,
      textAlign: "center",
      padding: "8px 0 6px",
      borderRadius: 12,
      cursor: "pointer",
      background: isSelected ? "#f59e0b" : isToday ? "#1e1e2e" : "transparent",
      border: isToday && !isSelected ? "1px solid #2a2a3e" : "1px solid transparent",
      transition: "all 0.15s",
    }),
    dayName: (isSelected) => ({
      fontSize: 10,
      color: isSelected ? "#0d0d14" : "#6b6b8a",
      fontWeight: 600,
      letterSpacing: "0.05em",
      display: "block",
      marginBottom: 3,
    }),
    dayNum: (isSelected, hasShift) => ({
      fontSize: 16,
      fontWeight: 700,
      color: isSelected ? "#0d0d14" : "#fff",
      display: "block",
    }),
    shiftDot: (isSelected, hasShift) => ({
      width: hasShift ? 6 : 4,
      height: hasShift ? 6 : 4,
      borderRadius: "50%",
      background: isSelected ? "#0d0d14" : hasShift ? "#f59e0b" : "transparent",
      margin: "3px auto 0",
      boxShadow: !isSelected && hasShift ? "0 0 5px #f59e0b" : "none",
    }),
    body: {
      flex: 1,
      padding: "16px 16px 90px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      overflowY: "auto",
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      color: "#4a4a6a",
      textTransform: "uppercase",
      marginBottom: 8,
    },
    card: {
      background: "#13131f",
      borderRadius: 16,
      border: "1px solid #1e1e2e",
      padding: "14px 16px",
    },
    shiftRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid #1a1a2a",
    },
    shiftIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: "#1e1e2e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontSize: 17,
    },
    shiftInfo: { flex: 1 },
    shiftTitle: { fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 },
    shiftTime: { fontSize: 12, color: "#6b6b8a" },
    shiftBadge: {
      fontSize: 11,
      fontWeight: 700,
      color: "#f59e0b",
      background: "rgba(245,158,11,0.12)",
      borderRadius: 20,
      padding: "3px 10px",
    },
    freeRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
    },
    statGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    statCard: {
      background: "#13131f",
      border: "1px solid #1e1e2e",
      borderRadius: 14,
      padding: "14px 16px",
    },
    statNum: { fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1 },
    statLabel: { fontSize: 12, color: "#6b6b8a", marginTop: 4 },
    barTrack: {
      background: "#1e1e2e",
      borderRadius: 20,
      height: 6,
      marginTop: 10,
      overflow: "hidden",
    },
    barFill: (pct, color) => ({
      height: "100%",
      width: `${Math.min(100, pct)}%`,
      background: color,
      borderRadius: 20,
      transition: "width 0.4s ease",
    }),
    priorityRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid #1a1a2a",
    },
    priorityDot: (color) => ({
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: color,
      flexShrink: 0,
    }),
    priorityName: { fontSize: 14, color: "#fff", fontWeight: 500, flex: 1 },
    priorityDays: { fontSize: 12, color: "#4a4a6a" },
    addBtn: {
      background: "#f59e0b",
      color: "#0d0d14",
      border: "none",
      borderRadius: 14,
      padding: "14px",
      width: "100%",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      letterSpacing: "0.02em",
    },
    ghostBtn: {
      background: "#13131f",
      color: "#9090aa",
      border: "1px solid #1e1e2e",
      borderRadius: 14,
      padding: "12px",
      width: "100%",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    tabBar: {
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: 430,
      background: "#13131f",
      borderTop: "1px solid #1e1e2e",
      display: "flex",
      padding: "10px 0 20px",
      zIndex: 100,
    },
    tabItem: (active) => ({
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.05em",
      color: active ? "#f59e0b" : "#3a3a5a",
      cursor: "pointer",
      border: "none",
      background: "transparent",
    }),
    modal: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      zIndex: 200,
    },
    modalSheet: {
      width: "100%",
      maxWidth: 430,
      background: "#13131f",
      borderRadius: "20px 20px 0 0",
      padding: "24px 20px 40px",
      border: "1px solid #1e1e2e",
      borderBottom: "none",
    },
    modalTitle: { fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 },
    fieldLabel: { fontSize: 12, fontWeight: 600, color: "#6b6b8a", marginBottom: 6, display: "block", letterSpacing: "0.05em", textTransform: "uppercase" },
    input: {
      width: "100%",
      background: "#0d0d14",
      border: "1px solid #1e1e2e",
      borderRadius: 10,
      padding: "11px 14px",
      color: "#fff",
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box",
      fontFamily: "'DM Sans', sans-serif",
    },
    colorDot: (color, selected) => ({
      width: 28,
      height: 28,
      borderRadius: "50%",
      background: color,
      cursor: "pointer",
      border: selected ? "3px solid #fff" : "3px solid transparent",
      boxSizing: "border-box",
    }),
    dayToggle: (active) => ({
      flex: 1,
      padding: "8px 0",
      borderRadius: 10,
      background: active ? "#f59e0b" : "#0d0d14",
      color: active ? "#0d0d14" : "#6b6b8a",
      border: "1px solid #1e1e2e",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      textAlign: "center",
    }),
    deleteBtn: {
      background: "transparent",
      border: "none",
      color: "#3a3a5a",
      cursor: "pointer",
      fontSize: 17,
      padding: "4px 6px",
      borderRadius: 6,
      lineHeight: 1,
    },
    editBtn: {
      background: "transparent",
      border: "none",
      color: "#4a4a7a",
      cursor: "pointer",
      fontSize: 13,
      padding: "4px 6px",
      borderRadius: 6,
      lineHeight: 1,
    },
    emptyState: {
      textAlign: "center",
      padding: "32px 0",
      color: "#3a3a5a",
      fontSize: 14,
    },
  };

  const todayGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const isCurrentWeek = weekOffset === 0;

  // Auth screen
  if (!authed) {
    const aStyles = {
      root: { minHeight: "100vh", background: "#0d0d14", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'DM Sans', sans-serif" },
      card: { width: "100%", maxWidth: 390, padding: "0 24px 40px", display: "flex", flexDirection: "column" },
      logo: { fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", color: "#f59e0b", textTransform: "uppercase", marginBottom: 32, textAlign: "center" },
      tagline: { fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.25, marginBottom: 8, textAlign: "center" },
      sub: { fontSize: 14, color: "#6b6b8a", textAlign: "center", marginBottom: 36 },
      tabRow: { display: "flex", background: "#13131f", borderRadius: 12, padding: 4, marginBottom: 24, border: "1px solid #1e1e2e" },
      tabBtn: (active) => ({
        flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
        background: active ? "#f59e0b" : "transparent", color: active ? "#0d0d14" : "#4a4a6a",
      }),
      fieldWrap: { marginBottom: 14 },
      label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4a4a6a", textTransform: "uppercase", display: "block", marginBottom: 6 },
      input: { width: "100%", background: "#13131f", border: "1px solid #1e1e2e", borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" },
      keepRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 22, cursor: "pointer" },
      checkbox: (checked) => ({
        width: 20, height: 20, borderRadius: 6, border: checked ? "none" : "2px solid #2a2a3e",
        background: checked ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, cursor: "pointer",
      }),
      submitBtn: { width: "100%", background: "#f59e0b", color: "#0d0d14", border: "none", borderRadius: 14, padding: "15px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 16 },
      error: { fontSize: 13, color: "#ef4444", textAlign: "center", marginBottom: 14, minHeight: 20 },
      divider: { display: "flex", alignItems: "center", gap: 12, margin: "4px 0 20px" },
      divLine: { flex: 1, height: 1, background: "#1e1e2e" },
      divText: { fontSize: 11, color: "#3a3a5a", fontWeight: 600 },
      switchTxt: { fontSize: 13, color: "#4a4a6a", textAlign: "center" },
      switchLink: { color: "#f59e0b", cursor: "pointer", fontWeight: 600, background: "none", border: "none", fontSize: 13, fontFamily: "'DM Sans', sans-serif" },
    };

    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={aStyles.root}>
          <div style={aStyles.card}>

            {/* Email confirmation screen */}
            {signupDone ? (
              <div style={{ textAlign: "center", paddingTop: 80 }}>
                <div style={{ fontSize: 64, marginBottom: 20 }}>📬</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Check your email</div>
                <div style={{ fontSize: 14, color: "#6b6b8a", lineHeight: 1.6, marginBottom: 32 }}>
                  We sent a confirmation link to{" "}
                  <span style={{ color: "#f59e0b", fontWeight: 600 }}>{authEmail}</span>.
                  {"\n"}Click it to activate your account, then come back here to log in.
                </div>
                <button style={aStyles.submitBtn} onClick={() => { setSignupDone(false); setAuthMode("login"); setAuthPassword(""); setAuthError(""); }}>
                  Back to log in
                </button>
                <div style={{ fontSize: 12, color: "#3a3a5a", marginTop: 16 }}>
                  Didn't get it? Check your spam folder.
                </div>
              </div>
            ) : (
              <>
                {/* Logo + hero */}
                <div style={{ textAlign: "center", marginBottom: 40, paddingTop: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                  <div style={aStyles.logo}>FreeTime</div>
                  <div style={aStyles.tagline}>{authMode === "login" ? "Welcome back" : "Take back your time"}</div>
                  <div style={aStyles.sub}>{authMode === "login" ? "Sign in to your account" : "Create your free account and start planning"}</div>
                </div>

                {/* Login / Sign up toggle */}
                <div style={aStyles.tabRow}>
                  <button style={aStyles.tabBtn(authMode === "login")} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Log in</button>
                  <button style={aStyles.tabBtn(authMode === "signup")} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up</button>
                </div>

                {/* Fields */}
                {authMode === "signup" && (
                  <div style={aStyles.fieldWrap}>
                    <label style={aStyles.label}>Your name</label>
                    <input style={aStyles.input} placeholder="Alex" value={authName}
                      onChange={e => setAuthName(e.target.value)} />
                  </div>
                )}
                <div style={aStyles.fieldWrap}>
                  <label style={aStyles.label}>Email</label>
                  <input style={aStyles.input} type="email" placeholder="you@email.com" value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAuth()} />
                </div>
                <div style={{ ...aStyles.fieldWrap, marginBottom: 18 }}>
                  <label style={aStyles.label}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input style={{ ...aStyles.input, paddingRight: 48 }}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••" value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAuth()} />
                    <button
                      onClick={() => setShowPassword(s => !s)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, color: showPassword ? "#f59e0b" : "#3a3a5a", padding: 0 }}>
                      {showPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                {/* Keep me signed in */}
                <div style={aStyles.keepRow} onClick={() => setKeepSignedIn(k => !k)}>
                  <div style={aStyles.checkbox(keepSignedIn)}>
                    {keepSignedIn && <span style={{ fontSize: 13, fontWeight: 900, color: "#0d0d14" }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: keepSignedIn ? "#fff" : "#4a4a6a", userSelect: "none" }}>Keep me signed in</span>
                </div>

                {/* Error */}
                <div style={aStyles.error}>{authError}</div>

                {/* Submit */}
                <button style={{ ...aStyles.submitBtn, opacity: authLoading ? 0.6 : 1 }} onClick={handleAuth} disabled={authLoading}>
                  {authLoading ? "Please wait..." : authMode === "login" ? "Log in" : "Create account"}
                </button>

                {/* Divider */}
                <div style={aStyles.divider}>
                  <div style={aStyles.divLine} />
                  <span style={aStyles.divText}>OR</span>
                  <div style={aStyles.divLine} />
                </div>

                {/* Continue as guest */}
                <button style={{ ...aStyles.submitBtn, background: "#13131f", color: "#9090aa", border: "1px solid #1e1e2e", marginBottom: 20 }}
                  onClick={() => { setCurrentUser({ name: "Guest", email: "", id: null }); setAuthed(true); }}>
                  Continue as guest
                </button>

                {/* Switch mode */}
                <div style={aStyles.switchTxt}>
                  {authMode === "login" ? (
                    <>Don't have an account? <button style={aStyles.switchLink} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up free</button></>
                  ) : (
                    <>Already have an account? <button style={aStyles.switchLink} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Log in</button></>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={styles.root}>
        <div style={styles.app}>

          {/* Header */}
          <div style={styles.header}>
            <div style={styles.logo}>FreeTime</div>
            <div style={styles.greeting}>
              {isCurrentWeek ? `${todayGreeting()}, ${currentUser?.name?.split(" ")[0] || ""}` : weekOffset < 0 ? "Past week" : "Upcoming week"}
            </div>
            <div style={styles.subGreeting}>{weekLabel}</div>
          </div>

          {/* Week nav + day strip */}
          <div style={styles.weekNav}>
            <button style={styles.navBtn} onClick={() => setWeekOffset(w => w - 1)}>‹</button>
            <span style={styles.weekLabel}>{isCurrentWeek ? "This week" : weekOffset < 0 ? `${Math.abs(weekOffset)}w ago` : `In ${weekOffset}w`}</span>
            <button style={styles.navBtn} onClick={() => setWeekOffset(w => w + 1)}>›</button>
          </div>

          <div style={styles.dayStrip}>
            {weekDays.map((day, i) => {
              const ds = day.toISOString().split("T")[0];
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDay);
              const hasShift = shifts.some(s => s.date === ds);
              return (
                <div key={i} style={styles.dayPill(isToday, isSelected, hasShift)}
                  onClick={() => { setSelectedDay(day); setTab("home"); }}>
                  <span style={styles.dayName(isSelected)}>{DAYS[i]}</span>
                  <span style={styles.dayNum(isSelected, hasShift)}>{day.getDate()}</span>
                  <div style={styles.shiftDot(isSelected, hasShift)} />
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div style={styles.body}>

            {tab === "home" && (
              <>
                {/* Selected day */}
                <div>
                  <div style={styles.sectionLabel}>{isSameDay(selectedDay, today) ? "Today" : FULL_DAYS[selectedDay.getDay()]} · {MONTHS[selectedDay.getMonth()]} {selectedDay.getDate()}</div>
                  <div style={styles.card}>
                    {dayShifts.length === 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
                        <div style={{ ...styles.shiftIcon, background: "rgba(16,185,129,0.1)" }}>🌿</div>
                        <div style={styles.shiftInfo}>
                          <div style={{ ...styles.shiftTitle, color: "#10b981" }}>Free day</div>
                          <div style={styles.shiftTime}>No shifts scheduled</div>
                        </div>
                        <span style={{ ...styles.shiftBadge, color: "#10b981", background: "rgba(16,185,129,0.12)" }}>Open</span>
                      </div>
                    ) : (
                      dayShifts.map((shift, idx) => {
                        const [sh, sm] = shift.startTime.split(":").map(Number);
                        const [eh, em] = shift.endTime.split(":").map(Number);
                        return (
                          <div key={shift.id} style={{ ...styles.shiftRow, borderBottom: idx < dayShifts.length - 1 ? "1px solid #1a1a2a" : "none" }}>
                            <div style={styles.shiftIcon}>💼</div>
                            <div style={styles.shiftInfo}>
                              <div style={styles.shiftTitle}>{shift.label}</div>
                              <div style={styles.shiftTime}>
                                {fmt12(sh, sm)} – {fmt12(eh, em)}
                                {(shift.travelMins ?? 0) > 0 && <span style={{ color: "#4a4a6a", marginLeft: 6 }}>🚗 {shift.travelMins}m travel</span>}
                              </div>
                            </div>
                            <span style={styles.shiftBadge}>{shiftHours(shift)}h</span>
                            <button style={styles.editBtn} onClick={() => openEditShift(shift)}>✎</button>
                            <button style={styles.deleteBtn} onClick={() => setShowDeleteConfirm(shift.id)}>×</button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <div style={styles.sectionLabel}>Week overview</div>
                  <div style={styles.statGrid}>
                    <div style={styles.statCard}>
                      <div style={styles.statNum}>{freeDays}</div>
                      <div style={styles.statLabel}>Free days</div>
                      <div style={styles.barTrack}><div style={styles.barFill((freeDays / 7) * 100, "#10b981")} /></div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statNum}>{workDays.size}</div>
                      <div style={styles.statLabel}>Work days</div>
                      <div style={styles.barTrack}><div style={styles.barFill((workDays.size / 7) * 100, "#f59e0b")} /></div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={{ ...styles.statNum, fontSize: 22 }}>{totalWorkHours}h</div>
                      <div style={styles.statLabel}>Work hours</div>
                      <div style={styles.barTrack}><div style={styles.barFill((totalWorkHours / (7 * wakingHours)) * 100, "#f59e0b")} /></div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={{ ...styles.statNum, fontSize: 22 }}>{totalPriorityHours}h</div>
                      <div style={styles.statLabel}>Priority hours</div>
                      <div style={styles.barTrack}><div style={styles.barFill((totalPriorityHours / (7 * wakingHours)) * 100, "#6366f1")} /></div>
                    </div>
                  </div>

                  {/* True free time */}
                  <div style={{ ...styles.card, marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>True free time</div>
                        <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 2 }}>After work & priorities</div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{totalFreeHours}h</div>
                    </div>
                    <div style={styles.barTrack}>
                      <div style={{ display: "flex", height: "100%", borderRadius: 20, overflow: "hidden" }}>
                        <div style={{ width: `${(totalWorkHours / (7 * wakingHours)) * 100}%`, background: "#f59e0b", transition: "width 0.4s" }} />
                        <div style={{ width: `${(totalPriorityHours / (7 * wakingHours)) * 100}%`, background: "#6366f1", transition: "width 0.4s" }} />
                        <div style={{ flex: 1, background: "#10b981", transition: "width 0.4s" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                      {[["#f59e0b","Work"],["#6366f1","Priorities"],["#10b981","Free"]].map(([color, label]) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                          <span style={{ fontSize: 11, color: "#4a4a6a" }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Day priorities */}
                {priorities.length > 0 && (
                  <div>
                    <div style={styles.sectionLabel}>
                      {isSameDay(selectedDay, today) ? "Today's" : FULL_DAYS[selectedDay.getDay()] + "'s"} priorities
                    </div>
                    {dayPriorities.length === 0 ? (
                      <div style={{ ...styles.card, textAlign: "center", color: "#3a3a5a", fontSize: 13, padding: "20px" }}>
                        No priorities scheduled — enjoy the free time
                      </div>
                    ) : (
                      <div style={styles.card}>
                        {dayPriorities.map((p, i) => (
                          <div key={p.id} style={{ ...styles.priorityRow, borderBottom: i < dayPriorities.length - 1 ? "1px solid #1a1a2a" : "none" }}>
                            <div style={{ width: 4, borderRadius: 4, alignSelf: "stretch", background: p.color, flexShrink: 0 }} />
                            <div style={{ flex: 1, marginLeft: 4 }}>
                              <div style={styles.priorityName}>{p.name}</div>
                              <div style={{ fontSize: 12, color: "#4a4a6a", marginTop: 2 }}>
                                {p.duration < 1 ? `${Math.round(p.duration * 60)}m` : `${p.duration}h`} dedicated{(p.travelMins ?? 0) > 0 ? ` · 🚗 ${p.travelMins}m travel` : ""}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: `${p.color}18`, borderRadius: 20, padding: "3px 10px" }}>
                              {p.duration ?? 1}h
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button style={styles.addBtn} onClick={() => { setNewShift(s => ({ ...s, date: selectedDateStr })); setShowAddShift(true); }}>
                  + Add shift
                </button>
              </>
            )}

            {tab === "week" && (
              <>
                <div style={styles.sectionLabel}>Week at a glance</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {weekDays.map((day) => {
                    const ds = day.toISOString().split("T")[0];
                    const dayShiftsForDay = shifts.filter(s => s.date === ds);
                    const isWork = dayShiftsForDay.length > 0;
                    const isToday = isSameDay(day, today);
                    const dayAbbr = DAYS[day.getDay()];
                    const dayPrioritiesForDay = priorities.filter(p => p.days.length === 0 || p.days.includes(dayAbbr));
                    const totalHrs = dayShiftsForDay.reduce((a, s) => a + shiftHours(s), 0);
                    return (
                      <div key={ds}
                        onClick={() => { setSelectedDay(day); setTab("home"); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px",
                          borderRadius: 13,
                          cursor: "pointer",
                          background: isToday ? "#1e1e2e" : "#13131f",
                          border: isToday ? "1px solid #2a2a4a" : "1px solid #1a1a2a",
                        }}>
                        {/* Day label */}
                        <div style={{ width: 36, flexShrink: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isWork ? "#f59e0b" : "#10b981", letterSpacing: "0.04em" }}>
                            {DAYS[day.getDay()].toUpperCase()}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isToday ? "#fff" : "#6b6b8a" }}>
                            {day.getDate()}
                          </div>
                        </div>

                        {/* Icon */}
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{isWork ? "💼" : "🌿"}</span>

                        {/* Middle info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {isWork ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {dayShiftsForDay.map(s => {
                                  const [sh, sm] = s.startTime.split(":").map(Number);
                                  const [eh, em] = s.endTime.split(":").map(Number);
                                  return `${fmt12(sh, sm)}–${fmt12(eh, em)}`;
                                }).join(", ")}
                              </div>
                              {dayPrioritiesForDay.length > 0 && (
                                <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {dayPrioritiesForDay.map(p => p.name).join(" · ")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>Day off</div>
                              {dayPrioritiesForDay.length > 0 && (
                                <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {dayPrioritiesForDay.map(p => p.name).join(" · ")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right badge */}
                        {isWork ? (
                          <span style={{ ...styles.shiftBadge, flexShrink: 0 }}>{totalHrs}h</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", borderRadius: 20, padding: "3px 10px", flexShrink: 0 }}>Free</span>
                        )}

                        {/* Add shift shortcut */}
                        <button style={{ ...styles.editBtn, flexShrink: 0, fontSize: 16, color: "#2a2a4a" }}
                          onClick={e => { e.stopPropagation(); setSelectedDay(day); setNewShift(s => ({ ...s, date: ds })); setShowAddShift(true); }}>
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Compact summary */}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, background: "#13131f", border: "1px solid #1a1a2a", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{totalWorkHours}h</div>
                    <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 2 }}>work</div>
                  </div>
                  <div style={{ flex: 1, background: "#13131f", border: "1px solid #1a1a2a", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#6366f1" }}>{totalPriorityHours}h</div>
                    <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 2 }}>priorities</div>
                  </div>
                  <div style={{ flex: 1, background: "#13131f", border: "1px solid #1a1a2a", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981" }}>{totalFreeHours}h</div>
                    <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 2 }}>free</div>
                  </div>
                </div>
              </>
            )}

            {tab === "priorities" && (
              <>
                <div style={styles.sectionLabel}>My priorities</div>
                {priorities.length === 0 ? (
                  <div style={{ ...styles.card, ...styles.emptyState }}>No priorities yet — add one below</div>
                ) : (
                  <div style={styles.card}>
                    {priorities.map((p, i) => (
                      <div key={p.id} style={{ ...styles.priorityRow, borderBottom: i < priorities.length - 1 ? "1px solid #1a1a2a" : "none" }}>
                        <div style={{ width: 4, borderRadius: 4, alignSelf: "stretch", background: p.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, marginLeft: 4 }}>
                          <div style={styles.priorityName}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 2 }}>
                            {p.days.length > 0 ? p.days.join(" · ") : "Every day"} · {p.duration < 1 ? `${Math.round(p.duration * 60)}m` : `${p.duration}h`}{(p.travelMins ?? 0) > 0 ? ` · 🚗 ${p.travelMins}m` : ""}
                          </div>
                        </div>
                        <button style={styles.editBtn} onClick={() => openEditPriority(p)}>✎</button>
                        <button style={styles.deleteBtn} onClick={() => deletePriority(p.id)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button style={styles.addBtn} onClick={() => { setEditingPriorityId(null); setNewPriority({ name: "", color: "#f59e0b", days: [], duration: 1, travelMins: 0 }); setDurationUnit("hrs"); setShowAddPriority(true); }}>
                  + Add priority
                </button>
              </>
            )}

            {tab === "settings" && (
              <>
                <div style={styles.sectionLabel}>Account</div>
                <div style={styles.card}>
                  <div style={{ ...styles.freeRow, borderBottom: "1px solid #1a1a2a", padding: "12px 0" }}>
                    <span style={{ fontSize: 14, color: "#6b6b8a" }}>Name</span>
                    <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{currentUser?.name}</span>
                  </div>
                  {currentUser?.email && (
                    <div style={{ ...styles.freeRow, padding: "12px 0" }}>
                      <span style={{ fontSize: 14, color: "#6b6b8a" }}>Email</span>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{currentUser.email}</span>
                    </div>
                  )}
                </div>
                <button style={{ ...styles.ghostBtn, color: "#ef4444", borderColor: "#2a1a1a" }}
                  onClick={() => { setAuthed(false); setCurrentUser(null); setAuthEmail(""); setAuthPassword(""); setAuthName(""); setAuthError(""); }}>
                  Sign out
                </button>

                <div style={styles.sectionLabel}>Sleep settings</div>
                <div style={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Average sleep</div>
                      <div style={{ fontSize: 12, color: "#6b6b8a", marginTop: 2 }}>Used to calculate your free time</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: "#f59e0b" }}>{sleepHours}</span>
                      <span style={{ fontSize: 13, color: "#6b6b8a", marginLeft: 4 }}>hrs</span>
                    </div>
                  </div>
                  <input type="range" min="4" max="12" step="0.5" value={sleepHours}
                    onChange={e => setSleepHours(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#f59e0b" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: "#3a3a5a" }}>4 hrs</span>
                    <span style={{ fontSize: 11, color: "#3a3a5a" }}>12 hrs</span>
                  </div>
                  <div style={{ marginTop: 14, padding: "10px 12px", background: "#0d0d14", borderRadius: 10, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#6b6b8a" }}>Waking hours/day</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>{24 - sleepHours} hrs</span>
                  </div>
                </div>

                <div style={styles.sectionLabel}>About FreeTime</div>
                <div style={styles.card}>
                  {[
                    ["Version", "0.1.0 — MVP"],
                    ["Built for", "Shift workers"],
                    ["Free time calc", `${24 - sleepHours} waking hrs/day`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ ...styles.freeRow, borderBottom: "1px solid #1a1a2a", padding: "12px 0" }}>
                      <span style={{ fontSize: 14, color: "#6b6b8a" }}>{k}</span>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ ...styles.freeRow, padding: "12px 0" }}>
                    <span style={{ fontSize: 14, color: "#6b6b8a" }}>Total shifts logged</span>
                    <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>{shifts.length}</span>
                  </div>
                </div>
                <div style={{ ...styles.card, marginTop: 0 }}>
                  <div style={{ fontSize: 13, color: "#4a4a6a", lineHeight: 1.7 }}>
                    FreeTime helps shift workers see and protect their free time. Add your shifts each week, set your personal priorities, and let the app do the math on what your week actually looks like.
                  </div>
                </div>
                <button style={{ ...styles.ghostBtn }} onClick={() => { setShifts([]); }}>
                  Clear all shifts
                </button>
              </>
            )}
          </div>

          {/* Tab bar */}
          <div style={styles.tabBar}>
            {[
              { id: "home", icon: "⊡", label: "HOME" },
              { id: "week", icon: "◫", label: "WEEK" },
              { id: "priorities", icon: "◈", label: "FOCUS" },
              { id: "settings", icon: "⊙", label: "MORE" },
            ].map(t => (
              <button key={t.id} style={styles.tabItem(tab === t.id)} onClick={() => setTab(t.id)}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Add Shift Modal */}
          {showAddShift && (
            <div style={styles.modal} onClick={e => { if (e.target === e.currentTarget) { setShowAddShift(false); setEditingShiftId(null); } }}>
              <div style={styles.modalSheet}>
                <div style={styles.modalTitle}>{editingShiftId ? "Edit shift" : "Add shift"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={styles.fieldLabel}>Label</label>
                    <input style={styles.input} value={newShift.label}
                      onChange={e => setNewShift(s => ({ ...s, label: e.target.value }))}
                      placeholder="Work, On-call, Training..." />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Date</label>
                    <input type="date" style={styles.input} value={newShift.date}
                      onChange={e => setNewShift(s => ({ ...s, date: e.target.value }))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={styles.fieldLabel}>Start time</label>
                      <input type="time" style={styles.input} value={newShift.startTime}
                        onChange={e => setNewShift(s => ({ ...s, startTime: e.target.value }))} />
                    </div>
                    <div>
                      <label style={styles.fieldLabel}>End time</label>
                      <input type="time" style={styles.input} value={newShift.endTime}
                        onChange={e => setNewShift(s => ({ ...s, endTime: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={styles.fieldLabel}>Round-trip travel time</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number" min="0" max="300" step="5"
                          value={newShift.travelMins}
                          onChange={e => {
                            const v = Math.max(0, Math.min(300, Number(e.target.value) || 0));
                            setNewShift(s => ({ ...s, travelMins: v }));
                          }}
                          style={{ ...styles.input, width: 60, textAlign: "center", padding: "5px 8px", fontSize: 14, fontWeight: 700, color: "#f59e0b" }}
                        />
                        <span style={{ fontSize: 12, color: "#4a4a6a" }}>min</span>
                      </div>
                    </div>
                    <input type="range" min="0" max="120" step="5" value={Math.min(newShift.travelMins, 120)}
                      onChange={e => setNewShift(s => ({ ...s, travelMins: Number(e.target.value) }))}
                      style={{ width: "100%", accentColor: "#f59e0b" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#3a3a5a" }}>None</span>
                      <span style={{ fontSize: 11, color: "#3a3a5a" }}>2 hrs (type for more)</span>
                    </div>
                  </div>
                  <button style={styles.addBtn} onClick={addShift}>{editingShiftId ? "Save changes" : "Save shift"}</button>
                  <button style={styles.ghostBtn} onClick={() => { setShowAddShift(false); setEditingShiftId(null); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Add / Edit Priority Modal */}
          {showAddPriority && (
            <div style={styles.modal} onClick={e => { if (e.target === e.currentTarget) { setShowAddPriority(false); setEditingPriorityId(null); } }}>
              <div style={styles.modalSheet}>
                <div style={styles.modalTitle}>{editingPriorityId ? "Edit priority" : "Add priority"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={styles.fieldLabel}>Name</label>
                    <input style={styles.input} value={newPriority.name}
                      onChange={e => setNewPriority(p => ({ ...p, name: e.target.value }))}
                      placeholder="Gym, Reading, Family time..." />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Color</label>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      {PRIORITY_COLORS.map(c => (
                        <div key={c} style={styles.colorDot(c, newPriority.color === c)}
                          onClick={() => setNewPriority(p => ({ ...p, color: c }))} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Preferred days</label>
                    <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                      {DAYS.map(d => (
                        <div key={d} style={styles.dayToggle(newPriority.days.includes(d))}
                          onClick={() => togglePriorityDay(d)}>{d.slice(0,1)}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#3a3a5a", marginTop: 6 }}>
                      {newPriority.days.length === 0 ? "No days selected — will show every day" : `${newPriority.days.length} day${newPriority.days.length !== 1 ? "s" : ""} selected`}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={styles.fieldLabel}>Dedicated time per session</label>
                      {/* Unit toggle */}
                      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a3e" }}>
                        {["hrs","mins"].map(u => (
                          <button key={u} onClick={() => setDurationUnit(u)}
                            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                              background: durationUnit === u ? newPriority.color : "#0d0d14",
                              color: durationUnit === u ? "#0d0d14" : "#4a4a6a" }}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="number" min="0" step={durationUnit === "hrs" ? "0.5" : "5"}
                        value={durationUnit === "hrs" ? newPriority.duration : Math.round(newPriority.duration * 60)}
                        onChange={e => {
                          const raw = Number(e.target.value) || 0;
                          const inHrs = durationUnit === "hrs" ? Math.max(0, raw) : Math.max(0, raw) / 60;
                          setNewPriority(p => ({ ...p, duration: Math.round(inHrs * 100) / 100 }));
                        }}
                        style={{ ...styles.input, flex: 1, textAlign: "center", padding: "8px", fontSize: 16, fontWeight: 700, color: newPriority.color }}
                      />
                      <span style={{ fontSize: 13, color: "#4a4a6a", flexShrink: 0 }}>{durationUnit}</span>
                    </div>
                    <input type="range"
                      min="0" max={durationUnit === "hrs" ? 12 : 720} step={durationUnit === "hrs" ? 0.5 : 5}
                      value={durationUnit === "hrs" ? Math.min(newPriority.duration, 12) : Math.min(Math.round(newPriority.duration * 60), 720)}
                      onChange={e => {
                        const raw = Number(e.target.value);
                        const inHrs = durationUnit === "hrs" ? raw : raw / 60;
                        setNewPriority(p => ({ ...p, duration: Math.round(inHrs * 100) / 100 }));
                      }}
                      style={{ width: "100%", accentColor: newPriority.color, marginTop: 8 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#3a3a5a" }}>0</span>
                      <span style={{ fontSize: 11, color: "#3a3a5a" }}>{durationUnit === "hrs" ? "12 hrs" : "12 hrs"} (type for more)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={styles.fieldLabel}>Round-trip travel time</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number" min="0" max="300" step="5"
                          value={newPriority.travelMins}
                          onChange={e => {
                            const v = Math.max(0, Math.min(300, Number(e.target.value) || 0));
                            setNewPriority(p => ({ ...p, travelMins: v }));
                          }}
                          style={{ ...styles.input, width: 60, textAlign: "center", padding: "5px 8px", fontSize: 14, fontWeight: 700, color: newPriority.color }}
                        />
                        <span style={{ fontSize: 12, color: "#4a4a6a" }}>min</span>
                      </div>
                    </div>
                    <input type="range" min="0" max="120" step="5" value={Math.min(newPriority.travelMins, 120)}
                      onChange={e => setNewPriority(p => ({ ...p, travelMins: Number(e.target.value) }))}
                      style={{ width: "100%", accentColor: newPriority.color }} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "#3a3a5a" }}>None</span>
                      <span style={{ fontSize: 11, color: "#3a3a5a" }}>2 hrs (type for more)</span>
                    </div>
                  </div>
                  <button style={styles.addBtn} onClick={addPriority}>{editingPriorityId ? "Save changes" : "Save priority"}</button>
                  <button style={styles.ghostBtn} onClick={() => { setShowAddPriority(false); setEditingPriorityId(null); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirm */}
          {showDeleteConfirm && (
            <div style={styles.modal} onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(null); }}>
              <div style={styles.modalSheet}>
                <div style={styles.modalTitle}>Remove shift?</div>
                <p style={{ color: "#6b6b8a", fontSize: 14, marginBottom: 20 }}>This shift will be removed from your schedule.</p>
                <button style={{ ...styles.addBtn, background: "#ef4444", marginBottom: 10 }} onClick={() => deleteShift(showDeleteConfirm)}>Remove</button>
                <button style={styles.ghostBtn} onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
