/* ══════════════════════════════════════════════
   VISIÓN BARRIAL — Panel Administrativo
══════════════════════════════════════════════ */

'use strict';

// ─── Estado global ────────────────────────────────────────────
let currentAdminId = null;
let adminRol       = null;
let allCategorias  = [];
let currentPeriod  = 'all';
let currentView    = 'dashboard';

// ─── Guard: verificar sesión y rol ────────────────────────────
async function checkAdminSession() {
  const { data } = await window.supabase.auth.getSession();
  if (!data.session) {
    window.location.replace('index.html');
    return null;
  }

  try {
    const { data: perfil, error } = await window.supabase
      .from('perfiles')
      .select('rol, nombre_completo')
      .eq('id', data.session.user.id)
      .single();

    if (error || !perfil || !['administrador', 'gestor'].includes(perfil.rol)) {
      window.location.replace('app.html');
      return null;
    }

    currentAdminId = data.session.user.id;
    adminRol       = perfil.rol;
    return { session: data.session, perfil };

  } catch (_) {
    window.location.replace('app.html');
    return null;
  }
}

// ─── Navegación ───────────────────────────────────────────────
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-view="${viewName}"]`);
  if (btn) btn.classList.add('active');

  currentView = viewName;

  const titles = {
    dashboard:      'Dashboard Global',
    'all-reports':  'Todos los Reportes'
  };
  const el = document.getElementById('topbar-title');
  if (el) el.textContent = titles[viewName] || 'Panel Administrativo';

  if (viewName === 'dashboard')    loadDashboard(currentPeriod);
  if (viewName === 'all-reports')  loadAllReports();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Cargar categorías (para el select de filtros) ─────────────
async function loadCategorias() {
  const { data } = await window.supabase
    .from('categorias')
    .select('id, nombre')
    .order('nombre');

  allCategorias = data || [];

  const catFilter = document.getElementById('filter-categoria');
  if (catFilter) {
    catFilter.innerHTML = '<option value="">Todas</option>' +
      allCategorias.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  }
}

// ─── Dashboard Global ─────────────────────────────────────────
async function loadDashboard(period = 'all') {
  currentPeriod = period;

  // Resaltar botón activo
  document.querySelectorAll('[data-period]').forEach(b => {
    b.classList.toggle('period-btn-active', b.dataset.period === period);
  });

  try {
    let query = window.supabase
      .from('reportes')
      .select('id, estado, categoria_id, created_at, updated_at, categorias(nombre)');

    if (period !== 'all') {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const from = new Date(Date.now() - (daysMap[period] || 7) * 86400000).toISOString();
      query = query.gte('created_at', from);
    }

    const { data: reportes, error } = await query;
    if (error) throw error;

    const total      = reportes.length;
    const pendientes = reportes.filter(r => r.estado === 'Pendiente').length;
    const enProceso  = reportes.filter(r => r.estado === 'En revisión' || r.estado === 'En atención').length;
    const resueltos  = reportes.filter(r => r.estado === 'Resuelto').length;
    const rechazados = reportes.filter(r => r.estado === 'Rechazado').length;

    setEl('stat-total',    total);
    setEl('stat-pending',  pendientes);
    setEl('stat-progress', enProceso);
    setEl('stat-resolved', resueltos);
    setEl('stat-rejected', rechazados);

    // ── Tiempo promedio de atención ──────────────────────────
    const resueltosFull = reportes.filter(r =>
      r.estado === 'Resuelto' && r.updated_at && r.created_at
    );
    const avgDays = resueltosFull.length
      ? resueltosFull.reduce((sum, r) =>
          sum + (new Date(r.updated_at) - new Date(r.created_at)) / 86400000, 0
        ) / resueltosFull.length
      : null;

    const avgEl    = document.getElementById('stat-avg-time');
    const sampleEl = document.getElementById('stat-avg-sample');
    if (avgEl) avgEl.textContent = avgDays !== null ? avgDays.toFixed(1) + ' días' : 'Sin datos';
    if (sampleEl) sampleEl.textContent = resueltosFull.length
      ? `Calculado sobre ${resueltosFull.length} reporte${resueltosFull.length > 1 ? 's' : ''} resuelto${resueltosFull.length > 1 ? 's' : ''}`
      : 'No hay reportes resueltos en este período';

    // ── Distribución por categoría ───────────────────────────
    const catCounts = {};
    reportes.forEach(r => {
      const cat = r.categorias?.nombre || 'Sin categoría';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const sorted   = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] || 1;
    const chartEl  = document.getElementById('cat-chart');

    if (chartEl) {
      if (sorted.length === 0) {
        chartEl.innerHTML = '<p class="text-muted-sm">No hay datos para el período seleccionado.</p>';
      } else {
        chartEl.innerHTML = sorted.map(([name, count]) => `
          <div class="cat-bar-row">
            <div class="cat-bar-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width:${(count / maxCount * 100).toFixed(1)}%"></div>
            </div>
            <div class="cat-bar-count">${count}</div>
          </div>
        `).join('');
      }
    }

  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

// ─── Todos los reportes ───────────────────────────────────────
async function loadAllReports() {
  const estado    = document.getElementById('filter-report-estado')?.value || '';
  const categoria = document.getElementById('filter-categoria')?.value    || '';
  const dateFrom  = document.getElementById('filter-date-from')?.value    || '';
  const dateTo    = document.getElementById('filter-date-to')?.value      || '';

  const tbody = document.getElementById('all-reports-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Cargando...</td></tr>';

  try {
    let query = window.supabase
      .from('reportes')
      .select('*, categorias(nombre), perfiles(nombre_completo)')
      .order('created_at', { ascending: false });

    if (estado)    query = query.eq('estado', estado);
    if (categoria) query = query.eq('categoria_id', categoria);
    if (dateFrom)  query = query.gte('created_at', dateFrom);
    if (dateTo)    query = query.lte('created_at', dateTo + 'T23:59:59');

    const { data, error } = await query;
    if (error) throw error;

    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No se encontraron reportes con los filtros seleccionados</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td><strong>${r.numero_caso}</strong></td>
        <td>${escapeHtml(r.perfiles?.nombre_completo || 'N/A')}</td>
        <td>${r.categorias?.nombre || 'N/A'}</td>
        <td>${escapeHtml(truncate(r.titulo, 32))}</td>
        <td><span class="badge badge-${stateBadge(r.estado)}">${r.estado}</span></td>
        <td>${r.prioridad}</td>
        <td>${r.entidad_responsable ? escapeHtml(r.entidad_responsable) : '<span style="color:var(--text-muted);">—</span>'}</td>
        <td>${formatDate(r.created_at)}</td>
        <td>
          <button class="btn-primary btn-sm" onclick="openManageModal('${r.id}')">Gestionar</button>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error cargando reportes:', error);
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Error al cargar reportes.</td></tr>';
  }
}

// ─── Modal de gestión ─────────────────────────────────────────
async function openManageModal(reportId) {
  const modal = document.getElementById('modal-manage');
  const body  = document.getElementById('modal-manage-body');

  if (body) body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Cargando reporte...</div>';
  if (modal) modal.style.display = 'flex';

  try {
    const [reportResult, historialResult] = await Promise.all([
      window.supabase
        .from('reportes')
        .select('*, categorias(nombre), perfiles(nombre_completo)')
        .eq('id', reportId)
        .single(),
      window.supabase
        .from('historial_reportes')
        .select('*, perfiles(nombre_completo)')
        .eq('reporte_id', reportId)
        .order('created_at', { ascending: false })
    ]);

    if (reportResult.error) throw reportResult.error;

    const r        = reportResult.data;
    const historial = historialResult.data || [];

    // ── Historial de movimientos ─────────────────────────────
    const historialHTML = historial.length > 0
      ? `<div class="history-timeline">${historial.map(h => {
          const quien = h.perfiles?.nombre_completo || 'Sistema';
          return `
            <div class="history-item">
              <div class="history-date">${formatDateTime(h.created_at)} · ${escapeHtml(quien)}</div>
              <div class="history-change">
                ${h.estado_anterior
                  ? `<span class="badge badge-${stateBadge(h.estado_anterior)}">${h.estado_anterior}</span>
                     <span class="history-arrow">→</span>`
                  : ''}
                ${h.estado_nuevo
                  ? `<span class="badge badge-${stateBadge(h.estado_nuevo)}">${h.estado_nuevo}</span>`
                  : (h.accion ? `<span style="font-size:0.85rem;color:var(--text-secondary);">${escapeHtml(h.accion)}</span>` : '')}
              </div>
              ${h.entidad_asignada ? `<div class="history-obs">Entidad: ${escapeHtml(h.entidad_asignada)}</div>` : ''}
              ${h.observacion ? `<div class="history-obs">${escapeHtml(h.observacion)}</div>` : ''}
            </div>`;
        }).join('')}</div>`
      : '<p class="text-muted-sm">Sin movimientos registrados aún.</p>';

    // ── Opciones de entidad ──────────────────────────────────
    const ENTIDADES = [
      'JAC Barrio', 'Alcaldía', 'Secretaría de Infraestructura',
      'Secretaría de Medio Ambiente', 'Empresa de Servicios Públicos',
      'Policía Nacional', 'Comité de Seguridad', 'Comité Ambiental', 'Otro'
    ];

    const obsLen = (r.observaciones || '').length;

    body.innerHTML = `
      <div class="manage-grid">

        <!-- ── Detalle del reporte ─────────────────────── -->
        <div class="manage-detail">
          <div class="detail-section">
            <div class="detail-label">Número de Caso</div>
            <div class="detail-value detail-num">${r.numero_caso}</div>
          </div>
          <div class="detail-section">
            <div class="detail-label">Ciudadano</div>
            <div class="detail-value">${escapeHtml(r.perfiles?.nombre_completo || 'N/A')}</div>
          </div>
          <div class="detail-row-2">
            <div class="detail-section">
              <div class="detail-label">Categoría</div>
              <div class="detail-value">${r.categorias?.nombre || 'N/A'}</div>
            </div>
            <div class="detail-section">
              <div class="detail-label">Prioridad</div>
              <div class="detail-value">${r.prioridad}</div>
            </div>
          </div>
          <div class="detail-section">
            <div class="detail-label">Título</div>
            <div class="detail-value" style="font-weight:600;">${escapeHtml(r.titulo)}</div>
          </div>
          <div class="detail-section">
            <div class="detail-label">Descripción</div>
            <div class="detail-value" style="white-space:pre-wrap;font-size:0.88rem;line-height:1.6;">${escapeHtml(r.descripcion)}</div>
          </div>
          <div class="detail-section">
            <div class="detail-label">Ubicación</div>
            <div class="detail-value">📍 ${escapeHtml(r.ubicacion)}</div>
          </div>
          <div class="detail-row-2">
            <div class="detail-section">
              <div class="detail-label">Estado Actual</div>
              <span class="badge badge-${stateBadge(r.estado)}">${r.estado}</span>
            </div>
            <div class="detail-section">
              <div class="detail-label">Entidad Actual</div>
              <div class="detail-value">${r.entidad_responsable || '—'}</div>
            </div>
          </div>
          <div class="detail-row-2">
            <div class="detail-section">
              <div class="detail-label">Fecha Ocurrencia</div>
              <div class="detail-value">${formatDate(r.fecha_ocurrencia)}</div>
            </div>
            <div class="detail-section">
              <div class="detail-label">Fecha Creación</div>
              <div class="detail-value">${formatDate(r.created_at)}</div>
            </div>
          </div>
          ${r.evidencia_url ? `
            <div class="detail-section">
              <div class="detail-label">Evidencia adjunta</div>
              <a href="${r.evidencia_url}" target="_blank" rel="noopener" class="btn-secondary btn-sm">📎 Ver archivo</a>
            </div>` : ''}
          <div class="detail-section">
            <div class="detail-label" style="margin-bottom:0.75rem;">Historial de Movimientos</div>
            ${historialHTML}
          </div>
        </div>

        <!-- ── Formulario de gestión ───────────────────── -->
        <div class="manage-form-panel">
          <h3 class="manage-form-title">Actualizar Reporte</h3>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label" for="manage-estado">Nuevo Estado</label>
            <select id="manage-estado" class="form-control">
              ${['Pendiente','En revisión','En atención','Resuelto','Rechazado'].map(s =>
                `<option value="${s}"${r.estado === s ? ' selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label" for="manage-entidad">Entidad Responsable</label>
            <select id="manage-entidad" class="form-control">
              <option value="">— Sin asignar —</option>
              ${ENTIDADES.map(e =>
                `<option value="${e}"${r.entidad_responsable === e ? ' selected' : ''}>${e}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label class="form-label" for="manage-observaciones">Observaciones</label>
            <textarea id="manage-observaciones" class="form-control" rows="7"
              maxlength="2000"
              placeholder="Registra las gestiones realizadas, contactos con entidades, acuerdos, etc."
            >${escapeHtml(r.observaciones || '')}</textarea>
            <span class="form-hint">
              <span id="manage-obs-count">${obsLen}</span>/2000 caracteres
            </span>
          </div>

          <button class="btn-primary" id="btn-save-manage" style="width:100%;"
            onclick="saveReportChanges('${r.id}')">
            Guardar Cambios
          </button>
          <div id="manage-msg" style="margin-top:0.85rem;font-size:0.85rem;"></div>

          <div style="margin-top:auto;padding-top:1.5rem;border-top:1px solid var(--border);margin-top:1.5rem;">
            <p style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;">
              El trigger de Supabase registra automáticamente el cambio de estado en el historial con la fecha y el usuario actual.
            </p>
          </div>
        </div>

      </div>
    `;

    // Contador de caracteres
    const obsInput = document.getElementById('manage-observaciones');
    const obsCount = document.getElementById('manage-obs-count');
    if (obsInput && obsCount) {
      obsInput.addEventListener('input', function () {
        obsCount.textContent = this.value.length;
      });
    }

  } catch (error) {
    console.error('Error cargando modal:', error);
    if (body) body.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--danger);">
        Error al cargar el reporte: ${escapeHtml(error.message)}
      </div>`;
  }
}

// ─── Guardar cambios (trigger maneja historial automáticamente) ──
async function saveReportChanges(reportId) {
  const estado               = document.getElementById('manage-estado').value;
  const entidad_responsable  = document.getElementById('manage-entidad').value;
  const observaciones        = document.getElementById('manage-observaciones').value.trim();
  const btn                  = document.getElementById('btn-save-manage');
  const msgEl                = document.getElementById('manage-msg');

  btn.disabled    = true;
  btn.textContent = 'Guardando...';
  msgEl.innerHTML = '';

  try {
    const { error } = await window.supabase
      .from('reportes')
      .update({
        estado,
        entidad_responsable: entidad_responsable || null,
        observaciones:       observaciones || null,
        updated_at:          new Date().toISOString()
      })
      .eq('id', reportId);

    if (error) throw error;

    msgEl.innerHTML = '<span style="color:var(--success);">✅ Cambios guardados correctamente.</span>';

    // Refrescar modal y tabla tras breve pausa
    setTimeout(() => {
      openManageModal(reportId);
      if (currentView === 'all-reports') loadAllReports();
      if (currentView === 'dashboard')   loadDashboard(currentPeriod);
    }, 1400);

  } catch (error) {
    console.error('Error guardando cambios:', error);
    btn.disabled    = false;
    btn.textContent = 'Guardar Cambios';
    msgEl.innerHTML = `<span style="color:var(--danger);">Error: ${escapeHtml(error.message)}</span>`;
  }
}

// ─── Cerrar modal ─────────────────────────────────────────────
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

// ─── Helpers ─────────────────────────────────────────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '…' : text;
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

// ─── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  const auth = await checkAdminSession();
  if (!auth) return;

  const { session, perfil } = auth;
  const nombre   = perfil.nombre_completo || session.user.email;
  const rolLabel = perfil.rol === 'gestor' ? 'Gestor Barrial' : 'Administrador';

  setEl('sidebar-user-name', nombre);
  setEl('sidebar-user-role', rolLabel);
  setEl('topbar-user-name',  nombre);

  await loadCategorias();
  loadDashboard('all');

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await window.supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  // Mobile menu
  document.getElementById('btn-menu')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Filtro por período (dashboard)
  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', function () {
      loadDashboard(this.dataset.period);
    });
  });

  // Filtros de reportes
  document.getElementById('btn-apply-filters')?.addEventListener('click', loadAllReports);
  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    ['filter-report-estado', 'filter-categoria', 'filter-date-from', 'filter-date-to']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadAllReports();
  });

  // Cerrar modal al hacer clic en el fondo
  document.getElementById('modal-manage')?.addEventListener('click', function (e) {
    if (e.target === this) closeModal('modal-manage');
  });

  console.log('✅ Panel admin inicializado —', rolLabel);
});
