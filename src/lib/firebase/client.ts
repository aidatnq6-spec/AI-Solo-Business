"use client";
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
let connected=false;
export function firebaseClient(config:FirebaseOptions,emulator:boolean){const app=getApps()[0]??initializeApp(config);const auth=getAuth(app);const db=getFirestore(app);if(emulator&&!connected){connectAuthEmulator(auth,"http://127.0.0.1:9099",{disableWarnings:true});connectFirestoreEmulator(db,"127.0.0.1",8080);connected=true;}return {app,auth,db};}
