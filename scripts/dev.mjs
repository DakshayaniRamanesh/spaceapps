import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const windows=process.platform==='win32';
const localPython=path.join(root,'backend','.venv',windows?'Scripts/python.exe':'bin/python');
const python=existsSync(localPython)?localPython:(windows?'python':'python3');
const apiPort=process.env.API_PORT||'8000';
const frontendPort=process.env.PORT||'3000';
const api=spawn(python,['-m','uvicorn','app.main:app','--host','127.0.0.1','--port',apiPort],{cwd:path.join(root,'backend'),stdio:'inherit',env:process.env});
const web=spawn(windows?'npm.cmd':'npm',['run','dev','--','--port',frontendPort],{cwd:path.join(root,'frontend'),stdio:'inherit',shell:windows,env:{...process.env,API_INTERNAL_URL:`http://127.0.0.1:${apiPort}`}});
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;api.kill('SIGTERM');web.kill('SIGTERM');setTimeout(()=>process.exit(code),300).unref()}
for(const child of [api,web]){child.on('error',e=>{console.error(e);stop(1)});child.on('exit',code=>stop(code||0))}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
