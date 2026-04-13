import React from 'react';
import AuthForm from './AuthForm';
import { motion } from 'motion/react';
import { Zap, Instagram, Twitter, Facebook } from 'lucide-react';

export default function GuestPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row font-sans selection:bg-emerald-500 selection:text-white overflow-hidden">
      {/* Desktop Left Side: Editorial Content */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-16 xl:p-24 bg-[#fcfdfc] border-r border-emerald-50 relative">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#10b981 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
        
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2.5 relative z-10"
        >
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="text-2xl font-bold tracking-tighter text-emerald-950">OwnMe</span>
        </motion.div>

        <div className="max-w-md relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="text-7xl xl:text-8xl font-bold tracking-tight text-emerald-950 leading-[0.9] mb-10">
              Social <br />
              networking <br />
              <span className="text-emerald-500">redefined.</span>
            </h1>
            <p className="text-xl text-emerald-900/50 font-medium leading-relaxed mb-12">
              A refined space for creators to connect and grow. Experience a minimal, high-end environment designed for your digital identity.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex gap-16"
          >
            <div>
              <div className="text-3xl font-bold text-emerald-950 tracking-tight">100K+</div>
              <div className="text-[11px] font-black text-emerald-500/60 uppercase tracking-[0.2em] mt-2">Creators</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-950 tracking-tight">50M+</div>
              <div className="text-[11px] font-black text-emerald-500/60 uppercase tracking-[0.2em] mt-2">Moments</div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex items-center gap-8 text-emerald-200 relative z-10"
        >
          <Instagram className="w-5 h-5 cursor-pointer hover:text-emerald-500 transition-all hover:scale-110" />
          <Twitter className="w-5 h-5 cursor-pointer hover:text-emerald-500 transition-all hover:scale-110" />
          <Facebook className="w-5 h-5 cursor-pointer hover:text-emerald-500 transition-all hover:scale-110" />
        </motion.div>
      </div>

      {/* Mobile Header (Visible only on mobile) */}
      <div className="lg:hidden flex items-center justify-center p-8 border-b border-emerald-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-emerald-950">OwnMe</span>
        </div>
      </div>

      {/* Right Side: Auth Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 xl:p-24 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <AuthForm />
          
          <div className="mt-20 pt-8 border-t border-emerald-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-emerald-200 text-[11px] font-bold uppercase tracking-widest">
              &copy; 2026 OwnMe Inc.
            </p>
            <div className="flex gap-6">
              <span className="text-[11px] font-bold text-emerald-200 hover:text-emerald-500 cursor-pointer transition-colors uppercase tracking-widest">Privacy</span>
              <span className="text-[11px] font-bold text-emerald-200 hover:text-emerald-500 cursor-pointer transition-colors uppercase tracking-widest">Terms</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
