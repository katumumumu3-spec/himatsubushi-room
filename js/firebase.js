import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { adminEmail, firebaseConfig } from "./firebase-config.js";

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "appId"];

export const isFirebaseConfigured = requiredConfigKeys.every((key) => {
  const value = firebaseConfig[key];
  return value && !String(value).includes("YOUR_");
});

let app;
let auth;
let db;
let storage;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export {
  addDoc,
  adminEmail,
  auth,
  collection,
  db,
  deleteDoc,
  deleteObject,
  doc,
  getDocs,
  getDownloadURL,
  GoogleAuthProvider,
  onAuthStateChanged,
  orderBy,
  query,
  ref,
  serverTimestamp,
  signInWithPopup,
  signOut,
  storage,
  updateDoc,
  uploadBytes,
};

export function appsCollection() {
  if (!db) throw new Error("Firebaseが設定されていません。");
  return collection(db, "apps");
}

export async function fetchApps() {
  const snapshot = await getDocs(query(appsCollection(), orderBy("createdAt", "desc")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function isAllowedAdmin(user) {
  return Boolean(
    user?.email &&
      user.emailVerified &&
      adminEmail !== "your-google-account@example.com" &&
      user.email.toLowerCase() === adminEmail.toLowerCase(),
  );
}
