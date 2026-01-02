
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Sparkles, Volume2, Loader2 } from 'lucide-react';
import { UserCollection } from '../types';
import { connectMuseumGuide } from '../services/geminiService';
import { useTranslation } from '../i18n';

interface MuseumGuideProps {
  collection: UserCollection;
  isOpen: boolean;
  onClose: () => void;
}

export const MuseumGuide: React.FC<MuseumGuideProps> = ({ collection, isOpen, onClose }) => {
  const { t, language } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && status === 'idle') {
      startSession();
    }
    return () => {
      stopSession();
    };
  }, [isOpen]);

  const decodeAudio = async (base64: string, ctx: AudioContext) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  };

  const startSession = async () => {
    setStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const itemsContext = collection.items.map(item => ({
        title: item.title,
        rating: item.rating,
        notes: item.notes,
        details: item.data
      }));

      const systemInstruction = language === 'zh' 
        ? `你是“珍藏博物馆向导”，一位关于 ${collection.name} 的资深且充满热情的专家。你的语气：优雅、博学、带有一丝艺术策展人的奇思妙想。你的目标：帮助用户欣赏和探索他们的藏品，可以谈论历史、文化或仅仅是聊聊这种爱好。请用中文交流。`
        : `You are the "Curio Museum Guide", a sophisticated and enthusiastic expert in ${collection.name}. Your tone: Elegant, knowledgeable, and slightly whimsical, like a high-end gallery curator. Your goal: Help users appreciate their items. Suggest things to look at, talk about history, or just chat about the hobby. Use English.`;

      const sessionPromise = connectMuseumGuide(collection, {
        onopen: () => {
          setStatus('active');
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            if (isMuted) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            const binary = String.fromCharCode(...new Uint8Array(int16.buffer));
            sessionPromise.then(session => {
              session.sendRealtimeInput({
                media: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' }
              });
            });
          };
          source.connect(processor);
          processor.connect(inputCtx.destination);
        },
        onmessage: async (msg: any) => {
          const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioData) {
            setIsSpeaking(true);
            const buffer = await decodeAudio(audioData, outputCtx);
            const source = outputCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputCtx.destination);
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0) setIsSpeaking(false);
            };
          }
          if (msg.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsSpeaking(false);
          }
        },
        onerror: () => setStatus('error'),
        onclose: () => setStatus('idle'),
      }, systemInstruction);

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const stopSession = () => {
    sessionRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    sourcesRef.current.forEach(s => s.stop());
    setStatus('idle');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pl-[calc(1.5rem+env(safe-area-inset-left,0px))] pr-[calc(1.5rem+env(safe-area-inset-right,0px))] bg-stone-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col items-center p-12 text-center relative">
        <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
          <X size={24} />
        </button>

        <div className="mb-8">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-inner ${
            status === 'connecting' ? 'bg-stone-100' : 
            status === 'active' ? (isSpeaking ? 'bg-amber-100 scale-110' : 'bg-stone-100') : 'bg-red-50'
          }`}>
            {status === 'connecting' ? <Loader2 className="animate-spin text-amber-500" size={40} /> :
             status === 'active' ? <Sparkles className={`${isSpeaking ? 'text-amber-500 animate-pulse' : 'text-stone-400'}`} size={40} /> :
             <MicOff className="text-red-400" size={40} />}
          </div>
        </div>

        <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">{t('guideTitle')}</h2>
        <p className="text-stone-500 mb-8 max-w-xs font-serif italic">
          {status === 'connecting' ? t('guideConnecting') :
           status === 'active' ? t('guideActive') : t('guideError')}
        </p>

        {status === 'active' && (
          <div className="flex gap-4">
             <button 
               onClick={() => setIsMuted(!isMuted)}
               className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                 isMuted ? 'bg-red-500 text-white' : 'bg-stone-900 text-white hover:bg-stone-800'
               }`}
             >
               {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
             </button>
             <div className="flex items-center gap-2 px-6 bg-stone-50 rounded-full border border-stone-100 text-stone-400">
                <Volume2 size={20} />
                <div className="flex gap-1">
                   {[1,2,3,4].map(i => (
                     <div key={i} className={`w-1 bg-amber-400 rounded-full transition-all duration-150 ${isSpeaking ? 'h-4 animate-bounce' : 'h-1'}`} style={{animationDelay: `${i*0.1}s`}}></div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {status === 'error' && (
          <button onClick={startSession} className="text-amber-600 font-bold hover:underline">{t('tryAgain')}</button>
        )}
      </div>
    </div>
  );
};
