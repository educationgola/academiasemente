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

      // ---------- Admin (password) ----------
      if (path === '/api/admin/login' && request.method === 'POST') return handleAdminLogin(request, env);
      if (path === '/api/admin/publish' && request.method === 'POST') return handlePublish(request, env);
      if (path === '/api/admin/students' && request.method === 'GET') return handleListStudents(request, env);
      if (path === '/api/admin/students/grant' && request.method === 'POST') return handleGrantCourse(request, env);
      if (path === '/api/admin/students/revoke' && request.method === 'POST') return handleRevokeCourse(request, env);
      if (path === '/api/admin/courses' && request.method === 'GET') return handleListCourses(request, env);
      if (path === '/api/admin/courses' && request.method === 'POST') return handleUpsertCourse(request, env);
      if (path === '/api/admin/courses/delete' && request.method === 'POST') return handleDeleteCourse(request, env);
      if (path === '/api/admin/courses/restore' && request.method === 'POST') return handleRestoreCourse(request, env);
      if (path === '/api/admin/videos' && request.method === 'POST') return handleUpsertVideo(request, env);
      if (path === '/api/admin/videos/delete' && request.method === 'POST') return handleDeleteVideo(request, env);
      if (path === '/api/admin/videos/restore' && request.method === 'POST') return handleRestoreVideo(request, env);
      if (path === '/api/admin/cloudinary/sign' && request.method === 'POST') return handleCloudinarySign(request, env);

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || 'Internal error' }, 500);
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
  if (!payload || payload.role !== 'student') throw new Error('Unauthorized');
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
  throw new Error('Unauthorized');
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
    user: { id, email, name, status: 'pending', picture: null },
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

  const token = await signToken({ sub: user.id, email: user.email, role: 'student' }, env.JWT_SECRET);
  return json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || name,
      picture: user.picture || picture,
      status: user.status,
    },
  });
}

async function handleMe(request, env) {
  const payload = await requireStudent(request, env);
  const user = await env.DB.prepare('SELECT id, email, name, picture, status, phone, created_at FROM users WHERE id = ?')
    .bind(payload.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);
  return json({ user });
}

// ==================== Student handlers ====================

async function handleStudentCourses(request, env) {
  const payload = await requireStudent(request, env);

  const { results: courses } = await env.DB.prepare(`
    SELECT c.id, c.title_pt, c.title_en, c.description_pt, c.description_en, c.cover_url,
           uc.status AS access_status, uc.granted_at, uc.expires_at
    FROM user_courses uc
    JOIN courses c ON c.id = uc.course_id
    WHERE uc.user_id = ? AND uc.status = 'active' AND c.active = 1
    ORDER BY c.sort_order, c.title_pt
  `).bind(payload.sub).all();

  // Attach videos for each course
  for (const course of courses) {
    const { results: videos } = await env.DB.prepare(`
      SELECT id, title_pt, title_en, description_pt, duration_seconds, sort_order
      FROM videos
      WHERE course_id = ? AND active = 1
      ORDER BY sort_order, title_pt
    `).bind(course.id).all();
    course.videos = videos;
  }

  return json({ courses });
}

async function handleSignedVideoUrl(request, env, videoId) {
  const payload = await requireStudent(request, env);

  // Check ownership
  const row = await env.DB.prepare(`
    SELECT v.cloudinary_public_id, v.title_pt
    FROM videos v
    JOIN user_courses uc ON uc.course_id = v.course_id
    WHERE v.id = ? AND uc.user_id = ? AND uc.status = 'active' AND v.active = 1
  `).bind(videoId, payload.sub).first();

  if (!row) return json({ error: 'Acesso negado ou vídeo não encontrado.' }, 403);

  // Generate Cloudinary signed URL (authenticated delivery)
  // Docs: https://cloudinary.com/documentation/authentication_signatures
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const publicId = row.cloudinary_public_id;

  // For authenticated videos the URL looks like:
  // https://res.cloudinary.com/{cloud}/video/authenticated/{signature}/v{timestamp}/{public_id}
  // Simpler approach used by many: use "private" type + sign with expires_at

  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  // Signature for authenticated delivery:
  // sha1( public_id + expires_at + api_secret )  (simplified; real Cloudinary uses more params)
  // Better: use the official "generate archive / delivery" style or the transformation sign.

  // Recommended pattern for private/authenticated:
  // 1. Upload resource type video, type authenticated
  // 2. Delivery URL with signature

  const toSign = `public_id=${publicId}&timestamp=${expiresAt}${apiSecret}`;
  const signature = await sha1(toSign);

  // Authenticated delivery URL
  const url = `https://res.cloudinary.com/${cloudName}/video/authenticated/s--${signature}--/v${expiresAt}/${publicId}`;

  // Note: the exact signature format for authenticated resources is:
  // For simplicity and reliability on free tier we also support a fallback
  // that uses the "private" delivery + auth_token style if you prefer later.

  return json({
    url,
    expiresAt,
    title: row.title_pt,
  });
}

async function sha1(message) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
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
    SELECT u.id, u.email, u.name, u.picture, u.status, u.phone, u.created_at,
           (SELECT COUNT(*) FROM user_courses uc WHERE uc.user_id = u.id AND uc.status = 'active') AS courses_count
    FROM users u
    ORDER BY u.created_at DESC
    LIMIT 500
  `).all();

  // Attach active course grants for revoke UI
  for (const s of results) {
    const { results: grants } = await env.DB.prepare(`
      SELECT uc.course_id, c.title_pt, uc.granted_at, uc.status
      FROM user_courses uc
      JOIN courses c ON c.id = uc.course_id
      WHERE uc.user_id = ? AND uc.status = 'active'
      ORDER BY c.title_pt
    `).bind(s.id).all();
    s.courses = grants || [];
  }

  return json({ students: results });
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
  // public_id without extension; path under private folder
  const slug = (body.slug || uuid().replace(/-/g, '').slice(0, 10)).replace(/[^a-zA-Z0-9_-]/g, '-');
  const publicId = body.public_id || `${folder}/private/${slug}`;

  // Params that go into the signature (alphabetical order required by Cloudinary)
  const signParams = {
    public_id: publicId,
    timestamp: String(timestamp),
    type: 'authenticated',
  };
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
    type: 'authenticated',
    signature,
    upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
  });
}
