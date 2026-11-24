import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { DogEar } from './Dogs';
import { EASE } from './ui';
import { useAuth } from '../contexts/AuthContext';

/** The signed-out screen for pages that need an account: a dog, a title, one button. */
const SignInGate = ({ title, text, button = 'Sign in with Google', prop = 'bow', seed = 5, animal }) => {
  const { loginWithGoogle } = useAuth();
  return (
    <div className="min-h-[72vh] flex flex-col items-center justify-center text-center px-6 pb-16">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: EASE }} className="relative">
        <span className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 w-[150%] aspect-square rounded-full bg-pink" />
        <DogEar animal={animal} prop={prop} seed={seed} body={false} ribbon={false} className="relative w-44 sm:w-52" />
      </motion.div>
      <h1 className="font-display text-[clamp(3.6rem,9vw,8rem)] mt-10">{title}</h1>
      {text && <p className="caps mt-3 max-w-md leading-snug">{text}</p>}
      <button onClick={loginWithGoogle} className="mt-8 h-14 px-9 rounded-full bg-red text-[#FBFBF4] font-display text-[24px] inline-flex items-center gap-2 hover:-rotate-3 hover:scale-105 transition-transform duration-500">
        {button} <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default SignInGate;
