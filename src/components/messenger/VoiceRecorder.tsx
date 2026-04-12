import React, { useState, useRef } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-4 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 w-full animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
        <span className="text-sm font-bold text-emerald-900 tabular-nums">
          {formatTime(recordingTime)}
        </span>
        <div className="flex-1 h-1 bg-emerald-200 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-emerald-500"
            animate={{ width: '100%' }}
            transition={{ duration: 300, ease: "linear" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
          title="Cancel"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button
          onClick={stopRecording}
          className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
          title="Stop and Send"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
