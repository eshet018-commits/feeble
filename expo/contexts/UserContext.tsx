import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { UserRole } from '@/types/event';
import { auth, firebaseClient, persistenceReady } from '@/lib/firebase-client';
import { onAuthStateChanged, User } from 'firebase/auth';

export const [UserProvider, useUser] = createContextHook(() => {
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string>('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    console.log('[UserContext] Setting up auth listener');
    let cancelled = false;
    let unsub: (() => void) | null = null;

    persistenceReady.then(() => {
      if (cancelled) return;
      console.log('[UserContext] Persistence ready, registering auth listener');

      unsub = onAuthStateChanged(auth, async (user) => {
        console.log('[UserContext] Auth state changed:', user ? user.uid : 'no user');
        setIsLoading(true);

        if (user) {
          setFirebaseUser(user);
          setUserId(user.uid);
          setUserEmail(user.email || '');
          setIsAuthenticated(true);

          const profile = await firebaseClient.getUserProfile(user.uid);

          const storedName = await AsyncStorage.getItem(`userName_${user.uid}`);
          if (storedName) {
            setUserName(storedName);
          } else {
            const defaultName = user.email?.split('@')[0] || `User${Math.floor(Math.random() * 10000)}`;
            await AsyncStorage.setItem(`userName_${user.uid}`, defaultName);
            setUserName(defaultName);
          }

          if (profile.displayName) {
            setDisplayName(profile.displayName);
          } else {
            const defaultDisplayName = user.email?.split('@')[0] || `User${Math.floor(Math.random() * 10000)}`;
            setDisplayName(defaultDisplayName);
          }

          if (profile.profilePicture) {
            setProfilePicture(profile.profilePicture);
          }

          const storedRole = await AsyncStorage.getItem(`userRole_${user.uid}`);
          if (storedRole) {
            setRole(storedRole as UserRole);
          }
        } else {
          setFirebaseUser(null);
          setUserId('');
          setUserName('');
          setUserEmail('');
          setDisplayName('');
          setProfilePicture('');
          setIsAuthenticated(false);
          setRole('viewer');
        }

        setIsLoading(false);
      });
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);



  const updateRole = async (newRole: UserRole) => {
    try {
      if (userId) {
        await AsyncStorage.setItem(`userRole_${userId}`, newRole);
        setRole(newRole);
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const updateUserName = async (newName: string) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    try {
      await AsyncStorage.setItem(`userName_${userId}`, newName);
      await firebaseClient.updateUserProfile(userId, { userName: newName });
      setUserName(newName);
      console.log('[UserContext] User name updated successfully');
    } catch (error) {
      console.error('[UserContext] Failed to update user name:', error);
      throw error;
    }
  };

  const updateDisplayName = async (newName: string) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    try {
      await firebaseClient.updateUserProfile(userId, { displayName: newName });
      setDisplayName(newName);
      console.log('[UserContext] Display name updated successfully');
    } catch (error) {
      console.error('[UserContext] Failed to update display name:', error);
      throw error;
    }
  };

  const updateProfilePicture = async (uri: string) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    try {
      console.log('[UserContext] Starting profile picture update...');
      const url = await firebaseClient.uploadProfilePicture(userId, uri);
      console.log('[UserContext] Profile picture uploaded, URL:', url);
      setProfilePicture(url);
      return url;
    } catch (error: any) {
      console.error('[UserContext] Failed to update profile picture:', error);
      console.error('[UserContext] Error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
      });
      throw error;
    }
  };

  return { 
    userId, 
    userName, 
    userEmail,
    displayName,
    profilePicture,
    role, 
    isLoading, 
    isAuthenticated,
    firebaseUser,
    updateRole, 
    updateUserName,
    updateDisplayName,
    updateProfilePicture,
    isAdmin: role === 'admin' 
  };
});
