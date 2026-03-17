// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// INSTRUÇÕES DE CONFIGURAÇÃO:
//
// 1. Acesse https://console.firebase.google.com
// 2. Clique em "Criar projeto" e dê um nome (ex: "munconnect")
// 3. No menu lateral, clique em "Firestore Database" → "Criar banco de dados"
//    - Escolha "Modo de teste" por enquanto (permite leitura e escrita livre)
// 4. Vá em "Configurações do projeto" (ícone de engrenagem) → "Seus aplicativos"
// 5. Clique no ícone "</>" para adicionar um app Web
// 6. Copie os valores do objeto firebaseConfig e cole abaixo substituindo os
//    campos marcados com TODO
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDu9KrryzTikcTTTKaWCWBISfk4aUvPJtU",
  authDomain: "munconnectg.firebaseapp.com",
  projectId: "munconnectg",
  storageBucket: "munconnectg.firebasestorage.app",
  messagingSenderId: "203874632546",
  appId: "1:203874632546:web:c47da292c124a5a530a23b",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
