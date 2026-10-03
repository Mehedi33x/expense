// src/firebase.js

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBzPbtESyom9Fq3FBmqYjzQulKGA3RnNAI",
  authDomain: "gen-lang-client-0187500069.firebaseapp.com",
  projectId: "gen-lang-client-0187500069",
  storageBucket: "gen-lang-client-0187500069.firebasestorage.app",
  messagingSenderId: "36116898719",
  appId: "1:36116898719:web:2d0b3a917026eb005bd3aa"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)