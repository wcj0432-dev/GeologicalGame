import { mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('release',{recursive:true});
await copyFile('dist/index.html','release/Petrogenesis-0.1.0-offline.html');
if(process.platform==='win32') execFileSync('powershell',['-NoProfile','-Command',"Compress-Archive -Path 'release/Petrogenesis-0.1.0-offline.html','PLAY_OFFLINE.md' -DestinationPath 'release/Petrogenesis-0.1.0-web.zip' -Force"],{stdio:'inherit'});
else execFileSync('zip',['-j','release/Petrogenesis-0.1.0-web.zip','release/Petrogenesis-0.1.0-offline.html','PLAY_OFFLINE.md'],{stdio:'inherit'});
