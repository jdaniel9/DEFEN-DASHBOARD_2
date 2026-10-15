const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const sql = fs.readFileSync(path.join(workspaceRoot, 'supabase', 'migrations', '202610120066_project_onboarding_personnel_verifier.sql'), 'utf8');
const projects = fs.readFileSync(path.join(projectRoot, 'js', 'project-management.js'), 'utf8');
const attendance = fs.readFileSync(path.join(projectRoot, 'js', 'asistencia.js'), 'utf8');
const supabase = fs.readFileSync(path.join(projectRoot, 'js', 'supabase.js'), 'utf8');
const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

test('migration 66 protects factor and exposes roster operations', () => {
  for (const token of [
    'onboarding_status', 'required_mobile_guard_count', 'required_agent_count',
    'Solo Gerencia puede aumentar o reducir el factor humano',
    'import_project_personnel_roster', 'reset_open_attendance_roster',
    'confirm_project_onboarding'
  ]) assert.ok(sql.includes(token), `missing ${token}`);
});

test('project UI generates and validates the five-column personnel template', () => {
  for (const token of [
    "['PUESTO','HORARIO','FECHA INGRESO','CEDULA','NOMBRE']",
    'SACAFRANCO', 'VALIDAR ARCHIVO', 'VERIFICADOR DE PERSONAL',
    'FACTOR HUMANO TOTAL', 'CONTEMPLA ARMAMENTO'
  ]) assert.ok(projects.includes(token), `missing ${token}`);
});

test('attendance exposes import, reset and close diagnostics', () => {
  assert.match(attendance, /IMPORTAR PERSONAL/);
  assert.match(attendance, /REINICIAR PRUEBA/);
  assert.match(attendance, /REVISAR CIERRE/);
  assert.match(supabase, /get_project_onboarding_workspace/);
  assert.match(supabase, /import_project_personnel_roster/);
  assert.match(html, /project-management\.js\?v=20261012-migracion66/);
});
