import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAhino5yPV-9UrRj8FboDwV_UoQsN5aIZ0",
  authDomain: "pernambucana-27f6b.firebaseapp.com",
  projectId: "pernambucana-27f6b",
  storageBucket: "pernambucana-27f6b.firebasestorage.app",
  messagingSenderId: "525510739750",
  appId: "1:525510739750:web:a990ef90181922afbe63e7",
  measurementId: "G-PX1XC1R53T"
};

// Inicializa Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const email = user.email.toLowerCase();
        let sector = 'all';
        if (email.includes('retif')) sector = 'Retifica';
        else if (email.includes('mecan')) sector = 'Mecanica';
        else if (email.includes('peca')) sector = 'Peças';
        else if (email.includes('torne')) sector = 'Torneadora';
        else if (email.includes('calde')) sector = 'Caldeiraria';

        setCurrentUser({
          email,
          sector,
          isAdmin: sector === 'all'
        });
        sessionStorage.setItem('pernambucanaFinanceAuth', 'ok');
        sessionStorage.setItem('pernambucanaUserEmail', email);
      } else {
        setCurrentUser(null);
        sessionStorage.removeItem('pernambucanaFinanceAuth');
        sessionStorage.removeItem('pernambucanaUserEmail');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => {
    let formattedEmail = email;
    if (!formattedEmail.includes('@')) {
      formattedEmail = formattedEmail + '@pernambucana.com.br';
    }
    return signInWithEmailAndPassword(auth, formattedEmail, password);
  };

  const logout = () => {
    return firebaseSignOut(auth);
  };

  const value = {
    currentUser,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
