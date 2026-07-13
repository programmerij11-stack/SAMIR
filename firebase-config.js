// ============================================================
//  CONFIGURATION FIREBASE - GESTION PARC ENGINS MINIERS
//  Remplacez les valeurs ci-dessous par celles de votre
//  projet Firebase (console.firebase.google.com)
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyC2UCtTND6K9Q1ZgKxYkl44xu_cz0TknSI",
  authDomain:        "gestion-maintenance-d1dd2.firebaseapp.com",
  projectId:         "gestion-maintenance-d1dd2",
  storageBucket:     "gestion-maintenance-d1dd2.firebasestorage.app",
  messagingSenderId: "905630701263",
  appId:             "1:905630701263:web:06544f767232ebeb2809ba",
  measurementId:     "G-CYW4V9QJ1S"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Active la persistance hors-ligne (cache local automatique)
db.enablePersistence({ synchronizeTabs: true })
  .catch(function(err) {
    if (err.code === 'failed-precondition') {
      console.warn('Persistance hors-ligne: plusieurs onglets ouverts.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistance hors-ligne non supportée par ce navigateur.');
    }
  });
