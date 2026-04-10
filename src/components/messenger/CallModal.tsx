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
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8"
    >
      <div className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-[40px] overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        {/* Video Streams */}
        {type === 'video' && (
          <div className="absolute inset-0">
            {/* Remote Video (Placeholder for now) */}
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              {!isVideoOff ? (
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-gray-700 mx-auto mb-4 flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-500" />
                  </div>
                  <p className="text-white/60 font-medium">Waiting for {contact.full_name || contact.username}...</p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                   <User className="w-32 h-32 text-gray-700" />
                </div>
              )}
            </div>

            {/* Local Video (Picture-in-Picture) */}
            <motion.div 
              drag
              dragConstraints={{ left: 20, right: 20, top: 20, bottom: 20 }}
              className="absolute top-8 right-8 w-48 aspect-[3/4] bg-black rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl z-20 cursor-move"
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
                  <VideoOff className="w-8 h-8 text-gray-600" />
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Audio Call UI */}
        {type === 'audio' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div 
              animate={{ 
                scale: status === 'ringing' ? [1, 1.1, 1] : 1,
                boxShadow: status === 'ringing' ? [
                  "0 0 0 0px rgba(16, 185, 129, 0)",
                  "0 0 0 40px rgba(16, 185, 129, 0.1)",
                  "0 0 0 0px rgba(16, 185, 129, 0)"
                ] : "none"
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-48 h-48 rounded-full bg-emerald-500/10 border-4 border-emerald-500/20 p-2 mb-8"
            >
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-2xl">
                {contact.avatar_url ? (
                  <img src={contact.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <User className="w-20 h-20" />
                  </div>
                )}
              </div>
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">{contact.full_name || contact.username}</h2>
            <p className="text-emerald-500 font-bold uppercase tracking-[0.2em] text-sm">
              {status === 'ringing' ? 'Ringing...' : formatDuration(duration)}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-6 z-30">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "p-5 rounded-full backdrop-blur-xl transition-all active:scale-90",
              isMuted ? "bg-rose-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {type === 'video' && (
            <button 
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={cn(
                "p-5 rounded-full backdrop-blur-xl transition-all active:scale-90",
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
                className="p-6 bg-emerald-500 text-white rounded-full shadow-2xl shadow-emerald-500/40 hover:bg-emerald-600 transition-all active:scale-90 animate-bounce"
              >
                <Phone className="w-8 h-8" />
              </button>
              <button 
                onClick={onEnd}
                className="p-6 bg-rose-500 text-white rounded-full shadow-2xl shadow-rose-500/40 hover:bg-rose-600 transition-all active:scale-90"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
            </>
          ) : (
            <button 
              onClick={onEnd}
              className="p-6 bg-rose-500 text-white rounded-full shadow-2xl shadow-rose-500/40 hover:bg-rose-600 transition-all active:scale-90"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
          )}
        </div>

        {/* Floating Info for Video Call */}
        {type === 'video' && (
          <div className="absolute top-8 left-8 z-30">
            <h2 className="text-2xl font-bold text-white mb-1">{contact.full_name || contact.username}</h2>
            <p className="text-emerald-500 font-bold uppercase tracking-[0.2em] text-xs">
              {status === 'ringing' ? 'Ringing...' : formatDuration(duration)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
