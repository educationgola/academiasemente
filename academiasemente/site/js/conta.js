/**
 * Academia Semente — Student area (Entrar / dashboard)
 * Progress, resume, profile, expand/collapse, next video
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
  var profileBtn = document.getElementById('profileBtn');
  var profileClose = document.getElementById('profileClose');
  var profilePanel = document.getElementById('profilePanel');
  var profileForm = document.getElementById('profileForm');
  var passwordForm = document.getElementById('passwordForm');
  var coursesList = document.getElementById('coursesList');
  var noCourses = document.getElementById('noCourses');
  var pendingBanner = document.getElementById('pendingBanner');
  var offlineBanner = document.getElementById('offlineBanner');
  var continueCard = document.getElementById('continueCard');
  var continueBtn = document.getElementById('continueBtn');
  var continueTitle = document.getElementById('continueTitle');
  var continueMeta = document.getElementById('continueMeta');
  var videoModal = document.getElementById('videoModal');
  var videoPlayer = document.getElementById('videoPlayer');
  var videoTitle = document.getElementById('videoTitle');
  var videoClose = document.getElementById('videoClose');
  var videoPrev = document.getElementById('videoPrev');
  var videoNext = document.getElementById('videoNext');

  /** Flat ordered list of videos for prev/next within current course playlist */
  var playlist = [];
  var currentVideoId = null;
  var progressTimer = null;
  var lastSavedPos = -1;
  /** Cache of last courses response for playlist rebuild */
  var coursesCache = [];

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

  function showSuccess(el, msg) {
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

  function formatDuration(sec) {
    sec = Math.floor(Number(sec) || 0);
    if (sec <= 0) return '';
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
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

  function showAuth() {
    if (authSection) authSection.hidden = false;
    if (dashboardSection) dashboardSection.hidden = true;
    if (profilePanel) profilePanel.hidden = true;
  }

  function showDashboard(user) {
    if (authSection) authSection.hidden = true;
    if (dashboardSection) dashboardSection.hidden = false;
    if (profilePanel) profilePanel.hidden = true;

    var nameEl = document.getElementById('userName');
    var badge = document.getElementById('userStatusBadge');
    var avatar = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = (user && user.name) || (user && user.email) || 'Aluno';

    if (badge) {
      var st = (user && user.status) || 'pending';
      badge.textContent = statusLabel(st);
      badge.className = 'status-badge status-' + st;
    }

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

    // Prefill profile fields
    var pn = document.getElementById('profileName');
    var pe = document.getElementById('profileEmail');
    var pp = document.getElementById('profilePhone');
    if (pn) pn.value = (user && user.name) || '';
    if (pe) pe.value = (user && user.email) || '';
    if (pp) pp.value = (user && user.phone) || '';

    // Password form: hide current if Google-only
    var curField = document.getElementById('currentPasswordField');
    var pwdHeading = document.getElementById('passwordHeading');
    var pwdSubmit = document.getElementById('passwordSubmitBtn');
    var hasPw = !!(user && user.has_password);
    if (curField) curField.hidden = !hasPw;
    if (pwdHeading) pwdHeading.textContent = hasPw ? 'Alterar palavra-passe' : 'Definir palavra-passe';
    if (pwdSubmit) pwdSubmit.textContent = hasPw ? 'Alterar palavra-passe' : 'Definir palavra-passe';

    loadCourses();
  }

  function skeletonHtml() {
    return (
      '<div class="course-skeleton" aria-hidden="true">' +
      '<div class="sk-line sk-title"></div>' +
      '<div class="sk-line"></div>' +
      '<div class="sk-line sk-short"></div>' +
      '</div>' +
      '<div class="course-skeleton" aria-hidden="true">' +
      '<div class="sk-line sk-title"></div>' +
      '<div class="sk-line"></div>' +
      '</div>'
    );
  }

  function loadCourses() {
    if (!coursesList) return;
    coursesList.innerHTML = skeletonHtml();
    if (noCourses) noCourses.hidden = true;
    if (continueCard) continueCard.hidden = true;
    if (offlineBanner) offlineBanner.hidden = true;

    api('/api/student/courses')
      .then(function (data) {
        var courses = data.courses || [];
        coursesCache = courses;
        renderContinue(data.last_watched);
        renderCourses(courses);
      })
      .catch(function (err) {
        coursesList.innerHTML =
          '<p class="error">' + escapeHtml(err.message || 'Não foi possível carregar os cursos.') + '</p>';
        if (offlineBanner && /servidor|ligação|contactar/i.test(err.message || '')) {
          offlineBanner.hidden = false;
        }
      });
  }

  function renderContinue(lw) {
    if (!continueCard || !continueBtn) return;
    if (!lw || !lw.id) {
      continueCard.hidden = true;
      return;
    }
    continueCard.hidden = false;
    if (continueTitle) {
      continueTitle.textContent = lw.title_pt || lw.title_en || 'Vídeo';
    }
    if (continueMeta) {
      var parts = [];
      if (lw.course_title_pt) parts.push(lw.course_title_pt);
      if (lw.position_seconds > 0) parts.push('em ' + formatDuration(lw.position_seconds));
      continueMeta.textContent = parts.join(' · ');
    }
    continueBtn.setAttribute('data-video-id', lw.id);
    continueBtn.setAttribute('data-video-title', lw.title_pt || lw.title_en || 'Vídeo');
    continueBtn.setAttribute('data-course-id', lw.course_id || '');
  }

  function renderCourses(courses) {
    if (!courses.length) {
      coursesList.innerHTML = '';
      if (noCourses) noCourses.hidden = false;
      return;
    }
    if (noCourses) noCourses.hidden = true;

    coursesList.innerHTML = courses
      .map(function (c, idx) {
        var prog = c.progress || { total: 0, completed: 0, percent: 0 };
        var videos = c.videos || [];
        var openByDefault = idx === 0;

        var videoItems = videos
          .map(function (v) {
            var dur = formatDuration(v.duration_seconds);
            var pct = 0;
            if (v.completed) {
              pct = 100;
            } else if (v.duration_seconds && v.position_seconds > 0) {
              pct = Math.min(99, Math.round((v.position_seconds / v.duration_seconds) * 100));
            }
            var stateClass = v.completed ? ' is-complete' : pct > 0 ? ' is-partial' : '';
            return (
              '<li>' +
              '<button type="button" class="video-item' +
              stateClass +
              '" data-video-id="' +
              escapeAttr(v.id) +
              '" data-video-title="' +
              escapeAttr(v.title_pt || v.title_en || 'Vídeo') +
              '" data-course-id="' +
              escapeAttr(c.id) +
              '">' +
              '<span class="video-item-left">' +
              '<span class="video-check" aria-hidden="true">' +
              (v.completed ? '✓' : '') +
              '</span>' +
              '<span class="video-item-title">' +
              escapeHtml(v.title_pt || v.title_en || 'Vídeo') +
              '</span>' +
              '</span>' +
              '<span class="video-item-right">' +
              (pct > 0 && !v.completed
                ? '<span class="video-pct">' + pct + '%</span>'
                : '') +
              (dur ? '<span class="video-item-dur">' + escapeHtml(dur) + '</span>' : '') +
              '</span>' +
              (pct > 0
                ? '<span class="video-progress-bar" aria-hidden="true"><span style="width:' +
                  pct +
                  '%"></span></span>'
                : '') +
              '</button></li>'
            );
          })
          .join('');

        var continueCta = '';
        if (c.continue_video && c.continue_video.id) {
          continueCta =
            '<button type="button" class="course-continue video-item-cta" data-video-id="' +
            escapeAttr(c.continue_video.id) +
            '" data-video-title="' +
            escapeAttr(c.continue_video.title_pt || c.continue_video.title_en || 'Vídeo') +
            '" data-course-id="' +
            escapeAttr(c.id) +
            '">Continuar' +
            (c.continue_video.position_seconds > 0
              ? ' · ' + formatDuration(c.continue_video.position_seconds)
              : '') +
            '</button>';
        }

        return (
          '<article class="course-card' +
          (openByDefault ? ' is-open' : '') +
          '" data-course-id="' +
          escapeAttr(c.id) +
          '">' +
          (c.cover_url
            ? '<img class="course-cover" src="' + escapeAttr(c.cover_url) + '" alt="">'
            : '') +
          '<div class="course-body">' +
          '<button type="button" class="course-header-btn" aria-expanded="' +
          (openByDefault ? 'true' : 'false') +
          '">' +
          '<div class="course-header-text">' +
          '<h3>' +
          escapeHtml(c.title_pt || c.title_en || 'Curso') +
          '</h3>' +
          '<div class="course-meta">' +
          '<span class="course-count">' +
          prog.completed +
          '/' +
          prog.total +
          ' vídeos</span>' +
          (prog.total
            ? '<span class="course-percent">' + prog.percent + '%</span>'
            : '') +
          '</div>' +
          (prog.total
            ? '<div class="course-progress-track"><div class="course-progress-fill" style="width:' +
              prog.percent +
              '%"></div></div>'
            : '') +
          '</div>' +
          '<span class="course-chevron" aria-hidden="true"></span>' +
          '</button>' +
          (c.description_pt || c.description_en
            ? '<p class="course-desc">' +
              escapeHtml(c.description_pt || c.description_en) +
              '</p>'
            : '') +
          continueCta +
          '<div class="course-videos' +
          (openByDefault ? '' : ' is-collapsed') +
          '">' +
          (videoItems ? '<ul class="video-list">' + videoItems + '</ul>' : '') +
          '</div>' +
          '</div></article>'
        );
      })
      .join('');
  }

  // ---------- Session bootstrap ----------
  function applySession() {
    var token = getToken();
    var user = getUser();
    if (token && user) {
      showDashboard(user);
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
          } else if (offlineBanner) {
            offlineBanner.hidden = false;
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
      stopProgressTracking();
      if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
      }
      showAuth();
      initGoogle();
    });
  }

  // Profile panel
  function openProfile() {
    if (profilePanel) profilePanel.hidden = false;
    showError(document.getElementById('profileError'), '');
    showSuccess(document.getElementById('profileSuccess'), '');
    showError(document.getElementById('passwordError'), '');
    showSuccess(document.getElementById('passwordSuccess'), '');
    if (profilePanel) profilePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeProfile() {
    if (profilePanel) profilePanel.hidden = true;
  }
  if (profileBtn) profileBtn.addEventListener('click', openProfile);
  if (profileClose) profileClose.addEventListener('click', closeProfile);

  if (profileForm) {
    profileForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('profileError');
      var okEl = document.getElementById('profileSuccess');
      showError(errEl, '');
      showSuccess(okEl, '');
      api('/api/student/profile', {
        method: 'POST',
        body: {
          name: document.getElementById('profileName').value,
          phone: document.getElementById('profilePhone').value,
        },
      })
        .then(function (data) {
          if (data.user) {
            var token = getToken();
            setSession(token, data.user);
            showDashboard(data.user);
            openProfile();
            showSuccess(okEl, 'Perfil actualizado.');
          }
        })
        .catch(function (err) {
          showError(errEl, err.message || 'Não foi possível guardar.');
        });
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('passwordError');
      var okEl = document.getElementById('passwordSuccess');
      showError(errEl, '');
      showSuccess(okEl, '');
      api('/api/student/password', {
        method: 'POST',
        body: {
          current_password: (document.getElementById('currentPassword') || {}).value || '',
          new_password: document.getElementById('newPassword').value,
        },
      })
        .then(function (data) {
          if (data.user) {
            var token = getToken();
            setSession(token, data.user);
            showDashboard(data.user);
            openProfile();
          }
          passwordForm.reset();
          showSuccess(okEl, 'Palavra-passe actualizada.');
        })
        .catch(function (err) {
          showError(errEl, err.message || 'Não foi possível alterar a palavra-passe.');
        });
    });
  }

  // Course expand/collapse + video clicks
  if (coursesList) {
    coursesList.addEventListener('click', function (e) {
      var headerBtn = e.target.closest('.course-header-btn');
      if (headerBtn) {
        var card = headerBtn.closest('.course-card');
        if (!card) return;
        var videosWrap = card.querySelector('.course-videos');
        var open = card.classList.toggle('is-open');
        headerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (videosWrap) videosWrap.classList.toggle('is-collapsed', !open);
        return;
      }

      var btn = e.target.closest('.video-item, .course-continue, .video-item-cta');
      if (!btn) return;
      var id = btn.getAttribute('data-video-id');
      var title = btn.getAttribute('data-video-title') || 'Vídeo';
      var courseId = btn.getAttribute('data-course-id') || '';
      openVideo(id, title, courseId);
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', function () {
      var id = continueBtn.getAttribute('data-video-id');
      var title = continueBtn.getAttribute('data-video-title') || 'Vídeo';
      var courseId = continueBtn.getAttribute('data-course-id') || '';
      if (id) openVideo(id, title, courseId);
    });
  }

  function buildPlaylist(courseId) {
    playlist = [];
    for (var i = 0; i < coursesCache.length; i++) {
      var c = coursesCache[i];
      if (courseId && c.id !== courseId) continue;
      var vids = c.videos || [];
      for (var j = 0; j < vids.length; j++) {
        playlist.push({
          id: vids[j].id,
          title: vids[j].title_pt || vids[j].title_en || 'Vídeo',
          courseId: c.id,
        });
      }
      if (courseId) break;
    }
  }

  function updateNavButtons() {
    if (!videoPrev || !videoNext) return;
    var idx = -1;
    for (var i = 0; i < playlist.length; i++) {
      if (playlist[i].id === currentVideoId) {
        idx = i;
        break;
      }
    }
    if (idx > 0) {
      videoPrev.hidden = false;
    } else {
      videoPrev.hidden = true;
    }
    if (idx >= 0 && idx < playlist.length - 1) {
      videoNext.hidden = false;
    } else {
      videoNext.hidden = true;
    }
  }

  function openVideo(id, title, courseId) {
    if (!videoModal || !videoPlayer) return;
    stopProgressTracking();
    currentVideoId = id;
    buildPlaylist(courseId);
    updateNavButtons();

    if (videoTitle) videoTitle.textContent = title;
    videoPlayer.removeAttribute('src');
    videoModal.hidden = false;
    document.body.style.overflow = 'hidden';

    api('/api/student/videos/' + encodeURIComponent(id) + '/url')
      .then(function (data) {
        if (data.url) {
          videoPlayer.src = data.url;
          var resumeAt = Number(data.position_seconds) || 0;
          if (data.completed) resumeAt = 0;
          var seekOnce = function () {
            if (resumeAt > 5 && videoPlayer.duration && resumeAt < videoPlayer.duration - 3) {
              try {
                videoPlayer.currentTime = resumeAt;
              } catch (e) {}
            }
            videoPlayer.removeEventListener('loadedmetadata', seekOnce);
          };
          videoPlayer.addEventListener('loadedmetadata', seekOnce);
          videoPlayer.play().catch(function () {});
          startProgressTracking(id);
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

  function saveProgress(force) {
    if (!currentVideoId || !videoPlayer) return;
    var pos = Math.floor(videoPlayer.currentTime || 0);
    if (!force && Math.abs(pos - lastSavedPos) < 8) return;
    lastSavedPos = pos;
    var completed = false;
    var dur = videoPlayer.duration;
    if (dur && isFinite(dur) && (pos / dur >= 0.9 || dur - pos <= 15)) {
      completed = true;
    }
    api('/api/student/videos/' + encodeURIComponent(currentVideoId) + '/progress', {
      method: 'POST',
      body: { position_seconds: pos, completed: completed },
    }).catch(function () {
      /* silent — offline ok */
    });
  }

  function startProgressTracking(videoId) {
    stopProgressTracking();
    currentVideoId = videoId;
    lastSavedPos = -1;
    progressTimer = setInterval(function () {
      if (!videoPlayer || videoPlayer.paused) return;
      saveProgress(false);
    }, 10000);

    videoPlayer.addEventListener('pause', onPauseSave);
    videoPlayer.addEventListener('ended', onEndedSave);
  }

  function onPauseSave() {
    saveProgress(true);
  }
  function onEndedSave() {
    if (!currentVideoId) return;
    lastSavedPos = -1;
    api('/api/student/videos/' + encodeURIComponent(currentVideoId) + '/progress', {
      method: 'POST',
      body: {
        position_seconds: Math.floor(videoPlayer.duration || videoPlayer.currentTime || 0),
        completed: true,
      },
    })
      .then(function () {
        loadCourses();
      })
      .catch(function () {});
  }

  function stopProgressTracking() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    if (videoPlayer) {
      videoPlayer.removeEventListener('pause', onPauseSave);
      videoPlayer.removeEventListener('ended', onEndedSave);
    }
  }

  function closeVideo() {
    saveProgress(true);
    stopProgressTracking();
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.removeAttribute('src');
      try {
        videoPlayer.load();
      } catch (e) {}
    }
    if (videoModal) videoModal.hidden = true;
    document.body.style.overflow = '';
    currentVideoId = null;
    // Refresh list so progress bars update
    loadCourses();
  }

  if (videoPrev) {
    videoPrev.addEventListener('click', function () {
      var idx = -1;
      for (var i = 0; i < playlist.length; i++) {
        if (playlist[i].id === currentVideoId) {
          idx = i;
          break;
        }
      }
      if (idx > 0) {
        var prev = playlist[idx - 1];
        openVideo(prev.id, prev.title, prev.courseId);
      }
    });
  }
  if (videoNext) {
    videoNext.addEventListener('click', function () {
      var idx = -1;
      for (var i = 0; i < playlist.length; i++) {
        if (playlist[i].id === currentVideoId) {
          idx = i;
          break;
        }
      }
      if (idx >= 0 && idx < playlist.length - 1) {
        var next = playlist[idx + 1];
        openVideo(next.id, next.title, next.courseId);
      }
    });
  }

  // Discourage casual download
  if (videoPlayer) {
    videoPlayer.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
    videoPlayer.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
      }
    });
  }

  if (videoClose) videoClose.addEventListener('click', closeVideo);
  if (videoModal) {
    videoModal.addEventListener('click', function (e) {
      if (e.target === videoModal) closeVideo();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && videoModal && !videoModal.hidden) {
      closeVideo();
    }
  });

  // Start
  applySession();
})();
