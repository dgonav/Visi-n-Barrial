'use strict';
/* ══════════════════════════════════════════
   VISIÓN BARRIAL — Auth Module
   RF-001 / CAS001 — Control de Acceso
══════════════════════════════════════════ */

const USERS_KEY    = 'vb_users';
const SESSION_KEY  = 'vb_session';
const ATTEMPTS_KEY = 'vb_login_attempts';
const RECOVER_KEY  = 'vb_recovery_tokens';
const SALT         = 'VisionBarrial_2026_s@lt!';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 min

// ─── Password Hashing (SHA-256 via Web Crypto) ───────────────────────────────
async function hashPassword(plain) {
  const data = new TextEncoder().encode(plain + SALT);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Token generator ─────────────────────────────────────────────────────────
function generateToken(len = 32) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── User store ──────────────────────────────────────────────────────────────
function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function findUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

// ─── Session ─────────────────────────────────────────────────────────────────
function createSession(user) {
  const session = {
    token:     generateToken(),
    userId:    user.id,
    email:     user.email,
    name:      user.name,
    role:      user.role,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

// ─── Brute-force protection ───────────────────────────────────────────────────
function getAttempts(email) {
  const all = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
  return all[email.toLowerCase()] || { count: 0, lockedUntil: 0 };
}

function recordAttempt(email) {
  const all = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
  const key = email.toLowerCase();
  const rec = all[key] || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    rec.count = 0; // reset after locking
  }
  all[key] = rec;
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  return rec;
}

function clearAttempts(email) {
  const all = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}');
  delete all[email.toLowerCase()];
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
}

function isLocked(email) {
  const rec = getAttempts(email);
  return rec.lockedUntil > Date.now();
}

function lockRemainingMs(email) {
  return Math.max(0, getAttempts(email).lockedUntil - Date.now());
}

// ─── Register (CAS001) ───────────────────────────────────────────────────────
async function registerUser({ name, email, password }) {
  if (findUserByEmail(email)) {
    return { ok: false, code: 'MS002', msg: 'Este correo ya está registrado en el sistema.' };
  }
  const hash = await hashPassword(password);
  const user = {
    id:         generateToken(8),
    name:       name.trim(),
    email:      email.toLowerCase().trim(),
    passwordHash: hash,
    role:       'Ciudadano',
    active:     true,
    createdAt:  new Date().toISOString(),
  };
  const users = getUsers();
  users.push(user);
  saveUsers(users);
  return { ok: true, user };
}

// ─── Login (CAS001) ──────────────────────────────────────────────────────────
async function loginUser({ email, password }) {
  if (isLocked(email)) {
    const ms  = lockRemainingMs(email);
    const min = Math.ceil(ms / 60000);
    return { ok: false, code: 'MS005_LOCK', msg: `Cuenta bloqueada temporalmente. Intenta en ${min} min.`, remainingMs: ms };
  }

  const user = findUserByEmail(email);
  if (!user || !user.active) {
    recordAttempt(email);
    return { ok: false, code: 'MS005', msg: 'Credenciales incorrectas. Verifica tu correo y contraseña.' };
  }

  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) {
    const rec = recordAttempt(email);
    const left = MAX_ATTEMPTS - rec.count;
    if (rec.lockedUntil > Date.now()) {
      return { ok: false, code: 'MS005_LOCK', msg: `Demasiados intentos fallidos. Cuenta bloqueada 15 minutos.`, remainingMs: LOCKOUT_MS };
    }
    return { ok: false, code: 'MS005', msg: `Credenciales incorrectas. Te quedan ${left} intento(s) antes del bloqueo.` };
  }

  clearAttempts(email);
  const session = createSession(user);
  return { ok: true, session };
}

// ─── Password Recovery (CAS001) ──────────────────────────────────────────────
function recoverPassword(email) {
  const user = findUserByEmail(email);
  if (!user) return { ok: true, simulated: true };
  const token = generateToken(20);
  const tokens = JSON.parse(localStorage.getItem(RECOVER_KEY) || '{}');
  tokens[token] = { email: user.email, expiresAt: Date.now() + 30 * 60 * 1000 };
  localStorage.setItem(RECOVER_KEY, JSON.stringify(tokens));
  return { ok: true, token, email: user.email };
}

function getRecoveryToken(token) {
  const tokens = JSON.parse(localStorage.getItem(RECOVER_KEY) || '{}');
  const rec = tokens[token];
  if (!rec) return null;
  if (rec.expiresAt < Date.now()) return null; // expirado
  return rec;
}

async function resetPassword(token, newPassword) {
  const tokens = JSON.parse(localStorage.getItem(RECOVER_KEY) || '{}');
  const rec = tokens[token];
  if (!rec || rec.expiresAt < Date.now()) {
    return { ok: false, msg: 'El enlace expiró o no es válido. Solicita uno nuevo.' };
  }
  const users = getUsers();
  const idx = users.findIndex(u => u.email === rec.email);
  if (idx === -1) return { ok: false, msg: 'Usuario no encontrado.' };
  users[idx].passwordHash = await hashPassword(newPassword);
  saveUsers(users);
  delete tokens[token];
  localStorage.setItem(RECOVER_KEY, JSON.stringify(tokens));
  return { ok: true };
}

// ─── Password strength ───────────────────────────────────────────────────────
function checkStrength(password) {
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Muy débil', 'Débil', 'Regular', 'Buena', 'Excelente'];
  const colors = ['', '#EF4444', '#F97316', '#F59E0B', '#22C55E', '#6C63FF'];
  return { score, label: labels[score] || '', color: colors[score] || '', pct: (score / 5) * 100 };
}

// ═══════════════════════════════════════════════════════
//  UI CONTROLLER
// ═══════════════════════════════════════════════════════

// ─── View switching ──────────────────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('form-' + tab).classList.add('active');
  const tabEl = document.querySelector(`[data-tab="${tab}"]`);
  if (tabEl) tabEl.classList.add('active');
  clearAlerts();
}

function clearAlerts() {
  document.querySelectorAll('.sys-alert').forEach(a => a.classList.remove('show'));
  document.querySelectorAll('.lockout-badge').forEach(b => b.classList.remove('show'));
}

function showAlert(formId, type, msg) {
  const el = document.querySelector(`#form-${formId} .sys-alert-${type}`);
  if (!el) return;
  el.querySelector('.alert-msg').textContent = msg;
  el.classList.add('show');
}

function hideAlert(formId, type) {
  const el = document.querySelector(`#form-${formId} .sys-alert-${type}`);
  if (el) el.classList.remove('show');
}

// ─── Field validation helpers ────────────────────────────────────────────────
function markInvalid(fieldId, errId, msg) {
  const f = document.getElementById(fieldId);
  const e = document.getElementById(errId);
  if (f) f.classList.add('invalid');
  if (e) { e.textContent = msg; e.classList.add('show'); }
}
function markValid(fieldId, errId) {
  const f = document.getElementById(fieldId);
  const e = document.getElementById(errId);
  if (f) { f.classList.remove('invalid'); f.classList.add('valid'); }
  if (e) e.classList.remove('show');
}
function resetField(fieldId, errId) {
  const f = document.getElementById(fieldId);
  const e = document.getElementById(errId);
  if (f) { f.classList.remove('invalid', 'valid'); }
  if (e) e.classList.remove('show');
}

// ─── Toggle password visibility ──────────────────────────────────────────────
function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const eyeOpen   = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  if (inp.type === 'password') { inp.type = 'text';     btn.innerHTML = eyeClosed; }
  else                         { inp.type = 'password'; btn.innerHTML = eyeOpen; }
}

// ─── Password strength UI ────────────────────────────────────────────────────
function updateStrength(password) {
  const s    = checkStrength(password);
  const fill = document.getElementById('strength-fill');
  const lbl  = document.getElementById('strength-label');
  if (!fill) return;
  fill.style.width      = s.pct + '%';
  fill.style.background = s.color;
  if (lbl) lbl.textContent = s.label;
}

// ─── Lockout countdown ───────────────────────────────────────────────────────
let lockTimer = null;
function startLockoutUI(email, ms) {
  const badge   = document.getElementById('lockout-badge-login');
  const timeEl  = document.getElementById('lockout-time');
  if (!badge || !timeEl) return;
  badge.classList.add('show');
  clearInterval(lockTimer);
  const end = Date.now() + ms;
  lockTimer = setInterval(() => {
    const rem = end - Date.now();
    if (rem <= 0) {
      clearInterval(lockTimer);
      badge.classList.remove('show');
      return;
    }
    const m = String(Math.floor(rem / 60000)).padStart(2, '0');
    const s = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
    timeEl.textContent = `${m}:${s}`;
  }, 1000);
}

// ─── Button loading state ─────────────────────────────────────────────────────
function setLoading(btnId, loading) {
  const btn  = document.getElementById(btnId);
  const span = btn?.querySelector('.btn-text');
  const spin = btn?.querySelector('.spinner');
  if (!btn) return;
  btn.disabled = loading;
  if (span) span.style.opacity = loading ? '0' : '1';
  if (spin) spin.style.display = loading ? 'inline-block' : 'none';
}

// ─── REGISTER handler ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (getSession()) { window.location.href = 'app.html'; return; }

  // ── Detectar token de recuperación en la URL ──────────────────────────────
  const urlToken = new URLSearchParams(window.location.search).get('token');
  if (urlToken) {
    const rec = getRecoveryToken(urlToken);
    showTab('reset');
    if (!rec) {
      showAlert('reset', 'expired', 'Este enlace ha expirado o ya fue usado. Solicita uno nuevo.');
      document.getElementById('btn-reset').disabled = true;
    } else {
      showAlert('reset', 'info', `Cambia la contraseña de la cuenta: ${rec.email}`);
    }
  }

  // ── Medidor de fortaleza del reset ───────────────────────────────────────
  document.getElementById('reset-password')?.addEventListener('input', function () {
    const s = checkStrength(this.value);
    const fill = document.getElementById('reset-strength-fill');
    const lbl  = document.getElementById('reset-strength-label');
    if (fill) { fill.style.width = s.pct + '%'; fill.style.background = s.color; }
    if (lbl)  lbl.textContent = s.label;
  });

  // ── Reset password form ──────────────────────────────────────────────────
  document.getElementById('form-reset')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlerts();
    const pass    = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-confirm').value;
    let ok = true;

    if (pass.length < 8 || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) {
      markInvalid('reset-password', 'err-reset-pass', 'Mínimo 8 caracteres, 1 mayúscula y 1 número.');
      ok = false;
    } else markValid('reset-password', 'err-reset-pass');

    if (pass !== confirm) {
      markInvalid('reset-confirm', 'err-reset-confirm', 'Las contraseñas no coinciden.');
      ok = false;
    } else if (confirm) markValid('reset-confirm', 'err-reset-confirm');

    if (!ok) return;

    setLoading('btn-reset', true);
    const result = await resetPassword(urlToken, pass);
    setLoading('btn-reset', false);

    if (!result.ok) {
      showAlert('reset', 'error', result.msg);
    } else {
      showAlert('reset', 'success', '¡Contraseña actualizada! Redirigiendo al inicio de sesión...');
      document.getElementById('btn-reset').disabled = true;
      setTimeout(() => {
        history.replaceState(null, '', location.pathname);
        showTab('login');
      }, 2000);
    }
  });

  // Password strength meter
  const regPass = document.getElementById('reg-password');
  if (regPass) {
    regPass.addEventListener('input', () => updateStrength(regPass.value));
  }

  // Register form
  document.getElementById('form-register')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlerts();
    let ok = true;

    const name    = document.getElementById('reg-name').value.trim();
    const email   = document.getElementById('reg-email').value.trim();
    const pass    = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    // Validations
    if (name.length < 2) { markInvalid('reg-name','err-reg-name','Mínimo 2 caracteres.'); ok=false; }
    else markValid('reg-name','err-reg-name');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { markInvalid('reg-email','err-reg-email','Formato de correo inválido.'); ok=false; }
    else markValid('reg-email','err-reg-email');

    if (pass.length < 8 || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) {
      markInvalid('reg-password','err-reg-pass','Mínimo 8 caracteres, 1 mayúscula y 1 número.');
      ok=false;
    } else markValid('reg-password','err-reg-pass');

    if (pass !== confirm) { markInvalid('reg-confirm','err-reg-confirm','Las contraseñas no coinciden.'); ok=false; }
    else if (confirm) markValid('reg-confirm','err-reg-confirm');

    if (!ok) return;

    setLoading('btn-register', true);
    const result = await registerUser({ name, email, password: pass });
    setLoading('btn-register', false);

    if (!result.ok) {
      showAlert('register', 'error', result.msg);
    } else {
      showAlert('register', 'success', '¡Cuenta creada! Inicia sesión para continuar.');
      document.getElementById('form-register').reset();
      resetField('reg-name','err-reg-name');
      resetField('reg-email','err-reg-email');
      resetField('reg-password','err-reg-pass');
      resetField('reg-confirm','err-reg-confirm');
      setTimeout(() => showTab('login'), 1500);
    }
  });

  // Login form
  document.getElementById('form-login')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlerts();
    const email = document.getElementById('log-email').value.trim();
    const pass  = document.getElementById('log-password').value;

    if (!email || !pass) {
      showAlert('login', 'error', 'Completa todos los campos requeridos (MS003).');
      return;
    }

    setLoading('btn-login', true);
    const result = await loginUser({ email, password: pass });
    setLoading('btn-login', false);

    if (!result.ok) {
      if (result.code === 'MS005_LOCK') {
        startLockoutUI(email, result.remainingMs || LOCKOUT_MS);
        showAlert('login', 'warning', result.msg);
      } else {
        showAlert('login', 'error', result.msg);
      }
    } else {
      showAlert('login', 'success', `¡Bienvenido, ${result.session.name}! Redirigiendo...`);
      setTimeout(() => { window.location.href = 'app.html'; }, 800);
    }
  });

  // Recover form
  document.getElementById('form-recover')?.addEventListener('submit', e => {
    e.preventDefault();
    clearAlerts();
    const email = document.getElementById('rec-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      markInvalid('rec-email','err-rec-email','Ingresa un correo válido.');
      return;
    }
    markValid('rec-email','err-rec-email');

    const result = recoverPassword(email);
    const box  = document.getElementById('recovery-box');
    const link = document.getElementById('recovery-link');
    if (box) box.classList.add('show');
    if (link && result.token) {
      const url = `${location.origin}${location.pathname}?token=${result.token}`;
      link.textContent = url;
      link.style.cursor = 'pointer';
      link.onclick = () => window.location.href = url;
    } else if (link) {
      link.textContent = 'Si el correo existe, recibirás el enlace en tu bandeja de entrada.';
    }
    showAlert('recover', 'info', 'Si el correo está registrado, recibirás un enlace válido por 30 minutos.');
  });
});
