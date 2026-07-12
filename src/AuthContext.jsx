import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Verifica se o email está na lista de admins no Firestore
        const adminDoc = await getDoc(doc(db, "admins", firebaseUser.email));
        setIsAdmin(adminDoc.exists());
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Login com email/senha.
  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  // Cadastro: cria o usuário no Auth e o doc users/{uid} no Firestore.
  const signup = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const name = (displayName || "").trim();
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    await setDoc(doc(db, "users", cred.user.uid), {
      displayName: name,
      email: cred.user.email,
      createdAt: serverTimestamp(),
    });
    return cred;
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, loading, login, signup, logout }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
