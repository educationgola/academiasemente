/**
 * Academia Semente — Admin panel
 * Students (grant/revoke), courses & videos (CRUD + soft-delete + Cloudinary upload)
 */
(function () {
  'use strict';

  const cfg = window.ACADEMIA_CONFIG;
  const API = cfg.WORKER_URL.replace(/\/$/, '') + '/api';

  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('loginError');
  const studentsTable = document.getElementById('studentsTable');
  const coursesAdmin = document.getElementById('coursesAdmin');
  const grantModal = document.getElementById('grantModal');
  const grantCourseSelect = document.getElementById('grantCourseSelect');
  const grantStudentLabel = document.getElementById('grantStudentLabel');
  const revokeModal = document.getElementById('revokeModal');
  const revokeCourseSelect = document.getElementById('revokeCourseSelect');
  const revokeStudentLabel = document.getElementById('revokeStudentLabel');
  const videoCourseSelect = document.getElementById('videoCourseSelect');
  const uploadStatus = document.getElementById('uploadStatus');

  let grantUserId = null;
  let revokeUserId = null;
  let coursesCache = [];
  let studentsCache = [];

  function getToken() {
    return sessionStorage.getItem(cfg.ADMIN_TOKEN_KEY) || localStorage.getItem(cfg.ADMIN_TOKEN_KEY);
  }
  function setToken(t) {
    sessionStorage.setItem(cfg.ADMIN_TOKEN_KEY, t);
  }
  function clearToken() {
    sessionStorage.removeItem(cfg.ADMIN_TOKEN_KEY);
    localStorage.removeItem(cfg.ADMIN_TOKEN_KEY);
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(API + path, { ...options, headers });
    } catch (netErr) {
      const err = new Error(
        'Sem ligação ao API (Failed to fetch). Confirme que o Worker está online: ' + API.replace(/\/api$/, '') + '/api/health'
      );
      err.status = 0;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
      }
      const err = new Error(data.error || ('Erro HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // —— Password toggle ——
  const passwordInput = document.getElementById('adminPassword');
  const togglePasswordBtn = document.getElementById('toggleAdminPassword');
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      const eye = togglePasswordBtn.querySelector('.icon-eye');
      const eyeOff = togglePasswordBtn.querySelector('.icon-eye-off');
      if (eye) eye.hidden = !showing;
      if (eyeOff) eyeOff.hidden = showing;
    });
  }

  // —— Login / logout ——
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = new FormData(loginForm).get('password');
    try {
      const data = await api('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setToken(data.token);
      showApp();
    } catch (err) {
      loginError.textContent = err.message || 'Palavra-passe incorrecta.';
      loginError.hidden = false;
    }
  });

  function doLogout() {
    clearToken();
    location.reload();
  }
  document.getElementById('adminLogout').addEventListener('click', doLogout);
  const logoutMobile = document.getElementById('adminLogoutMobile');
  if (logoutMobile) logoutMobile.addEventListener('click', doLogout);

  // —— Nav (sidebar + bottom bar share .nav-btn) ——
  const PANEL_TITLES = {
    students: 'Alunos',
    enrollments: 'Inscrições',
    orders: 'Encomendas',
    messages: 'Mensagens',
    courses: 'Cursos',
    website: 'Website',
    notify: 'Avisos',
    guide: 'Guia',
  };

  function switchPanel(panel) {
    if (!panel) return;
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.panel === panel);
    });
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = true));
    const el = document.getElementById('panel-' + panel);
    if (el) el.hidden = false;
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = PANEL_TITLES[panel] || panel;
    if (panel === 'enrollments') loadEnrollments();
    if (panel === 'orders') loadOrders();
    if (panel === 'messages') loadMessages();
    if (panel === 'students') loadStudents();
    if (panel === 'courses') loadCourses();
    if (panel === 'notify') populateNotifyUsers();
    if (panel === 'website') loadWebsite();
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  let summaryPollTimer = null;
  function startSummaryPoll() {
    if (summaryPollTimer) return;
    summaryPollTimer = setInterval(() => {
      loadSummary();
      // Refresh student list when viewing Alunos so online dots stay fresh
      const studentsPanel = document.getElementById('panel-students');
      if (studentsPanel && !studentsPanel.hidden) loadStudents();
    }, 60000);
  }

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    loadSummary();
    startSummaryPoll();
    loadStudents();
    loadCourses();
    loadEnrollments();
    loadOrders();
    loadMessages();
  }

  async function loadSummary() {
    try {
      const data = await api('/admin/summary');
      const counts = (data && data.counts) || {};
      document.querySelectorAll('[data-count]').forEach((el) => {
        const key = el.getAttribute('data-count');
        const n = Number(counts[key]) || 0;
        if (el.classList.contains('nav-count')) {
          if (n > 0) {
            el.hidden = false;
            el.textContent = n > 99 ? '99+' : String(n);
          } else {
            el.hidden = true;
            el.textContent = '';
          }
        } else if (el.classList.contains('nav-dot')) {
          el.hidden = n <= 0;
        }
      });
      const onlineN = Number(counts.students_online) || 0;
      const onlineBadge = document.getElementById('studentsOnlineBadge');
      const onlineText = document.getElementById('studentsOnlineText');
      if (onlineBadge && onlineText) {
        onlineText.textContent = onlineN === 1 ? '1 online' : onlineN + ' online';
        onlineBadge.hidden = false;
      }
      const onlineLine = document.getElementById('studentsOnlineLine');
      if (onlineLine) {
        onlineLine.hidden = false;
        onlineLine.innerHTML =
          '<span class="online-dot" aria-hidden="true"></span> ' +
          (onlineN === 0
            ? 'Nenhum aluno online neste momento (janela de 2 min).'
            : onlineN === 1
              ? '<strong>1 aluno</strong> online agora (actividade nos últimos 2 min).'
              : '<strong>' + onlineN + ' alunos</strong> online agora (actividade nos últimos 2 min).');
      }
    } catch (_) {
      /* non-blocking */
    }
  }

  // ==================== Students ====================

  function formatLastSeen(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
      if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
      const sec = Math.round((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return 'há instantes';
      if (sec < 3600) return 'há ' + Math.floor(sec / 60) + ' min';
      if (sec < 86400) return 'há ' + Math.floor(sec / 3600) + ' h';
      return d.toLocaleString('pt-AO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return String(iso).slice(0, 16);
    }
  }


  const studentSearch = document.getElementById('studentSearch');
  const studentStatusFilter = document.getElementById('studentStatusFilter');
  const studentsCount = document.getElementById('studentsCount');
  const editStudentModal = document.getElementById('editStudentModal');
  const editStudentForm = document.getElementById('editStudentForm');

  function isProbeEmail(email) {
    const e = (email || '').toLowerCase();
    return (
      e.includes('test.com') ||
      e.includes('example.com') ||
      e.includes('probe') ||
      e.endsWith('@test.com') ||
      /probe-?\d*/.test(e)
    );
  }

  function getFilteredStudents() {
    const q = ((studentSearch && studentSearch.value) || '').trim().toLowerCase();
    const st = (studentStatusFilter && studentStatusFilter.value) || '';
    return studentsCache.filter((s) => {
      if (st === 'online') {
        if (!s.is_online) return false;
      } else if (st && s.status !== st) {
        return false;
      }
      if (!q) return true;
      const hay = ((s.name || '') + ' ' + (s.email || '') + ' ' + (s.phone || '')).toLowerCase();
      return hay.includes(q);
    });
  }

  function renderStudents() {
    const rows = getFilteredStudents();
    if (studentsCount) {
      studentsCount.textContent = rows.length
        ? `${rows.length} aluno(s)${rows.length !== studentsCache.length ? ` de ${studentsCache.length}` : ''}`
        : studentsCache.length
          ? 'Nenhum resultado para este filtro.'
          : '';
    }
    if (!studentsCache.length) {
      studentsTable.innerHTML = '<div class="empty-state">Nenhum aluno registado ainda.</div>';
      return;
    }
    if (!rows.length) {
      studentsTable.innerHTML = '<div class="empty-state">Nenhum aluno corresponde à pesquisa.</div>';
      return;
    }
    studentsTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nome / Email</th>
            <th>Estado</th>
            <th>Cursos</th>
            <th>Desde</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((s) => {
              const courses = s.courses || [];
              const history = s.course_history || [];
              const courseChips = courses.length
                ? courses.map((c) => `<span class="chip">${esc(c.title_pt)}</span>`).join(' ')
                : '<span class="muted">—</span>';
              const revokedCount = history.filter((h) => h.status === 'revoked').length;
              return `
            <tr>
              <td data-label="Aluno">
                <strong>${s.is_online ? '<span class="online-dot" title="Online"></span> ' : ''}${esc(s.name || '—')}</strong>
                ${s.is_online ? '<span class="chip chip-online">Online</span>' : ''}
                <br>
                <span class="student-email">${esc(s.email)}</span>
                ${s.phone ? `<br><span class="student-email">${esc(s.phone)}</span>` : ''}
                ${s.last_seen_at && !s.is_online ? `<br><span class="student-email muted">Visto: ${esc(formatLastSeen(s.last_seen_at))}</span>` : ''}
              </td>
              <td data-label="Estado">
                <select class="status-select" data-status-id="${s.id}" title="Alterar estado">
                  <option value="pending"${s.status === 'pending' ? ' selected' : ''}>Pendente</option>
                  <option value="active"${s.status === 'active' ? ' selected' : ''}>Activo</option>
                  <option value="suspended"${s.status === 'suspended' ? ' selected' : ''}>Suspenso</option>
                </select>
              </td>
              <td data-label="Cursos" class="courses-cell">
                ${courseChips}
                ${revokedCount ? `<br><span class="muted" style="font-size:0.75rem">${revokedCount} revogado(s)</span>` : ''}
              </td>
              <td data-label="Desde">${(s.created_at || '').slice(0, 10) || '—'}</td>
              <td data-label="" class="actions-cell">
                <button type="button" class="btn btn-sm" data-grant="${s.id}" data-label="${esc(s.name || s.email)}">Atribuir</button>
                ${
                  courses.length
                    ? `<button type="button" class="btn btn-sm btn-outline" data-revoke="${s.id}" data-label="${esc(s.name || s.email)}">Revogar</button>`
                    : ''
                }
                <button type="button" class="btn btn-sm btn-outline" data-edit="${s.id}">Editar</button>
                <button type="button" class="btn btn-sm btn-danger" data-del-student="${s.id}" data-label="${esc(s.name || s.email)}">Eliminar</button>
              </td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    `;
    studentsTable.querySelectorAll('[data-grant]').forEach((btn) => {
      btn.addEventListener('click', () => openGrant(btn.dataset.grant, btn.dataset.label));
    });
    studentsTable.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', () => openRevoke(btn.dataset.revoke, btn.dataset.label));
    });
    studentsTable.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEditStudent(btn.dataset.edit));
    });
    studentsTable.querySelectorAll('[data-del-student]').forEach((btn) => {
      btn.addEventListener('click', () => deleteStudent(btn.dataset.delStudent, btn.dataset.label));
    });
    studentsTable.querySelectorAll('.status-select').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.statusId;
        const status = sel.value;
        try {
          await api('/admin/students/update', {
            method: 'POST',
            body: JSON.stringify({ id, status }),
          });
          const s = studentsCache.find((x) => x.id === id);
          if (s) s.status = status;
          renderStudents();
        } catch (err) {
          alert(err.message);
          loadStudents();
        }
      });
    });
  }

  async function loadStudents() {
    studentsTable.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const data = await api('/admin/students');
      studentsCache = data.students || [];
      // Normalize is_online from API
      studentsCache.forEach((s) => {
        s.is_online = s.is_online === true || s.is_online === 1 || s.is_online === '1';
      });
      renderStudents();
      loadSummary();
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        location.reload();
        return;
      }
      studentsTable.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  document.getElementById('refreshStudents').addEventListener('click', loadStudents);
  if (studentSearch) studentSearch.addEventListener('input', renderStudents);
  if (studentStatusFilter) studentStatusFilter.addEventListener('change', renderStudents);

  const bulkDeleteProbes = document.getElementById('bulkDeleteProbes');
  if (bulkDeleteProbes) {
    bulkDeleteProbes.addEventListener('click', async () => {
      const probes = studentsCache.filter((s) => isProbeEmail(s.email));
      if (!probes.length) {
        alert('Nenhuma conta probe/test encontrada.');
        return;
      }
      if (!confirm(`Apagar ${probes.length} conta(s) de teste permanentemente?`)) return;
      try {
        for (const s of probes) {
          await api('/admin/students/delete', {
            method: 'POST',
            body: JSON.stringify({ id: s.id }),
          });
        }
        await loadStudents();
        alert(`${probes.length} conta(s) apagada(s).`);
      } catch (err) {
        alert(err.message);
        loadStudents();
      }
    });
  }

  function openGrant(userId, label) {
    grantUserId = userId;
    grantStudentLabel.textContent = label;
    const active = coursesCache.filter((c) => c.active !== 0);
    grantCourseSelect.innerHTML =
      active.map((c) => `<option value="${c.id}">${esc(c.title_pt)}</option>`).join('') ||
      '<option value="">— crie um curso primeiro —</option>';
    grantModal.hidden = false;
  }

  document.getElementById('grantCancel').addEventListener('click', () => {
    grantModal.hidden = true;
  });

  document.getElementById('grantConfirm').addEventListener('click', async () => {
    const course_id = grantCourseSelect.value;
    if (!course_id || !grantUserId) return;
    try {
      await api('/admin/students/grant', {
        method: 'POST',
        body: JSON.stringify({ user_id: grantUserId, course_id }),
      });
      grantModal.hidden = true;
      loadStudents();
      alert('Curso atribuído.');
    } catch (err) {
      alert(err.message);
    }
  });

  function openRevoke(userId, label) {
    revokeUserId = userId;
    revokeStudentLabel.textContent = label;
    const student = studentsCache.find((s) => s.id === userId);
    const courses = (student && student.courses) || [];
    revokeCourseSelect.innerHTML =
      courses.map((c) => `<option value="${c.course_id}">${esc(c.title_pt)}</option>`).join('') ||
      '<option value="">— sem cursos activos —</option>';
    revokeModal.hidden = false;
  }

  document.getElementById('revokeCancel').addEventListener('click', () => {
    revokeModal.hidden = true;
  });

  document.getElementById('revokeConfirm').addEventListener('click', async () => {
    const course_id = revokeCourseSelect.value;
    if (!course_id || !revokeUserId) return;
    if (!confirm('Revogar o acesso a este curso?')) return;
    try {
      await api('/admin/students/revoke', {
        method: 'POST',
        body: JSON.stringify({ user_id: revokeUserId, course_id }),
      });
      revokeModal.hidden = true;
      loadStudents();
      alert('Acesso revogado.');
    } catch (err) {
      alert(err.message);
    }
  });

  function openEditStudent(id) {
    const s = studentsCache.find((x) => x.id === id);
    if (!s || !editStudentModal) return;
    document.getElementById('editStudentId').value = s.id;
    document.getElementById('editStudentEmail').textContent = s.email || '';
    document.getElementById('editStudentName').value = s.name || '';
    document.getElementById('editStudentPhone').value = s.phone || '';
    document.getElementById('editStudentStatus').value = s.status || 'pending';
    const histEl = document.getElementById('editStudentHistory');
    const history = s.course_history || [];
    if (histEl) {
      histEl.innerHTML = history.length
        ? '<strong style="color:inherit">Histórico de cursos</strong><ul style="margin:0.35rem 0 0;padding-left:1.1rem">' +
          history
            .map(
              (h) =>
                `<li>${esc(h.title_pt)} — <em>${esc(h.status)}</em>${h.granted_at ? ' · ' + String(h.granted_at).slice(0, 10) : ''}</li>`
            )
            .join('') +
          '</ul>'
        : '<span>Sem histórico de cursos.</span>';
    }
    editStudentModal.hidden = false;
  }

  const editStudentCancel = document.getElementById('editStudentCancel');
  if (editStudentCancel) {
    editStudentCancel.addEventListener('click', () => {
      editStudentModal.hidden = true;
    });
  }

  if (editStudentForm) {
    editStudentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editStudentId').value;
      const name = document.getElementById('editStudentName').value;
      const phone = document.getElementById('editStudentPhone').value;
      const status = document.getElementById('editStudentStatus').value;
      try {
        await api('/admin/students/update', {
          method: 'POST',
          body: JSON.stringify({ id, name, phone, status }),
        });
        editStudentModal.hidden = true;
        loadStudents();
        alert('Aluno actualizado.');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  async function deleteStudent(id, label) {
    if (!confirm(`Eliminar permanentemente o aluno «${label}»? Esta acção não se pode desfazer.`)) return;
    try {
      await api('/admin/students/delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      loadStudents();
      alert('Aluno eliminado.');
    } catch (err) {
      alert(err.message);
    }
  }


  // ==================== Contact messages ====================

  const messagesList = document.getElementById('messagesList');
  const messageSearch = document.getElementById('messageSearch');
  const messageStatusFilter = document.getElementById('messageStatusFilter');
  const messagesCount = document.getElementById('messagesCount');
  let messagesCache = [];

  async function loadMessages() {
    if (!messagesList) return;
    messagesList.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const status = messageStatusFilter ? messageStatusFilter.value : 'new';
      const q = messageSearch ? messageSearch.value.trim() : '';
      let path = '/admin/messages?limit=200';
      if (status) path += '&status=' + encodeURIComponent(status);
      if (q) path += '&q=' + encodeURIComponent(q);
      const data = await api(path);
      messagesCache = (data && data.messages) || [];
      renderMessages();
      loadSummary();
    } catch (err) {
      messagesList.innerHTML = '<p class="error">' + esc(err.message) + '</p>';
    }
  }

  function renderMessages() {
    if (!messagesList) return;
    if (messagesCount) {
      messagesCount.textContent = messagesCache.length
        ? messagesCache.length + ' mensagem' + (messagesCache.length === 1 ? '' : 's')
        : 'Nenhuma mensagem';
    }
    if (!messagesCache.length) {
      messagesList.innerHTML = '<p class="muted empty-state">Sem mensagens neste filtro.</p>';
      return;
    }
        messagesList.innerHTML = messagesCache
      .map((m) => {
        const statusChip =
          m.status === 'done'
            ? '<span class="chip chip-done">Concluída</span>'
            : m.status === 'read'
              ? '<span class="chip chip-pending">Lida</span>'
              : '<span class="chip chip-pending">Nova</span>';
        return (
          '<article class="enrollment-card" data-id="' +
          esc(m.id) +
          '">' +
          '<div class="enrollment-card-head">' +
          '<div>' +
          '<h3>' +
          esc(m.name || '—') +
          '</h3>' +
          '<div class="enrollment-meta">' +
          statusChip +
          (m.subject ? ' <span>' + esc(m.subject) + '</span>' : '') +
          '</div>' +
          '</div>' +
          '<div class="enrollment-actions">' +
          (m.status === 'new'
            ? '<button type="button" class="btn btn-sm btn-outline" data-msg-status="read">Marcar lida</button>'
            : '') +
          (m.status !== 'done'
            ? '<button type="button" class="btn btn-sm" data-msg-status="done">Concluir</button>'
            : '') +
          (m.status === 'done'
            ? '<button type="button" class="btn btn-sm btn-outline" data-msg-status="new">Reabrir</button>'
            : '') +
          '<button type="button" class="btn btn-sm btn-danger" data-msg-delete>Apagar</button>' +
          '</div>' +
          '</div>' +
          '<dl class="enrollment-details">' +
          (m.email ? '<div><dt>Email</dt><dd>' + esc(m.email) + '</dd></div>' : '') +
          (m.phone ? '<div><dt>Telefone</dt><dd>' + esc(m.phone) + '</dd></div>' : '') +
          '<div><dt>Mensagem</dt><dd>' + esc(m.message || '') + '</dd></div>' +
          '<div><dt>Recebido</dt><dd>' + esc(m.created_at || '') + '</dd></div>' +
          '</dl>' +
          '</article>'
        );
      })
      .join('');
  }

  if (document.getElementById('refreshMessages')) {
    document.getElementById('refreshMessages').addEventListener('click', loadMessages);
  }
  if (messageStatusFilter) messageStatusFilter.addEventListener('change', loadMessages);
  if (messageSearch) {
    let msgTmr;
    messageSearch.addEventListener('input', () => {
      clearTimeout(msgTmr);
      msgTmr = setTimeout(loadMessages, 280);
    });
  }
  if (messagesList) {
    messagesList.addEventListener('click', async (ev) => {
      const card = ev.target.closest('[data-id]');
      if (!card) return;
      const id = card.getAttribute('data-id');
      if (ev.target.closest('[data-msg-delete]')) {
        if (!confirm('Apagar esta mensagem?')) return;
        try {
          await api('/admin/messages/delete', { method: 'POST', body: JSON.stringify({ id }) });
          loadMessages();
        } catch (err) {
          alert(err.message || 'Erro ao apagar');
        }
        return;
      }
      const statusBtn = ev.target.closest('[data-msg-status]');
      if (statusBtn) {
        const status = statusBtn.getAttribute('data-msg-status');
        try {
          await api('/admin/messages/status', {
            method: 'POST',
            body: JSON.stringify({ id, status }),
          });
          loadMessages();
        } catch (err) {
          alert(err.message || 'Erro ao actualizar');
        }
      }
    });
  }

  // ==================== Courses ====================

  function fillCourseSelect() {
    const active = coursesCache.filter((c) => c.active !== 0);
    const current = videoCourseSelect.value;
    videoCourseSelect.innerHTML =
      '<option value="">— escolha um curso —</option>' +
      active.map((c) => `<option value="${c.id}">${esc(c.title_pt)}</option>`).join('');
    if (current) videoCourseSelect.value = current;
  }

  async function loadCourses() {
    coursesAdmin.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const data = await api('/admin/courses');
      coursesCache = data.courses || [];
      fillCourseSelect();
      const activeCourses = coursesCache.filter((c) => c.active !== 0);
      const deletedCourses = coursesCache.filter((c) => c.active === 0);

      if (!activeCourses.length && !deletedCourses.length) {
        coursesAdmin.innerHTML = '<div class="empty-state">Nenhum curso criado. Use o formulário abaixo.</div>';
        return;
      }

      let html = '';

      if (activeCourses.length) {
        html += activeCourses
          .map((c) => {
            const videos = (c.videos || []).filter((v) => v.active !== 0);
            const deletedVideos = (c.videos || []).filter((v) => v.active === 0);
            return `
          <div class="course-block">
            <div class="course-block-head">
              <div>
                <h4>
                  ${esc(c.title_pt)}
                  <span class="course-id">${esc(c.id)}</span>
                </h4>
                ${c.description_pt ? `<p class="muted">${esc(c.description_pt)}</p>` : ''}
              </div>
              <div class="course-actions">
                <button type="button" class="btn btn-sm btn-outline" data-edit-course="${c.id}">Editar</button>
                <button type="button" class="btn btn-sm btn-danger" data-del-course="${c.id}">Eliminar</button>
              </div>
            </div>
            ${
              videos.length
                ? videos
                    .map(
                      (v) => `
              <div class="video-row">
                <div class="video-row-info">
                  <span>${esc(v.title_pt)}</span>
                  <code>${esc(v.cloudinary_public_id)}</code>
                </div>
                <div class="video-row-actions">
                  <button type="button" class="btn btn-sm btn-outline" data-edit-video="${v.id}" data-course="${c.id}">Editar</button>
                  <button type="button" class="btn btn-sm btn-danger" data-del-video="${v.id}">Eliminar</button>
                </div>
              </div>`
                    )
                    .join('')
                : '<p class="muted" style="margin:0.5rem 0 0">Sem vídeos</p>'
            }
            ${
              deletedVideos.length
                ? `<div class="deleted-videos">
                    <p class="muted" style="margin:0.6rem 0 0.35rem;font-size:0.8rem">Vídeos eliminados</p>
                    ${deletedVideos
                      .map(
                        (v) => `
                    <div class="video-row is-inactive">
                      <div class="video-row-info">
                        <span>${esc(v.title_pt)}</span>
                        <code>${esc(v.cloudinary_public_id)}</code>
                      </div>
                      <div class="video-row-actions">
                        <button type="button" class="btn btn-sm btn-outline" data-restore-video="${v.id}">Restaurar</button>
                        <button type="button" class="btn btn-sm btn-danger" data-purge-video="${v.id}">Apagar p/sempre</button>
                      </div>
                    </div>`
                      )
                      .join('')}
                  </div>`
                : ''
            }
          </div>`;
          })
          .join('');
      } else {
        html += '<div class="empty-state">Nenhum curso activo. Use o formulário abaixo ou restaure um eliminado.</div>';
      }

      if (deletedCourses.length) {
        html += '<h3 class="deleted-section-title">Cursos eliminados</h3>';
        html += deletedCourses
          .map(
            (c) => `
          <div class="course-block is-inactive">
            <div class="course-block-head">
              <div>
                <h4>
                  ${esc(c.title_pt)}
                  <span class="badge suspended">inactivo</span>
                  <span class="course-id">${esc(c.id)}</span>
                </h4>
                ${c.description_pt ? `<p class="muted">${esc(c.description_pt)}</p>` : ''}
              </div>
              <div class="course-actions">
                <button type="button" class="btn btn-sm btn-outline" data-restore-course="${c.id}">Restaurar</button>
                <button type="button" class="btn btn-sm btn-danger" data-purge-course="${c.id}">Apagar p/sempre</button>
              </div>
            </div>
          </div>`
          )
          .join('');
      }

      coursesAdmin.innerHTML = html;

      coursesAdmin.querySelectorAll('[data-edit-course]').forEach((btn) => {
        btn.addEventListener('click', () => startEditCourse(btn.dataset.editCourse));
      });
      coursesAdmin.querySelectorAll('[data-del-course]').forEach((btn) => {
        btn.addEventListener('click', () => deleteCourse(btn.dataset.delCourse, false));
      });
      coursesAdmin.querySelectorAll('[data-restore-course]').forEach((btn) => {
        btn.addEventListener('click', () => restoreCourse(btn.dataset.restoreCourse));
      });
      coursesAdmin.querySelectorAll('[data-purge-course]').forEach((btn) => {
        btn.addEventListener('click', () => deleteCourse(btn.dataset.purgeCourse, true));
      });
      coursesAdmin.querySelectorAll('[data-edit-video]').forEach((btn) => {
        btn.addEventListener('click', () => startEditVideo(btn.dataset.editVideo, btn.dataset.course));
      });
      coursesAdmin.querySelectorAll('[data-del-video]').forEach((btn) => {
        btn.addEventListener('click', () => deleteVideo(btn.dataset.delVideo, false));
      });
      coursesAdmin.querySelectorAll('[data-restore-video]').forEach((btn) => {
        btn.addEventListener('click', () => restoreVideo(btn.dataset.restoreVideo));
      });
      coursesAdmin.querySelectorAll('[data-purge-video]').forEach((btn) => {
        btn.addEventListener('click', () => deleteVideo(btn.dataset.purgeVideo, true));
      });
    } catch (err) {
      coursesAdmin.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  document.getElementById('refreshCourses').addEventListener('click', loadCourses);

  // —— Course form ——
  const courseForm = document.getElementById('courseForm');
  const courseIdField = document.getElementById('courseIdField');
  const courseFormTitle = document.getElementById('courseFormTitle');
  const courseSubmitBtn = document.getElementById('courseSubmitBtn');
  const courseCancelEdit = document.getElementById('courseCancelEdit');

  function resetCourseForm() {
    courseForm.reset();
    courseIdField.value = '';
    courseFormTitle.textContent = 'Novo curso';
    courseSubmitBtn.textContent = 'Guardar curso';
    courseCancelEdit.hidden = true;
    const statusEl = document.getElementById('coverUploadStatus');
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.className = 'hint';
    }
  }

  function startEditCourse(id) {
    const c = coursesCache.find((x) => x.id === id);
    if (!c) return;
    courseIdField.value = c.id;
    courseForm.elements.title_pt.value = c.title_pt || '';
    courseForm.elements.title_en.value = c.title_en || '';
    courseForm.elements.description_pt.value = c.description_pt || '';
    courseForm.elements.cover_url.value = c.cover_url || '';
    courseFormTitle.textContent = 'Editar curso';
    courseSubmitBtn.textContent = 'Actualizar curso';
    courseCancelEdit.hidden = false;
    courseForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  courseCancelEdit.addEventListener('click', resetCourseForm);

  const courseCoverFile = document.getElementById('courseCoverFile');
  const courseCoverUrl = document.getElementById('courseCoverUrl') || courseForm.elements.cover_url;
  const coverUploadStatus = document.getElementById('coverUploadStatus');

  async function uploadCoverToCloudinary(file) {
    if (coverUploadStatus) {
      coverUploadStatus.hidden = false;
      coverUploadStatus.textContent = 'A obter assinatura…';
      coverUploadStatus.className = 'hint';
    }
    const slug = (file.name || 'cover')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40);
    const sign = await api('/admin/cloudinary/sign', {
      method: 'POST',
      body: JSON.stringify({
        resource_type: 'image',
        slug: 'cover-' + slug + '-' + Date.now().toString(36),
      }),
    });

    if (coverUploadStatus) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      coverUploadStatus.textContent = `A enviar capa (${mb} MB)…`;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sign.api_key);
    form.append('timestamp', String(sign.timestamp));
    form.append('signature', sign.signature);
    form.append('public_id', sign.public_id);

    let res;
    try {
      res = await fetch(sign.upload_url, { method: 'POST', body: form });
    } catch (netErr) {
      throw new Error(
        'Falha de rede ao enviar a imagem. Verifique a ligação ou use um ficheiro mais pequeno.'
      );
    }
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (result && result.error && result.error.message) ||
        result.message ||
        'Upload da capa falhou (HTTP ' + res.status + ')';
      throw new Error(msg);
    }
    // Prefer secure_url from Cloudinary response
    const url =
      result.secure_url ||
      result.url ||
      (sign.cloud_name && result.public_id
        ? `https://res.cloudinary.com/${sign.cloud_name}/image/upload/${result.public_id}`
        : null);
    if (!url) throw new Error('Cloudinary não devolveu URL da imagem.');

    if (coverUploadStatus) {
      coverUploadStatus.textContent = 'Capa enviada.';
      coverUploadStatus.className = 'hint success-hint';
    }
    return url;
  }

  courseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(courseForm);
    let coverUrl = (fd.get('cover_url') || '').trim() || null;
    const file = courseCoverFile && courseCoverFile.files && courseCoverFile.files[0];

    courseSubmitBtn.disabled = true;
    try {
      if (file) {
        coverUrl = await uploadCoverToCloudinary(file);
        if (courseCoverUrl) courseCoverUrl.value = coverUrl;
      }
      const payload = {
        title_pt: fd.get('title_pt'),
        title_en: fd.get('title_en') || null,
        description_pt: fd.get('description_pt') || null,
        cover_url: coverUrl,
      };
      const id = fd.get('id');
      if (id) payload.id = id;
      await api('/admin/courses', { method: 'POST', body: JSON.stringify(payload) });
      resetCourseForm();
      loadCourses();
      alert(id ? 'Curso actualizado.' : 'Curso guardado.');
    } catch (err) {
      if (coverUploadStatus) {
        coverUploadStatus.hidden = false;
        coverUploadStatus.textContent = err.message;
        coverUploadStatus.className = 'hint error-hint';
      }
      alert(err.message);
    } finally {
      courseSubmitBtn.disabled = false;
    }
  });

  async function deleteCourse(id, permanent) {
    if (permanent) {
      if (!confirm('Apagar este curso PARA SEMPRE? Remove o curso, vídeos e atribuições da base de dados. Não se pode desfazer.')) return;
    } else {
      if (!confirm('Eliminar este curso? Os alunos deixam de o ver. Pode restaurar depois.')) return;
    }
    try {
      await api('/admin/courses/delete', {
        method: 'POST',
        body: JSON.stringify({ id, permanent: !!permanent }),
      });
      loadCourses();
      alert(permanent ? 'Curso apagado permanentemente.' : 'Curso eliminado (pode restaurar).');
    } catch (err) {
      alert(err.message);
    }
  }

  async function restoreCourse(id) {
    try {
      await api('/admin/courses/restore', { method: 'POST', body: JSON.stringify({ id }) });
      loadCourses();
      alert('Curso restaurado.');
    } catch (err) {
      alert(err.message);
    }
  }

  // —— Video form ——
  const videoForm = document.getElementById('videoForm');
  const videoIdField = document.getElementById('videoIdField');
  const videoFormTitle = document.getElementById('videoFormTitle');
  const videoSubmitBtn = document.getElementById('videoSubmitBtn');
  const videoCancelEdit = document.getElementById('videoCancelEdit');
  const videoFileInput = document.getElementById('videoFileInput');
  const videoPublicId = document.getElementById('videoPublicId');

  function resetVideoForm() {
    videoForm.reset();
    videoIdField.value = '';
    videoFormTitle.textContent = 'Novo vídeo';
    videoSubmitBtn.textContent = 'Guardar vídeo';
    videoCancelEdit.hidden = true;
    if (uploadStatus) {
      uploadStatus.hidden = true;
      uploadStatus.textContent = '';
    }
    fillCourseSelect();
  }

  function startEditVideo(videoId, courseId) {
    const course = coursesCache.find((c) => c.id === courseId);
    const v = course && (course.videos || []).find((x) => x.id === videoId);
    if (!v) return;
    fillCourseSelect();
    videoIdField.value = v.id;
    videoCourseSelect.value = courseId;
    videoForm.elements.title_pt.value = v.title_pt || '';
    videoPublicId.value = v.cloudinary_public_id || '';
    videoForm.elements.duration_seconds.value = v.duration_seconds || '';
    videoFormTitle.textContent = 'Editar vídeo';
    videoSubmitBtn.textContent = 'Actualizar vídeo';
    videoCancelEdit.hidden = false;
    videoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  videoCancelEdit.addEventListener('click', resetVideoForm);

  async function uploadVideoToCloudinary(file) {
    if (uploadStatus) {
      uploadStatus.hidden = false;
      uploadStatus.textContent = 'A obter assinatura…';
      uploadStatus.className = 'hint';
    }
    const slug = (file.name || 'video')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40);
    const sign = await api('/admin/cloudinary/sign', {
      method: 'POST',
      body: JSON.stringify({ slug: slug + '-' + Date.now().toString(36) }),
    });

    if (uploadStatus) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      uploadStatus.textContent = `A enviar vídeo (${mb} MB) para o Cloudinary… (pode demorar)`;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sign.api_key);
    form.append('timestamp', String(sign.timestamp));
    form.append('signature', sign.signature);
    form.append('public_id', sign.public_id);
    form.append('type', sign.type);

    let res;
    try {
      res = await fetch(sign.upload_url, { method: 'POST', body: form });
    } catch (netErr) {
      throw new Error(
        'Falha de rede ao contactar o Cloudinary (Failed to fetch). ' +
          'Verifique a ligação, tente um ficheiro mais pequeno, ou faça upload no painel Cloudinary e cole o public_id.'
      );
    }
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (result && result.error && result.error.message) ||
        result.message ||
        'Upload Cloudinary falhou (HTTP ' + res.status + ')';
      throw new Error(msg);
    }
    const publicId = result.public_id || sign.public_id;
    // Cloudinary returns duration in seconds (float) for video resources
    let duration = null;
    if (typeof result.duration === 'number' && result.duration > 0) {
      duration = Math.round(result.duration);
    }
    if (uploadStatus) {
      uploadStatus.textContent =
        'Upload concluído: ' + publicId + (duration ? ' · ' + duration + 's' : '');
      uploadStatus.className = 'hint success-hint';
    }
    return { public_id: publicId, duration_seconds: duration };
  }

  videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(videoForm);
    const course_id = fd.get('course_id');
    const title_pt = fd.get('title_pt');
    let publicId = (fd.get('cloudinary_public_id') || '').trim();
    let durationSeconds = fd.get('duration_seconds') ? Number(fd.get('duration_seconds')) : null;
    const file = videoFileInput.files && videoFileInput.files[0];

    if (!course_id) {
      alert('Escolha um curso.');
      return;
    }

    videoSubmitBtn.disabled = true;
    try {
      if (file) {
        const uploaded = await uploadVideoToCloudinary(file);
        publicId = uploaded.public_id;
        videoPublicId.value = publicId;
        if (uploaded.duration_seconds) {
          durationSeconds = uploaded.duration_seconds;
          if (videoForm.elements.duration_seconds) {
            videoForm.elements.duration_seconds.value = String(durationSeconds);
          }
        }
      }
      if (!publicId) {
        alert('Faça upload de um ficheiro ou indique o Cloudinary public_id.');
        return;
      }
      const payload = {
        course_id,
        title_pt,
        cloudinary_public_id: publicId,
        duration_seconds: durationSeconds || null,
      };
      const id = fd.get('id');
      if (id) payload.id = id;
      await api('/admin/videos', { method: 'POST', body: JSON.stringify(payload) });
      resetVideoForm();
      loadCourses();
      alert(id ? 'Vídeo actualizado.' : 'Vídeo guardado.');
    } catch (err) {
      if (uploadStatus) {
        uploadStatus.hidden = false;
        uploadStatus.textContent = err.message;
        uploadStatus.className = 'hint error-hint';
      }
      alert(err.message);
    } finally {
      videoSubmitBtn.disabled = false;
    }
  });

  async function deleteVideo(id, permanent) {
    if (permanent) {
      if (!confirm('Apagar este vídeo PARA SEMPRE da base de dados? Não se pode desfazer.')) return;
    } else {
      if (!confirm('Eliminar este vídeo? Deixa de aparecer aos alunos. Pode restaurar depois.')) return;
    }
    try {
      await api('/admin/videos/delete', {
        method: 'POST',
        body: JSON.stringify({ id, permanent: !!permanent }),
      });
      loadCourses();
      alert(permanent ? 'Vídeo apagado permanentemente.' : 'Vídeo eliminado (pode restaurar).');
    } catch (err) {
      alert(err.message);
    }
  }

  async function restoreVideo(id) {
    try {
      await api('/admin/videos/restore', { method: 'POST', body: JSON.stringify({ id }) });
      loadCourses();
      alert('Vídeo restaurado.');
    } catch (err) {
      alert(err.message);
    }
  }

  // ==================== Inscrições ====================

  const enrollmentsList = document.getElementById('enrollmentsList');
  const enrollmentsCount = document.getElementById('enrollmentsCount');
  const enrollmentStatusFilter = document.getElementById('enrollmentStatusFilter');
  let enrollmentsCache = [];

  const PAY_LABELS = {
    referencia: 'Referência Multicaixa',
    iban: 'Transferência IBAN',
    express: 'Multicaixa Express',
  };

  function formatKz(n) {
    const v = Number(n) || 0;
    if (v === 0) return 'Grátis';
    return v.toLocaleString('pt-AO') + ' Kz';
  }

  function phoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function whatsappHref(phone, name, course) {
    let digits = phoneDigits(phone);
    if (!digits) return '';
    if (digits.length === 9) digits = '244' + digits;
    const text =
      'Olá' +
      (name ? ' ' + name : '') +
      ', sou da Academia Semente. Sobre a sua inscrição' +
      (course ? ' no curso ' + course : '') +
      '…';
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text);
  }

  const enrollmentSearch = document.getElementById('enrollmentSearch');
  let enrollSearchTimer = null;

  async function loadEnrollments() {
    if (!enrollmentsList) return;
    enrollmentsList.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const status = enrollmentStatusFilter ? enrollmentStatusFilter.value : 'pending';
      const qText = enrollmentSearch ? enrollmentSearch.value.trim() : '';
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (qText) params.set('q', qText);
      const qs = params.toString() ? '?' + params.toString() : '';
      const data = await api('/admin/enrollments' + qs);
      enrollmentsCache = data.enrollments || [];
      renderEnrollments();
      loadSummary();
    } catch (err) {
      enrollmentsList.innerHTML = '<p class="error">' + esc(err.message) + '</p>';
    }
  }

  function renderEnrollments() {
    if (!enrollmentsList) return;
    if (enrollmentsCount) {
      enrollmentsCount.textContent = enrollmentsCache.length
        ? enrollmentsCache.length + ' inscrição(ões)'
        : 'Nenhuma inscrição neste filtro.';
    }
    if (!enrollmentsCache.length) {
      enrollmentsList.innerHTML =
        '<div class="empty-state">Nenhuma inscrição. Quando alguém preencher o formulário em inscricao.html, aparece aqui.</div>';
      return;
    }

    enrollmentsList.innerHTML = enrollmentsCache
      .map((e) => {
        const wa = whatsappHref(e.phone, e.name, e.course);
        const pay = PAY_LABELS[e.payment_method] || e.payment_method || '—';
        const statusChip =
          e.status === 'done'
            ? '<span class="chip chip-done">Concluída</span>'
            : '<span class="chip chip-pending">Pendente</span>';
        return (
          '<article class="enrollment-card" data-id="' +
          esc(e.id) +
          '">' +
          '<div class="enrollment-card-head">' +
          '<div>' +
          '<h3>' +
          esc(e.name) +
          '</h3>' +
          '<div class="enrollment-meta">' +
          statusChip +
          ' <span>' +
          esc(e.course || '') +
          '</span> · <strong>' +
          formatKz(e.amount_kz) +
          '</strong> · ' +
          esc(pay) +
          '</div>' +
          '</div>' +
          '<div class="enrollment-actions">' +
          (e.status !== 'done'
            ? '<button type="button" class="btn btn-sm" data-enroll-done="' +
              esc(e.id) +
              '">Concluir</button>'
            : '') +
          (wa
            ? '<a class="btn btn-sm btn-outline" href="' +
              esc(wa) +
              '" target="_blank" rel="noopener">WhatsApp</a>'
            : '') +
          '<button type="button" class="btn btn-sm btn-danger" data-enroll-del="' +
          esc(e.id) +
          '">Apagar</button>' +
          '</div>' +
          '</div>' +
          '<dl class="enrollment-details">' +
          row('Email', e.email) +
          row('Telefone', e.phone) +
          row('Idade', e.age) +
          row('Estado civil', e.marital) +
          row('Morada', e.address) +
          row('Província', e.province) +
          row('Município', e.municipality) +
          row('Nível', e.level) +
          row('Horário', e.schedule) +
          row('Motivação', e.motivation) +
          row('Dificuldades', e.difficulties) +
          row('Experiência', e.experience) +
          row('Temas', e.topics) +
          row('Notas', e.notes) +
          row('Recebido', e.created_at) +
          '</dl>' +
          '</article>'
        );
      })
      .join('');
  }

  function row(label, value) {
    if (value == null || value === '') return '';
    return (
      '<div><dt>' +
      esc(label) +
      '</dt><dd>' +
      esc(String(value)) +
      '</dd></div>'
    );
  }

  if (document.getElementById('refreshEnrollments')) {
    document.getElementById('refreshEnrollments').addEventListener('click', loadEnrollments);
  }
  if (enrollmentStatusFilter) {
    enrollmentStatusFilter.addEventListener('change', loadEnrollments);
  }
  if (enrollmentSearch) {
    enrollmentSearch.addEventListener('input', () => {
      clearTimeout(enrollSearchTimer);
      enrollSearchTimer = setTimeout(loadEnrollments, 280);
    });
  }

  if (enrollmentsList) {
    enrollmentsList.addEventListener('click', async (ev) => {
      const doneBtn = ev.target.closest('[data-enroll-done]');
      const delBtn = ev.target.closest('[data-enroll-del]');
      if (doneBtn) {
        const id = doneBtn.getAttribute('data-enroll-done');
        try {
          await api('/admin/enrollments/done', {
            method: 'POST',
            body: JSON.stringify({ id }),
          });
          loadEnrollments();
        } catch (err) {
          alert(err.message);
        }
      }
      if (delBtn) {
        const id = delBtn.getAttribute('data-enroll-del');
        if (!confirm('Apagar esta inscrição permanentemente?')) return;
        try {
          await api('/admin/enrollments/delete', {
            method: 'POST',
            body: JSON.stringify({ id }),
          });
          loadEnrollments();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }

  // ==================== Encomendas ====================

  const ordersList = document.getElementById('ordersList');
  const ordersCount = document.getElementById('ordersCount');
  const orderStatusFilter = document.getElementById('orderStatusFilter');
  const orderSearch = document.getElementById('orderSearch');
  let ordersCache = [];
  let orderSearchTimer = null;

  async function loadOrders() {
    if (!ordersList) return;
    ordersList.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const status = orderStatusFilter ? orderStatusFilter.value : 'pending';
      const qText = orderSearch ? orderSearch.value.trim() : '';
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (qText) params.set('q', qText);
      const qs = params.toString() ? '?' + params.toString() : '';
      const data = await api('/admin/orders' + qs);
      ordersCache = data.orders || [];
      renderOrders();
      loadSummary();
    } catch (err) {
      ordersList.innerHTML = '<p class="error">' + esc(err.message) + '</p>';
    }
  }

  function renderOrders() {
    if (!ordersList) return;
    if (ordersCount) {
      ordersCount.textContent = ordersCache.length
        ? ordersCache.length + ' encomenda(s)'
        : 'Nenhuma encomenda neste filtro.';
    }
    if (!ordersCache.length) {
      ordersList.innerHTML =
        '<div class="empty-state">Nenhuma encomenda. Quando alguém concluir o checkout, aparece aqui.</div>';
      return;
    }

    ordersList.innerHTML = ordersCache
      .map((o) => {
        const wa = whatsappHref(o.phone, o.name, 'encomenda de produtos');
        const pay = PAY_LABELS[o.payment_method] || o.payment_method || '—';
        const statusChip =
          o.status === 'done'
            ? '<span class="chip chip-done">Concluída</span>'
            : '<span class="chip chip-pending">Pendente</span>';
        const items = Array.isArray(o.items) ? o.items : [];
        const itemsHtml = items
          .map(
            (it) =>
              '<li>' +
              esc(it.name || it.id) +
              ' × ' +
              esc(String(it.qty)) +
              ' — ' +
              formatKz(it.price * it.qty) +
              '</li>'
          )
          .join('');

        return (
          '<article class="enrollment-card" data-id="' +
          esc(o.id) +
          '">' +
          '<div class="enrollment-card-head">' +
          '<div>' +
          '<h3>' +
          esc(o.name) +
          '</h3>' +
          '<div class="enrollment-meta">' +
          statusChip +
          ' <strong>' +
          formatKz(o.total_kz) +
          '</strong> · ' +
          esc(pay) +
          '</div>' +
          '</div>' +
          '<div class="enrollment-actions">' +
          (o.status !== 'done'
            ? '<button type="button" class="btn btn-sm" data-order-done="' +
              esc(o.id) +
              '">Concluir</button>'
            : '') +
          (wa
            ? '<a class="btn btn-sm btn-outline" href="' +
              esc(wa) +
              '" target="_blank" rel="noopener">WhatsApp</a>'
            : '') +
          '<button type="button" class="btn btn-sm btn-danger" data-order-del="' +
          esc(o.id) +
          '">Apagar</button>' +
          '</div>' +
          '</div>' +
          '<ul class="order-items-list">' +
          itemsHtml +
          '</ul>' +
          '<dl class="enrollment-details">' +
          row('Telefone', o.phone) +
          row('Email', o.email) +
          row('Morada', o.address) +
          row('Província', o.province) +
          row('Município', o.municipality) +
          row('Notas', o.notes) +
          row('Recebido', o.created_at) +
          '</dl>' +
          '</article>'
        );
      })
      .join('');
  }

  if (document.getElementById('refreshOrders')) {
    document.getElementById('refreshOrders').addEventListener('click', loadOrders);
  }
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener('change', loadOrders);
  }
  if (orderSearch) {
    orderSearch.addEventListener('input', () => {
      clearTimeout(orderSearchTimer);
      orderSearchTimer = setTimeout(loadOrders, 280);
    });
  }

  if (ordersList) {
    ordersList.addEventListener('click', async (ev) => {
      const doneBtn = ev.target.closest('[data-order-done]');
      const delBtn = ev.target.closest('[data-order-del]');
      if (doneBtn) {
        const id = doneBtn.getAttribute('data-order-done');
        try {
          await api('/admin/orders/done', {
            method: 'POST',
            body: JSON.stringify({ id }),
          });
          loadOrders();
        } catch (err) {
          alert(err.message);
        }
      }
      if (delBtn) {
        const id = delBtn.getAttribute('data-order-del');
        if (!confirm('Apagar esta encomenda permanentemente?')) return;
        try {
          await api('/admin/orders/delete', {
            method: 'POST',
            body: JSON.stringify({ id }),
          });
          loadOrders();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }


  // ==================== Admin notifications ====================

  function populateNotifyUsers() {
    const sel = document.getElementById('notifyUserSelect');
    if (!sel) return;
    const current = sel.value;
    const opts = ['<option value="">— escolha —</option>'];
    (studentsCache || []).forEach((s) => {
      const label = (s.name || s.email || s.id) + (s.status ? ' · ' + s.status : '');
      opts.push('<option value="' + esc(s.id) + '">' + esc(label) + '</option>');
    });
    sel.innerHTML = opts.join('');
    if (current) sel.value = current;
  }

  const notifyOneForm = document.getElementById('notifyOneForm');
  if (notifyOneForm) {
    notifyOneForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('notifyOneStatus');
      const user_id = document.getElementById('notifyUserSelect').value;
      const title = document.getElementById('notifyOneTitle').value.trim();
      const body = document.getElementById('notifyOneBody').value.trim();
      if (!user_id || !title) return;
      try {
        await api('/admin/notifications', {
          method: 'POST',
          body: JSON.stringify({ user_id, title, body }),
        });
        if (status) {
          status.hidden = false;
          status.className = 'hint success-hint';
          status.textContent = 'Aviso enviado.';
        }
        document.getElementById('notifyOneTitle').value = '';
        document.getElementById('notifyOneBody').value = '';
      } catch (err) {
        if (status) {
          status.hidden = false;
          status.className = 'hint error-hint';
          status.textContent = err.message || 'Erro ao enviar.';
        }
      }
    });
  }

  const notifyBroadcastForm = document.getElementById('notifyBroadcastForm');
  if (notifyBroadcastForm) {
    notifyBroadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('notifyBcStatus');
      const title = document.getElementById('notifyBcTitle').value.trim();
      const body = document.getElementById('notifyBcBody').value.trim();
      if (!title) return;
      if (!confirm('Enviar este aviso a todos os alunos activos?')) return;
      try {
        const data = await api('/admin/notifications/broadcast', {
          method: 'POST',
          body: JSON.stringify({ title, body, only_active: true }),
        });
        if (status) {
          status.hidden = false;
          status.className = 'hint success-hint';
          status.textContent = 'Enviado a ' + (data.sent || 0) + ' aluno(s).';
        }
        document.getElementById('notifyBcTitle').value = '';
        document.getElementById('notifyBcBody').value = '';
      } catch (err) {
        if (status) {
          status.hidden = false;
          status.className = 'hint error-hint';
          status.textContent = err.message || 'Erro no broadcast.';
        }
      }
    });
  }

  // —— Website CMS ——
  let siteCache = null;
  let siteSec = 'hero';

  function siteStatus(msg, ok) {
    const el = document.getElementById('websiteStatus');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className = 'hint ' + (ok ? 'success-hint' : 'error-hint');
  }

  function fieldPair(labelPt, labelEn, namePt, nameEn, valPt, valEn, rows) {
    const ta = !!rows;
    if (ta) {
      return (
        '<div class="bilingual">' +
        '<div><label>' + esc(labelPt) + '</label><textarea data-k="' + esc(namePt) + '" rows="' + rows + '">' + esc(valPt || '') + '</textarea></div>' +
        '<div><label>' + esc(labelEn) + '</label><textarea data-k="' + esc(nameEn) + '" rows="' + rows + '">' + esc(valEn || '') + '</textarea></div>' +
        '</div>'
      );
    }
    return (
      '<div class="bilingual">' +
      '<div><label>' + esc(labelPt) + '</label><input type="text" data-k="' + esc(namePt) + '" value="' + esc(valPt || '') + '"></div>' +
      '<div><label>' + esc(labelEn) + '</label><input type="text" data-k="' + esc(nameEn) + '" value="' + esc(valEn || '') + '"></div>' +
      '</div>'
    );
  }

  function imgField(label, key, url, keyAttr) {
    const attr = keyAttr || 'data-k';
    return (
      '<div><label>' + esc(label) + '</label>' +
      '<div class="img-row">' +
      (url
        ? '<img class="img-preview" src="' + esc(url) + '" alt="">'
        : '<div class="img-preview" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:#999">—</div>') +
      '<input type="url" ' + attr + '="' + esc(key) + '" value="' + esc(url || '') + '" placeholder="URL Cloudinary ou assets/…">' +
      '<label class="btn btn-outline" style="margin:0;cursor:pointer">Upload' +
      '<input type="file" accept="image/*" data-upload-target hidden></label></div></div>'
    );
  }

  function collectForm(root) {
    const data = {};
    root.querySelectorAll('[data-k]').forEach(function (el) {
      const k = el.getAttribute('data-k');
      if (k) data[k] = el.value;
    });
    return data;
  }

  async function uploadSiteImage(file, targetInput) {
    siteStatus('A enviar imagem…', true);
    const sign = await api('/admin/cloudinary/sign', {
      method: 'POST',
      body: JSON.stringify({
        resource_type: 'image',
        folder: 'site',
        slug: 'img-' + Date.now().toString(36),
      }),
    });
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', sign.api_key);
    fd.append('timestamp', sign.timestamp);
    fd.append('signature', sign.signature);
    fd.append('public_id', sign.public_id);
    const up = await fetch(sign.upload_url, { method: 'POST', body: fd });
    const result = await up.json();
    if (!up.ok) throw new Error((result.error && result.error.message) || 'Falha no upload Cloudinary');
    const url = result.secure_url || result.url;
    if (targetInput) {
      targetInput.value = url;
      const row = targetInput.closest('.img-row');
      if (row) {
        var img = row.querySelector('img.img-preview');
        if (!img) {
          img = document.createElement('img');
          img.className = 'img-preview';
          row.insertBefore(img, row.firstChild);
          var ph = row.querySelector('div.img-preview');
          if (ph) ph.remove();
        }
        img.src = url;
      }
    }
    siteStatus('Imagem enviada.', true);
    return url;
  }

  function wireUploads(editor) {
    editor.querySelectorAll('input[type="file"][data-upload-target]').forEach(function (inp) {
      inp.addEventListener('change', async function () {
        if (!inp.files || !inp.files[0]) return;
        var row = inp.closest('.img-row');
        var target = row && row.querySelector('input[type="url"]');
        try {
          await uploadSiteImage(inp.files[0], target);
        } catch (err) {
          siteStatus(err.message || 'Erro no upload', false);
        }
        inp.value = '';
      });
    });
  }

  function renderSiteSection() {
    const editor = document.getElementById('siteEditor');
    if (!editor || !siteCache) return;
    const s = siteCache[siteSec] || {};
    let html = '';

    if (siteSec === 'announce') {
      html += '<div class="form-section">';
      html += fieldPair('Texto PT', 'Texto EN', 'text_pt', 'text_en', s.text_pt, s.text_en);
      html += fieldPair('Destaque PT', 'Destaque EN', 'accent_pt', 'accent_en', s.accent_pt, s.accent_en);
      html += '</div>';
    }

    if (siteSec === 'hero') {
      html += '<div class="form-section">';
      html += fieldPair('Eyebrow PT', 'Eyebrow EN', 'eyebrow_pt', 'eyebrow_en', s.eyebrow_pt, s.eyebrow_en);
      html += fieldPair('Título PT (pode usar <br>)', 'Título EN', 'title_pt', 'title_en', s.title_pt, s.title_en, 2);
      html += fieldPair('Subtítulo PT', 'Subtítulo EN', 'subtitle_pt', 'subtitle_en', s.subtitle_pt, s.subtitle_en, 3);
      html += fieldPair('Botão 1 PT', 'Botão 1 EN', 'cta_pt', 'cta_en', s.cta_pt, s.cta_en);
      html += fieldPair('Botão 2 PT', 'Botão 2 EN', 'cta2_pt', 'cta2_en', s.cta2_pt, s.cta2_en);
      html += imgField('Imagem de fundo (Hero)', 'image_url', s.image_url);
      html += '</div>';
    }

    if (siteSec === 'about') {
      html += '<div class="form-section">';
      html += fieldPair('Eyebrow PT', 'Eyebrow EN', 'eyebrow_pt', 'eyebrow_en', s.eyebrow_pt, s.eyebrow_en);
      html += fieldPair('Título PT', 'Título EN', 'title_pt', 'title_en', s.title_pt, s.title_en, 2);
      html += fieldPair('Parágrafo 1 PT', 'Parágrafo 1 EN', 'p1_pt', 'p1_en', s.p1_pt, s.p1_en, 3);
      html += fieldPair('Parágrafo 2 PT', 'Parágrafo 2 EN', 'p2_pt', 'p2_en', s.p2_pt, s.p2_en, 3);
      html += fieldPair('Parágrafo 3 PT', 'Parágrafo 3 EN', 'p3_pt', 'p3_en', s.p3_pt, s.p3_en, 2);
      html += fieldPair('Missão título PT', 'Missão título EN', 'mission_title_pt', 'mission_title_en', s.mission_title_pt, s.mission_title_en);
      html += fieldPair('Missão PT', 'Missão EN', 'mission_pt', 'mission_en', s.mission_pt, s.mission_en, 2);
      html += fieldPair('Visão título PT', 'Visão título EN', 'vision_title_pt', 'vision_title_en', s.vision_title_pt, s.vision_title_en);
      html += fieldPair('Visão PT', 'Visão EN', 'vision_pt', 'vision_en', s.vision_pt, s.vision_en, 2);
      html += '<div class="bilingual"><div><label>Stat alunos (valor)</label><input type="text" data-k="stat_students" value="' + esc(s.stat_students || '') + '"></div>';
      html += '<div><label>Stat centros</label><input type="text" data-k="stat_centers" value="' + esc(s.stat_centers || '') + '"></div></div>';
      html += '<div class="bilingual"><div><label>Stat meses</label><input type="text" data-k="stat_months" value="' + esc(s.stat_months || '') + '"></div>';
      html += '<div><label>Stat IA</label><input type="text" data-k="stat_ai" value="' + esc(s.stat_ai || '') + '"></div></div>';
      html += fieldPair('Label alunos PT', 'Label alunos EN', 'stat_students_label_pt', 'stat_students_label_en', s.stat_students_label_pt, s.stat_students_label_en);
      html += imgField('Imagem Sobre', 'image_url', s.image_url);
      html += '</div>';
    }

    if (siteSec === 'courses') {
      html += '<div class="form-section">';
      html += fieldPair('Eyebrow PT', 'Eyebrow EN', 'eyebrow_pt', 'eyebrow_en', s.eyebrow_pt, s.eyebrow_en);
      html += fieldPair('Título PT', 'Título EN', 'title_pt', 'title_en', s.title_pt, s.title_en, 2);
      html += fieldPair('Descrição PT', 'Descrição EN', 'desc_pt', 'desc_en', s.desc_pt, s.desc_en, 2);
      html += fieldPair('Badge popular PT', 'Badge EN', 'popular_pt', 'popular_en', s.popular_pt, s.popular_en);
      html += fieldPair('Botão inscrição PT', 'Botão EN', 'enroll_btn_pt', 'enroll_btn_en', s.enroll_btn_pt, s.enroll_btn_en);
      html += fieldPair('Teste gratuito PT', 'Teste EN', 'free_test_pt', 'free_test_en', s.free_test_pt, s.free_test_en);
      html += fieldPair('Título horários PT', 'Título EN', 'schedules_title_pt', 'schedules_title_en', s.schedules_title_pt, s.schedules_title_en);
      html += '</div>';
      (s.modalities || []).forEach(function (m, i) {
        html += '<div class="modality-card" data-mod-i="' + i + '">';
        html += '<h4>' + esc(m.id || ('Modalidade ' + (i + 1))) + (m.featured ? ' · em destaque' : '') + '</h4>';
        html += '<input type="hidden" data-mod-k="id" value="' + esc(m.id || '') + '">';
        html += '<div class="bilingual"><div><label>Título PT</label><input type="text" data-mod-k="title_pt" value="' + esc(m.title_pt || '') + '"></div>';
        html += '<div><label>Título EN</label><input type="text" data-mod-k="title_en" value="' + esc(m.title_en || '') + '"></div></div>';
        html += '<div class="bilingual"><div><label>Tag PT</label><input type="text" data-mod-k="tag_pt" value="' + esc(m.tag_pt || '') + '"></div>';
        html += '<div><label>Tag EN</label><input type="text" data-mod-k="tag_en" value="' + esc(m.tag_en || '') + '"></div></div>';
        html += '<div class="bilingual"><div><label>Preço (Kz/mês)</label><input type="number" data-mod-k="price_kz" value="' + esc(String(m.price_kz != null ? m.price_kz : '')) + '"></div>';
        html += '<div><label>Destaque</label><select data-mod-k="featured"><option value="0"' + (!m.featured ? ' selected' : '') + '>Não</option><option value="1"' + (m.featured ? ' selected' : '') + '>Sim</option></select></div></div>';
        html += '<div class="features-list bilingual"><div><label>Features PT (1 por linha)</label><textarea data-mod-k="features_pt" rows="5">' + esc((m.features_pt || []).join('\n')) + '</textarea></div>';
        html += '<div><label>Features EN (1 por linha)</label><textarea data-mod-k="features_en" rows="5">' + esc((m.features_en || []).join('\n')) + '</textarea></div></div>';
        html += imgField('Ícone', 'icon_url', m.icon_url, 'data-mod-k');
        html += '</div>';
      });
      html += '<div class="form-section"><h4 style="margin:0 0 0.75rem;font-size:0.9375rem">Horários</h4>';
      (s.schedules || []).forEach(function (sch, i) {
        html += '<div class="bilingual" data-sch-i="' + i + '"><div><label>Hora</label><input type="text" data-sch-k="time" value="' + esc(sch.time || '') + '"></div>';
        html += '<div><label>Label PT</label><input type="text" data-sch-k="label_pt" value="' + esc(sch.label_pt || '') + '"></div>';
        html += '<div><label>Label EN</label><input type="text" data-sch-k="label_en" value="' + esc(sch.label_en || '') + '"></div></div>';
      });
      html += '</div>';
    }

    if (siteSec === 'products') {
      html += '<div class="form-section">';
      html += fieldPair('Eyebrow PT', 'Eyebrow EN', 'eyebrow_pt', 'eyebrow_en', s.eyebrow_pt, s.eyebrow_en);
      html += fieldPair('Título PT', 'Título EN', 'title_pt', 'title_en', s.title_pt, s.title_en, 2);
      html += fieldPair('Descrição PT', 'Descrição EN', 'desc_pt', 'desc_en', s.desc_pt, s.desc_en, 2);
      html += fieldPair('Botão PT', 'Botão EN', 'buy_btn_pt', 'buy_btn_en', s.buy_btn_pt, s.buy_btn_en);
      html += '</div>';
      (s.items || []).forEach(function (p, i) {
        html += '<div class="product-edit-card" data-prod-i="' + i + '">';
        html += '<h4>' + esc(p.name_pt || p.id || 'Produto') + '</h4>';
        html += '<input type="hidden" data-prod-k="id" value="' + esc(p.id || '') + '">';
        html += '<div class="bilingual"><div><label>Nome PT</label><input type="text" data-prod-k="name_pt" value="' + esc(p.name_pt || '') + '"></div>';
        html += '<div><label>Nome EN</label><input type="text" data-prod-k="name_en" value="' + esc(p.name_en || '') + '"></div></div>';
        html += '<div class="bilingual"><div><label>Desc PT</label><textarea data-prod-k="desc_pt" rows="2">' + esc(p.desc_pt || '') + '</textarea></div>';
        html += '<div><label>Desc EN</label><textarea data-prod-k="desc_en" rows="2">' + esc(p.desc_en || '') + '</textarea></div></div>';
        html += '<div><label>Preço (Kz)</label><input type="number" data-prod-k="price_kz" value="' + esc(String(p.price_kz != null ? p.price_kz : '')) + '"></div>';
        html += imgField('Imagem principal', 'image_url', p.image_url, 'data-prod-k');
        html += '</div>';
      });
    }

    if (siteSec === 'diff') {
      html += '<div class="form-section">';
      html += fieldPair('Eyebrow PT', 'Eyebrow EN', 'eyebrow_pt', 'eyebrow_en', s.eyebrow_pt, s.eyebrow_en);
      html += fieldPair('Título PT', 'Título EN', 'title_pt', 'title_en', s.title_pt, s.title_en, 2);
      html += imgField('Imagem de fundo', 'image_url', s.image_url);
      html += '</div>';
      (s.items || []).forEach(function (d, i) {
        html += '<div class="diff-edit-card" data-diff-i="' + i + '">';
        html += '<h4>Item ' + (i + 1) + '</h4>';
        html += '<div class="bilingual"><div><label>Título PT</label><input type="text" data-diff-k="title_pt" value="' + esc(d.title_pt || '') + '"></div>';
        html += '<div><label>Título EN</label><input type="text" data-diff-k="title_en" value="' + esc(d.title_en || '') + '"></div></div>';
        html += '<div class="bilingual"><div><label>Texto PT</label><textarea data-diff-k="text_pt" rows="2">' + esc(d.text_pt || '') + '</textarea></div>';
        html += '<div><label>Texto EN</label><textarea data-diff-k="text_en" rows="2">' + esc(d.text_en || '') + '</textarea></div></div>';
        html += imgField('Ícone', 'icon_url', d.icon_url, 'data-diff-k');
        html += '</div>';
      });
    }

    if (siteSec === 'contact') {
      html += '<div class="form-section">';
      html += fieldPair('Eyebrow PT', 'Eyebrow EN', 'eyebrow_pt', 'eyebrow_en', s.eyebrow_pt, s.eyebrow_en);
      html += fieldPair('Título PT', 'Título EN', 'title_pt', 'title_en', s.title_pt, s.title_en);
      html += fieldPair('Descrição PT', 'Descrição EN', 'desc_pt', 'desc_en', s.desc_pt, s.desc_en, 3);
      html += '<div><label>WhatsApp (só dígitos, ex: 244945574700)</label><input type="text" data-k="whatsapp" value="' + esc(s.whatsapp || '') + '"></div>';
      html += '<div><label>Email</label><input type="email" data-k="email" value="' + esc(s.email || '') + '"></div>';
      html += '<div><label>Morada</label><input type="text" data-k="address" value="' + esc(s.address || '') + '"></div>';
      html += '<div><label>Instagram URL</label><input type="url" data-k="instagram" value="' + esc(s.instagram || '') + '"></div>';
      html += '<div><label>Facebook URL</label><input type="url" data-k="facebook" value="' + esc(s.facebook || '') + '"></div>';
      html += imgField('Imagem de fundo Contacto', 'image_url', s.image_url);
      html += '</div>';
    }

    html += '<div class="save-bar"><button type="button" class="btn" id="siteSaveBtn">Guardar secção</button>' +
      '<span class="hint-inline">Grava só esta secção. O site público actualiza de imediato.</span></div>';

    editor.innerHTML = html;
    wireUploads(editor);
    var saveBtn = document.getElementById('siteSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveSiteSection);
  }

  function buildSectionPayload() {
    const editor = document.getElementById('siteEditor');
    const base = collectForm(editor);
    const prev = (siteCache && siteCache[siteSec]) || {};

    if (siteSec === 'courses') {
      const modalities = [];
      editor.querySelectorAll('.modality-card').forEach(function (card) {
        const m = {};
        card.querySelectorAll('[data-mod-k]').forEach(function (el) {
          const k = el.getAttribute('data-mod-k');
          var v = el.value;
          if (k === 'price_kz') v = Number(v) || 0;
          if (k === 'featured') v = v === '1';
          if (k === 'features_pt' || k === 'features_en') {
            v = String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
          }
          m[k] = v;
        });
        modalities.push(m);
      });
      const schedules = [];
      editor.querySelectorAll('[data-sch-i]').forEach(function (row) {
        const sch = {};
        row.querySelectorAll('[data-sch-k]').forEach(function (el) {
          sch[el.getAttribute('data-sch-k')] = el.value;
        });
        schedules.push(sch);
      });
      return Object.assign({}, prev, base, { modalities: modalities, schedules: schedules });
    }

    if (siteSec === 'products') {
      const items = [];
      editor.querySelectorAll('.product-edit-card').forEach(function (card) {
        const p = {};
        card.querySelectorAll('[data-prod-k]').forEach(function (el) {
          const k = el.getAttribute('data-prod-k');
          var v = el.value;
          if (k === 'price_kz') v = Number(v) || 0;
          p[k] = v;
        });
        items.push(p);
      });
      return Object.assign({}, prev, base, { items: items });
    }

    if (siteSec === 'diff') {
      const items = [];
      editor.querySelectorAll('.diff-edit-card').forEach(function (card) {
        const d = {};
        card.querySelectorAll('[data-diff-k]').forEach(function (el) {
          d[el.getAttribute('data-diff-k')] = el.value;
        });
        items.push(d);
      });
      return Object.assign({}, prev, base, { items: items });
    }

    return Object.assign({}, prev, base);
  }

  async function saveSiteSection() {
    try {
      const data = buildSectionPayload();
      siteStatus('A guardar…', true);
      const res = await api('/admin/site', {
        method: 'PUT',
        body: JSON.stringify({ section: siteSec, data: data }),
      });
      if (siteCache) siteCache[siteSec] = res.data || data;
      siteStatus('Guardado. O site público já usa estes dados.', true);
    } catch (err) {
      siteStatus(err.message || 'Erro ao guardar', false);
    }
  }

  async function loadWebsite() {
    const editor = document.getElementById('siteEditor');
    try {
      const data = await api('/admin/site');
      siteCache = data.site || {};
      renderSiteSection();
      siteStatus('', true);
    } catch (err) {
      if (editor) editor.innerHTML = '<p class="hint error-hint">' + esc(err.message) + '</p>';
    }
  }

  document.querySelectorAll('.site-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      siteSec = tab.getAttribute('data-site-sec') || 'hero';
      document.querySelectorAll('.site-tab').forEach(function (t) {
        t.classList.toggle('active', t === tab);
      });
      renderSiteSection();
    });
  });


  // —— Boot ——
  if (getToken()) {
    showApp();
  }
})();
