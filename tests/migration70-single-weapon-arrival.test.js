const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project=path.resolve(__dirname,'..');
const root=path.resolve(project,'..');
const read=p=>fs.readFileSync(p,'utf8');
const sql=read(path.join(root,'supabase','migrations','202610140070_receive_single_weapon_from_inventory.sql'));
const supabase=read(path.join(project,'js','supabase.js'));
const armamento=read(path.join(project,'js','armamento.js'));

test('single reception updates only the selected movement and weapon',()=>{
  assert.match(sql,/where id=p_weapon_id and active for update/);
  assert.match(sql,/where id=v_movement\.id/);
  assert.doesNotMatch(sql,/public\.receive_weapon_batch\(/);
  assert.match(sql,/pending_in_same_batch/);
});

test('unsafe batch shortcut is disabled and UI warns about individual scope',()=>{
  assert.match(sql,/revoke all on function public\.receive_current_weapon_batch/);
  assert.match(supabase,/receive_current_weapon_at_destination/);
  assert.match(armamento,/Solo se recibirá esta arma/);
  assert.match(armamento,/Las demás permanecerán EN TRÁNSITO/);
});
