const fs = require('fs');
const assert = require('assert');
const sql = fs.readFileSync('supabase/migrations/202610190075_coordination_role_and_archive_history_merge.sql','utf8');
const auth = fs.readFileSync('DEFEN-DASHBOARD-trabajo/js/auth.js','utf8');
const html = fs.readFileSync('DEFEN-DASHBOARD-trabajo/index.html','utf8');

assert(sql.includes("'coordinacion_general'"));
assert(sql.includes("pr.status='ARCHIVED'"));
assert(sql.includes('where project_id=v_project_id'));
assert(sql.includes("'matched_archived_projects'"));
assert(html.includes('value="coordinacion_general"'));
assert(auth.includes("return rolActual() === 'admin'\n        && backendUsaSupabase()"), 'Usuarios debe seguir siendo exclusivo de Admin');
assert(auth.includes("['admin', 'coordinacion_general'].includes(rolActual())"), 'Coordinacion debe ver Auditoria/Salud');
console.log('OK migracion 75: historico y permisos verificados');
