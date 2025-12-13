import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader2, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { UserCollection, FieldDefinition, CollectionItem } from '../types';
import { analyzeImage } from '../services/geminiService';
import { Button } from './ui/Button';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: UserCollection[];
  onSave: (collectionId: string, item: Omit<CollectionItem, 'id' | 'createdAt'>) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, collections, onSave }) => {
  const [step, setStep] = useState<'select-type' | 'upload' | 'analyzing' | 'verify'>('select-type');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open
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
      // Remove header for API
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
      setError("Could not analyze image. Please fill details manually.");
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

  // Render Functions
  const renderCollectionSelect = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-serif font-bold text-center mb-6">What are we adding?</h3>
      <div className="grid grid-cols-2 gap-3">
        {collections.map(c => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCollectionId(c.id);
              setStep('upload');
            }}
            className="p-4 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
          >
            <span className="block text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">
              {/* Need to get icon from template or stored */}
              📦
            </span>
            <span className="font-bold text-stone-800">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 mb-4">
        <Camera size={32} />
      </div>
      <h3 className="text-xl font-serif font-bold">Snap a photo</h3>
      <p className="text-stone-500 max-w-xs mx-auto">
        We'll use AI to read the label and fill in the details for you.
      </p>
      
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Button onClick={() => fileInputRef.current?.click()} size="lg" icon={<Upload />}>
           Upload Photo
        </Button>
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
        />
        <button onClick={() => { setStep('verify'); setFormData({data:{}}); }} className="text-stone-400 text-sm hover:text-stone-600">
          Skip photo & enter manually
        </button>
      </div>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="text-center py-12 space-y-4">
        <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 border-4 border-stone-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-amber-500">
                <Sparkles size={20} className="animate-pulse" />
            </div>
        </div>
        <h3 className="text-lg font-medium text-stone-800 animate-pulse">Reading label...</h3>
    </div>
  );

  const renderVerify = () => {
      if (!currentCollection) return null;
      
      const updateField = (key: string, value: any) => {
          setFormData({ ...formData, data: { ...formData.data, [key]: value } });
      };

      return (
        <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100">
                {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg shadow-sm" />
                )}
                <div className="flex-1">
                     <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Title</label>
                     <input 
                        type="text" 
                        value={formData.title} 
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full bg-transparent border-b border-stone-300 focus:border-amber-500 outline-none text-lg font-bold text-stone-900 placeholder-stone-300 pb-1"
                        placeholder="Item Name"
                     />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Core: Rating */}
                 <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-stone-500 mb-1">My Rating</label>
                    <div className="flex gap-2">
                        {[1,2,3,4,5].map(star => (
                            <button 
                                key={star}
                                onClick={() => setFormData({...formData, rating: star})}
                                className={`text-2xl transition-transform hover:scale-110 ${formData.rating >= star ? 'text-amber-400' : 'text-stone-200'}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                 </div>

                 {/* Dynamic Fields */}
                 {currentCollection.customFields.map(field => (
                     <div key={field.id} className={field.type === 'long_text' ? 'md:col-span-2' : ''}>
                         <label className="block text-xs font-bold text-stone-500 mb-1 flex items-center gap-1">
                             {field.label}
                             {/* Highlight AI suggested fields if we tracked them, simple dot for now */}
                             {formData.data[field.id] && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="AI Suggested"></span>}
                         </label>
                         
                         {field.type === 'select' ? (
                             <select
                                value={formData.data[field.id] || ''}
                                onChange={e => updateField(field.id, e.target.value)}
                                className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 outline-none"
                             >
                                 <option value="">Select...</option>
                                 {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                             </select>
                         ) : field.type === 'long_text' ? (
                             <textarea
                                value={formData.data[field.id] || ''}
                                onChange={e => updateField(field.id, e.target.value)}
                                className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 outline-none min-h-[80px]"
                             />
                         ) : (
                             <input 
                                type={field.type === 'number' ? 'number' : 'text'}
                                value={formData.data[field.id] || ''}
                                onChange={e => updateField(field.id, e.target.value)}
                                className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 outline-none"
                             />
                         )}
                     </div>
                 ))}

                 {/* Notes */}
                 <div className="md:col-span-2">
                     <label className="block text-xs font-bold text-stone-500 mb-1">Notes</label>
                     <textarea
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 outline-none min-h-[80px]"
                        placeholder="Personal thoughts..."
                     />
                 </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} icon={<Check size={16}/>}>Save to Collection</Button>
            </div>
        </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-stone-100">
            <h2 className="font-serif font-bold text-lg text-stone-800">
                {step === 'select-type' ? 'Add Item' : 
                 step === 'upload' ? 'Add Photo' : 
                 step === 'analyzing' ? 'Analyzing...' : 'Review Details'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-800 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                    {error}
                </div>
            )}
            {step === 'select-type' && renderCollectionSelect()}
            {step === 'upload' && renderUpload()}
            {step === 'analyzing' && renderAnalyzing()}
            {step === 'verify' && renderVerify()}
        </div>
      </div>
    </div>
  );
};
