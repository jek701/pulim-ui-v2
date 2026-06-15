import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

export const firebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);
export const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '';
export const firebaseAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '';

export let db: Firestore = undefined as unknown as Firestore;
export let auth: Auth = undefined as unknown as Auth;

if (firebaseConfigured) {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  db = getFirestore(app);
  auth = getAuth(app);
}
