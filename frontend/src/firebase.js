import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCiZhMV6nRuT-D6vKb-pQzz9s_slrxLcx4",
  authDomain: "daa-pbl-1fd0e.firebaseapp.com",
  projectId: "daa-pbl-1fd0e",
  storageBucket: "daa-pbl-1fd0e.firebasestorage.app",
  messagingSenderId: "669048693334",
  appId: "1:669048693334:web:b821454f28ade72a4151f7",
  measurementId: "G-5DM5T0BT9L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
