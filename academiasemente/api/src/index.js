/**
 * Academia Semente — Cloudflare Worker
 * Auth (Google + email/password), admin publish, student courses, signed Cloudinary URLs
 *
 * Secrets (wrangler secret put ...):
 *   ADMIN_PASSWORD, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
 *   GOOGLE_CLIENT_SECRET, JWT_SECRET
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    try {
      // ---------- Public ----------
      if (path === '/api/health') return json({ ok: true, ts: new Date().toISOString() });
      if (path === '/api/enroll' && request.method === 'POST') return handlePublicEnroll(request, env);
      if (path === '/api/orders' && request.method === 'POST') return handlePublicOrder(request, env);

      // ---------- Auth ----------
      if (path === '/api/auth/register' && request.method === 'POST') return handleRegister(request, env);
      if (path === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env);
      if (path === '/api/auth/google' && request.method === 'POST') return handleGoogle(request, env);
      if (path === '/api/auth/me' && request.method === 'GET') return handleMe(request, env);

      // ---------- Student ----------
      if (path === '/api/student/courses' && request.method === 'GET') return handleStudentCourses(request, env);
      if (path.match(/^\/api\/student\/videos\/[^/]+\/url$/) && request.method === 'GET') {
        const videoId = path.split('/')[4];
        return handleSignedVideoUrl(request, env, videoId);
      }
      if (path.match(/^\/api\/student\/videos\/[^/]+\/progress$/) && request.method === 'POST') {
        const videoId = path.split('/')[4];
        return handleSaveProgress(request, env, videoId);
      }
      if (path === '/api/student/profile' && request.method === 'POST') return handleUpdateProfile(request, env);
      if (path === '/api/student/password' && request.method === 'POST') return handleChangePassword(request, env);

      // ---------- Admin (password) ----------
      if (path === '/api/admin/login' && request.method === 'POST') return handleAdminLogin(request, env);
      if (path === '/api/admin/publish' && request.method === 'POST') return handlePublish(request, env);
      if (path === '/api/admin/students' && request.method === 'GET') return handleListStudents(request, env);
      if (path === '/api/admin/students/grant' && request.method === 'POST') return handleGrantCourse(request, env);
      if (path === '/api/admin/students/revoke' && request.method === 'POST') return handleRevokeCourse(request, env);
      if (path === '/api/admin/students/update' && request.method === 'POST') return handleUpdateStudent(request, env);
      if (path === '/api/admin/students/delete' && request.method === 'POST') return handleDeleteStudent(request, env);
      if (path === '/api/admin/courses' && request.method === 'GET') return handleListCourses(request, env);
      if (path === '/api/admin/courses' && request.method === 'POST') return handleUpsertCourse(request, env);
      if (path === '/api/admin/courses/delete' && request.method === 'POST') return handleDeleteCourse(request, env);
      if (path === '/api/admin/courses/restore' && request.method === 'POST') return handleRestoreCourse(request, env);
      if (path === '/api/admin/videos' && request.method === 'POST') return handleUpsertVideo(request, env);
      if (path === '/api/admin/videos/delete' && request.method === 'POST') return handleDeleteVideo(request, env);
      if (path === '/api/admin/videos/restore' && request.method === 'POST') return handleRestoreVideo(request, env);
      if (path === '/api/admin/cloudinary/sign' && request.method === 'POST') return handleCloudinarySign(request, env);
      if (path === '/api/admin/enrollments' && request.method === 'GET') return handleListEnrollments(request, env);
      if (path === '/api/admin/enrollments/done' && request.method === 'POST') return handleEnrollmentDone(request, env);
      if (path === '/api/admin/enrollments/delete' && request.method === 'POST') return handleEnrollmentDelete(request, env);
      if (path === '/api/admin/orders' && request.method === 'GET') return handleListOrders(request, env);
      if (path === '/api/admin/orders/done' && request.method === 'POST') return handleOrderDone(request, env);
      if (path === '/api/admin/orders/delete' && request.method === 'POST') return handleOrderDelete(request, env);

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      // Prefer pre-built Response (keeps CORS on 401/403 from requireStudent/requireAdmin)
      if (err && err.response instanceof Response) return err.response;
      const status = err && err.status ? err.status : 500;
      return json({ error: (err && err.message) || 'Internal error' }, status);
    }
  },
};

// ==================== Helpers ====================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function uuid() {
  return crypto.randomUUID();
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Password hashing: PBKDF2 (Web Crypto). 12k iterations — safe for Workers CPU limits. */
const PBKDF2_ITERATIONS = 12000;

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, stored) {
  // stored format: salt:hash
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

async function makePasswordHash(password) {
  const salt = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

function b64encode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64encodeStr(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function b64decodeStr(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    try {
      return atob(str);
    } catch {
      return null;
    }
  }
}

/** Very simple JWT-like token (HMAC-SHA256). Not a full JWT library. */
async function signToken(payload, secret, expiresInSec = 60 * 60 * 24 * 7) {
  if (!secret) throw new Error('JWT_SECRET is not configured on the Worker');
  const header = b64encodeStr(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64encodeStr(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec }));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const signature = b64encode(sig);
  return `${data}.${signature}`;
}

async function verifyToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const data = `${header}.${body}`;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(secret)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    let sigBytes;
    try {
      sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    } catch {
      return null;
    }
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const json = b64decodeStr(body);
    if (!json) return null;
    const payload = JSON.parse(json);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearer(request) {
  const h = request.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function requireStudent(request, env) {
  const token = getBearer(request);
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload || payload.role !== 'student') {
    // Return a Response (not throw) so CORS headers are always present
    const err = new Error('Unauthorized');
    err.status = 401;
    err.response = json({ error: 'Sessão inválida ou expirada. Entre novamente.' }, 401);
    throw err;
  }
  return payload;
}

/** Block suspended accounts from courses/videos even with a valid session token. */
async function requireActiveStudent(request, env) {
  const payload = await requireStudent(request, env);
  const user = await env.DB.prepare('SELECT id, status FROM users WHERE id = ?')
    .bind(payload.sub)
    .first();
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    err.response = json({ error: 'Sessão inválida ou expirada. Entre novamente.' }, 401);
    throw err;
  }
  if (user.status === 'suspended') {
    const err = new Error('Conta suspensa');
    err.status = 403;
    err.response = json(
      { error: 'Conta suspensa. Contacte a academia.', code: 'suspended' },
      403
    );
    throw err;
  }
  return payload;
}

async function requireAdmin(request, env) {
  const token = getBearer(request);
  // Admin tokens are simple: we also accept the raw password in a special header for the blueprint style,
  // but prefer a short-lived admin token.
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (payload && payload.role === 'admin') return payload;

  // Fallback: Authorization: Bearer <ADMIN_PASSWORD>
  if (token && token === env.ADMIN_PASSWORD) {
    return { role: 'admin' };
  }
  const err = new Error('Unauthorized');
  err.status = 401;
  err.response = json({ error: 'Não autorizado.' }, 401);
  throw err;
}

// ==================== Auth handlers ====================

async function handleRegister(request, env) {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  if (!env.JWT_SECRET) return json({ error: 'JWT_SECRET not configured. Run: wrangler secret put JWT_SECRET' }, 500);

  const body = await readBody(request);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const name = (body.name || '').trim();

  if (!email || !password || password.length < 6) {
    return json({ error: 'Email e palavra-passe (mín. 6 caracteres) são obrigatórios.' }, 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return json({ error: 'Este email já está registado.' }, 409);

  const id = uuid();
  const password_hash = await makePasswordHash(password);

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, name, status) VALUES (?, ?, ?, ?, 'pending')`
  ).bind(id, email, password_hash, name || null).run();

  const token = await signToken({ sub: id, email, role: 'student' }, env.JWT_SECRET);
  return json({
    token,
    user: { id, email, name, status: 'pending', picture: null, phone: null, has_password: true },
  });
}

async function handleLogin(request, env) {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  if (!env.JWT_SECRET) return json({ error: 'JWT_SECRET not configured. Run: wrangler secret put JWT_SECRET' }, 500);

  const body = await readBody(request);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) return json({ error: 'Email e palavra-passe obrigatórios.' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user || !user.password_hash) return json({ error: 'Credenciais inválidas.' }, 401);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return json({ error: 'Credenciais inválidas.' }, 401);

  if (user.status === 'suspended') return json({ error: 'Conta suspensa. Contacte a academia.' }, 403);

  const token = await signToken({ sub: user.id, email: user.email, role: 'student' }, env.JWT_SECRET);
  return json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      status: user.status,
      phone: user.phone || null,
      has_password: !!user.password_hash,
    },
  });
}

async function handleGoogle(request, env) {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  if (!env.JWT_SECRET) return json({ error: 'JWT_SECRET not configured. Run: wrangler secret put JWT_SECRET' }, 500);

  const body = await readBody(request);
  const idToken = body.credential || body.id_token;
  if (!idToken) return json({ error: 'Missing Google credential' }, 400);

  // Verify with Google tokeninfo (simple, good enough for free tier)
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) return json({ error: 'Invalid Google token' }, 401);
  const info = await res.json();

  // Optional: check audience matches our client ID
  if (info.aud !== env.GOOGLE_CLIENT_ID) {
    return json({ error: 'Token audience mismatch' }, 401);
  }

  const email = (info.email || '').toLowerCase();
  const google_id = info.sub;
  const name = info.name || '';
  const picture = info.picture || null;

  if (!email) return json({ error: 'Google account has no email' }, 400);

  let user = await env.DB.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?')
    .bind(google_id, email)
    .first();

  if (!user) {
    const id = uuid();
    await env.DB.prepare(
      `INSERT INTO users (id, email, google_id, name, picture, status) VALUES (?, ?, ?, ?, ?, 'pending')`
    ).bind(id, email, google_id, name, picture).run();
    user = { id, email, name, picture, status: 'pending', google_id };
  } else {
    // Link google_id if missing
    if (!user.google_id) {
      await env.DB.prepare('UPDATE users SET google_id = ?, name = COALESCE(name, ?), picture = COALESCE(picture, ?), updated_at = datetime(\'now\') WHERE id = ?')
        .bind(google_id, name, picture, user.id).run();
    }
  }

  if (user.status === 'suspended') return json({ error: 'Conta suspensa.' }, 403);

  // Refresh user row after possible link update
  user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

  const token = await signToken({ sub: user.id, email: user.email, role: 'student' }, env.JWT_SECRET);
  return json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || name,
      picture: user.picture || picture,
      status: user.status,
      phone: user.phone || null,
      has_password: !!user.password_hash,
    },
  });
}

async function handleMe(request, env) {
  const payload = await requireStudent(request, env);
  const user = await env.DB.prepare(
    'SELECT id, email, name, picture, status, phone, created_at, password_hash FROM users WHERE id = ?'
  )
    .bind(payload.sub)
    .first();
  if (!user) return json({ error: 'User not found' }, 404);
  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      status: user.status,
      phone: user.phone,
      created_at: user.created_at,
      has_password: !!user.password_hash,
    },
  });
}

// ==================== Student handlers ====================

async function handleStudentCourses(request, env) {
  const payload = await requireActiveStudent(request, env);

  const { results: courses } = await env.DB.prepare(`
    SELECT c.id, c.title_pt, c.title_en, c.description_pt, c.description_en, c.cover_url,
           uc.status AS access_status, uc.granted_at, uc.expires_at
    FROM user_courses uc
    JOIN courses c ON c.id = uc.course_id
    WHERE uc.user_id = ? AND uc.status = 'active' AND c.active = 1
    ORDER BY c.sort_order, c.title_pt
  `).bind(payload.sub).all();

  // Attach videos + progress for each course
  for (const course of courses) {
    let videos = [];
    try {
      const res = await env.DB.prepare(`
        SELECT v.id, v.title_pt, v.title_en, v.description_pt, v.duration_seconds, v.sort_order,
               COALESCE(wp.position_seconds, 0) AS position_seconds,
               COALESCE(wp.completed, 0) AS completed,
               wp.updated_at AS progress_updated_at
        FROM videos v
        LEFT JOIN watch_progress wp ON wp.video_id = v.id AND wp.user_id = ?
        WHERE v.course_id = ? AND v.active = 1
        ORDER BY v.sort_order, v.title_pt
      `).bind(payload.sub, course.id).all();
      videos = res.results || [];
    } catch (_) {
      // Fallback if watch_progress table not migrated yet
      const res = await env.DB.prepare(`
        SELECT id, title_pt, title_en, description_pt, duration_seconds, sort_order
        FROM videos
        WHERE course_id = ? AND active = 1
        ORDER BY sort_order, title_pt
      `).bind(course.id).all();
      videos = (res.results || []).map((v) => ({
        ...v,
        position_seconds: 0,
        completed: 0,
        progress_updated_at: null,
      }));
    }

    const total = videos.length;
    const done = videos.filter((v) => v.completed).length;
    course.videos = videos.map((v) => ({
      id: v.id,
      title_pt: v.title_pt,
      title_en: v.title_en,
      description_pt: v.description_pt,
      duration_seconds: v.duration_seconds,
      sort_order: v.sort_order,
      position_seconds: Number(v.position_seconds) || 0,
      completed: !!v.completed,
      progress_updated_at: v.progress_updated_at || null,
    }));
    course.progress = {
      total,
      completed: done,
      percent: total ? Math.round((done / total) * 100) : 0,
    };

    // First incomplete video for "Continuar"
    const next = course.videos.find((v) => !v.completed) || null;
    course.continue_video = next
      ? { id: next.id, title_pt: next.title_pt, title_en: next.title_en, position_seconds: next.position_seconds }
      : null;
  }

  // Global last watched (most recent progress across all courses)
  let lastWatched = null;
  try {
    lastWatched = await env.DB.prepare(`
      SELECT v.id, v.title_pt, v.title_en, v.duration_seconds, c.id AS course_id, c.title_pt AS course_title_pt,
             wp.position_seconds, wp.completed, wp.updated_at
      FROM watch_progress wp
      JOIN videos v ON v.id = wp.video_id AND v.active = 1
      JOIN courses c ON c.id = v.course_id AND c.active = 1
      JOIN user_courses uc ON uc.course_id = c.id AND uc.user_id = wp.user_id AND uc.status = 'active'
      WHERE wp.user_id = ? AND wp.completed = 0 AND wp.position_seconds > 5
      ORDER BY wp.updated_at DESC
      LIMIT 1
    `).bind(payload.sub).first();
  } catch (_) {
    // Table may not exist yet on first deploy
    lastWatched = null;
  }

  return json({
    courses,
    last_watched: lastWatched
      ? {
          id: lastWatched.id,
          title_pt: lastWatched.title_pt,
          title_en: lastWatched.title_en,
          duration_seconds: lastWatched.duration_seconds,
          course_id: lastWatched.course_id,
          course_title_pt: lastWatched.course_title_pt,
          position_seconds: Number(lastWatched.position_seconds) || 0,
        }
      : null,
  });
}

async function handleSaveProgress(request, env, videoId) {
  const payload = await requireActiveStudent(request, env);
  const body = await readBody(request);

  // Ownership check
  const row = await env.DB.prepare(`
    SELECT v.id, v.duration_seconds
    FROM videos v
    JOIN user_courses uc ON uc.course_id = v.course_id
    WHERE v.id = ? AND uc.user_id = ? AND uc.status = 'active' AND v.active = 1
  `).bind(videoId, payload.sub).first();

  if (!row) return json({ error: 'Acesso negado ou vídeo não encontrado.' }, 403);

  let position = Number(body.position_seconds);
  if (!Number.isFinite(position) || position < 0) position = 0;
  position = Math.floor(position);

  const duration = Number(row.duration_seconds) || 0;
  let completed = body.completed === true || body.completed === 1 || body.completed === '1';
  // Auto-complete near end (≥ 90% or within 15s of end)
  if (duration > 0 && (position / duration >= 0.9 || duration - position <= 15)) {
    completed = true;
    position = duration;
  }

  try {
    await env.DB.prepare(`
      INSERT INTO watch_progress (user_id, video_id, position_seconds, completed, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, video_id) DO UPDATE SET
        position_seconds = excluded.position_seconds,
        completed = CASE
          WHEN watch_progress.completed = 1 THEN 1
          ELSE excluded.completed
        END,
        updated_at = datetime('now')
    `).bind(payload.sub, videoId, position, completed ? 1 : 0).run();
  } catch (err) {
    // If table missing, surface a clear error
    if (String(err.message || '').includes('no such table')) {
      return json({ error: 'Tabela watch_progress em falta. Execute schema.sql no D1.' }, 500);
    }
    throw err;
  }

  return json({ ok: true, position_seconds: position, completed });
}

async function handleUpdateProfile(request, env) {
  const payload = await requireStudent(request, env);
  const body = await readBody(request);
  const name = body.name != null ? String(body.name).trim() : null;
  const phone = body.phone != null ? String(body.phone).trim() : null;

  if (name !== null && name.length > 120) {
    return json({ error: 'Nome demasiado longo.' }, 400);
  }
  if (phone !== null && phone.length > 40) {
    return json({ error: 'Telefone inválido.' }, 400);
  }

  const user = await env.DB.prepare('SELECT id, email, name, picture, status, phone, password_hash FROM users WHERE id = ?')
    .bind(payload.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const newName = name !== null ? name || null : user.name;
  const newPhone = phone !== null ? phone || null : user.phone;

  await env.DB.prepare(
    `UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(newName, newPhone, user.id).run();

  return json({
    user: {
      id: user.id,
      email: user.email,
      name: newName,
      picture: user.picture,
      status: user.status,
      phone: newPhone,
      has_password: !!user.password_hash,
    },
  });
}

async function handleChangePassword(request, env) {
  const payload = await requireStudent(request, env);
  const body = await readBody(request);
  const current = body.current_password || '';
  const next = body.new_password || '';

  if (!next || next.length < 6) {
    return json({ error: 'Nova palavra-passe deve ter pelo menos 6 caracteres.' }, 400);
  }

  const user = await env.DB.prepare('SELECT id, email, name, picture, status, phone, password_hash FROM users WHERE id = ?')
    .bind(payload.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);

  if (user.password_hash) {
    if (!current) return json({ error: 'Indique a palavra-passe actual.' }, 400);
    const ok = await verifyPassword(current, user.password_hash);
    if (!ok) return json({ error: 'Palavra-passe actual incorrecta.' }, 401);
  }
  // Google-only accounts can set a password without current

  const password_hash = await makePasswordHash(next);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(password_hash, user.id).run();

  return json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      status: user.status,
      phone: user.phone,
      has_password: true,
    },
  });
}

async function handleSignedVideoUrl(request, env, videoId) {
  const payload = await requireActiveStudent(request, env);

  // Check ownership + return progress for resume
  const row = await env.DB.prepare(`
    SELECT v.cloudinary_public_id, v.title_pt, v.duration_seconds,
           COALESCE(wp.position_seconds, 0) AS position_seconds,
           COALESCE(wp.completed, 0) AS completed
    FROM videos v
    JOIN user_courses uc ON uc.course_id = v.course_id
    LEFT JOIN watch_progress wp ON wp.video_id = v.id AND wp.user_id = ?
    WHERE v.id = ? AND uc.user_id = ? AND uc.status = 'active' AND v.active = 1
  `).bind(payload.sub, videoId, payload.sub).first();

  if (!row) return json({ error: 'Acesso negado ou vídeo não encontrado.' }, 403);

  if (!env.CLOUDINARY_API_SECRET) {
    return json({ error: 'Cloudinary não configurado no Worker.' }, 500);
  }

  // Authenticated delivery signed URL
  // Docs: https://cloudinary.com/documentation/delivery_url_signatures
  // Signature = first 8 chars of URL-safe base64(SHA-1( path_after_signature + api_secret ))
  // path_after_signature = [transformations/][version/]public_id[.format]
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'lfoop5b8';
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const publicId = row.cloudinary_public_id;

  // Include .mp4 so the browser gets a proper video Content-Type
  const deliveryPath = `${publicId}.mp4`;
  const signature = await cloudinaryDeliverySignature(deliveryPath, apiSecret);

  const url = `https://res.cloudinary.com/${cloudName}/video/authenticated/s--${signature}--/${deliveryPath}`;

  return json({
    url,
    title: row.title_pt,
    duration_seconds: row.duration_seconds || null,
    position_seconds: Number(row.position_seconds) || 0,
    completed: !!row.completed,
  });
}

/** Hex SHA-1 (used for upload API signatures). */
async function sha1(message) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cloudinary delivery URL signature (authenticated / signed delivery).
 * First 8 characters of URL-safe base64(SHA-1(toSign + apiSecret)).
 * toSign is the slash-joined path that appears after /s--SIG--/ in the URL.
 */
async function cloudinaryDeliverySignature(toSign, apiSecret) {
  const data = new TextEncoder().encode(toSign + apiSecret);
  const hash = await crypto.subtle.digest('SHA-1', data);
  // URL-safe base64 without padding
  const bytes = new Uint8Array(hash);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64.slice(0, 8);
}

// ==================== Admin handlers ====================

async function handleAdminLogin(request, env) {
  const body = await readBody(request);
  const password = body.password || '';
  if (!env.ADMIN_PASSWORD) {
    return json({
      error: 'ADMIN_PASSWORD não está configurada no Worker. Execute: npx wrangler secret put ADMIN_PASSWORD',
    }, 500);
  }
  if (!password || password !== env.ADMIN_PASSWORD) {
    return json({ error: 'Palavra-passe incorrecta.' }, 401);
  }
  if (!env.JWT_SECRET) {
    return json({
      error: 'JWT_SECRET não está configurado no Worker. Execute: npx wrangler secret put JWT_SECRET',
    }, 500);
  }
  const token = await signToken({ role: 'admin' }, env.JWT_SECRET, 60 * 60 * 12); // 12h
  return json({ token, role: 'admin' });
}

async function handlePublish(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  const catalog = body.catalog;
  if (!catalog) return json({ error: 'Missing catalog' }, 400);

  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const folder = env.CLOUDINARY_FOLDER || 'academiasemente';
  const publicId = `${folder}/catalog`;
  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signed raw upload
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = await sha1(toSign);

  const form = new FormData();
  form.append('file', new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' }), 'catalog.json');
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('signature', signature);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    body: form,
  });

  const result = await uploadRes.json();
  if (!uploadRes.ok) {
    console.error(result);
    return json({ error: 'Cloudinary upload failed', detail: result }, 502);
  }

  return json({ ok: true, url: result.secure_url, public_id: result.public_id });
}

async function handleListStudents(request, env) {
  await requireAdmin(request, env);
  const { results } = await env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.picture, u.status, u.phone, u.created_at, u.updated_at,
           (SELECT COUNT(*) FROM user_courses uc WHERE uc.user_id = u.id AND uc.status = 'active') AS courses_count
    FROM users u
    ORDER BY u.created_at DESC
    LIMIT 500
  `).all();

  // Attach all grants (active + history) for admin UI
  for (const s of results) {
    const { results: grants } = await env.DB.prepare(`
      SELECT uc.course_id, c.title_pt, uc.granted_at, uc.status, uc.expires_at
      FROM user_courses uc
      JOIN courses c ON c.id = uc.course_id
      WHERE uc.user_id = ?
      ORDER BY uc.status ASC, c.title_pt
    `).bind(s.id).all();
    const all = grants || [];
    s.courses = all.filter((g) => g.status === 'active');
    s.course_history = all;
  }

  return json({ students: results });
}

async function handleUpdateStudent(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id required' }, 400);

  const allowedStatus = ['pending', 'active', 'suspended'];
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(body.id).first();
  if (!user) return json({ error: 'Aluno não encontrado' }, 404);

  const name = body.name !== undefined ? (body.name || null) : user.name;
  const phone = body.phone !== undefined ? (body.phone || null) : user.phone;
  let status = user.status;
  if (body.status !== undefined) {
    if (!allowedStatus.includes(body.status)) {
      return json({ error: 'status inválido (pending|active|suspended)' }, 400);
    }
    status = body.status;
  }

  await env.DB.prepare(`
    UPDATE users SET name = ?, phone = ?, status = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(name, phone, status, body.id).run();

  return json({
    ok: true,
    user: { id: body.id, email: user.email, name, phone, status },
  });
}

async function handleDeleteStudent(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id required' }, 400);

  // Cascades: user_courses and sessions have ON DELETE CASCADE in schema
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(body.id).run();
  await env.DB.prepare('DELETE FROM user_courses WHERE user_id = ?').bind(body.id).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(body.id).run();

  return json({ ok: true });
}

async function handleGrantCourse(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  const { user_id, course_id, expires_at } = body;
  if (!user_id || !course_id) return json({ error: 'user_id and course_id required' }, 400);

  await env.DB.prepare(`
    INSERT INTO user_courses (user_id, course_id, status, expires_at)
    VALUES (?, ?, 'active', ?)
    ON CONFLICT(user_id, course_id) DO UPDATE SET status = 'active', expires_at = excluded.expires_at, granted_at = datetime('now')
  `).bind(user_id, course_id, expires_at || null).run();

  // Optionally activate the user
  await env.DB.prepare(`UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ? AND status = 'pending'`)
    .bind(user_id).run();

  return json({ ok: true });
}

async function handleRevokeCourse(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  const { user_id, course_id } = body;
  if (!user_id || !course_id) return json({ error: 'user_id and course_id required' }, 400);

  await env.DB.prepare(`
    UPDATE user_courses SET status = 'revoked' WHERE user_id = ? AND course_id = ?
  `).bind(user_id, course_id).run();

  return json({ ok: true });
}

async function handleListCourses(request, env) {
  await requireAdmin(request, env);
  const { results: courses } = await env.DB.prepare(`
    SELECT * FROM courses ORDER BY sort_order, title_pt
  `).all();
  for (const c of courses) {
    const { results: videos } = await env.DB.prepare(`
      SELECT id, title_pt, title_en, cloudinary_public_id, duration_seconds, sort_order, active
      FROM videos WHERE course_id = ? ORDER BY sort_order
    `).bind(c.id).all();
    c.videos = videos;
  }
  return json({ courses });
}

async function handleUpsertCourse(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  const id = body.id || uuid();
  await env.DB.prepare(`
    INSERT INTO courses (id, title_pt, title_en, description_pt, description_en, cover_url, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title_pt = excluded.title_pt,
      title_en = excluded.title_en,
      description_pt = excluded.description_pt,
      description_en = excluded.description_en,
      cover_url = excluded.cover_url,
      active = excluded.active,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `).bind(
    id,
    body.title_pt || 'Sem título',
    body.title_en || null,
    body.description_pt || null,
    body.description_en || null,
    body.cover_url || null,
    body.active !== undefined ? (body.active ? 1 : 0) : 1,
    body.sort_order || 0
  ).run();
  return json({ ok: true, id });
}

async function handleUpsertVideo(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.course_id || !body.cloudinary_public_id) {
    return json({ error: 'course_id and cloudinary_public_id required' }, 400);
  }
  const id = body.id || uuid();
  await env.DB.prepare(`
    INSERT INTO videos (id, course_id, title_pt, title_en, description_pt, cloudinary_public_id, duration_seconds, sort_order, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      course_id = excluded.course_id,
      title_pt = excluded.title_pt,
      title_en = excluded.title_en,
      description_pt = excluded.description_pt,
      cloudinary_public_id = excluded.cloudinary_public_id,
      duration_seconds = excluded.duration_seconds,
      sort_order = excluded.sort_order,
      active = excluded.active,
      updated_at = datetime('now')
  `).bind(
    id,
    body.course_id,
    body.title_pt || 'Vídeo',
    body.title_en || null,
    body.description_pt || null,
    body.cloudinary_public_id,
    body.duration_seconds || null,
    body.sort_order || 0,
    body.active !== undefined ? (body.active ? 1 : 0) : 1
  ).run();
  return json({ ok: true, id });
}

/**
 * Delete course.
 * body.permanent === true → hard delete (course + videos + grants)
 * otherwise soft-delete (active = 0)
 */
async function handleDeleteCourse(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id required' }, 400);

  if (body.permanent) {
    await env.DB.prepare('DELETE FROM user_courses WHERE course_id = ?').bind(body.id).run();
    await env.DB.prepare('DELETE FROM videos WHERE course_id = ?').bind(body.id).run();
    await env.DB.prepare('DELETE FROM courses WHERE id = ?').bind(body.id).run();
    return json({ ok: true, permanent: true });
  }

  await env.DB.prepare(`
    UPDATE courses SET active = 0, updated_at = datetime('now') WHERE id = ?
  `).bind(body.id).run();
  return json({ ok: true, permanent: false });
}

/** Restore soft-deleted course (active = 1). */
async function handleRestoreCourse(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id required' }, 400);
  await env.DB.prepare(`
    UPDATE courses SET active = 1, updated_at = datetime('now') WHERE id = ?
  `).bind(body.id).run();
  return json({ ok: true });
}

/**
 * Delete video.
 * body.permanent === true → hard delete row
 * otherwise soft-delete (active = 0)
 */
async function handleDeleteVideo(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id required' }, 400);

  if (body.permanent) {
    await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(body.id).run();
    return json({ ok: true, permanent: true });
  }

  await env.DB.prepare(`
    UPDATE videos SET active = 0, updated_at = datetime('now') WHERE id = ?
  `).bind(body.id).run();
  return json({ ok: true, permanent: false });
}

/** Restore soft-deleted video (active = 1). */
async function handleRestoreVideo(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id required' }, 400);
  await env.DB.prepare(`
    UPDATE videos SET active = 1, updated_at = datetime('now') WHERE id = ?
  `).bind(body.id).run();
  return json({ ok: true });
}

/**
 * Signed params for direct browser upload of authenticated videos to Cloudinary.
 * Client uploads the file to Cloudinary, then POSTs /api/admin/videos with the public_id.
 */
async function handleCloudinarySign(request, env) {
  await requireAdmin(request, env);
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return json({
      error: 'Cloudinary secrets missing. Run: wrangler secret put CLOUDINARY_API_KEY && wrangler secret put CLOUDINARY_API_SECRET',
    }, 500);
  }

  const body = await readBody(request);
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'lfoop5b8';
  const folder = env.CLOUDINARY_FOLDER || 'academiasemente';
  const timestamp = Math.floor(Date.now() / 1000);
  const slug = (body.slug || uuid().replace(/-/g, '').slice(0, 10)).replace(/[^a-zA-Z0-9_-]/g, '-');

  // resource_type: 'video' (default, private lessons) | 'image' (public course covers)
  const resourceType = body.resource_type === 'image' ? 'image' : 'video';

  let publicId;
  let type;
  let signParams;

  if (resourceType === 'image') {
    // Public delivery so student dashboard <img> works without signed URLs
    publicId = body.public_id || `${folder}/covers/${slug}`;
    type = 'upload';
    signParams = {
      public_id: publicId,
      timestamp: String(timestamp),
    };
  } else {
    publicId = body.public_id || `${folder}/private/${slug}`;
    type = 'authenticated';
    signParams = {
      public_id: publicId,
      timestamp: String(timestamp),
      type: 'authenticated',
    };
  }

  // Params that go into the signature (alphabetical order required by Cloudinary)
  const toSign =
    Object.keys(signParams)
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join('&') + env.CLOUDINARY_API_SECRET;
  const signature = await sha1(toSign);

  return json({
    cloud_name: cloudName,
    api_key: env.CLOUDINARY_API_KEY,
    timestamp,
    public_id: publicId,
    type,
    resource_type: resourceType,
    signature,
    upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
  });
}

// ==================== Enrolments (Inscrições) ====================

const COURSE_PRICES_KZ = {
  Online: 10525,
  Presencial: 15225,
  Domiciliar: 100000,
  'Teste de nível': 0,
};

const PAYMENT_METHODS = ['referencia', 'iban', 'express'];

async function handlePublicEnroll(request, env) {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  const body = await readBody(request);

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const course = String(body.course || body.interest || '').trim();
  const payment_method = String(body.payment_method || '').trim();

  if (!name || name.length < 2) return json({ error: 'Nome é obrigatório.' }, 400);
  if (!email || !email.includes('@')) return json({ error: 'E-mail inválido.' }, 400);
  if (!phone) return json({ error: 'Telefone / WhatsApp é obrigatório.' }, 400);
  if (!course || !(course in COURSE_PRICES_KZ)) {
    return json({ error: 'Curso inválido.' }, 400);
  }
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return json({ error: 'Escolha um método de pagamento válido.' }, 400);
  }

  const amount_kz = COURSE_PRICES_KZ[course];
  const id = uuid();
  const age = body.age != null && body.age !== '' ? Number(body.age) : null;

  try {
    await env.DB.prepare(
      `INSERT INTO enrollments (
        id, name, age, marital, email, phone, address, province, municipality,
        course, level, schedule, motivation, difficulties, experience, topics, notes,
        amount_kz, payment_method, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
      .bind(
        id,
        name,
        Number.isFinite(age) ? age : null,
        String(body.marital || '').trim() || null,
        email,
        phone,
        String(body.address || '').trim() || null,
        String(body.province || '').trim() || null,
        String(body.municipality || '').trim() || null,
        course,
        String(body.level || '').trim() || null,
        String(body.schedule || '').trim() || null,
        String(body.motivation || '').trim() || null,
        String(body.difficulties || '').trim() || null,
        String(body.experience || '').trim() || null,
        String(body.topics || '').trim() || null,
        String(body.notes || body.message || '').trim() || null,
        amount_kz,
        payment_method
      )
      .run();
  } catch (err) {
    if (String(err.message || '').includes('no such table')) {
      return json({ error: 'Tabela enrollments em falta. Execute schema.sql no D1.' }, 500);
    }
    throw err;
  }

  return json({
    ok: true,
    id,
    amount_kz,
    payment_method,
    course,
  });
}

async function handleListEnrollments(request, env) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || '').trim();

  let sql = `SELECT * FROM enrollments`;
  const binds = [];
  if (status === 'pending' || status === 'done') {
    sql += ` WHERE status = ?`;
    binds.push(status);
  }
  sql += ` ORDER BY created_at DESC LIMIT 200`;

  try {
    const stmt = env.DB.prepare(sql);
    const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return json({ enrollments: results || [] });
  } catch (err) {
    if (String(err.message || '').includes('no such table')) {
      return json({ enrollments: [], error: 'Tabela enrollments em falta. Execute schema.sql.' });
    }
    throw err;
  }
}

async function handleEnrollmentDone(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id obrigatório' }, 400);
  await env.DB.prepare(
    `UPDATE enrollments SET status = 'done', updated_at = datetime('now') WHERE id = ?`
  )
    .bind(body.id)
    .run();
  return json({ ok: true });
}

async function handleEnrollmentDelete(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id obrigatório' }, 400);
  await env.DB.prepare(`DELETE FROM enrollments WHERE id = ?`).bind(body.id).run();
  return json({ ok: true });
}

// ==================== Orders (Encomendas) ====================

async function handlePublicOrder(request, env) {
  if (!env.DB) return json({ error: 'Database not configured' }, 500);
  const body = await readBody(request);

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const payment_method = String(body.payment_method || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name || name.length < 2) return json({ error: 'Nome é obrigatório.' }, 400);
  if (!phone) return json({ error: 'Telefone / WhatsApp é obrigatório.' }, 400);
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return json({ error: 'Escolha um método de pagamento válido.' }, 400);
  }
  if (!items.length) return json({ error: 'Carrinho vazio.' }, 400);

  const cleanItems = items.map((it) => ({
    id: String(it.id || ''),
    name: String(it.name || ''),
    nameEn: String(it.nameEn || it.name || ''),
    price: Math.max(0, Math.round(Number(it.price) || 0)),
    qty: Math.max(1, Math.round(Number(it.qty) || 1)),
  }));

  const total_kz = cleanItems.reduce((s, it) => s + it.price * it.qty, 0);
  const id = uuid();

  try {
    await env.DB.prepare(
      `INSERT INTO orders (
        id, name, phone, email, address, province, municipality, notes,
        items_json, total_kz, payment_method, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
      .bind(
        id,
        name,
        phone,
        String(body.email || '').trim().toLowerCase() || null,
        String(body.address || '').trim() || null,
        String(body.province || '').trim() || null,
        String(body.municipality || '').trim() || null,
        String(body.notes || '').trim() || null,
        JSON.stringify(cleanItems),
        total_kz,
        payment_method
      )
      .run();
  } catch (err) {
    if (String(err.message || '').includes('no such table')) {
      return json({ error: 'Tabela orders em falta. Execute schema.sql no D1.' }, 500);
    }
    throw err;
  }

  return json({ ok: true, id, total_kz, payment_method });
}

async function handleListOrders(request, env) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || '').trim();

  let sql = `SELECT * FROM orders`;
  const binds = [];
  if (status === 'pending' || status === 'done') {
    sql += ` WHERE status = ?`;
    binds.push(status);
  }
  sql += ` ORDER BY created_at DESC LIMIT 200`;

  try {
    const stmt = env.DB.prepare(sql);
    const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    const orders = (results || []).map((o) => {
      let items = [];
      try {
        items = JSON.parse(o.items_json || '[]');
      } catch (_) {
        items = [];
      }
      return { ...o, items };
    });
    return json({ orders });
  } catch (err) {
    if (String(err.message || '').includes('no such table')) {
      return json({ orders: [], error: 'Tabela orders em falta. Execute schema.sql.' });
    }
    throw err;
  }
}

async function handleOrderDone(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id obrigatório' }, 400);
  await env.DB.prepare(
    `UPDATE orders SET status = 'done', updated_at = datetime('now') WHERE id = ?`
  )
    .bind(body.id)
    .run();
  return json({ ok: true });
}

async function handleOrderDelete(request, env) {
  await requireAdmin(request, env);
  const body = await readBody(request);
  if (!body.id) return json({ error: 'id obrigatório' }, 400);
  await env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(body.id).run();
  return json({ ok: true });
}
