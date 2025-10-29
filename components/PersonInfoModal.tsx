import React, { useMemo, useState, useEffect } from 'react';
import { Person } from '../types';
import Card from './Card';
import { getPhoto } from '../utils/db';
import { UsersIcon, PhoneIcon, StarIcon, EditIcon } from './icons/Icons';

interface PersonInfoModalProps {
  person: Person;
  onClose: () => void;
  onSavePhoto: (personId: string, photoDataUrl: string) => void;
  fullPosition: string;
  dutyStats: {
    totalDuties: number;
    dutiesThisMonth: number;
    overallIndex: number;
    monthlyIndex: number;
    busiestCategory: string | null;
  } | undefined;
}

const StarRating: React.FC<{ index: number; label: string }> = ({ index, label }) => {
    const starCount = useMemo(() => {
        if (index < 0.5) return 1;
        if (index < 0.8) return 2;
        if (index < 1.2) return 3;
        if (index < 1.6) return 4;
        return 5;
    }, [index]);

    return (
        <div className="text-center">
            <p className="text-sm text-secondary-text">{label}</p>
            <div className="flex justify-center text-yellow-400">
                {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} filled={i < starCount} className="w-6 h-6" />
                ))}
            </div>
            <p className="text-xs text-secondary-text mt-1">(x{index.toFixed(2)})</p>
        </div>
    );
};


const PersonInfoModal: React.FC<PersonInfoModalProps> = ({ person, onClose, onSavePhoto, fullPosition, dutyStats }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (person.hasPhoto) {
        getPhoto(person.id).then(url => {
            if (url) setPhotoUrl(url);
        });
    } else {
        setPhotoUrl(null);
    }
  }, [person.hasPhoto, person.id]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 256;
            const MAX_HEIGHT = 256;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                onSavePhoto(person.id, dataUrl);
                setPhotoUrl(dataUrl);
            }
        };
        img.src = event.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 flex items-center gap-4 border-b border-border-color">
            <div className="flex-shrink-0 relative">
                <div className="w-20 h-20 rounded-full bg-secondary bg-cover bg-center border-2 border-border-color" style={{ backgroundImage: `url(${photoUrl})` }}>
                    {!photoUrl && <UsersIcon className="w-10 h-10 text-secondary-text m-5" />}
                </div>
                 <label htmlFor="photo-upload" className="absolute bottom-0 right-0 cursor-pointer bg-accent text-white text-xs p-1 rounded-full hover:bg-accent-hover transition-colors">
                    <EditIcon className="w-4 h-4" />
                </label>
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>
            <div>
                 <h2 className="text-xl font-bold text-header">{person.fullName}</h2>
                 <p className="text-sm text-secondary-text">{person.rank}</p>
                 <p className="text-xs text-secondary-text">ІНН: {person.tin}</p>
            </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Main Info */}
            <Card title="Особиста інформація" className="bg-secondary/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="flex justify-between border-b border-border-color/50 pb-1">
                        <span className="text-secondary-text">Повна посада:</span>
                        <span className="text-primary-text text-right font-medium">{fullPosition}</span>
                    </div>
                     <div className="flex justify-between border-b border-border-color/50 pb-1">
                        <span className="text-secondary-text">Телефон:</span>
                        <span className="text-primary-text font-medium flex items-center gap-1"><PhoneIcon className="w-4 h-4" />{person.phone || 'Не вказано'}</span>
                    </div>
                     <div className="flex justify-between border-b border-border-color/50 pb-1">
                        <span className="text-secondary-text">Дата народження:</span>
                        <span className="text-primary-text font-medium">{person.dateOfBirth || 'Не вказано'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border-color/50 pb-1">
                        <span className="text-secondary-text">Додано до системи:</span>
                        <span className="text-primary-text font-medium">{new Date(person.createdTimestamp).toLocaleDateString('uk-UA')}</span>
                    </div>
                     <div className="flex justify-between border-b border-border-color/50 pb-1">
                        <span className="text-secondary-text">Джерело:</span>
                        <span className="text-primary-text font-medium">{person.source === 'manual' ? 'Додано вручну' : 'Імпортовано'}</span>
                    </div>
                     <div className="flex justify-between border-b border-border-color/50 pb-1">
                        <span className="text-secondary-text">Рядок з файлу:</span>
                        <span className="text-primary-text font-medium">{person.subdivisionRowIndex || 'N/A'}</span>
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <Card title="Статистика нарядів" className="bg-secondary/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center bg-primary p-3 rounded-lg">
                        <p className="text-secondary-text text-sm">Всього нарядів</p>
                        <p className="text-3xl font-bold text-header">{dutyStats?.totalDuties || 0}</p>
                    </div>
                     <div className="text-center bg-primary p-3 rounded-lg">
                        <p className="text-secondary-text text-sm">Нарядів у цьому місяці</p>
                        <p className="text-3xl font-bold text-header">{dutyStats?.dutiesThisMonth || 0}</p>
                    </div>
                    <StarRating index={dutyStats?.overallIndex || 0} label="Індекс (загальний)" />
                    <StarRating index={dutyStats?.monthlyIndex || 0} label="Індекс (місяць)" />
                </div>
                 {dutyStats?.busiestCategory && <p className="text-xs text-center text-secondary-text mt-2">Індекс розраховано по найбільш завантаженій категорії: "{dutyStats.busiestCategory}"</p>}
            </Card>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end space-x-2 p-4 border-t border-border-color">
          <button type="button" onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Закрити</button>
        </div>
      </div>
    </div>
  );
};

export default PersonInfoModal;
