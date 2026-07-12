// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO:
//
// As credenciais vêm de variáveis de ambiente (Vite expõe ao bundle apenas as
// que começam com VITE_). Copie .env.local.example para .env.local e preencha.
//
// Onde achar os valores: Firebase Console → engrenagem (Configurações do
// projeto) → "Seus aplicativos" → app Web → objeto firebaseConfig.
//
// Obs.: a config web do Firebase NÃO é secreta (vai no bundle do frontend de
// qualquer forma); manter em .env é só organização. O que protege os dados são
// as Security Rules (fase separada).
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Fallback removível para desenvolvimento offline (valores do projeto atual).
// Se preferir, apague este bloco depois de configurar o .env.local.
// const firebaseConfig = {
//   apiKey: "AIzaSyDu9KrryzTikcTTTKaWCWBISfk4aUvPJtU",
//   authDomain: "munconnectg.firebaseapp.com",
//   projectId: "munconnectg",
//   storageBucket: "munconnectg.firebasestorage.app",
//   messagingSenderId: "203874632546",
//   appId: "1:203874632546:web:c47da292c124a5a530a23b",
// };

if (!firebaseConfig.apiKey) {
  console.warn(
    "[firebase] VITE_FIREBASE_* ausentes. Copie .env.local.example para " +
      ".env.local e preencha as credenciais do Firebase."
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
