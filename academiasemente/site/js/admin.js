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
    });
  });

  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    loadStudents();
    loadCourses();
  }

  // ==================== Students ====================

  async function loadStudents() {
    studentsTable.innerHTML = '<p class="muted">A carregar…</p>';
    try {
      const data = await api('/admin/students');
      studentsCache = data.students || [];
      if (!studentsCache.length) {
        studentsTable.innerHTML = '<div class="empty-state">Nenhum aluno registado ainda.</div>';
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
            ${studentsCache
              .map((s) => {
                const courses = s.courses || [];
                const courseChips = courses.length
                  ? courses
                      .map(
                        (c) =>
                          `<span class="chip">${esc(c.title_pt)}</span>`
                      )
                      .join(' ')
                  : '<span class="muted">—</span>';
                return `
              <tr>
                <td data-label="Aluno">
                  <strong>${esc(s.name || '—')}</strong><br>
                  <span class="student-email">${esc(s.email)}</span>
                </td>
                <td data-label="Estado"><span class="badge ${esc(s.status || '')}">${esc(s.status || '—')}</span></td>
                <td data-label="Cursos" class="courses-cell">${courseChips}</td>
                <td data-label="Desde">${(s.created_at || '').slice(0, 10) || '—'}</td>
                <td data-label="" class="actions-cell">
                  <button type="button" class="btn btn-sm" data-grant="${s.id}" data-label="${esc(s.name || s.email)}">Atribuir</button>
                  ${
                    courses.length
                      ? `<button type="button" class="btn btn-sm btn-outline" data-revoke="${s.id}" data-label="${esc(s.name || s.email)}">Revogar</button>`
                      : ''
                  }
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

  courseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(courseForm);
    const payload = {
      title_pt: fd.get('title_pt'),
      title_en: fd.get('title_en') || null,
      description_pt: fd.get('description_pt') || null,
      cover_url: fd.get('cover_url') || null,
    };
    const id = fd.get('id');
    if (id) payload.id = id;
    try {
      await api('/admin/courses', { method: 'POST', body: JSON.stringify(payload) });
      resetCourseForm();
      loadCourses();
      alert(id ? 'Curso actualizado.' : 'Curso guardado.');
    } catch (err) {
      alert(err.message);
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

    if (uploadStatus) uploadStatus.textContent = 'A enviar vídeo para o Cloudinary… (pode demorar)';

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sign.api_key);
    form.append('timestamp', String(sign.timestamp));
    form.append('signature', sign.signature);
    form.append('public_id', sign.public_id);
    form.append('type', sign.type);

    const res = await fetch(sign.upload_url, { method: 'POST', body: form });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (result && (result.error && result.error.message)) || result.message || 'Upload Cloudinary falhou';
      throw new Error(msg);
    }
    if (uploadStatus) {
      uploadStatus.textContent = 'Upload concluído: ' + (result.public_id || sign.public_id);
      uploadStatus.className = 'hint success-hint';
    }
    return result.public_id || sign.public_id;
  }

  videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(videoForm);
    const course_id = fd.get('course_id');
    const title_pt = fd.get('title_pt');
    let publicId = (fd.get('cloudinary_public_id') || '').trim();
    const file = videoFileInput.files && videoFileInput.files[0];

    if (!course_id) {
      alert('Escolha um curso.');
      return;
    }

    videoSubmitBtn.disabled = true;
    try {
      if (file) {
        publicId = await uploadVideoToCloudinary(file);
        videoPublicId.value = publicId;
      }
      if (!publicId) {
        alert('Faça upload de um ficheiro ou indique o Cloudinary public_id.');
        return;
      }
      const payload = {
        course_id,
        title_pt,
        cloudinary_public_id: publicId,
        duration_seconds: fd.get('duration_seconds') ? Number(fd.get('duration_seconds')) : null,
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

  // —— Boot ——
  if (getToken()) {
    showApp();
  }
})();
