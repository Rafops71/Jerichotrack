/**
 * Jericho Platform – Firebase Configuration
 * 
 * IMPORTANT:
 * Replace the placeholder values below with your real Firebase config
 * from the Firebase Console → Project Settings → General → Your apps
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase (using the modular SDK via CDN in HTML)
// The actual initialization happens in auth.js / app.js after the SDKs are loaded.

window.JERICHO_FIREBASE_CONFIG = firebaseConfig;
