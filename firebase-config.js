import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB4YC4CltKeZ7Wz4SjQZXsX1_IA4bRER8s',
  authDomain: 'mz-consulting-stg-20260929.firebaseapp.com',
  projectId: 'mz-consulting-stg-20260929',
  storageBucket: 'mz-consulting-stg-20260929.firebasestorage.app',
  messagingSenderId: '310103737342',
  appId: '1:310103737342:web:cf5f28a1d431fbd758f6af',
  databaseURL: 'https://mz-consulting-stg-20260929-default-rtdb.asia-southeast1.firebasedatabase.app'
};

export const FIREBASE_ENVIRONMENT = Object.freeze({
  name: 'STAGING',
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  databaseURL: firebaseConfig.databaseURL
});

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
