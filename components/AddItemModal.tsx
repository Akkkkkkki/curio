
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader2, Sparkles, Check } from 'lucide-react';
import { UserCollection, CollectionItem } from '../types';
import { analyzeImage } from '../services/geminiService';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: UserCollection[];
  onSave: (collectionId: string, item: Omit<CollectionItem, 'id' | 'createdAt'>) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, collections, onSave }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'select-type' | 'upload' | 'analyzing' | 'verify'>('select-type');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(collections.length === 1 ? 'upload' : 'select-type');
      if (collections.length === 1) setSelectedCollectionId(collections[0].id);
      setImagePreview(null);
      setFormData({});
      setError(null);
    }
  }, [isOpen, collections]);

  if (!isOpen) return null;

  const currentCollection = collections.find(c => c.id === selectedCollectionId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        analyze(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyze = async (base64: string) => {
    if (!currentCollection) return;
    setStep('analyzing');
    try {
      const base64Data = base64.split(',')[1];
      const result = await analyzeImage(base64Data, currentCollection.customFields);
      setFormData({
        title: result.title,
        notes: result.notes,
        data: result.data,
        rating: 0
      });
      setStep('verify');
    } catch (e) {
      console.error(e);
      setError("Analysis failed. Please fill in the details manually.");
      setStep('verify');
      setFormData({ title: '', notes: '', data: {}, rating: 0 });
    }
  };

  const handleSave = () => {
    if (!currentCollection) return;
    onSave(currentCollection.id, {
      collectionId: currentCollection.id,
      photoUrl: imagePreview || '',
      title: formData.title || 'Untitled',
      rating: formData.rating || 0,
      notes: formData.notes || '',
      data: formData.data || {},
    });
    onClose();
  };

  const renderCollectionSelect = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold text-center mb-8">{t('newArchive')}</h3>
      <div className="grid grid-cols-2 gap-4">
        {collections.map(c => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCollectionId(c.id);
              setStep('upload');
            }}
            className="p-6 rounded-2xl border border-stone-100 bg-stone-50/50 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group shadow-sm hover:shadow-md"
          >
            <span className="block text-3xl mb-3 group-hover:scale-110 transition-transform origin-left">
              {c.icon || '📦'}
            </span>
            <span className="font-bold text-stone-800 block text-lg">{c.name}</span>
            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">{t('artifacts')}: {c.items.length}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="text-center space-y-8 py-4">
        <div className="flex justify-center">
            <div className="relative">
                <div className="w-40 h-40 rounded-full bg-stone-50 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 group hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                   {imagePreview ? (
                       <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                   ) : (
                       <>
                           <Camera size={32} className="mb-2" />
                           <span className="text-xs font-bold uppercase tracking-wider">{t('takePhoto')}</span>
                       </>
                   )}
                </div>
            </div>
        </div>
        <div>
            <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">{t('uploadPhoto')}</h3>
            <p className="text-stone-500 max-w-xs mx-auto">{t('geminiExtracting')}</p>
        </div>
        <div className="flex flex-col gap-3">
            <Button onClick={() => fileInputRef.current?.click()} size="lg" icon={<Upload size={18} />}>
                {imagePreview ? t('changePhoto') : t('uploadPhoto')}
            </Button>
            <button onClick={() => setStep('verify')} className="text-sm font-medium text-stone-400 hover:text-stone-600">{t('skipManual')}</button>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
    </div>
  );

  const renderAnalyzing = () => (
    <div className="text-center py-20 space-y-6">
        <div className="relative inline-block">
            <div className="absolute inset-0 bg-amber-200 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-white p-6 rounded-full shadow-lg border border-stone-100">
                <Sparkles size={40} className="text-amber-500 animate-pulse" />
            </div>
        </div>
        <div>
            <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">{t('analyzingPhoto')}</h3>
            <p className="text-stone-500 italic font-serif">{t('geminiExtracting')}</p>
        </div>
    </div>
  );

  const renderVerify = () => (
    <div className="space-y-6">
       <div className="flex gap-6 items-start">
            <div className="w-24 h-24 rounded-xl bg-stone-100 flex-shrink-0 overflow-hidden border border-stone-200">
                {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <Camera className="w-full h-full p-6 text-stone-200" />}
            </div>
            <div className="flex-1">
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">{t('title')}</label>
                <input 
                    type="text" 
                    className="w-full text-xl font-bold bg-transparent border-b border-stone-200 focus:border-amber-500 outline-none pb-1 transition-colors"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                />
            </div>
       </div>

       <div className="space-y-4 max-h-[40vh] overflow-y-auto px-1">
            {currentCollection?.customFields.map(field => (
                <div key={field.id}>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">{field.label}</label>
                    <input 
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                        value={formData.data?.[field.id] || ''}
                        onChange={e => setFormData({
                            ...formData, 
                            data: { ...formData.data, [field.id]: e.target.value }
                        })}
                    />
                </div>
            ))}
            <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">{t('rating')}</label>
                <div className="flex gap-2">
                    {[1,2,3,4,5].map(s => (
                        <button 
                            key={s} 
                            onClick={() => setFormData({...formData, rating: s})}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all ${formData.rating === s ? 'bg-amber-400 border-amber-500 text-white shadow-sm' : 'bg-white border-stone-200 text-stone-300'}`}
                        >
                            ★
                        </button>
                    ))}
                </div>
            </div>
       </div>

       <Button className="w-full" size="lg" onClick={handleSave} icon={<Check size={18} />}>
           {t('addToCollection')}
       </Button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="font-serif font-bold text-xl text-stone-800">{t('addItem')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
            {step === 'select-type' && renderCollectionSelect()}
            {step === 'upload' && renderUpload()}
            {step === 'analyzing' && renderAnalyzing()}
            {step === 'verify' && renderVerify()}
        </div>
      </div>
    </div>
  );
};
