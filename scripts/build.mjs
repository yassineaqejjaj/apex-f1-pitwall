import {cp,mkdir,writeFile,rm} from 'node:fs/promises';
const base=process.env.PUBLIC_API_BASE||'';
if(base&&!/^https:\/\/[a-z\d.-]+(?:\/[a-z\d/_-]*)?$/i.test(base))throw Error('PUBLIC_API_BASE must be an HTTPS URL without credentials or query');
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});await writeFile('dist/runtime-config.js','globalThis.APEX_CONFIG=Object.freeze('+JSON.stringify({apiBase:base})+');\n');console.log('Built static frontend in dist/');
