import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDG66i3eyUasVwq3HXzXt8-RaYmNDoJrj0',
  authDomain: 'mzconsulting.firebaseapp.com',
  projectId: 'mzconsulting',
  storageBucket: 'mzconsulting.firebasestorage.app',
  messagingSenderId: '901595351717',
  appId: '1:901595351717:web:bd5d89c29b86bb0befdb4c',
  databaseURL: 'https://mzconsulting-default-rtdb.firebaseio.com/'
};

export const FIREBASE_ENVIRONMENT = Object.freeze({
  name: 'PRODUCTION',
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  databaseURL: firebaseConfig.databaseURL
});

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
