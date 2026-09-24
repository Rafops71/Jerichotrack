/* Re-exports exactly the Firebase symbols companion.html imports, plus the two
   emulator-connection functions the sandbox build needs. Same SDK, same
   version (10.13.0) as the CDN the live app uses - just served locally so the
   robot can run without internet access. */
export { initializeApp } from 'firebase/app';
export {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot,
  enableIndexedDbPersistence, connectFirestoreEmulator
} from 'firebase/firestore';
export {
  getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator
} from 'firebase/auth';
