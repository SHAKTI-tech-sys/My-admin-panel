import { onAuthStateChanged, User as FirebaseUser, getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { getDb, getAuthInstance } from './firebase';
import { UserProfile } from '../types';

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
};

export const syncUserProfile = async (firebaseUser: FirebaseUser): Promise<UserProfile> => {
  const db = getDb();
  if (!db) throw new Error("Database not initialized");

  const storedId = localStorage.getItem('messengerId');
  let userProfile: UserProfile = {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || 'Anonymous',
    photoURL: firebaseUser.photoURL || '',
    email: firebaseUser.email || '',
    status: 'online',
    lastSeen: Timestamp.now()
  };

  try {
    // 1. Try to find profile by UID first (most reliable) - with 3s timeout
    const userDoc = await withTimeout(getDoc(doc(db, 'users', firebaseUser.uid)), 3000, null);
    
    if (userDoc && userDoc.exists()) {
      userProfile = { ...userProfile, ...userDoc.data() as UserProfile };
    } else if (storedId) {
      // 2. If UID doc doesn't exist but we have a stored messengerId, try to find by that - with 3s timeout
      const q = query(collection(db, 'users'), where('messengerId', '==', storedId));
      const snap = await withTimeout(getDocs(q), 3000, null);
      if (snap && !snap.empty) {
        // Use the one with most recent activity or just the first match
        const data = snap.docs[0].data() as UserProfile;
        userProfile = { ...userProfile, ...data, uid: firebaseUser.uid };
      }
    }

    // Ensure UID matches current logged in user
    userProfile.uid = firebaseUser.uid;
    
    // Sync back to Firestore - don't wait for this to complete to unblock UI
    setDoc(doc(db, 'users', firebaseUser.uid), {
      ...userProfile,
      lastSeen: serverTimestamp(),
      status: 'online'
    }, { merge: true }).catch(e => console.warn("Background sync failed:", e));

    if (userProfile.messengerId) {
      localStorage.setItem('messengerId', userProfile.messengerId);
    }
  } catch (error) {
    console.warn("Sync partially failed, using local/default profile:", error);
  }

  return userProfile;
};

export const checkSession = async (): Promise<UserProfile | null> => {
  const auth = getAuthInstance();
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  
  try {
    return await syncUserProfile(firebaseUser);
  } catch (error) {
    console.error("Session check failed:", error);
    return null;
  }
};

export const initAuthListener = (onUserChange: (user: UserProfile | null) => void) => {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const profile = await syncUserProfile(firebaseUser);
        onUserChange(profile);
      } catch (error) {
        console.error("Auth sync failed:", error);
        onUserChange(null);
      }
    } else {
      localStorage.removeItem('messengerId');
      onUserChange(null);
    }
  });
};
