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
    const res = await fetch(API + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Erro');
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

  document.getElementById('adminLogout').addEventListener('click', () => {
    clearToken();
    location.reload();
  });

  // —— Nav ——
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach((p) => (p.hidden = true));
      document.getElementById('panel-' + btn.dataset.panel).hidden = false;
      if (btn.dataset.panel === 'enrollments') loadEnrollments();
      if (btn.dataset.panel === 'orders') loadOrders();
    });
  });

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    loadStudents();
    loadCourses();
    loadEnrollments();
    loadOrders();
  }

  // ==================== Students ====================

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
      if (st && s.status !== st) return false;
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
                <strong>${esc(s.name || '—')}</strong><br>
                <span class="student-email">${esc(s.email)}</span>
                ${s.phone ? `<br><span class="student-email">${esc(s.phone)}</span>` : ''}
              </td>
              <td data-label="Estado">
                <select class="status-select" data-status-id="${s.id}" title="Alterar estado">
                  <option value="pending"${s.status === 'pending' ? ' selected' : ''}>pending</option>
                  <option value="active"${s.status === 'active' ? ' selected' : ''}>active</option>
                  <option value="suspended"${s.status === 'suspended' ? ' selected' : ''}>suspended</option>
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
      renderStudents();
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

  async function loadEnrollments() {
    if (!enrollmentsList) return;
    enrollmentsList.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const status = enrollmentStatusFilter ? enrollmentStatusFilter.value : 'pending';
      const q = status ? '?status=' + encodeURIComponent(status) : '';
      const data = await api('/admin/enrollments' + q);
      enrollmentsCache = data.enrollments || [];
      renderEnrollments();
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
  let ordersCache = [];

  async function loadOrders() {
    if (!ordersList) return;
    ordersList.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const status = orderStatusFilter ? orderStatusFilter.value : 'pending';
      const q = status ? '?status=' + encodeURIComponent(status) : '';
      const data = await api('/admin/orders' + q);
      ordersCache = data.orders || [];
      renderOrders();
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

  // —— Boot ——
  if (getToken()) {
    showApp();
  }
})();
