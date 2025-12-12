import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyBoyo314YlWmwA-1ddW21Q_fzcQfcTCEbw",
    authDomain: "healthymika.firebaseapp.com",
    projectId: "healthymika",
    storageBucket: "healthymika.firebasestorage.app",
    messagingSenderId: "773346793950",
    appId: "1:773346793950:web:02c3245e6e4c2d6570654f",
    measurementId: "G-R32YK6Y0W2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
