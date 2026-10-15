/**
 * Academia Semente — shared config
 * Update WORKER_URL after deploying the Worker.
 */
window.ACADEMIA_CONFIG = {
  // After first deploy, replace with your real Worker URL, e.g.:
  // https://academiasemente.educationgola.workers.dev
  WORKER_URL: 'https://academiasemente.educationgola.workers.dev',

  // Cloudinary (public)
  CLOUDINARY_CLOUD_NAME: 'lfoop5b8',
  CLOUDINARY_FOLDER: 'academiasemente',
  // Live catalog (raw JSON)
  CATALOG_JSON_URL: 'https://res.cloudinary.com/lfoop5b8/raw/upload/academiasemente/catalog.json',

  // Google OAuth Client ID (public)
  GOOGLE_CLIENT_ID: '609301481037-ki70io8nvim10u59bocriok0a39q6tvt.apps.googleusercontent.com',

  // localStorage keys
  STUDENT_TOKEN_KEY: 'as_student_token',
  STUDENT_USER_KEY: 'as_student_user',
  ADMIN_TOKEN_KEY: 'as_admin_token',
};
