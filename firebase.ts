import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  enableMultiTabIndexedDbPersistence 
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { OperationType, FirestoreErrorInfo } from '../types';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let initPromise: Promise<{ app: FirebaseApp | null, db: Firestore | null, auth: Auth | null, storage: FirebaseStorage | null }> | null = null;

async function getFirebaseConfig() {
  try {
    const config = await import('../../firebase-applet-config.json');
    if (config.default.apiKey === 'PLACEHOLDER') {
      console.warn('Firebase placeholder config detected.');
      return null;
    }
    return config.default;
  } catch (error) {
    console.warn('Firebase config not found. Please run set_up_firebase.');
    return null;
  }
}

export async function initFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = await getFirebaseConfig();
    if (!config) return { app: null, db: null, auth: null, storage: null };

    app = initializeApp(config);
    db = getFirestore(app, config.firestoreDatabaseId);
    storage = getStorage(app);
    auth = getAuth(app);

    // Enable offline persistence carefully
    if (typeof window !== 'undefined') {
      try {
        // Use a timeout for persistence as it can hang in some environments
        await Promise.race([
          enableMultiTabIndexedDbPersistence(db),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Persistence timeout')), 2000))
        ]);
        console.log('Firestore multi-tab persistence enabled');
      } catch (err: any) {
        console.warn('Firestore persistence initialization error or timeout:', err);
        // We don't throw here to allow the app to function in memory-only mode if persistence fails
      }
    }
    
    return { app, db, auth, storage };
  })();

  return initPromise;
}

// Lazy getters
export const getDb = () => {
  if (!db) {
    console.warn('Firestore not initialized. Using fallback behavior.');
    return null as any;
  }
  return db;
};

export const getAuthInstance = () => {
  if (!auth) {
    console.warn('Auth not initialized. Using fallback behavior.');
    return null as any; 
  }
  return auth;
};

export const getStorageInstance = () => {
  if (!storage) {
    console.warn('Storage not initialized.');
    return null as any;
  }
  return storage;
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = auth;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid,
      email: currentAuth?.currentUser?.email,
      emailVerified: currentAuth?.currentUser?.emailVerified,
      isAnonymous: currentAuth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
