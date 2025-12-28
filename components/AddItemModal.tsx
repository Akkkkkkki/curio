
import React, { useState, useRef, useEffect } from 'react';
// Added Plus icon to the lucide-react imports
import { Camera, Upload, X, Loader2, Sparkles, Check, Zap, ArrowRight, Trash2, Plus } from 'lucide-react';
import { UserCollection, CollectionItem } from '../types';
import { analyzeImage, isAiEnabled } from '../services/geminiService';
import { Button } from './ui/Button';
import { useTranslation } from '../i18n';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: UserCollection[];
  onSave: (collectionId: string, item: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

interface BatchItem {
  id: string;
  image: string;
  title: string;
  notes: string;
  data: Record<string, any>;
  rating: number;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, collections, onSave }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'select-type' | 'upload' | 'batch-verify' | 'analyzing' | 'verify'>('select-type');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(collections.length === 1 ? 'upload' : 'select-type');
      if (collections.length === 1) setSelectedCollectionId(collections[0].id);
      setImagePreview(null);
      setBatchItems([]);
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

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !currentCollection) return;
    const collection = currentCollection;

    const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('File read failed'));
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });

    const createBatchItem = (image: string, overrides: Partial<BatchItem> = {}): BatchItem => ({
      id: Math.random().toString(36).slice(2, 10),
      image,
      title: '',
      notes: '',
      data: {},
      rating: 0,
      ...overrides,
    });

    const analyzeBatchImages = async (images: string[]) => {
      if (!isAiEnabled()) {
        setError("AI analysis is unavailable. Please fill in the details manually.");
        return images.map(image => createBatchItem(image));
      }
      const analyzed: BatchItem[] = [];
      for (const image of images) {
        const base64Data = image.split(',')[1];
        try {
          const result = await analyzeImage(base64Data, collection.customFields);
          analyzed.push(createBatchItem(image, {
            title: result.title || '',
            notes: result.notes || '',
            data: result.data || {},
          }));
        } catch (err) {
          console.error(err);
          setError("Analysis failed. Please fill in the details manually.");
          analyzed.push(createBatchItem(image));
        }
      }
      return analyzed;
    };

    const loadBatch = async () => {
      setError(null);
      setStep('analyzing');
      try {
        const images = await Promise.all(Array.from(files).map(readFileAsDataUrl));
        const newItems = await analyzeBatchImages(images);
        setBatchItems(prev => [...prev, ...newItems]);
        setStep('batch-verify');
      } catch (err) {
        console.error(err);
        setError("Analysis failed. Please fill in the details manually.");
        setStep('batch-verify');
      } finally {
        e.target.value = '';
      }
    };

    void loadBatch();
  };

  const updateBatchItem = (id: string, updates: Partial<BatchItem>) => {
    setBatchItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const updateBatchItemField = (id: string, fieldId: string, value: string) => {
    setBatchItems(prev => prev.map(item => item.id === id ? {
      ...item,
      data: { ...item.data, [fieldId]: value }
    } : item));
  };

  const removeBatchItem = (id: string) => {
    setBatchItems(prev => prev.filter(item => item.id !== id));
  };

  const analyze = async (base64: string) => {
    if (!currentCollection) return;
    if (!isAiEnabled()) {
      setError("AI analysis is unavailable. Please fill in the details manually.");
      setFormData({ title: '', notes: '', data: {}, rating: 0 });
      setStep('verify');
      return;
    }
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

  const handleBatchSave = () => {
    if (!currentCollection) return;
    batchItems.forEach(item => {
      onSave(currentCollection.id, {
        collectionId: currentCollection.id,
        photoUrl: item.image,
        title: item.title || 'Untitled',
        rating: item.rating || 0,
        notes: item.notes || '',
        data: item.data || {},
      });
    });
    onClose();
  };

  const renderCollectionSelect = () => (
    <div className="space-y-4 sm:space-y-6">
      <h3 className="text-xl sm:text-2xl font-serif font-bold text-center mb-4 sm:mb-8">{t('newArchive')}</h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {collections.map(c => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCollectionId(c.id);
              setStep('upload');
            }}
            className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-stone-100 bg-stone-50/50 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group shadow-sm hover:shadow-md"
          >
            <span className="block text-2xl sm:text-3xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform origin-left">
              {c.icon || '📦'}
            </span>
            <span className="font-bold text-stone-800 block text-base sm:text-lg truncate">{c.name}</span>
            <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">{t('artifacts')}: {c.items.length}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="text-center space-y-6 sm:space-y-8 py-2 sm:py-4">
        <div className="flex justify-center">
            <div className="relative">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-stone-50 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 group hover:border-amber-400 hover:bg-amber-50 transition-all cursor-pointer overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                   {imagePreview ? (
                       <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                   ) : (
                       <>
                           <Camera size={28} className="sm:w-8 sm:h-8 mb-2" />
                           <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t('takePhoto')}</span>
                       </>
                   )}
                </div>
            </div>
        </div>
        <div>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mb-1 sm:mb-2">{t('uploadPhoto')}</h3>
            <p className="text-sm sm:text-base text-stone-500 max-w-xs mx-auto">{t('geminiExtracting')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:gap-3">
            <Button onClick={() => fileInputRef.current?.click()} size="lg" icon={<Upload size={18} />}>
                {imagePreview ? t('changePhoto') : t('uploadPhoto')}
            </Button>
            <Button variant="secondary" onClick={() => batchInputRef.current?.click()} icon={<Zap size={18} />}>
                {t('batchMode')}
            </Button>
            <button onClick={() => setStep('verify')} className="text-xs sm:text-sm font-medium text-stone-400 hover:text-stone-600">{t('skipManual')}</button>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        <input type="file" ref={batchInputRef} className="hidden" accept="image/*" multiple onChange={handleBatchFileChange} />
    </div>
  );

  const renderBatchVerify = () => (
    <div className="space-y-6">
        <div className="bg-amber-50 p-4 rounded-2xl flex gap-3 border border-amber-100">
            <Zap className="text-amber-600 shrink-0" size={20} />
            <div>
                <h4 className="text-sm font-bold text-amber-900">{t('batchMode')}</h4>
                <p className="text-[11px] text-amber-700">{t('batchModeDesc')}</p>
            </div>
        </div>
        {error && (
          <div className="p-3 bg-amber-50 text-amber-700 text-xs rounded-xl border border-amber-100 font-medium">
            {error}
          </div>
        )}
        <div className="space-y-4 max-h-[45vh] overflow-y-auto px-1">
            {batchItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-stone-100 bg-white p-3 shadow-sm">
                    <div className="flex gap-3 items-start">
                        <div className="group relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200 shrink-0">
                            <img src={item.image} className="w-full h-full object-cover" />
                            <button onClick={() => removeBatchItem(item.id)} className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                        </div>
                        <div className="flex-1 space-y-2">
                            <div>
                                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{t('title')}</label>
                                <input 
                                    type="text" 
                                    className="w-full text-sm font-semibold bg-transparent border-b border-stone-200 focus:border-amber-500 outline-none pb-1 transition-colors"
                                    value={item.title}
                                    onChange={e => updateBatchItem(item.id, { title: e.target.value })}
                                />
                            </div>
                            {currentCollection?.customFields.map(field => (
                                <div key={field.id}>
                                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{field.label}</label>
                                    <input 
                                        className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                                        value={item.data?.[field.id] || ''}
                                        onChange={e => updateBatchItemField(item.id, field.id, e.target.value)}
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{t('rating')}</label>
                                <div className="flex gap-1">
                                    {[1,2,3,4,5].map(s => (
                                        <button 
                                            key={s} 
                                            onClick={() => updateBatchItem(item.id, { rating: s })}
                                            className={`w-7 h-7 rounded-md border flex items-center justify-center transition-all text-xs ${item.rating === s ? 'bg-amber-400 border-amber-500 text-white shadow-sm' : 'bg-white border-stone-200 text-stone-300'}`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
            <button onClick={() => batchInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-300 hover:border-amber-200 hover:bg-stone-50 transition-all py-6">
                <Plus size={20} />
                <span className="text-[9px] font-bold uppercase mt-2">Add More</span>
            </button>
        </div>
        <Button className="w-full" size="lg" onClick={handleBatchSave} icon={<ArrowRight size={18} />} disabled={batchItems.length === 0}>
            Archive {batchItems.length} Artifacts
        </Button>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="text-center py-12 sm:py-20 space-y-4 sm:space-y-6">
        <div className="relative inline-block">
            <div className="absolute inset-0 bg-amber-200 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-white p-4 sm:p-6 rounded-full shadow-lg border border-stone-100">
                <Sparkles size={32} className="sm:w-10 sm:h-10 text-amber-500 animate-pulse" />
            </div>
        </div>
        <div>
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mb-1 sm:mb-2">{t('analyzingPhoto')}</h3>
            <p className="text-sm sm:text-base text-stone-500 italic font-serif">{t('geminiExtracting')}</p>
        </div>
    </div>
  );

  const renderVerify = () => (
    <div className="space-y-4 sm:space-y-6">
       {error && (
         <div className="p-3 bg-amber-50 text-amber-700 text-xs rounded-xl border border-amber-100 font-medium">
           {error}
         </div>
       )}
       <div className="flex gap-4 sm:gap-6 items-start">
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-stone-100 flex-shrink-0 overflow-hidden border border-stone-200">
                {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <Camera className="w-full h-full p-4 sm:p-6 text-stone-200" />}
            </div>
            <div className="flex-1">
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5 sm:mb-1">{t('title')}</label>
                <input 
                    type="text" 
                    className="w-full text-lg sm:text-xl font-bold bg-transparent border-b border-stone-200 focus:border-amber-500 outline-none pb-1 transition-colors"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                />
            </div>
       </div>

       <div className="space-y-3 sm:space-y-4 max-h-[35vh] sm:max-h-[40vh] overflow-y-auto px-1">
            {currentCollection?.customFields.map(field => (
                <div key={field.id}>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5 sm:mb-1">{field.label}</label>
                    <input 
                        className="w-full p-2 sm:p-2.5 bg-stone-50 border border-stone-200 rounded-lg sm:rounded-xl text-sm"
                        value={formData.data?.[field.id] || ''}
                        onChange={e => setFormData({
                            ...formData, 
                            data: { ...formData.data, [field.id]: e.target.value }
                        })}
                    />
                </div>
            ))}
            <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5 sm:mb-1">{t('rating')}</label>
                <div className="flex gap-1 sm:gap-2">
                    {[1,2,3,4,5].map(s => (
                        <button 
                            key={s} 
                            onClick={() => setFormData({...formData, rating: s})}
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center transition-all text-sm ${formData.rating === s ? 'bg-amber-400 border-amber-500 text-white shadow-sm' : 'bg-white border-stone-200 text-stone-300'}`}
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
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100">
          <h2 className="font-serif font-bold text-lg sm:text-xl text-stone-800">{t('addItem')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-8">
            {step === 'select-type' && renderCollectionSelect()}
            {step === 'upload' && renderUpload()}
            {step === 'batch-verify' && renderBatchVerify()}
            {step === 'analyzing' && renderAnalyzing()}
            {step === 'verify' && renderVerify()}
        </div>
      </div>
    </div>
  );
};
