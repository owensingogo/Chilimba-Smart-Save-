
/* =========================================
   CHILIMBA SMART SAVE
   Shared Firebase Configuration
========================================= */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

/* YOUR EXISTING FIREBASE PROJECT */

const firebaseConfig = {
  apiKey: "AIzaSyBwpDEgS6sPBbb-oNVM_4VnMxYxn3Vzfms",
  authDomain: "chilimba-smart-save.firebaseapp.com",
  projectId: "chilimba-smart-save",
  storageBucket: "chilimba-smart-save.firebasestorage.app",
  messagingSenderId: "134574528736",
  appId: "1:134574528736:web:8b9f332b1e5eb8e152d885"
};

/* INITIALIZE FIREBASE */

const app = initializeApp(firebaseConfig);

/* AUTHENTICATION */

const auth = getAuth(app);

/* FIRESTORE DATABASE */

const db = getFirestore(app);

/* EXPORT FOR OTHER PROJECT FILES */

export { app, auth, db };
