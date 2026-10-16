/**
 * Academia Semente — Student area (Entrar / dashboard)
 */
(function () {
  'use strict';

  var CFG = window.ACADEMIA_CONFIG || {};
  var API = (CFG.WORKER_URL || '').replace(/\/$/, '');
  var TOKEN_KEY = CFG.STUDENT_TOKEN_KEY || 'as_student_token';
  var USER_KEY = CFG.STUDENT_USER_KEY || 'as_student_user';
  var CLIENT_ID = CFG.GOOGLE_CLIENT_ID || '';

  var authSection = document.getElementById('authSection');
  var dashboardSection = document.getElementById('dashboardSection');
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  var loginError = document.getElementById('loginError');
  var registerError = document.getElementById('registerError');
  var logoutBtn = document.getElementById('logoutBtn');
  var coursesList = document.getElementById('coursesList');
  var noCourses = document.getElementById('noCourses');
  var pendingBanner = document.getElementById('pendingBanner');
  var videoModal = document.getElementById('videoModal');
  var videoPlayer = document.getElementById('videoPlayer');
  var videoTitle = document.getElementById('videoTitle');
  var videoClose = document.getElementById('videoClose');

  // ---------- Storage ----------
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }
  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ---------- API ----------
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!API) {
      return Promise.reject(new Error('API não configurada (WORKER_URL em config.js).'));
    }
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          try {
            data = text ? JSON.parse(text) : {};
          } catch (e) {
            data = { error: text || 'Resposta inválida do servidor' };
          }
          if (!res.ok) {
            var err = new Error(data.error || 'Erro ' + res.status);
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      })
      .catch(function (err) {
        if (err && err.status) throw err;
        throw new Error(
          'Não foi possível contactar o servidor. Verifique a ligação e se o Worker está activo.'
        );
      });
  }

  // ---------- UI helpers ----------
  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function statusLabel(status) {
    var map = {
      pending: 'Pendente',
      active: 'Activa',
      suspended: 'Suspensa',
    };
    return map[status] || status || '—';
  }

  function showAuth() {
    if (authSection) authSection.hidden = false;
    if (dashboardSection) dashboardSection.hidden = true;
  }

  function showDashboard(user) {
    if (authSection) authSection.hidden = true;
    if (dashboardSection) dashboardSection.hidden = false;

    var nameEl = document.getElementById('userName');
    var statusEl = document.getElementById('userStatus');
    var avatar = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = (user && user.name) || (user && user.email) || 'Aluno';
    if (statusEl) statusEl.textContent = statusLabel(user && user.status);

    if (avatar) {
      if (user && user.picture) {
        avatar.src = user.picture;
        avatar.hidden = false;
      } else {
        avatar.hidden = true;
      }
    }

    if (pendingBanner) {
      pendingBanner.hidden = !(user && user.status === 'pending');
    }

    loadCourses();
  }

  function loadCourses() {
    if (!coursesList) return;
    coursesList.innerHTML = '<p class="loading">A carregar cursos…</p>';
    if (noCourses) noCourses.hidden = true;

    api('/api/student/courses')
      .then(function (data) {
        var courses = data.courses || [];
        if (!courses.length) {
          coursesList.innerHTML = '';
          if (noCourses) noCourses.hidden = false;
          return;
        }
        if (noCourses) noCourses.hidden = true;
        coursesList.innerHTML = courses
          .map(function (c) {
            var videos = (c.videos || [])
              .map(function (v) {
                var dur = v.duration_seconds
                  ? Math.floor(v.duration_seconds / 60) + ':' + String(v.duration_seconds % 60).padStart(2, '0')
                  : '';
                return (
                  '<li><button type="button" class="video-item" data-video-id="' +
                  escapeAttr(v.id) +
                  '" data-video-title="' +
                  escapeAttr(v.title_pt || v.title_en || 'Vídeo') +
                  '">' +
                  '<span class="video-item-title">' +
                  escapeHtml(v.title_pt || v.title_en || 'Vídeo') +
                  '</span>' +
                  (dur ? '<span class="video-item-dur">' + escapeHtml(dur) + '</span>' : '') +
                  '</button></li>'
                );
              })
              .join('');

            return (
              '<article class="course-card">' +
              (c.cover_url
                ? '<img class="course-cover" src="' + escapeAttr(c.cover_url) + '" alt="">'
                : '') +
              '<div class="course-body">' +
              '<h3>' +
              escapeHtml(c.title_pt || c.title_en || 'Curso') +
              '</h3>' +
              (c.description_pt || c.description_en
                ? '<p class="course-desc">' +
                  escapeHtml(c.description_pt || c.description_en) +
                  '</p>'
                : '') +
              (videos ? '<ul class="video-list">' + videos + '</ul>' : '') +
              '</div></article>'
            );
          })
          .join('');
      })
      .catch(function (err) {
        coursesList.innerHTML =
          '<p class="error">' + escapeHtml(err.message || 'Não foi possível carregar os cursos.') + '</p>';
      });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  // ---------- Session bootstrap ----------
  function applySession() {
    var token = getToken();
    var user = getUser();
    if (token && user) {
      showDashboard(user);
      // Refresh profile in background
      api('/api/auth/me')
        .then(function (data) {
          if (data.user) {
            setSession(token, data.user);
            showDashboard(data.user);
          }
        })
        .catch(function (err) {
          if (err.status === 401) {
            clearSession();
            showAuth();
            initGoogle();
          }
        });
    } else {
      showAuth();
      initGoogle();
    }
  }

  // ---------- Google Sign-In ----------
  function initGoogle() {
    if (!CLIENT_ID) {
      console.warn('GOOGLE_CLIENT_ID missing in config.js');
      return;
    }

    // Set client_id on the markup (for GSI auto-render)
    var onload = document.getElementById('g_id_onload');
    if (onload) onload.setAttribute('data-client_id', CLIENT_ID);

    function render() {
      if (!window.google || !google.accounts || !google.accounts.id) return;

      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: onGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      var wrapper = document.getElementById('googleBtnWrapper');
      if (wrapper) {
        // Clear placeholder markup and render a reliable button
        var host = document.createElement('div');
        host.id = 'googleBtnHost';
        wrapper.innerHTML = '';
        wrapper.appendChild(host);
        google.accounts.id.renderButton(host, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(320, wrapper.clientWidth || 320),
        });
      }
    }

    if (window.google && google.accounts && google.accounts.id) {
      render();
    } else {
      // GSI script is async — wait for it
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (window.google && google.accounts && google.accounts.id) {
          clearInterval(t);
          render();
        } else if (tries > 50) {
          clearInterval(t);
        }
      }, 100);
    }
  }

  // Global callback (also referenced by data-callback)
  window.onGoogleCredential = function (response) {
    if (!response || !response.credential) {
      showError(loginError, 'Resposta Google inválida.');
      return;
    }
    showError(loginError, '');
    api('/api/auth/google', {
      method: 'POST',
      body: { credential: response.credential },
    })
      .then(function (data) {
        setSession(data.token, data.user);
        showDashboard(data.user);
      })
      .catch(function (err) {
        showError(loginError, err.message || 'Falha no login com Google.');
      });
  };

  // ---------- Email forms ----------
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      showError(loginError, '');
      var fd = new FormData(loginForm);
      api('/api/auth/login', {
        method: 'POST',
        body: {
          email: fd.get('email'),
          password: fd.get('password'),
        },
      })
        .then(function (data) {
          setSession(data.token, data.user);
          showDashboard(data.user);
        })
        .catch(function (err) {
          showError(loginError, err.message || 'Falha no login.');
        });
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      showError(registerError, '');
      var fd = new FormData(registerForm);
      api('/api/auth/register', {
        method: 'POST',
        body: {
          name: fd.get('name'),
          email: fd.get('email'),
          password: fd.get('password'),
        },
      })
        .then(function (data) {
          setSession(data.token, data.user);
          showDashboard(data.user);
        })
        .catch(function (err) {
          showError(registerError, err.message || 'Falha ao criar conta.');
        });
    });
  }

  // Tabs
  document.querySelectorAll('.auth-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.auth-tab').forEach(function (t) {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      var which = tab.getAttribute('data-tab');
      if (loginForm) loginForm.hidden = which !== 'login';
      if (registerForm) registerForm.hidden = which !== 'register';
      showError(loginError, '');
      showError(registerError, '');
    });
  });

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      clearSession();
      if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
      }
      showAuth();
      initGoogle();
    });
  }

  // Video list click
  if (coursesList) {
    coursesList.addEventListener('click', function (e) {
      var btn = e.target.closest('.video-item');
      if (!btn) return;
      var id = btn.getAttribute('data-video-id');
      var title = btn.getAttribute('data-video-title') || 'Vídeo';
      openVideo(id, title);
    });
  }

  function openVideo(id, title) {
    if (!videoModal || !videoPlayer) return;
    if (videoTitle) videoTitle.textContent = title;
    videoPlayer.removeAttribute('src');
    videoModal.hidden = false;

    api('/api/student/videos/' + encodeURIComponent(id) + '/url')
      .then(function (data) {
        if (data.url) {
          videoPlayer.src = data.url;
          videoPlayer.play().catch(function () {});
        } else {
          alert('URL do vídeo indisponível.');
          closeVideo();
        }
      })
      .catch(function (err) {
        alert(err.message || 'Não foi possível abrir o vídeo.');
        closeVideo();
      });
  }

  function closeVideo() {
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.removeAttribute('src');
    }
    if (videoModal) videoModal.hidden = true;
  }

  if (videoClose) videoClose.addEventListener('click', closeVideo);
  if (videoModal) {
    videoModal.addEventListener('click', function (e) {
      if (e.target === videoModal) closeVideo();
    });
  }

  // Start
  applySession();
})();
