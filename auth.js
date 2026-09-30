// auth.js — در همه صفحات import کن
const SUPABASE_URL = 'https://hjzzvzxhrqovvducnxha.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqenp2enhocnFvdnZkdWNueGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDY0MTksImV4cCI6MjA5NzUyMjQxOX0.XfFimXnkKHFBlYUE-E7daaBNjPJZV-D21UfCL_1SeoQ';
const SESSION_KEY = 'lingua_session_v1';

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch (e) { return null; }
}

function isLoggedIn() {
  const s = getSession();
  return !!(s && s.phone && s.verified);
}

function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = '/index.html';
}

// بررسی اشتراک فعال (بر اساس کد ۵ رقمی که در phone ذخیره شده)
async function verifySession() {
  const session = getSession();
  if (!session || !session.phone) return false;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?phone=eq.${encodeURIComponent(session.phone)}&is_active=eq.true&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        }
      }
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}
