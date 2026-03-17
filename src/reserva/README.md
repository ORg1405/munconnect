# MUNConnect

Calendário de conferências MUN para Belo Horizonte.

## Pré-requisitos

- [Node.js](https://nodejs.org/) versão 18 ou superior
- Conta no Google (para o Firebase)

---

## 1. Configurar o Firebase

1. Acesse https://console.firebase.google.com
2. Clique em **"Criar projeto"** → dê o nome `munconnect` → desative o Google Analytics (não precisa) → clique em **Criar projeto**
3. No menu lateral, clique em **Firestore Database** → **Criar banco de dados**
   - Escolha **"Modo de teste"** → selecione a região `southamerica-east1 (São Paulo)` → **Ativar**
4. Clique na **engrenagem** (⚙️) no topo do menu lateral → **Configurações do projeto**
5. Role até **"Seus aplicativos"** → clique em **</>** (Web)
6. Dê o apelido `munconnect-web` → clique em **Registrar aplicativo**
7. Copie os valores do objeto `firebaseConfig` que aparece

---

## 2. Colar as credenciais no código

Abra o arquivo `src/firebase.js` e substitua os campos `TODO_COLE_AQUI` pelos valores copiados:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "munconnect-xxxx.firebaseapp.com",
  projectId: "munconnect-xxxx",
  storageBucket: "munconnect-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...",
};
```

---

## 3. Instalar e rodar

Abra o terminal dentro da pasta do projeto e rode:

```bash
npm install
npm run dev
```

O app abre em http://localhost:5173

---

## Estrutura do projeto

```
munconnect/
├── src/
│   ├── App.jsx               # Componente raiz
│   ├── firebase.js           # Configuração do Firebase ← edite aqui
│   ├── main.jsx              # Entry point
│   ├── index.css             # Reset CSS
│   └── components/
│       ├── Sidebar.jsx       # Menu lateral
│       ├── Calendar.jsx      # Calendário principal
│       ├── EventModal.jsx    # Modal de detalhes do evento
│       ├── AddEventModal.jsx # Modal de adicionar evento
│       └── ComingSoon.jsx    # Placeholder para features futuras
├── index.html
├── package.json
└── vite.config.js
```

---

## Ativar/desativar modo admin

Em `src/components/Calendar.jsx`, linha 13:

```js
const IS_ADMIN = true;  // true = vê o botão "+ Adicionar"
                        // false = modo visualização
```

No futuro, isso será substituído por um sistema de login real.
