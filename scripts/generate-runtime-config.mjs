import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const localFile=path.join(root,'.env.local');
if(fs.existsSync(localFile)){
  for(const line of fs.readFileSync(localFile,'utf8').split(/\r?\n/)){
    const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if(match&&!process.env[match[1]])process.env[match[1]]=match[2].trim();
  }
}
const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_INTERNAL_AUTH_DOMAIN'];
for(const key of required)if(!String(process.env[key]||'').trim())throw new Error(`Falta la variable ${key}`);
const config={
  SUPABASE_URL:String(process.env.SUPABASE_URL).trim(),
  SUPABASE_PUBLISHABLE_KEY:String(process.env.SUPABASE_PUBLISHABLE_KEY).trim(),
  SUPABASE_INTERNAL_AUTH_DOMAIN:String(process.env.SUPABASE_INTERNAL_AUTH_DOMAIN).trim(),
  APPS_SCRIPT_URL:String(process.env.APPS_SCRIPT_URL||'').trim()
};
fs.writeFileSync(path.join(root,'js','runtime-config.js'),`globalThis.__DEFEN_CONFIG__ = Object.freeze(${JSON.stringify(config,null,2)});\n`,{mode:0o600});
console.log('Configuración pública generada correctamente.');
