import { readdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
const dir=path.resolve('.tools/java21');let javaHome;
if(existsSync(dir)){const name=readdirSync(dir).find(n=>existsSync(path.join(dir,n,'bin','java.exe')));if(name)javaHome=path.join(dir,name);}
const env={...process.env,FIREBASE_EMULATORS_PATH:path.resolve('.cache/firebase'),...(javaHome?{JAVA_HOME:javaHome,PATH:path.join(javaHome,'bin')+path.delimiter+process.env.PATH}:{})};
const child=spawn(process.execPath,['node_modules/firebase-tools/lib/bin/firebase.js',...process.argv.slice(2)],{stdio:'inherit',env});child.on('exit',code=>process.exit(code??1));
