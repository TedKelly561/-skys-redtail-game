import React, { useEffect, useState } from 'react';
import { X, Share, Download, Trash2 } from 'lucide-react';
import { Photo, canSharePhoto, downloadPhoto, sharePhoto } from '../game/photos';

const bigBtn =
  'flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-base transition active:scale-95 cursor-pointer';

/** One photo, big, with Share / Save (and Delete in the album). */
export const PhotoView: React.FC<{
  url: string;
  title: string;
  onClose: () => void;
  onDelete?: () => void;
  closeLabel?: string;
}> = ({ url, title, onClose, onDelete, closeLabel = 'Keep swimming' }) => {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    let alive = true;
    canSharePhoto(url).then((ok) => alive && setCanShare(ok));
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className="absolute inset-0 z-[60] bg-slate-950/85 flex items-center justify-center p-4 pointer-events-auto" onClick={onClose}>
      <div className="w-full max-w-md flex flex-col items-center gap-3 animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="text-white text-xl font-black">{title}</div>
        <img src={url} alt="Your photo of Whiskers" className="w-full max-h-[60vh] object-contain rounded-xl shadow-2xl rotate-[-1.5deg]" />
        <div className="w-full grid grid-cols-2 gap-2">
          {canShare ? (
            <button onClick={() => void sharePhoto(url)} className={`${bigBtn} bg-sky-500 text-white`}>
              <Share className="w-5 h-5" /> Share
            </button>
          ) : (
            <button onClick={() => downloadPhoto(url)} className={`${bigBtn} bg-sky-500 text-white`}>
              <Download className="w-5 h-5" /> Save
            </button>
          )}
          <button onClick={onClose} className={`${bigBtn} bg-emerald-500 text-white`}>
            {closeLabel}
          </button>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="flex items-center gap-1.5 text-sm font-semibold text-rose-200/80 hover:text-rose-100 cursor-pointer">
            <Trash2 className="w-4 h-4" /> Delete this photo
          </button>
        )}
      </div>
    </div>
  );
};

/** The little album of recent photos (kept on this device). */
export const PhotoAlbum: React.FC<{
  photos: Photo[];
  onClose: () => void;
  onDelete: (at: number) => void;
}> = ({ photos, onClose, onDelete }) => {
  const [open, setOpen] = useState<Photo | null>(null);
  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 pointer-events-auto" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-amber-50 border-4 border-amber-300 shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-amber-900">📷 My Photos</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-amber-100 text-amber-900 cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>
        {photos.length === 0 ? (
          <p className="text-amber-900/80 text-center py-8 font-semibold">Tap 📷 while swimming to take a picture!</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((p) => (
              <button key={p.at} onClick={() => setOpen(p)} className="cursor-pointer active:scale-95 transition">
                <img src={p.url} alt="Photo of Whiskers" className="w-full rounded-lg shadow-md" />
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-amber-900/60 text-center mt-3">The last 8 photos are kept on this device.</p>
      </div>
      {open && (
        <PhotoView
          url={open.url}
          title="📷 My Photo"
          closeLabel="Back"
          onClose={() => setOpen(null)}
          onDelete={() => {
            onDelete(open.at);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
};
