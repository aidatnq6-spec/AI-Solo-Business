import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
export function adminApp(){return getApps()[0]??initializeApp({projectId:process.env.FIREBASE_PROJECT_ID??"demo-content-studio",storageBucket:process.env.FIREBASE_STORAGE_BUCKET??"demo-content-studio.appspot.com",...(process.env.APP_MODE==="firebase"?{credential:applicationDefault()}:{} )});}
export const adminAuth=()=>getAuth(adminApp());
export const firestore=()=>getFirestore(adminApp());
export const bucket=()=>getStorage(adminApp()).bucket();
