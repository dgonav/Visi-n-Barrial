/* ══════════════════════════════════════
   VISIÓN BARRIAL — App Logic
   RF-002 / CAS002 | CAS003 | CAS005
══════════════════════════════════════ */

'use strict';

// ─── Session guard & user bootstrap ─────────────────────────────────────────
const SESSION_KEY = 'vb_session';

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

function loadUserUI() {
  const session = getSession();
  if (!session) { window.location.replace('index.html'); return; }
  const avatarEl = document.getElementById('userAvatar');
  const nameEl   = document.getElementById('userName');
  if (avatarEl) avatarEl.textContent = session.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (nameEl)   nameEl.textContent   = session.name;
}

// ─────────────── DATA STORE ───────────────
const STORAGE_KEY = 'vb_reports';

const CATEGORY_MAP = {
  infraestructura: { label: 'Infraestructura vial', icon: '🛣️' },
  alumbrado:       { label: 'Alumbrado público',    icon: '💡' },
  basuras:         { label: 'Acumulación de basuras', icon: '🗑️' },
  agua:            { label: 'Agua / Alcantarillado', icon: '💧' },
  seguridad:       { label: 'Seguridad ciudadana',   icon: '🚨' },
  espacio:         { label: 'Espacio público',        icon: '🌳' },
  ruido:           { label: 'Contaminación auditiva', icon: '🔊' },
  otro:            { label: 'Otro',                   icon: '📌' },
};

const STATUS_META = {
  'Pendiente':   { badge: 'badge-pendiente', dot: '#EF4444', timelineColor: '#EF4444' },
  'En revisión': { badge: 'badge-revision',  dot: '#F59E0B', timelineColor: '#F59E0B' },
  'En atención': { badge: 'badge-atencion',  dot: '#3B82F6', timelineColor: '#3B82F6' },
  'Resuelto':    { badge: 'badge-resuelto',  dot: '#22C55E', timelineColor: '#22C55E' },
  'Cancelado':   { badge: 'badge-cancelado', dot: '#6B7280', timelineColor: '#6B7280' },
};

const PRIORITY_META = {
  'Alta':  { badge: 'badge-prioridad-alta' },
  'Media': { badge: 'badge-prioridad-media' },
  'Baja':  { badge: 'badge-prioridad-baja' },
};

// Demo seed data
const SEED_REPORTS = [
  {
    id: 'VB-0001',
    tipo: 'infraestructura',
    prioridad: 'Alta',
    descripcion: 'Existe un bache de grandes dimensiones en la Calle 72 con Carrera 43, el cual representa un peligro para vehículos y peatones. El problema lleva más de tres semanas sin atención.',
    ubicacion: 'Calle 72 #43-12, Barrio El Prado, Barranquilla',
    fechaOcurrencia: '2026-04-10',
    fechaCreacion: '2026-04-10T09:15:00',
    estado: 'En atención',
    evidencia: null,
    historial: [
      { estado: 'Pendiente',   fecha: '2026-04-10T09:15:00', actor: 'Sistema',    obs: 'Reporte creado exitosamente.' },
      { estado: 'En revisión', fecha: '2026-04-12T11:30:00', actor: 'Admin. Ana García', obs: 'Reporte validado. Se notifica al área de obras públicas.' },
      { estado: 'En atención', fecha: '2026-04-16T08:00:00', actor: 'Admin. Ana García', obs: 'Cuadrilla asignada. Intervención programada para la próxima semana.' },
    ]
  },
  {
    id: 'VB-0002',
    tipo: 'alumbrado',
    prioridad: 'Media',
    descripcion: 'Tres postes de alumbrado público en el Parque Olaya Herrera llevan apagados más de dos semanas, generando inseguridad en la zona en horas de la noche.',
    ubicacion: 'Parque Olaya Herrera, Cra. 38, Barranquilla',
    fechaOcurrencia: '2026-04-15',
    fechaCreacion: '2026-04-15T19:40:00',
    estado: 'Resuelto',
    evidencia: null,
    historial: [
      { estado: 'Pendiente',   fecha: '2026-04-15T19:40:00', actor: 'Sistema',    obs: 'Reporte creado exitosamente.' },
      { estado: 'En revisión', fecha: '2026-04-16T10:00:00', actor: 'Admin. Luis Morales', obs: 'Reporte verificado.' },
      { estado: 'En atención', fecha: '2026-04-17T08:30:00', actor: 'Admin. Luis Morales', obs: 'Técnicos enviados al sitio.' },
      { estado: 'Resuelto',    fecha: '2026-04-18T14:00:00', actor: 'Admin. Luis Morales', obs: 'Luminarias reemplazadas. Problema solucionado.' },
    ]
  },
  {
    id: 'VB-0003',
    tipo: 'basuras',
    prioridad: 'Baja',
    descripcion: 'Acumulación excesiva de basura en el lote baldío de la Carrera 50. El olor y los roedores afectan a los vecinos del sector.',
    ubicacion: 'Carrera 50 #68-20, Barrio Modelo, Barranquilla',
    fechaOcurrencia: '2026-04-20',
    fechaCreacion: '2026-04-20T08:00:00',
    estado: 'Pendiente',
    evidencia: null,
    historial: [
      { estado: 'Pendiente', fecha: '2026-04-20T08:00:00', actor: 'Sistema', obs: 'Reporte creado. En espera de revisión.' },
    ]
  },
];

function loadReports() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_REPORTS));
  return SEED_REPORTS;
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function getReports() { return loadReports(); }

function generateId() {
  const reports = getReports();
  if (reports.length === 0) return 'VB-0001';
  const max = reports.reduce((m, r) => {
    const n = parseInt(r.id.replace('VB-', ''), 10) || 0;
    return Math.max(m, n);
  }, 0);
  return 'VB-' + String(max + 1).padStart(4, '0');
}

// ─────────────── NAVIGATION ───────────────
let currentView = 'dashboard';

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.view === view);
  });
  currentView = view;
  // Close mobile menu
  document.getElementById('navLinks').classList.remove('open');
  // Re-render on switch
  if (view === 'dashboard') renderDashboard();
  if (view === 'mis-reportes') renderMyReports();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ─────────────── DASHBOARD ───────────────
function renderDashboard() {
  const reports = getReports();
  const total     = reports.length;
  const pendiente = reports.filter(r => r.estado === 'Pendiente').length;
  const atencion  = reports.filter(r => r.estado === 'En atención' || r.estado === 'En revisión').length;
  const resuelto  = reports.filter(r => r.estado === 'Resuelto').length;

  animateCounter('count-total',    total);
  animateCounter('count-pendiente', pendiente);
  animateCounter('count-atencion',  atencion);
  animateCounter('count-resuelto',  resuelto);

  const container = document.getElementById('recent-reports-list');
  const recent = [...reports].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion)).slice(0, 4);
  container.innerHTML = recent.length
    ? recent.map(r => reportCardHTML(r)).join('')
    : '<p style="color:var(--text-muted);text-align:center;padding:2rem">No hay reportes aún.</p>';
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const step = Math.ceil(target / 20);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

// ─────────────── REPORT CARD HTML ───────────────
function reportCardHTML(r) {
  const cat  = CATEGORY_MAP[r.tipo] || { label: r.tipo, icon: '📌' };
  const meta = STATUS_META[r.estado] || STATUS_META['Pendiente'];
  const pri  = r.prioridad ? PRIORITY_META[r.prioridad] : null;
  const fecha = formatDate(r.fechaCreacion);
  const priBadge = pri
    ? `<span class="badge ${pri.badge}" style="font-size:.65rem;padding:.15rem .5rem;">${r.prioridad}</span>`
    : '';
  return `
    <div class="report-card" onclick="showDetail('${r.id}')" id="card-${r.id}">
      <div class="report-category-icon">${cat.icon}</div>
      <div class="report-info">
        <div class="report-id" style="display:flex;align-items:center;gap:.4rem;">${r.id} ${priBadge}</div>
        <div class="report-title">${cat.label}</div>
        <div class="report-location">📍 ${r.ubicacion}</div>
      </div>
      <span class="badge ${meta.badge}">${r.estado}</span>
      <div class="report-date">${fecha}</div>
      <div class="report-arrow">›</div>
    </div>`;
}

// ─────────────── MY REPORTS (CAS003/CAS005) ───────────────
function renderMyReports(filteredList) {
  const reports = filteredList !== undefined ? filteredList : getReports();
  const allReports = getReports();

  // Counters
  document.getElementById('sum-atendidos').textContent  = allReports.filter(r => r.estado === 'Resuelto').length;
  document.getElementById('sum-pendientes').textContent = allReports.filter(r => r.estado === 'Pendiente').length;
  document.getElementById('sum-atencion').textContent   = allReports.filter(r => r.estado === 'En atención' || r.estado === 'En revisión').length;

  const container = document.getElementById('my-reports-list');
  const emptyState = document.getElementById('empty-state');
  const noReports  = document.getElementById('no-reports-state');

  if (allReports.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'none';
    noReports.style.display  = 'block';
    return;
  }
  noReports.style.display = 'none';

  const sorted = [...reports].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  if (sorted.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    container.innerHTML = sorted.map(r => reportCardHTML(r)).join('');
  }
}

function applyFilters() {
  const tipo     = document.getElementById('filtro-tipo').value;
  const estado   = document.getElementById('filtro-estado').value;
  const fechaIni = document.getElementById('filtro-fecha-ini').value;
  const fechaFin = document.getElementById('filtro-fecha-fin').value;
  const busqueda = document.getElementById('filtro-busqueda').value.trim().toUpperCase();

  let results = getReports();
  if (tipo)     results = results.filter(r => r.tipo === tipo);
  if (estado)   results = results.filter(r => r.estado === estado);
  if (fechaIni) results = results.filter(r => r.fechaCreacion >= fechaIni);
  if (fechaFin) results = results.filter(r => r.fechaCreacion <= fechaFin + 'T23:59:59');
  if (busqueda) {
    results = results.filter(r => {
      const cat = CATEGORY_MAP[r.tipo] || { label: r.tipo };
      return r.id.toUpperCase().includes(busqueda)
          || r.ubicacion.toUpperCase().includes(busqueda)
          || r.descripcion.toUpperCase().includes(busqueda)
          || cat.label.toUpperCase().includes(busqueda);
    });
  }

  renderMyReports(results);
}

function clearFilters() {
  document.getElementById('filtro-tipo').value      = '';
  document.getElementById('filtro-estado').value    = '';
  document.getElementById('filtro-fecha-ini').value = '';
  document.getElementById('filtro-fecha-fin').value = '';
  document.getElementById('filtro-busqueda').value  = '';
  renderMyReports();
}

// ─────────────── DETAIL VIEW (CAS003) ───────────────
function showDetail(id) {
  const reports = getReports();
  const report  = reports.find(r => r.id === id);
  if (!report) return;

  document.getElementById('view-detalle').classList.remove('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-detalle').classList.add('active');
  document.getElementById('detalle-titulo').textContent = `Reporte ${report.id}`;

  const cat  = CATEGORY_MAP[report.tipo] || { label: report.tipo, icon: '📌' };
  const meta = STATUS_META[report.estado] || STATUS_META['Pendiente'];

  const timelineHTML = report.historial.map(h => {
    const m = STATUS_META[h.estado] || STATUS_META['Pendiente'];
    return `
      <div class="timeline-item">
        <div class="timeline-dot" style="background:${m.timelineColor}"></div>
        <div class="timeline-date">${formatDateTime(h.fecha)}</div>
        <div class="timeline-state"><span class="badge ${m.badge}">${h.estado}</span></div>
        ${h.obs ? `<div class="timeline-obs">"${h.obs}"</div>` : ''}
        <div class="timeline-actor">Por: ${h.actor}</div>
      </div>`;
  }).reverse().join('');

  const pri = report.prioridad ? PRIORITY_META[report.prioridad] : null;
  const cancelBtn = report.estado === 'Pendiente'
    ? `<div class="detalle-actions">
         <button class="btn btn-outline btn-danger" onclick="cancelReport('${report.id}')">
           🚫 Cancelar Reporte
         </button>
       </div>`
    : '';

  document.getElementById('detalle-container').innerHTML = `
    <div class="detalle-card">
      <div class="detalle-header">
        <div>
          <div class="detalle-id">${report.id}</div>
          <div class="detalle-tipo">${cat.icon} ${cat.label}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;">
          <span class="badge ${meta.badge}">${report.estado}</span>
          ${pri ? `<span class="badge ${pri.badge}">Prioridad ${report.prioridad}</span>` : ''}
        </div>
      </div>
      <div class="detalle-field">
        <div class="detalle-field-label">Descripción</div>
        <div class="detalle-field-value">${report.descripcion}</div>
      </div>
      <div class="detalle-field">
        <div class="detalle-field-label">Ubicación</div>
        <div class="detalle-field-value">📍 ${report.ubicacion}</div>
      </div>
      <div class="detalle-field">
        <div class="detalle-field-label">Fecha de ocurrencia</div>
        <div class="detalle-field-value">📅 ${formatDate(report.fechaOcurrencia + 'T12:00:00')}</div>
      </div>
      <div class="detalle-field">
        <div class="detalle-field-label">Fecha de creación del reporte</div>
        <div class="detalle-field-value">🕐 ${formatDateTime(report.fechaCreacion)}</div>
      </div>
      ${report.evidencia ? `<div class="detalle-field"><div class="detalle-field-label">Evidencia adjunta</div><div class="detalle-field-value">📎 ${report.evidencia}</div></div>` : ''}
      ${cancelBtn}
    </div>
    <div class="detalle-card">
      <div class="detalle-section-title">🕓 Historial de Seguimiento</div>
      <div class="timeline">${timelineHTML}</div>
    </div>`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelReport(id) {
  const reports = getReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx === -1) return;
  const session = getSession();
  const now = new Date().toISOString();
  reports[idx].estado = 'Cancelado';
  reports[idx].historial.push({
    estado: 'Cancelado',
    fecha:  now,
    actor:  session ? session.name : 'Ciudadano',
    obs:    'Reporte cancelado por el ciudadano.'
  });
  saveReports(reports);
  showDetail(id);
  showToast('Reporte cancelado correctamente.', 'info');
}

// ─────────────── FORM (CAS002) ───────────────
document.addEventListener('DOMContentLoaded', () => {
  // Load authenticated user info into navbar
  loadUserUI();

  // Set max date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fecha-ocurrencia').setAttribute('max', today);
  document.getElementById('fecha-ocurrencia').value = today;

  // Char counter
  const desc = document.getElementById('descripcion');
  desc.addEventListener('input', () => {
    document.getElementById('char-count').textContent = desc.value.length;
  });

  // Validación inline al salir de cada campo (blur) — CAS002
  document.getElementById('tipo-problema')?.addEventListener('change', () => {
    const el = document.getElementById('tipo-problema');
    if (!el.value) showFieldError('tipo-problema', 'error-tipo');
    else clearFieldError('tipo-problema');
  });
  document.getElementById('prioridad')?.addEventListener('change', () => {
    const el = document.getElementById('prioridad');
    if (!el.value) showFieldError('prioridad', 'error-prioridad');
    else clearFieldError('prioridad');
  });
  document.getElementById('descripcion')?.addEventListener('blur', () => {
    const el = document.getElementById('descripcion');
    if (el.value.trim().length < 20) showFieldError('descripcion', 'error-descripcion');
    else clearFieldError('descripcion');
  });
  document.getElementById('ubicacion')?.addEventListener('blur', () => {
    const el = document.getElementById('ubicacion');
    if (!el.value.trim()) showFieldError('ubicacion', 'error-ubicacion');
    else clearFieldError('ubicacion');
  });
  document.getElementById('fecha-ocurrencia')?.addEventListener('change', () => {
    const el  = document.getElementById('fecha-ocurrencia');
    const hoy = new Date().toISOString().split('T')[0];
    if (!el.value || el.value > hoy) showFieldError('fecha-ocurrencia', 'error-fecha');
    else clearFieldError('fecha-ocurrencia');
  });

  // Drag & drop
  const dropArea = document.getElementById('file-upload-area');
  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.style.borderColor = 'var(--primary)'; });
  dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = ''; });
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  renderDashboard();
});

function handleFile(event) {
  const file = event.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024;
  const errEl = document.getElementById('error-archivo');

  if (!allowed.includes(file.type) || file.size > maxSize) {
    errEl.classList.add('visible');
    document.getElementById('file-preview').style.display = 'none';
    return;
  }
  errEl.classList.remove('visible');
  const preview = document.getElementById('file-preview');
  preview.style.display = 'flex';
  preview.innerHTML = `✅ ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  window._attachedFile = file.name;
}

function getLocation() {
  const btn = document.getElementById('btn-ubicacion-actual');
  btn.textContent = '⏳ Obteniendo...';
  btn.disabled = true;
  if (!navigator.geolocation) {
    showToast('Tu navegador no soporta geolocalización.', 'error');
    btn.textContent = '📍 Ubicación actual';
    btn.disabled = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      document.getElementById('ubicacion').value = `${lat.toFixed(6)}, ${lng.toFixed(6)} (GPS)`;
      btn.textContent = '✅ Ubicación obtenida';
      btn.disabled = false;
      clearFieldError('ubicacion');
    },
    () => {
      showToast('No se pudo obtener la ubicación. Ingrésala manualmente.', 'error');
      btn.textContent = '📍 Ubicación actual';
      btn.disabled = false;
    }
  );
}

function validateForm() {
  let valid = true;
  // Tipo
  const tipo = document.getElementById('tipo-problema');
  if (!tipo.value) { showFieldError('tipo-problema', 'error-tipo'); valid = false; }
  else clearFieldError('tipo-problema');
  // Prioridad
  const pri = document.getElementById('prioridad');
  if (!pri.value) { showFieldError('prioridad', 'error-prioridad'); valid = false; }
  else clearFieldError('prioridad');
  // Descripción
  const desc = document.getElementById('descripcion');
  if (desc.value.trim().length < 20) { showFieldError('descripcion', 'error-descripcion'); valid = false; }
  else clearFieldError('descripcion');
  // Ubicación
  const ubic = document.getElementById('ubicacion');
  if (!ubic.value.trim()) { showFieldError('ubicacion', 'error-ubicacion'); valid = false; }
  else clearFieldError('ubicacion');
  // Fecha
  const fecha = document.getElementById('fecha-ocurrencia');
  const today = new Date().toISOString().split('T')[0];
  if (!fecha.value || fecha.value > today) { showFieldError('fecha-ocurrencia', 'error-fecha'); valid = false; }
  else clearFieldError('fecha-ocurrencia');
  return valid;
}

function showFieldError(fieldId, errorId) {
  document.getElementById(fieldId).classList.add('invalid');
  document.getElementById(errorId).classList.add('visible');
}

function clearFieldError(fieldId) {
  const fieldEl = document.getElementById(fieldId);
  if (fieldEl) fieldEl.classList.remove('invalid');
  // Find sibling error
  const form = document.getElementById('report-form');
  if (form) {
    const errEl = form.querySelector(`#error-${fieldId}`);
    if (errEl) errEl.classList.remove('visible');
  }
}

function submitReport(event) {
  event.preventDefault();
  if (!validateForm()) {
    showToast('Completa todos los campos requeridos correctamente.', 'error');
    return;
  }

  const reports = getReports();
  const newId = generateId();
  const now = new Date().toISOString();

  const newReport = {
    id: newId,
    tipo: document.getElementById('tipo-problema').value,
    prioridad: document.getElementById('prioridad').value,
    descripcion: document.getElementById('descripcion').value.trim(),
    ubicacion: document.getElementById('ubicacion').value.trim(),
    fechaOcurrencia: document.getElementById('fecha-ocurrencia').value,
    fechaCreacion: now,
    estado: 'Pendiente',
    evidencia: window._attachedFile || null,
    historial: [
      { estado: 'Pendiente', fecha: now, actor: 'Sistema', obs: 'Reporte creado exitosamente. En espera de revisión.' }
    ]
  };

  reports.push(newReport);
  saveReports(reports);
  window._attachedFile = null;

  document.getElementById('modal-report-id').textContent = '#' + newId;
  document.getElementById('success-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('success-modal').style.display = 'none';
  resetForm();
  showView('mis-reportes');
}

function closeModalStay() {
  document.getElementById('success-modal').style.display = 'none';
  resetForm();
}

function resetForm() {
  document.getElementById('report-form').reset();
  document.getElementById('char-count').textContent = '0';
  document.getElementById('file-preview').style.display = 'none';
  window._attachedFile = null;
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('visible'));
  document.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fecha-ocurrencia').value = today;
  const gpsBtn = document.getElementById('btn-ubicacion-actual');
  if (gpsBtn) { gpsBtn.textContent = '📍 Ubicación actual'; gpsBtn.disabled = false; }
}

// ─────────────── UTILS ───────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

let toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show toast-' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3500);
}
