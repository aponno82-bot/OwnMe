import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VoicePlayerProps {
  url: string;
  isOwn?: boolean;
}

export default function VoicePlayer({ url, isOwn }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = async () => {
    if (audioRef.current && !isTransitioning) {
      setIsTransitioning(true);
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
          setIsPlaying(true);
        }
      } catch (error) {
        console.error("Playback error:", error);
      } finally {
        setIsTransitioning(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-3 rounded-2xl min-w-[240px]",
      isOwn ? "bg-emerald-600/20" : "bg-gray-100"
    )}>
      <audio ref={audioRef} src={url} />
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm",
          isOwn ? "bg-white text-emerald-600" : "bg-emerald-500 text-white"
        )}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold opacity-60">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative h-1.5 bg-black/10 rounded-full overflow-hidden group">
          <input 
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div 
            className={cn(
              "absolute top-0 left-0 h-full transition-all duration-100",
              isOwn ? "bg-white" : "bg-emerald-500"
            )}
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
          }
        }}
        className="p-1.5 hover:bg-black/5 rounded-lg transition-colors opacity-60"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
