import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
