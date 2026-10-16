/**
 * Academia Semente — Admin panel
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

  let grantUserId = null;
  let coursesCache = [];

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
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Erro');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Login
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
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  document.getElementById('adminLogout').addEventListener('click', () => {
    clearToken();
    location.reload();
  });

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => (p.hidden = true));
      document.getElementById('panel-' + btn.dataset.panel).hidden = false;
    });
  });

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    loadStudents();
    loadCourses();
  }

  // Students
  async function loadStudents() {
    studentsTable.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const data = await api('/admin/students');
      const rows = data.students || [];
      if (!rows.length) {
        studentsTable.innerHTML = '<p class="muted">Nenhum aluno registado ainda.</p>';
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
            ${rows.map(s => `
              <tr>
                <td data-label="Aluno">
                  <strong>${esc(s.name || '—')}</strong><br>
                  <span style="font-size:0.85rem;color:#666">${esc(s.email)}</span>
                </td>
                <td data-label="Estado"><span class="badge ${s.status}">${s.status}</span></td>
                <td data-label="Cursos">${s.courses_count || 0}</td>
                <td data-label="Desde">${(s.created_at || '').slice(0, 10)}</td>
                <td data-label="">
                  <button type="button" class="btn" data-grant="${s.id}" data-label="${esc(s.name || s.email)}">Atribuir curso</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      studentsTable.querySelectorAll('[data-grant]').forEach(btn => {
        btn.addEventListener('click', () => openGrant(btn.dataset.grant, btn.dataset.label));
      });
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

  // Courses
  async function loadCourses() {
    coursesAdmin.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const data = await api('/admin/courses');
      coursesCache = data.courses || [];
      if (!coursesCache.length) {
        coursesAdmin.innerHTML = '<p class="muted">Nenhum curso criado.</p>';
        return;
      }
      coursesAdmin.innerHTML = coursesCache.map(c => `
        <div class="course-block">
          <h4>${esc(c.title_pt)} <code style="font-size:0.75rem;color:#888">${c.id}</code></h4>
          <p class="muted" style="margin:0 0 0.5rem">${esc(c.description_pt || '')}</p>
          ${(c.videos || []).map(v => `
            <div class="video-row">
              <span>${esc(v.title_pt)}</span>
              <code>${esc(v.cloudinary_public_id)}</code>
            </div>
          `).join('') || '<p class="muted">Sem vídeos</p>'}
        </div>
      `).join('');
    } catch (err) {
      coursesAdmin.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  document.getElementById('refreshCourses').addEventListener('click', loadCourses);

  document.getElementById('courseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/admin/courses', {
        method: 'POST',
        body: JSON.stringify({
          title_pt: fd.get('title_pt'),
          title_en: fd.get('title_en'),
          description_pt: fd.get('description_pt'),
          cover_url: fd.get('cover_url') || null,
        }),
      });
      e.target.reset();
      loadCourses();
      alert('Curso guardado.');
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('videoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/admin/videos', {
        method: 'POST',
        body: JSON.stringify({
          course_id: fd.get('course_id'),
          title_pt: fd.get('title_pt'),
          cloudinary_public_id: fd.get('cloudinary_public_id'),
          duration_seconds: fd.get('duration_seconds') ? Number(fd.get('duration_seconds')) : null,
        }),
      });
      e.target.reset();
      loadCourses();
      alert('Vídeo guardado.');
    } catch (err) {
      alert(err.message);
    }
  });

  // Grant modal
  function openGrant(userId, label) {
    grantUserId = userId;
    grantStudentLabel.textContent = label;
    grantCourseSelect.innerHTML = coursesCache.map(c =>
      `<option value="${c.id}">${esc(c.title_pt)}</option>`
    ).join('') || '<option value="">— crie um curso primeiro —</option>';
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

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Boot
  if (getToken()) {
    showApp();
  }
})();
