import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { UserProfile } from '../types';

export function useAdminAuth() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            if (data.role === 'admin') {
              setAdminUser(user);
              setAdminProfile(data);
              setError(null);
            } else {
              await signOut(auth);
              setError('Unauthorized Access: Admin privileges required.');
            }
          } else {
            await signOut(auth);
            setError('User profile not found.');
          }
        } catch (err) {
          console.error('Admin Auth Error:', err);
          setError('Authentication failed. Please try again.');
        }
      } else {
        setAdminUser(null);
        setAdminProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return { adminUser, adminProfile, loading, error, logout };
}
