/**
 * Custom hook for Firebase authentication state management.
 */
import { useState, useEffect } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [googleToken, setGoogleToken] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/gmail.send");
    provider.addScope("https://www.googleapis.com/auth/gmail.compose");
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    provider.addScope("https://www.googleapis.com/auth/calendar.events");
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleToken(credential.accessToken);
      }
    } catch (err) {
      console.error("Firebase sign-in failure:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setGoogleToken("");
    } catch (err) {
      console.error("Firebase sign-out failure:", err);
    }
  };

  return {
    user,
    loadingAuth,
    googleToken,
    setGoogleToken,
    handleSignIn,
    handleSignOut,
  };
}
