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
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

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

// App Check (reCAPTCHA Enterprise) — protege os callables de IA. Só liga se a
// site key estiver configurada (VITE_RECAPTCHA_ENTERPRISE_SITE_KEY; a site key
// é pública). Em desenvolvimento usa o debug token: defina
// VITE_APPCHECK_DEBUG_TOKEN com um token registrado no console, ou deixe vazio
// para o SDK gerar um (aparece no console do navegador para você registrar).
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
if (appCheckSiteKey) {
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const db = getFirestore(app);
export const auth = getAuth(app);
// Mesma região das Cloud Functions (functions/src/config.ts → REGION).
export const functions = getFunctions(app, "southamerica-east1");

// Emulator Suite (opt-in): VITE_USE_EMULATORS=true no .env.local.
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
