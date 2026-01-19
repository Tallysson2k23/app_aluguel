import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyCIDxH0dQDrJEpES4FcUxCKcMgBGUb5Cuk",
  authDomain: "aluguel-map.firebaseapp.com",
  projectId: "aluguel-map",
  storageBucket: "aluguel-map.firebasestorage.app",
  messagingSenderId: "93097645091",
  appId: "1:93097645091:web:893051bb16759c02820d96"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);