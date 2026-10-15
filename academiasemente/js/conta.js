/**
 * Academia Semente — Student area (/conta.html)
 * Google OAuth + email/password + dashboard + private video player
 */
(function () {
  'use strict';

  const cfg = window.ACADEMIA_CONFIG;
  const API = cfg.WORKER_URL.replace(/\/$/, '') + '/api';

  // ---------- DOM ----------
  const authSection = document.getElementById('authSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  const coursesList = document.getElementById('coursesList');
  const noCourses = document.getElementById('noCourses');
  const pendingBanner = document.getElementById('pendingBanner');
  const userNameEl = document.getElementById('userName');
  const userStatusEl = document.getElementById('userStatus');
  const userAvatar = document.getElementById('userAvatar');
  const logoutBtn = document.getElementById('logoutBtn');
  const videoModal = document.getElementById('videoModal');
  const videoPlayer = document.getElementById('videoPlayer');
  const videoTitle = document.getElementById('videoTitle');
  const videoClose = document.getElementById('videoClose');

  // ---------- Storage helpers ----------
  function getToken() {
    return localStorage.getItem(cfg.STUDENT_TOKEN_KEY);
  }
  function setSession(token, user) {
    localStorage.setItem(cfg.STUDENT_TOKEN_KEY, token);
    localStorage.setItem(cfg.STUDENT_USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(cfg.STUDENT_TOKEN_KEY);
    localStorage.removeItem(cfg.STUDENT_USER_KEY);
  }
  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(cfg.STUDENT_USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Erro de rede');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- Auth UI ----------
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      loginForm.hidden = tab !== 'login';
      registerForm.hidden = tab !== 'register';
      loginError.hidden = true;
      registerError.hidden = true;
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const fd = new FormData(loginForm);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: fd.get('email'),
          password: fd.get('password'),
        }),
      });
      setSession(data.token, data.user);
      showDashboard(data.user);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.hidden = true;
    const fd = new FormData(registerForm);
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          password: fd.get('password'),
        }),
      });
      setSession(data.token, data.user);
      showDashboard(data.user);
    } catch (err) {
      registerError.textContent = err.message;
      registerError.hidden = false;
    }
  });

  // Google callback (global)
  window.onGoogleCredential = async function (response) {
    try {
      const data = await api('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential }),
      });
      setSession(data.token, data.user);
      showDashboard(data.user);
    } catch (err) {
      alert(err.message || 'Erro no login Google');
    }
  };

  function initGoogleButton() {
    const el = document.getElementById('g_id_onload');
    if (el) el.setAttribute('data-client_id', cfg.GOOGLE_CLIENT_ID);
    // GIS will auto-render the .g_id_signin button once client_id is set
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: cfg.GOOGLE_CLIENT_ID,
        callback: window.onGoogleCredential,
      });
      google.accounts.id.renderButton(
        document.querySelector('.g_id_signin'),
        { type: 'standard', size: 'large', theme: 'outline', width: 320 }
      );
    }
  }

  // ---------- Dashboard ----------
  async function showDashboard(user) {
    authSection.hidden = true;
    dashboardSection.hidden = false;

    userNameEl.textContent = user.name || user.email.split('@')[0];
    userStatusEl.textContent = statusLabel(user.status);
    if (user.picture) {
      userAvatar.src = user.picture;
      userAvatar.hidden = false;
    } else {
      userAvatar.hidden = true;
    }

    pendingBanner.hidden = user.status !== 'pending';

    await loadCourses();
  }

  function statusLabel(s) {
    const map = {
      pending: 'Pendente de activação',
      active: 'Activa',
      suspended: 'Suspensa',
    };
    return map[s] || s;
  }

  async function loadCourses() {
    coursesList.innerHTML = '<p class="loading">A carregar…</p>';
    noCourses.hidden = true;
    try {
      const data = await api('/student/courses');
      const courses = data.courses || [];
      if (!courses.length) {
        coursesList.innerHTML = '';
        noCourses.hidden = false;
        return;
      }
      coursesList.innerHTML = courses.map(renderCourse).join('');
      coursesList.querySelectorAll('[data-video-id]').forEach(btn => {
        btn.addEventListener('click', () => playVideo(btn.dataset.videoId, btn.dataset.videoTitle));
      });
    } catch (err) {
      if (err.status === 401) {
        clearSession();
        location.reload();
        return;
      }
      coursesList.innerHTML = `<p class="error">${err.message}</p>`;
    }
  }

  function renderCourse(c) {
    const videos = (c.videos || []).map(v => `
      <li>
        <button type="button" class="video-item" data-video-id="${v.id}" data-video-title="${escapeHtml(v.title_pt)}">
          <span class="video-item-title">${escapeHtml(v.title_pt)}</span>
          ${v.duration_seconds ? `<span class="video-item-dur">${formatDuration(v.duration_seconds)}</span>` : ''}
        </button>
      </li>
    `).join('');

    return `
      <article class="course-card">
        ${c.cover_url ? `<img class="course-cover" src="${escapeHtml(c.cover_url)}" alt="">` : ''}
        <div class="course-body">
          <h3>${escapeHtml(c.title_pt)}</h3>
          ${c.description_pt ? `<p class="course-desc">${escapeHtml(c.description_pt)}</p>` : ''}
          <ul class="video-list">${videos || '<li class="muted">Sem vídeos ainda</li>'}</ul>
        </div>
      </article>
    `;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---------- Video player ----------
  async function playVideo(videoId, title) {
    videoTitle.textContent = title || 'A carregar…';
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    videoModal.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const data = await api(`/student/videos/${videoId}/url`);
      videoTitle.textContent = data.title || title;
      videoPlayer.src = data.url;
      videoPlayer.play().catch(() => {});
    } catch (err) {
      videoTitle.textContent = err.message || 'Não foi possível carregar o vídeo';
    }
  }

  function closeVideo() {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    videoModal.hidden = true;
    document.body.style.overflow = '';
  }

  videoClose.addEventListener('click', closeVideo);
  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) closeVideo();
  });

  logoutBtn.addEventListener('click', () => {
    clearSession();
    location.reload();
  });

  // ---------- Boot ----------
  async function boot() {
    initGoogleButton();
    // Retry Google button after script loads
    setTimeout(initGoogleButton, 800);

    const token = getToken();
    const user = getStoredUser();
    if (token && user) {
      try {
        // Refresh user data
        const data = await api('/auth/me');
        setSession(token, data.user);
        showDashboard(data.user);
      } catch {
        clearSession();
        authSection.hidden = false;
        dashboardSection.hidden = true;
      }
    } else {
      authSection.hidden = false;
      dashboardSection.hidden = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
