import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email.toLowerCase();
        let sector = 'all';
        let allowedSectors = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'];
        let isAdmin = false;

        // 1. Tenta carregar permissões dinâmicas da coleção 'users' no Firestore (ID = e-mail)
        try {
          const userDocRef = doc(db, 'users', email);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            sector = userData.sector || 'all';
            isAdmin = !!userData.isAdmin;
            allowedSectors = userData.allowedSectors || ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'];
            
            setCurrentUser({
              email,
              sector,
              isAdmin,
              allowedSectors
            });
            sessionStorage.setItem('pernambucanaFinanceAuth', 'ok');
            sessionStorage.setItem('pernambucanaUserEmail', email);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn("Erro ao buscar permissões no Firestore, usando fallback:", err);
        }

        // 2. Fallback de regras estáticas por padrão de e-mail (se não cadastrado no Firestore)
        if (
          email.includes('rejanebrito') || 
          email.includes('rubensbrito') || 
          email.includes('financeiro')
        ) {
          sector = 'all';
          isAdmin = true;
          allowedSectors = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'];
        } else if (email.includes('retifica')) {
          sector = 'Retifica';
          allowedSectors = ['Retifica', 'Mecanica'];
        } else if (email.includes('peca')) {
          sector = 'Peças';
          allowedSectors = ['Peças'];
        } else if (email.includes('torne') || email.includes('orcamnto')) {
          sector = 'Torneadora';
          allowedSectors = ['Torneadora', 'Caldeiraria'];
        } else if (email.includes('calde')) {
          sector = 'Caldeiraria';
          allowedSectors = ['Caldeiraria'];
        } else if (email.includes('mecan')) {
          sector = 'Mecanica';
          allowedSectors = ['Mecanica'];
        } else {
          // Fallback administrador por padrão
          sector = 'all';
          isAdmin = true;
          allowedSectors = ['Mecanica', 'Peças', 'Retifica', 'Torneadora', 'Caldeiraria', 'AltoGeral'];
        }

        setCurrentUser({
          email,
          sector,
          isAdmin,
          allowedSectors
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
