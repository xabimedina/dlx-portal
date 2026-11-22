"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

// Solo E2E: con NEXT_PUBLIC_FIREBASE_EMULATOR=1 el navegador habla con los
// emuladores locales (dlx-e2e). En producción la variable no existe.
const USE_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";
const EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";

/**
 * SDK de Firebase para el NAVEGADOR (login del usuario, subida de imágenes).
 */
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

function ensureApp(): FirebaseApp | null {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = ensureApp();
  if (!a) return null;
  if (!authInstance) {
    authInstance = getAuth(a);
    if (USE_EMULATOR) {
      connectAuthEmulator(authInstance, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    }
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore | null {
  const a = ensureApp();
  if (!a) return null;
  if (!dbInstance) {
    dbInstance = getFirestore(a);
    if (USE_EMULATOR) connectFirestoreEmulator(dbInstance, EMULATOR_HOST, 8080);
  }
  return dbInstance;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const a = ensureApp();
  if (!a) return null;
  if (!storageInstance) {
    storageInstance = getStorage(a);
    if (USE_EMULATOR) connectStorageEmulator(storageInstance, EMULATOR_HOST, 9199);
  }
  return storageInstance;
}
