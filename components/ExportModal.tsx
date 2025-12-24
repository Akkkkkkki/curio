import React, { useState, useEffect } from 'react';
import { X, Printer, Share2, Download, Maximize2, Minimize2, Check, Loader2, Camera } from 'lucide-react';
import { CollectionItem, FieldDefinition } from '../types';
import { Button } from './ui/Button';
import { getAsset } from '../services/db';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CollectionItem;
  fields: FieldDefinition[];
}

type TemplateStyle = 'minimal' | 'full' | 'retro';
type AspectRatio = '1:1' | '3:4' | '9:16';
type ImageFit = 'cover' | 'contain';

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, item, fields }) => {
  const [style, setStyle] = useState<TemplateStyle>('minimal');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [imageFit, setImageFit] = useState<ImageFit>('cover');
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(true);

  // Fetch the high-res master image from the asset store
  useEffect(() => {
    if (!isOpen) return;

    let objectUrl: string | null = null;
    const loadMaster = async () => {
      setIsLoadingImage(true);
      try {
        const blob = await getAsset(item.id);
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        }
      } catch (e) {
        console.error("Export: Failed to load master image", e);
      } finally {
        setIsLoadingImage(false);
      }
    };

    loadMaster();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, item.id]);

  if (!isOpen) return null;

  const getValue = (fieldId: string) => {
    const val = item.data[fieldId];
    if (val === undefined || val === null) return null;
    return val.toString();
  };

  const primaryFields = fields.slice(0, 2); 

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: item.title,
                text: `Check out ${item.title} from my collection!`,
                url: window.location.href
            });
        } catch (err) {
            console.log('Error sharing:', err);
        }
    } else {
        alert("Sharing is not supported on this browser/device.");
    }
  };

  const getAspectRatioStyle = () => {
    const map: Record<AspectRatio, string> = {
        '1:1': '1 / 1',
        '3:4': '3 / 4',
        '9:16': '9 / 16'
    };
    return { aspectRatio: map[aspectRatio] };
  };
  
  const isCompact = aspectRatio === '1:1';
  const titleSize = isCompact ? 'text-xl' : 'text-3xl';
  const metaSize = isCompact ? 'text-[8px]' : 'text-[10px]';

  const renderCardPreview = () => {
    const containerStyles = {
        minimal: "bg-white p-6 flex flex-col items-center text-center justify-between border-[12px] border-white",
        full: "bg-stone-900 text-white p-6 flex flex-col justify-end relative",
        retro: "bg-[#f4ebd9] p-4 flex flex-col border-4 border-stone-800",
    };

    return (
      <div 
        id="card-preview"
        className={`shadow-2xl transition-all duration-300 overflow-hidden relative group select-none h-full w-auto mx-auto print:h-auto print:w-[100mm]`}
        style={getAspectRatioStyle()}
      >
        <div className={`w-full h-full ${containerStyles[style]} transition-all duration-300`}>
            
            {/* MINIMAL TEMPLATE */}
            {style === 'minimal' && (
                <>
                    <div className={`w-full overflow-hidden mb-4 ring-4 ring-stone-100 bg-stone-50 relative flex-1 rounded-xl min-h-0`}>
                        {isLoadingImage ? (
                            <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-stone-200" /></div>
                        ) : imageUrl ? (
                            <>
                                {imageFit === 'contain' && (
                                    <img src={imageUrl} className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-150" alt="" />
                                )}
                                <img 
                                    src={imageUrl} 
                                    className={`w-full h-full relative z-10 ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`} 
                                    alt={item.title}
                                />
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-200"><Camera size={40} /><span className="text-xs">No Image</span></div>
                        )}
                    </div>
                    <div className="flex-shrink-0 w-full">
                        <h3 className={`font-serif ${titleSize} font-bold text-stone-900 leading-tight mb-2 line-clamp-2`}>{item.title}</h3>
                        <div className="flex gap-1 justify-center text-amber-400 mb-3">
                             {[...Array(5)].map((_, i) => (
                                 <span key={i} className={i < item.rating ? 'text-amber-400' : 'text-stone-200'}>★</span>
                             ))}
                        </div>
                        <div className={`flex justify-center flex-wrap gap-2 ${metaSize} font-bold uppercase tracking-widest text-stone-400`}>
                            {primaryFields.map(f => {
                                const v = getValue(f.id);
                                return v ? <span key={f.id} className="px-2 py-1 bg-stone-50 rounded-md">{v}</span> : null;
                            })}
                        </div>
                    </div>
                    <div className="mt-5 pt-3 border-t border-stone-100 w-full flex-shrink-0 flex justify-between items-center">
                         <p className={`${metaSize} text-stone-400 font-mono`}>CURIO MUSEUM</p>
                         <p className={`${metaSize} text-stone-300 font-mono`}>{new Date().getFullYear()}</p>
                    </div>
                </>
            )}

            {/* FULL TEMPLATE */}
            {style === 'full' && (
                <>
                    {imageUrl && (
                        <div className="absolute inset-0">
                             {imageFit === 'contain' && (
                                <img src={imageUrl} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-60 scale-125" alt="" />
                            )}
                            <img 
                                src={imageUrl} 
                                className={`w-full h-full relative z-10 ${imageFit === 'contain' ? 'object-contain' : 'object-cover'} ${imageFit === 'contain' ? '' : 'opacity-80'}`} 
                                alt={item.title}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent z-20" />
                        </div>
                    )}
                    <div className={`relative z-30 flex flex-col h-full justify-end`}>
                        <div className="mb-auto pt-2 flex justify-end">
                            <div className="bg-black/30 backdrop-blur-md rounded-full px-3 py-1 flex gap-1 text-amber-400 text-xs">
                                {[...Array(item.rating)].map((_, i) => <span key={i}>★</span>)}
                            </div>
                        </div>
                        
                        <h3 className={`font-serif ${isCompact ? 'text-2xl' : 'text-4xl'} font-bold text-white mb-2 leading-none shadow-black drop-shadow-lg`}>{item.title}</h3>
                        <p className={`text-stone-300 text-sm line-clamp-2 mb-6 font-medium text-shadow ${isCompact ? 'hidden' : 'block'}`}>
                            {item.notes || "No notes added."}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                             {primaryFields.map(f => (
                                 <div key={f.id}>
                                     <p className="text-[9px] uppercase text-stone-400 tracking-wider mb-0.5">{f.label}</p>
                                     <p className="text-base font-semibold text-white truncate">{getValue(f.id) || '-'}</p>
                                 </div>
                             ))}
                        </div>
                    </div>
                </>
            )}

            {/* RETRO TEMPLATE */}
            {style === 'retro' && (
                <>
                    <div className="w-full flex-1 border-2 border-stone-800 mb-4 bg-stone-200 grayscale contrast-125 overflow-hidden relative min-h-0">
                        {imageUrl && (
                            <img 
                                src={imageUrl} 
                                className={`w-full h-full mix-blend-multiply ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`} 
                                alt={item.title}
                            />
                        )}
                        <div className="absolute top-2 left-2 w-full h-full border border-stone-800/20 pointer-events-none"></div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col justify-between">
                        <div>
                             <div className="flex justify-between items-end border-b-2 border-stone-800 pb-2 mb-3">
                                <h3 className={`font-serif ${isCompact ? 'text-lg' : 'text-2xl'} font-bold text-stone-900 uppercase tracking-tighter line-clamp-2 pr-2 leading-none`}>
                                    {item.title}
                                </h3>
                                <span className="font-mono text-xs font-bold bg-stone-900 text-[#f4ebd9] px-1 shrink-0 mb-0.5">NO. {item.rating}</span>
                             </div>
                             
                             <div className="grid grid-cols-1 gap-1 text-xs font-mono text-stone-800">
                                 {fields.slice(0,3).map(f => (
                                     <div key={f.id} className="flex justify-between items-end">
                                         <span className="uppercase text-stone-500 pb-0.5">{f.label}</span>
                                         <span className="font-bold border-b border-stone-400 border-dotted flex-1 text-right ml-2 line-clamp-2 leading-tight">{getValue(f.id)}</span>
                                     </div>
                                 ))}
                             </div>
                        </div>
                        <div className={`text-center ${metaSize} font-mono text-stone-400 mt-4 uppercase tracking-widest`}>
                            Archival Record • {new Date().toLocaleDateString()}
                        </div>
                    </div>
                </>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md animate-in fade-in duration-200 print:bg-white print:static print:block">
      
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center pt-6 pb-[45vh] px-6 md:pb-6 md:pr-96 md:pt-6 overflow-hidden print:relative print:inset-auto print:p-0 print:overflow-visible print:block" 
        onClick={() => setIsExpanded(false)}
      >
         <div className="h-full w-full flex items-center justify-center print:block print:h-auto print:w-auto">
            {renderCardPreview()}
         </div>
      </div>

      <div 
        className={`absolute bottom-0 left-0 right-0 md:top-0 md:left-auto md:w-96 md:h-full bg-white rounded-t-3xl md:rounded-none shadow-2xl flex flex-col transition-all duration-300 ease-out z-10 ${isExpanded ? 'h-[85vh]' : 'h-[40vh]'} md:h-full print:hidden`}
      >
        <div 
            className="md:hidden w-full flex justify-center py-3 cursor-pointer active:opacity-70 touch-none"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="w-12 h-1.5 bg-stone-200 rounded-full" />
        </div>

        <div className="px-6 pb-4 md:pt-6 border-b border-stone-100 flex justify-between items-center bg-white rounded-t-3xl md:rounded-none shrink-0">
            <div>
                <h2 className="font-serif font-bold text-xl text-stone-900">Export Card</h2>
                <p className="text-xs text-stone-500 hidden md:block">Customize your collection card.</p>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-stone-400 hover:text-stone-800 rounded-full hover:bg-stone-50">
                <X size={20}/>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Card Style</label>
                <div className="grid grid-cols-1 gap-2">
                    {['minimal', 'full', 'retro'].map((s) => (
                        <button 
                            key={s}
                            onClick={() => setStyle(s as TemplateStyle)}
                            className={`flex items-center p-3 rounded-xl border transition-all text-left group ${
                                style === s 
                                ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500' 
                                : 'border-stone-200 hover:border-amber-200 hover:bg-stone-50'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-lg mr-3 shadow-sm border ${
                                s === 'minimal' ? 'bg-white border-stone-100' : 
                                s === 'full' ? 'bg-stone-800 border-stone-800' : 
                                'bg-[#f4ebd9] border-stone-300'
                            }`}></div>
                            <div>
                                <span className="font-bold text-stone-900 capitalize block">{s}</span>
                                <span className="text-[10px] text-stone-500 uppercase tracking-wide">
                                    {s === 'minimal' ? 'Clean & Airy' : s === 'full' ? 'Immersive' : 'Vintage'}
                                </span>
                            </div>
                            {style === s && <Check size={16} className="ml-auto text-amber-600" />}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Aspect Ratio</label>
                    <div className="flex gap-2">
                        {['1:1', '3:4', '9:16'].map(r => (
                            <button
                                key={r}
                                onClick={() => setAspectRatio(r as AspectRatio)}
                                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${aspectRatio === r ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                            >
                                {r.replace(':', '/')}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                     <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Image Fit</label>
                     <div className="flex gap-2">
                        <button 
                            onClick={() => setImageFit('contain')} 
                            className={`flex-1 py-2 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 ${imageFit === 'contain' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                        >
                            <Minimize2 size={12}/> Fit
                        </button>
                        <button 
                            onClick={() => setImageFit('cover')} 
                            className={`flex-1 py-2 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 ${imageFit === 'cover' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                        >
                            <Maximize2 size={12}/> Fill
                        </button>
                     </div>
                </div>
            </div>
        </div>

        <div className="p-4 md:p-6 border-t border-stone-100 bg-stone-50 space-y-3 shrink-0">
            <Button className="w-full" size="lg" icon={<Download size={18} />}>
                Save Image
            </Button>
            <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handlePrint} icon={<Printer size={16}/>}>
                    Print
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleShare} icon={<Share2 size={16}/>}>
                    Share
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};
