/* ══════════════════════════════════════
   VISIÓN BARRIAL — App Logic (Supabase)
══════════════════════════════════════ */

'use strict';

// ─── Global State ─────────────────────────────────────────
let isAdmin = false;
let currentUserId = null;

// ─── Mapa de reporte ──────────────────────────────────────
let reportMap    = null;
let reportMarker = null;
let reportLat    = null;
let reportLng    = null;
let reportBarrio = null;

// ─── Session & Auth ─────────────────────────────────────────
async function checkSession() {
  const { data } = await window.supabase.auth.getSession();
  if (!data.session) {
    window.location.replace('index.html');
    return null;
  }
  return data.session;
}

async function logout() {
  await window.supabase.auth.signOut();
  window.location.href = 'index.html';
}

async function loadUserUI() {
  const session = await checkSession();
  if (!session) return;

  currentUserId = session.user.id;
  const userEmail = session.user.email;
  const userName = session.user.user_metadata?.nombre_completo || userEmail;

  const sidebarName = document.getElementById('sidebar-user-name');
  const topbarName  = document.getElementById('topbar-user-name');
  if (sidebarName) sidebarName.textContent = userName;
  if (topbarName)  topbarName.textContent  = userName;

  // CAS004: detectar rol admin en tabla perfiles
  try {
    const { data: perfil } = await window.supabase
      .from('perfiles')
      .select('rol')
      .eq('id', session.user.id)
      .single();

    if (perfil?.rol === 'administrador' || perfil?.rol === 'gestor') {
      window.location.replace('admin.html');
      return;
    }
  } catch (_) { /* sin perfil especial */ }
}

// ─── Navigation ─────────────────────────────────────────
let currentView = 'dashboard';

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  currentView = viewName;

  const titles = {
    dashboard:    'Panel Principal',
    report:       'Reportar Problema',
    'my-reports': 'Mis Reportes',
    search:       'Buscar Reportes',
    admin:        'Panel Administrativo'
  };
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[viewName] || 'Visión Barrial';

  if (viewName === 'my-reports') loadMyReports();
  else if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'admin') loadAdminReports();
  else if (viewName === 'report') initReportMap();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Dashboard ─────────────────────────────────────────
async function loadDashboard() {
  try {
    const session = await checkSession();
    if (!session) return;

    const { data: reportes, error } = await window.supabase
      .from('reportes')
      .select('estado')
      .eq('usuario_id', session.user.id);

    if (error) throw error;

    const pendientes  = reportes.filter(r => r.estado === 'Pendiente').length;
    const enAtencion  = reportes.filter(r => r.estado === 'En atención' || r.estado === 'En revisión').length;
    const resueltos   = reportes.filter(r => r.estado === 'Resuelto').length;

    document.getElementById('stat-pending').textContent  = pendientes;
    document.getElementById('stat-progress').textContent = enAtencion;
    document.getElementById('stat-resolved').textContent = resueltos;
    document.getElementById('stat-total').textContent    = reportes.length;

    const { data: recientes, error: recError } = await window.supabase
      .from('reportes')
      .select('*, categorias (nombre)')
      .eq('usuario_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recError) throw recError;

    const tbody = document.getElementById('recent-reports-tbody');
    if (!recientes || recientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay reportes recientes</td></tr>';
      return;
    }

    tbody.innerHTML = recientes.map(r => `
      <tr>
        <td><strong>${r.numero_caso}</strong></td>
        <td>${r.categorias?.nombre || 'N/A'}</td>
        <td>${truncate(r.descripcion, 50)}</td>
        <td><span class="badge badge-${stateBadge(r.estado)}">${r.estado}</span></td>
        <td>${formatDate(r.created_at)}</td>
        <td><button class="btn-secondary btn-sm" onclick="viewReportDetail('${r.id}')">Ver</button></td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

// ─── Mis Reportes (CAS005: filtro por estado) ──────────────────────
async function loadMyReports(filterEstado = '') {
  try {
    const session = await checkSession();
    if (!session) return;

    let query = window.supabase
      .from('reportes')
      .select('*, categorias (nombre)')
      .eq('usuario_id', session.user.id)
      .order('created_at', { ascending: false });

    if (filterEstado) query = query.eq('estado', filterEstado);

    const { data: reportes, error } = await query;
    if (error) throw error;

    const tbody = document.getElementById('my-reports-tbody');
    if (!reportes || reportes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No has creado reportes aún</td></tr>';
      return;
    }

    tbody.innerHTML = reportes.map(r => `
      <tr>
        <td><strong>${r.numero_caso}</strong></td>
        <td>${r.categorias?.nombre || 'N/A'}</td>
        <td>${r.titulo}</td>
        <td><span class="badge badge-${stateBadge(r.estado)}">${r.estado}</span></td>
        <td>${r.prioridad}</td>
        <td>${formatDate(r.created_at)}</td>
        <td><button class="btn-secondary btn-sm" onclick="viewReportDetail('${r.id}')">Ver</button></td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error cargando reportes:', error);
  }
}

// ─── Panel Administrativo (CAS004) ────────────────────────────────
async function loadAdminReports() {
  if (!isAdmin) return;

  try {
    const { data: reportes, error } = await window.supabase
      .from('reportes')
      .select('*, categorias (nombre), perfiles (nombre_completo, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('admin-reports-tbody');
    if (!reportes || reportes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay reportes en el sistema</td></tr>';
      return;
    }

    tbody.innerHTML = reportes.map(r => `
      <tr>
        <td><strong>${r.numero_caso}</strong></td>
        <td>${r.perfiles?.nombre_completo || r.perfiles?.email || 'N/A'}</td>
        <td>${r.categorias?.nombre || 'N/A'}</td>
        <td><span class="badge badge-${stateBadge(r.estado)}">${r.estado}</span></td>
        <td>${r.prioridad}</td>
        <td>${formatDate(r.created_at)}</td>
        <td><button class="btn-secondary btn-sm" onclick="viewReportDetail('${r.id}')">Ver</button></td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error cargando panel admin:', error);
  }
}

// ─── Detalle del reporte (CAS003 + CAS004) ────────────────────────
async function viewReportDetail(reportId) {
  try {
    const [reportResult, historialResult] = await Promise.all([
      window.supabase
        .from('reportes')
        .select('*, categorias (nombre)')
        .eq('id', reportId)
        .single(),
      window.supabase
        .from('historial_reportes')
        .select('*')
        .eq('reporte_id', reportId)
        .order('created_at', { ascending: false })
    ]);

    if (reportResult.error) throw reportResult.error;

    const reporte  = reportResult.data;
    const historial = historialResult.data || [];

    // CAS003: historial de estados
    const historialHTML = historial.length > 0
      ? `<div class="history-timeline">${historial.map(h => `
          <div class="history-item">
            <div class="history-date">${formatDateTime(h.created_at)}</div>
            <div class="history-change">
              <span class="badge badge-${stateBadge(h.estado_anterior || 'Pendiente')}">${h.estado_anterior || '—'}</span>
              <span class="history-arrow">→</span>
              <span class="badge badge-${stateBadge(h.estado_nuevo)}">${h.estado_nuevo}</span>
            </div>
            ${h.observacion ? `<div class="history-obs">${escapeHtml(h.observacion)}</div>` : ''}
          </div>
        `).join('')}</div>`
      : '<p class="text-muted-sm">Sin cambios de estado registrados.</p>';

    // CAS004: formulario de cambio de estado (solo admin)
    const adminFormHTML = isAdmin ? `
      <div class="admin-state-form">
        <h4 class="admin-form-title">Cambiar Estado</h4>
        <div class="form-group" style="margin-bottom:1rem;">
          <label class="form-label" for="admin-new-state">Nuevo Estado</label>
          <select id="admin-new-state" class="form-control">
            ${['Pendiente','En revisión','En atención','Resuelto','Rechazado'].map(s =>
              `<option value="${s}"${reporte.estado === s ? ' selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:1rem;">
          <label class="form-label" for="admin-observation">Observación <span class="required">*</span></label>
          <textarea id="admin-observation" class="form-control" rows="3" placeholder="Describe el motivo del cambio de estado..."></textarea>
        </div>
        <button class="btn-primary btn-sm" id="btn-save-state"
          onclick="saveAdminStateChange('${reporte.id}','${escapeHtml(reporte.estado)}')">
          Guardar Cambio
        </button>
        <div id="admin-form-msg" style="margin-top:0.75rem;font-size:0.85rem;"></div>
      </div>
    ` : '';

    const modal     = document.getElementById('modal-detail');
    const modalBody = document.getElementById('modal-detail-body');

    modalBody.innerHTML = `
      <div style="display:grid;gap:1.5rem;">
        <div>
          <div class="detail-label">Número de Caso</div>
          <div style="font-size:1.1rem;font-weight:700;">${reporte.numero_caso}</div>
        </div>
        <div>
          <div class="detail-label">Categoría</div>
          <div>${reporte.categorias?.nombre || 'N/A'}</div>
        </div>
        <div>
          <div class="detail-label">Título</div>
          <div style="font-weight:600;">${escapeHtml(reporte.titulo)}</div>
        </div>
        <div>
          <div class="detail-label">Descripción</div>
          <div style="white-space:pre-wrap;">${escapeHtml(reporte.descripcion)}</div>
        </div>
        <div>
          <div class="detail-label">Ubicación</div>
          <div>📍 ${escapeHtml(reporte.ubicacion)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <div class="detail-label">Estado</div>
            <span class="badge badge-${stateBadge(reporte.estado)}">${reporte.estado}</span>
          </div>
          <div>
            <div class="detail-label">Prioridad</div>
            <div>${reporte.prioridad}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <div class="detail-label">Fecha Ocurrencia</div>
            <div>${formatDate(reporte.fecha_ocurrencia)}</div>
          </div>
          <div>
            <div class="detail-label">Fecha Creación</div>
            <div>${formatDate(reporte.created_at)}</div>
          </div>
        </div>
        ${reporte.evidencia_url ? `
          <div>
            <div class="detail-label">Evidencia</div>
            <a href="${reporte.evidencia_url}" target="_blank" rel="noopener" class="btn-primary btn-sm">📎 Ver archivo adjunto</a>
          </div>
        ` : ''}
        <div>
          <div class="detail-label" style="margin-bottom:0.75rem;">Historial de Estados</div>
          ${historialHTML}
        </div>
        ${adminFormHTML}
      </div>
    `;

    modal.style.display = 'flex';

  } catch (error) {
    console.error('Error cargando detalle:', error);
  }
}

// ─── Guardar cambio de estado (CAS004) ────────────────────────────
async function saveAdminStateChange(reportId, estadoActual) {
  const nuevoEstado  = document.getElementById('admin-new-state').value;
  const observacion  = document.getElementById('admin-observation').value.trim();
  const msgEl        = document.getElementById('admin-form-msg');
  const btn          = document.getElementById('btn-save-state');

  if (!observacion) {
    msgEl.innerHTML = '<span style="color:var(--danger);">La observación es obligatoria.</span>';
    return;
  }

  btn.disabled     = true;
  btn.textContent  = 'Guardando...';
  msgEl.innerHTML  = '';

  try {
    const { error: updateError } = await window.supabase
      .from('reportes')
      .update({
        estado:         nuevoEstado,
        observaciones:  observacion || null,
        updated_at:     new Date().toISOString()
      })
      .eq('id', reportId);

    if (updateError) throw updateError;
    // El trigger de Supabase inserta el historial automáticamente

    msgEl.innerHTML = '<span style="color:var(--success);">✅ Estado actualizado correctamente.</span>';
    // Refresca el modal para mostrar el historial actualizado
    setTimeout(() => viewReportDetail(reportId), 1400);

  } catch (error) {
    console.error('Error guardando cambio:', error);
    btn.disabled    = false;
    btn.textContent = 'Guardar Cambio';
    msgEl.innerHTML = `<span style="color:var(--danger);">Error: ${escapeHtml(error.message)}</span>`;
  }
}

// ─── Búsqueda funcional (CAS004 / vista search) ───────────────────
async function searchReports() {
  const numeroCaso = document.getElementById('search-number').value.trim();
  const dateFrom   = document.getElementById('search-date-from').value;
  const dateTo     = document.getElementById('search-date-to').value;
  const tbody      = document.getElementById('search-results-tbody');

  tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Buscando...</td></tr>';

  try {
    const session = await checkSession();
    if (!session) return;

    let query = window.supabase
      .from('reportes')
      .select('*, categorias (nombre)')
      .order('created_at', { ascending: false });

    // ciudadanos solo ven sus propios reportes
    if (!isAdmin) query = query.eq('usuario_id', session.user.id);
    if (numeroCaso) query = query.ilike('numero_caso', `%${numeroCaso}%`);
    if (dateFrom)   query = query.gte('created_at', dateFrom);
    if (dateTo)     query = query.lte('created_at', dateTo + 'T23:59:59');

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No se encontraron resultados</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td><strong>${r.numero_caso}</strong></td>
        <td>${r.categorias?.nombre || 'N/A'}</td>
        <td>${truncate(r.descripcion, 50)}</td>
        <td><span class="badge badge-${stateBadge(r.estado)}">${r.estado}</span></td>
        <td>${formatDate(r.created_at)}</td>
        <td><button class="btn-secondary btn-sm" onclick="viewReportDetail('${r.id}')">Ver</button></td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error buscando:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error al realizar la búsqueda.</td></tr>';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────
function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatDateTime(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Genera la clase CSS del badge normalizando tildes y espacios
function stateBadge(estado) {
  const map = {
    'Pendiente':   'pendiente',
    'En revisión': 'en-revision',
    'En atención': 'en-atencion',
    'Resuelto':    'resuelto',
    'Rechazado':   'rechazado'
  };
  return map[estado] || (estado || '').toLowerCase().replace(/\s+/g, '-');
}

// ─── Notificaciones ───────────────────────────────────────
async function loadNotifications() {
  if (!currentUserId) return;

  const { data, error } = await window.supabase
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.error('Error notificaciones:', error); return; }

  const unread = (data || []).filter(n => !n.leida).length;
  const badge  = document.getElementById('notif-badge');
  if (badge) {
    badge.style.display = unread > 0 ? 'flex' : 'none';
    badge.textContent   = unread > 9 ? '9+' : unread;
  }

  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!data || data.length === 0) {
    list.innerHTML = '<p class="notif-empty">No tienes notificaciones</p>';
    return;
  }

  list.innerHTML = `<div class="notif-list-scroll">${data.map(n => `
    <div class="notif-item ${n.leida ? '' : 'unread'}" data-id="${n.id}" data-reporte="${n.reporte_id}">
      <span>${escapeHtml(n.mensaje)}</span>
      <span class="notif-time">${formatDateTime(n.created_at)}</span>
    </div>
  `).join('')}</div>`;

  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async () => {
      const notifId = el.dataset.id;
      await window.supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', notifId);
      document.getElementById('notif-dropdown').style.display = 'none';
      showView('my-reports');
      loadNotifications();
    });
  });
}

async function markAllAsRead() {
  if (!currentUserId) return;
  await window.supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('usuario_id', currentUserId)
    .eq('leida', false);
  loadNotifications();
}

// ─── Mapa interactivo (Leaflet + OpenStreetMap) ───────────
function initReportMap() {
  if (reportMap) {
    // Ya inicializado: solo corregir tamaño por el contenedor oculto
    setTimeout(() => reportMap.invalidateSize(), 150);
    return;
  }

  reportMap = L.map('report-map').setView([10.9685, -74.7813], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(reportMap);

  reportMap.on('click', function (e) {
    placeMarker(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => reportMap.invalidateSize(), 150);
}

function placeMarker(lat, lng) {
  if (reportMarker) {
    reportMarker.setLatLng([lat, lng]);
  } else {
    reportMarker = L.marker([lat, lng], { draggable: true }).addTo(reportMap);
    reportMarker.on('dragend', function () {
      const pos = reportMarker.getLatLng();
      updateLocationFromCoords(pos.lat, pos.lng);
    });
  }
  updateLocationFromCoords(lat, lng);
}

async function updateLocationFromCoords(lat, lng) {
  reportLat = lat;
  reportLng = lng;

  const input = document.getElementById('report-location');
  if (input) input.placeholder = 'Obteniendo dirección...';

  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
    );
    const data = await res.json();
    const addr = data.address || {};
    reportBarrio = addr.suburb || addr.neighbourhood || addr.city_district
                 || addr.town  || addr.village || null;
    if (input) input.value = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (_) {
    if (input) input.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  const ov = document.getElementById('sidebar-overlay');
  if (ov) ov.remove();
}

function toggleMenu() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (window.innerWidth > 768) {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  } else {
    const isOpen = sidebar.classList.toggle('open');
    if (isOpen) {
      const overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        inset:    '0',
        zIndex:   '99',
        background: 'rgba(0,0,0,0.5)'
      });
      overlay.addEventListener('click', closeSidebar);
      document.body.appendChild(overlay);
    } else {
      closeSidebar();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  await loadUserUI();
  loadDashboard();

  loadNotifications();
  setInterval(loadNotifications, 60000);

  const btnNotif = document.getElementById('btn-notif');
  const dropdown = document.getElementById('notif-dropdown');
  if (btnNotif && dropdown) {
    btnNotif.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      dropdown.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) loadNotifications();
    });
  }

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('notif-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      if (dropdown) dropdown.style.display = 'none';
    }
  });

  document.getElementById('btn-mark-all-read')?.addEventListener('click', (e) => {
    e.stopPropagation();
    markAllAsRead();
  });

  // Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // Mobile menu
  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) btnMenu.addEventListener('click', toggleMenu);

  // Cerrar sidebar al navegar en móvil
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // ── CAS006: contador y validación de descripción ──────────────
  const descInput = document.getElementById('report-description');
  const descCount = document.getElementById('desc-count');
  const descError = document.getElementById('desc-error');

  if (descInput) {
    descInput.addEventListener('input', function () {
      const len = this.value.length;
      if (descCount) {
        descCount.textContent = len;
        descCount.style.color = (len < 20 || len > 1000) ? 'var(--danger)' : '';
      }
      if (descError)
        descError.style.display = (len > 0 && (len < 20 || len > 1000)) ? 'block' : 'none';
    });
  }

  // ── CAS006: fecha no futura ────────────────────────────────────
  const dateInput = document.getElementById('report-date');
  const dateError = document.getElementById('date-error');

  if (dateInput) {
    dateInput.addEventListener('change', function () {
      const sel   = new Date(this.value + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (dateError) dateError.style.display = sel > today ? 'block' : 'none';
    });
  }

  // ── CAS006: archivo máximo 5 MB (sin alert) ───────────────────
  const fileInput = document.getElementById('report-evidence');
  const fileError = document.getElementById('file-error');

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const tooBig = this.files.length > 0 && this.files[0].size > 5 * 1024 * 1024;
      if (fileError) fileError.style.display = tooBig ? 'block' : 'none';
      if (tooBig) this.value = '';
    });
  }

  // ── CAS005: filtro de estado en "Mis Reportes" ────────────────
  const filterStatus = document.getElementById('filter-status');
  if (filterStatus) {
    filterStatus.addEventListener('change', function () {
      loadMyReports(this.value);
    });
  }

  // ── Búsqueda ──────────────────────────────────────────────────
  const btnSearch = document.getElementById('btn-search');
  if (btnSearch) btnSearch.addEventListener('click', searchReports);

  // ── Formulario de reporte ─────────────────────────────────────
  const formReport = document.getElementById('form-report');
  if (formReport) {
    formReport.addEventListener('submit', async function (e) {
      e.preventDefault();

      const category    = document.getElementById('report-category').value;
      const title       = document.getElementById('report-title').value.trim();
      const description = document.getElementById('report-description').value.trim();
      const location    = document.getElementById('report-location').value.trim();
      const date        = document.getElementById('report-date').value;
      const priority    = document.getElementById('report-priority').value;
      const fileInputEl = document.getElementById('report-evidence');

      // Campos obligatorios
      if (!category || !title || !description || !location || !date) {
        alert('Por favor completa todos los campos obligatorios');
        return;
      }

      // CAS006: descripción 20–1000 chars
      if (description.length < 20 || description.length > 1000) {
        if (descError) descError.style.display = 'block';
        descInput?.focus();
        return;
      }

      // CAS006: fecha no futura
      const selectedDate = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        if (dateError) dateError.style.display = 'block';
        dateInput?.focus();
        return;
      }

      // CAS006: archivo ≤ 5 MB
      if (fileInputEl.files.length > 0 && fileInputEl.files[0].size > 5 * 1024 * 1024) {
        if (fileError) fileError.style.display = 'block';
        return;
      }

      const btn     = document.getElementById('btn-submit-report');
      const btnText = btn.querySelector('.btn-text');
      const spinner = btn.querySelector('.spinner');

      spinner.style.display = 'block';
      btnText.textContent   = 'Guardando...';
      btn.disabled          = true;

      try {
        const session = await checkSession();
        if (!session) return;

        const { data: categorias, error: catError } = await window.supabase
          .from('categorias')
          .select('id, nombre')
          .eq('nombre', getCategoryName(category))
          .single();

        if (catError || !categorias) throw new Error('No se encontró la categoría seleccionada');

        let evidenceUrl = null;

        if (fileInputEl.files.length > 0) {
          const file     = fileInputEl.files[0];
          const fileExt  = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await window.supabase.storage
            .from('evidencias')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = window.supabase.storage
            .from('evidencias')
            .getPublicUrl(fileName);

          evidenceUrl = urlData.publicUrl;
        }

        const { data, error } = await window.supabase
          .from('reportes')
          .insert({
            usuario_id:       session.user.id,
            categoria_id:     categorias.id,
            titulo:           title,
            descripcion:      description,
            ubicacion:        location,
            latitud:          reportLat,
            longitud:         reportLng,
            barrio:           reportBarrio,
            fecha_ocurrencia: date,
            prioridad:        formatPriority(priority),
            evidencia_url:    evidenceUrl,
            estado:           'Pendiente'
          })
          .select()
          .single();

        if (error) throw error;

        alert('✅ Reporte creado exitosamente: ' + data.numero_caso);
        formReport.reset();
        if (descCount) { descCount.textContent = '0'; descCount.style.color = ''; }
        // Resetear estado del mapa
        if (reportMarker) { reportMarker.remove(); reportMarker = null; }
        reportLat    = null;
        reportLng    = null;
        reportBarrio = null;
        showView('my-reports');

      } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al crear reporte: ' + error.message);
      } finally {
        spinner.style.display = 'none';
        btnText.textContent   = 'Enviar Reporte';
        btn.disabled          = false;
      }
    });
  }

  console.log('✅ App inicializada correctamente');
});

// ─── Helpers de formulario ────────────────────────────────────────
function getCategoryName(categoryValue) {
  const map = {
    'infraestructura': 'Infraestructura',
    'alumbrado':       'Alumbrado Público',
    'seguridad':       'Seguridad',
    'basuras':         'Recolección de Basuras',
    'vias':            'Vías y Calles',
    'zonas-verdes':    'Zonas Verdes',
    'acueducto':       'Acueducto',
    'alcantarillado':  'Alcantarillado',
    'otro':            'Otro'
  };
  return map[categoryValue] || 'Otro';
}

function formatPriority(priority) {
  const map = { 'baja': 'Baja', 'media': 'Media', 'alta': 'Alta', 'urgente': 'Urgente' };
  return map[priority] || 'Media';
}
