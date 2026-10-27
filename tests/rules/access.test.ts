import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
let env:RulesTestEnvironment;
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-content-studio',firestore:{rules:readFileSync('firestore.rules','utf8')},storage:{rules:readFileSync('storage.rules','utf8')}});await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'config/access'),{ownerUid:'owner'});await setDoc(doc(c.firestore(),'users/owner/products/p1'),{name:'Private'});await uploadBytes(ref(c.storage(),'users/owner/test.png'),new Uint8Array([1,2,3]));});});
afterAll(async()=>{await env?.cleanup();});
describe('single-owner rules',()=>{
 it('allows owner reads only',async()=>{await assertSucceeds(getDoc(doc(env.authenticatedContext('owner').firestore(),'users/owner/products/p1')));await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(),'users/owner/products/p1')));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users/owner/products/p1')));});
 it('denies direct writes even by owner',async()=>{await assertFails(setDoc(doc(env.authenticatedContext('owner').firestore(),'users/owner/products/p1'),{name:'Altered'}));await assertFails(setDoc(doc(env.authenticatedContext('other').firestore(),'users/other/products/p1'),{name:'Altered'}));});
 it('denies config changes and unauthorized file access',async()=>{await assertFails(setDoc(doc(env.authenticatedContext('owner').firestore(),'config/access'),{ownerUid:'other'}));await assertFails(uploadBytes(ref(env.authenticatedContext('owner').storage(),'users/owner/new.png'),new Uint8Array([1])));await assertFails(getBytes(ref(env.authenticatedContext('other').storage(),'users/owner/test.png')));await assertSucceeds(getBytes(ref(env.authenticatedContext('owner').storage(),'users/owner/test.png')));});
});
