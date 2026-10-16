const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('weapon month closure creates one open period and immutable snapshot',()=>{
  const sql=read('supabase/migrations/202610150072_weapon_month_closure_and_observations.sql');
  assert.match(sql,/create table if not exists public\.weapon_control_periods/i);
  assert.match(sql,/weapon_control_one_open_period/i);
  assert.match(sql,/closure_snapshot/i);
  assert.match(sql,/close_weapon_control_month/i);
  assert.match(sql,/reports_generated/i);
  assert.match(sql,/No se puede modificar un mes de armamento cerrado/i);
});

test('weapon activity is added automatically to monthly observations',()=>{
  const sql=read('supabase/migrations/202610150072_weapon_month_closure_and_observations.sql');
  assert.match(sql,/weapon_monthly_events/i);
  assert.match(sql,/weapons_monthly_event/i);
  assert.match(sql,/weapon_movements_monthly_event/i);
  assert.match(sql,/weapon_technical_monthly_event/i);
  assert.match(sql,/weapon_daily_controls_monthly_event/i);
  assert.match(sql,/INGRESO DE ARMA/i);
  assert.match(sql,/SALIDA DE INVENTARIO/i);
});

test('frontend exports PDF and Excel before closing and opens next month',()=>{
  const js=read('DEFEN-DASHBOARD-trabajo/js/weapon-control.js');
  const api=read('DEFEN-DASHBOARD-trabajo/js/supabase.js');
  const html=read('DEFEN-DASHBOARD-trabajo/index.html');
  assert.match(js,/wcExportPdf/);assert.match(js,/wcExportExcel/);assert.match(js,/wcOpenClosure/);assert.match(js,/wcExecuteClosure/);
  assert.match(js,/OBSERVACIONES Y MOVIMIENTOS DEL MES/);
  assert.match(api,/preview_weapon_month_closure/);assert.match(api,/close_weapon_control_month/);
  assert.match(html,/weapon-control\.js\?v=20261015-migracion72/);
  assert.match(html,/main\.css\?v=20261015-migracion72-1/);
  const css=read('DEFEN-DASHBOARD-trabajo/css/main.css');
  assert.match(css,/#weapon-control-modal \.as-table-wrap\{flex:0 0 clamp\(320px,45vh,470px\)/);
});
