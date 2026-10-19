const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('weapon control can be unmarked without deleting audit history',()=>{
  const sql=read('supabase/migrations/202610160073_weapon_unmark_and_ope_summary.sql');
  const js=read('DEFEN-DASHBOARD-trabajo/js/weapon-control.js');
  assert.match(sql,/add column if not exists deleted_at/i);
  assert.match(sql,/delete_weapon_daily_control/i);
  assert.match(sql,/No se puede desmarcar un mes cerrado/i);
  assert.match(sql,/event_type in\('REGISTRADO','ACTUALIZADO','ELIMINADO'\)/i);
  assert.match(js,/DESMARCAR DÍA/);assert.match(js,/wcDelete/);
  assert.match(js,/wc-mark-grid/);
});

test('Resumen OPE provides combined filters and mobile project cards',()=>{
  const sql=read('supabase/migrations/202610160073_weapon_unmark_and_ope_summary.sql');
  const js=read('DEFEN-DASHBOARD-trabajo/js/operations-summary.js');
  const html=read('DEFEN-DASHBOARD-trabajo/index.html');
  const css=read('DEFEN-DASHBOARD-trabajo/css/main.css');
  assert.match(sql,/get_operations_summary_workspace/i);
  assert.match(sql,/'real_personnel'/i);assert.match(sql,/'non_lethal'/i);assert.match(sql,/'schedules'/i);
  assert.match(js,/opeToggle/);assert.match(js,/opeProjectServices/);assert.match(js,/ope-projects-list/);
  assert.match(html,/data-permiso-resumen-ope/);assert.match(html,/operations-summary\.js\?v=20261016-migracion73/);
  assert.match(css,/@media\(max-width:600px\).*\.ope-modal/s);
});
