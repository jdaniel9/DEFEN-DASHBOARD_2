const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project=path.resolve(__dirname,'..');
const root=path.resolve(project,'..');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read(path.join(root,'supabase','migrations','202610140068_admin_retarget_weapons_in_transit.sql'));
const auth=read(path.join(project,'js','auth.js'));
const supabase=read(path.join(project,'js','supabase.js'));
const armamento=read(path.join(project,'js','armamento.js'));
const html=read(path.join(project,'index.html'));

test('destination correction is admin-only and audited',()=>{
  for(const token of ["current_profile_role() <> 'admin'",'weapon_destination_corrections','previous_destination_province_id','new_destination_province_id','reason'])
    assert.ok(sql.includes(token),`missing ${token}`);
});

test('only pending returns to a warehouse may be retargeted',()=>{
  assert.match(sql,/v_weapon\.state<>'TRANSITO'/);
  assert.match(sql,/movement_status<>'EN_TRANSITO'/);
  assert.match(sql,/new_state<>'RASTRILLO'/);
  assert.match(sql,/update public\.weapon_movements/);
  assert.match(sql,/update public\.weapons/);
});

test('admin UI supports correcting several transit weapons',()=>{
  assert.match(auth,/rolActual\(\) === 'admin'/);
  assert.match(supabase,/admin_retarget_weapons_in_transit/);
  assert.match(armamento,/Seleccionar todas las armas mostradas/);
  assert.match(armamento,/Continuarán EN TRÁNSITO/);
  assert.match(html,/armamento\.js\?v=20261014-migracion68/);
});
