import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Profile } from '../../types';

interface CallModalProps {
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended';
  contact: Profile;
  onEnd: () => void;
  onAccept?: () => void;
  isIncoming?: boolean;
}

export default function CallModal({ type, status, contact, onEnd, onAccept, isIncoming }: CallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'audio');
  const [duration, setDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let interval: any;
    if (status === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (type === 'video' && status === 'connected') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(err => console.error('Error accessing media devices:', err));
    }
  }, [type, status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
    >
      <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-[48px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col group">
        {/* Video Streams */}
        {type === 'video' && (
          <div className="absolute inset-0">
            {/* Remote Video (Placeholder for now) */}
            <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
              {!isVideoOff ? (
                <div className="text-center">
                  <motion.div 
                    animate={{ 
                      scale: status === 'ringing' ? [1, 1.05, 1] : 1,
                      opacity: status === 'ringing' ? [0.5, 1, 0.5] : 1
                    }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="w-40 h-40 rounded-full bg-white/5 mx-auto mb-6 flex items-center justify-center border border-white/10"
                  >
                    <User className="w-20 h-20 text-white/20" />
                  </motion.div>
                  <p className="text-white/40 font-bold uppercase tracking-[0.3em] text-[10px]">
                    {status === 'ringing' ? `Calling ${contact.full_name || contact.username}...` : `Connected with ${contact.full_name || contact.username}`}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                   <User className="w-40 h-40 text-white/5" />
                </div>
              )}
            </div>

            {/* Local Video (Picture-in-Picture) */}
            <motion.div 
              drag
              dragConstraints={{ left: 20, right: 20, top: 20, bottom: 20 }}
              initial={{ x: 20, y: 20 }}
              className="absolute top-8 right-8 w-48 aspect-[3/4] bg-black rounded-[32px] overflow-hidden border border-white/10 shadow-2xl z-20 cursor-move group/pip"
            >
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-gray-700" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/pip:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-6 h-6 text-white/50" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Audio Call UI */}
        {type === 'audio' && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
            <motion.div 
              animate={{ 
                scale: status === 'ringing' ? [1, 1.05, 1] : 1,
                boxShadow: status === 'ringing' ? [
                  "0 0 0 0px rgba(16, 185, 129, 0)",
                  "0 0 0 60px rgba(16, 185, 129, 0.05)",
                  "0 0 0 0px rgba(16, 185, 129, 0)"
                ] : "none"
              }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="w-56 h-56 rounded-full bg-emerald-500/5 border border-emerald-500/10 p-4 mb-10"
            >
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-white/10 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                {contact.avatar_url ? (
                  <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600">
                    <User className="w-24 h-24" />
                  </div>
                )}
              </div>
            </motion.div>
            <h2 className="text-4xl font-black text-white mb-3 tracking-tight">{contact.full_name || contact.username}</h2>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                status === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-gray-500"
              )} />
              <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs">
                {status === 'ringing' ? 'Ringing...' : formatDuration(duration)}
              </p>
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-8 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-3xl p-3 rounded-[32px] border border-white/10 shadow-2xl">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "p-5 rounded-[24px] transition-all active:scale-90",
                isMuted ? "bg-rose-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {type === 'video' && (
              <button 
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={cn(
                  "p-5 rounded-[24px] transition-all active:scale-90",
                  isVideoOff ? "bg-rose-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
            )}

            {isIncoming && status === 'ringing' ? (
              <>
                <button 
                  onClick={onAccept}
                  className="p-6 bg-emerald-500 text-white rounded-[24px] shadow-2xl shadow-emerald-500/40 hover:bg-emerald-600 transition-all active:scale-90 animate-pulse"
                >
                  <Phone className="w-8 h-8" />
                </button>
                <button 
                  onClick={onEnd}
                  className="p-6 bg-rose-500 text-white rounded-[24px] shadow-2xl shadow-rose-500/40 hover:bg-rose-600 transition-all active:scale-90"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
              </>
            ) : (
              <button 
                onClick={onEnd}
                className="p-6 bg-rose-500 text-white rounded-[24px] shadow-2xl shadow-rose-500/40 hover:bg-rose-600 transition-all active:scale-90"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
            )}
          </div>
        </div>

        {/* Floating Info for Video Call */}
        {type === 'video' && (
          <div className="absolute top-10 left-10 z-30">
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight drop-shadow-2xl">{contact.full_name || contact.username}</h2>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                status === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-gray-500"
              )} />
              <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs drop-shadow-2xl">
                {status === 'ringing' ? 'Ringing...' : formatDuration(duration)}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
