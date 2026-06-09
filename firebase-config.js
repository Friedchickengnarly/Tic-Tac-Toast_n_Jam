// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCi_6DFzFANAPqY-3nfbV7aJ0oy0DuZQZs",
  authDomain: "tictactoast.firebaseapp.com",
  projectId: "tictactoast",
  storageBucket: "tictactoast.firebasestorage.app",
  messagingSenderId: "1051170393793",
  appId: "1:1051170393793:web:48405c6470632735188e40",
  measurementId: "G-J37JWNZ69E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
