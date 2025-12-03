import React, { useState } from 'react';
import { AllData } from '../types';
import { useToast } from '../context/ThemeContext';
import { getFileFromDB, saveFileToDB } from '../utils/db';

interface ImportExportModalProps {
    initialMode: 'import' | 'export';
    onClose: () => void;
}

type DataTypeKey = keyof AllData;
const DATA_KEYS: DataTypeKey[] = ['people', 'categories', 'schedules', 'weapons', 'subdivisions', 'customWeaponTypes', 'settings', 'commander'];
const DATA_KEY_NAMES: Record<DataTypeKey, string> = {
    people: 'Особовий склад',
    categories: 'Категорії',
    schedules: 'Графіки',
    weapons: 'Зброя',
    subdivisions: 'Структура',
    customWeaponTypes: 'Типи зброї',
    settings: 'Налаштування',
    commander: 'Дані командира',
};

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

const ImportExportModal: React.FC<ImportExportModalProps> = ({ initialMode, onClose }) => {
    const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialMode);
    const [fileData, setFileData] = useState<AllData | null>(null);
    const [importSelections, setImportSelections] = useState<Record<DataTypeKey, { import: boolean; mode: 'replace' | 'merge' }>>({
        people: { import: false, mode: 'replace' },
        categories: { import: false, mode: 'replace' },
        schedules: { import: false, mode: 'replace' },
        weapons: { import: false, mode: 'replace' },
        subdivisions: { import: false, mode: 'replace' },
        customWeaponTypes: { import: false, mode: 'replace' },
        settings: { import: false, mode: 'replace' },
        commander: { import: false, mode: 'replace' },
    });
    const [exportSelections, setExportSelections] = useState<Record<DataTypeKey, boolean>>({
        people: true, categories: true, schedules: true, weapons: true, subdivisions: true, customWeaponTypes: true, settings: true, commander: true
    });
    const { showToast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (!text || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
                     showToast("Некоректний формат файлу. Очікується JSON.");
                     setFileData(null);
                     if (e.target) e.target.value = '';
                     return;
                }
                try {
                    const data = JSON.parse(text) as AllData;
                    setFileData(data);
                    const newSelections: typeof importSelections = { ...importSelections };
                    for (const key of DATA_KEYS) {
                        if (data[key] !== undefined) {
                            newSelections[key].import = true;
                        }
                    }
                    setImportSelections(newSelections);
                    showToast("Файл успішно прочитано. Виберіть дані для імпорту.");
                } catch (error) {
                    showToast("Некоректний формат файлу. Очікується JSON.");
                    setFileData(null);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleImport = () => {
        if (!fileData) {
            showToast("Спочатку завантажте файл.");
            return;
        }

        try {
            for (const key of DATA_KEYS) {
                if (importSelections[key].import && fileData[key] !== undefined) {
                    const storageKey = key === 'settings' ? 'app-settings' : key === 'customWeaponTypes' ? 'custom-weapon-types' : key;
                    if (importSelections[key].mode === 'replace') {
                        localStorage.setItem(storageKey, JSON.stringify(fileData[key]));
                    } else { // Merge
                        const existingRaw = localStorage.getItem(storageKey);
                        const existingData = existingRaw ? JSON.parse(existingRaw) : Array.isArray(fileData[key]) ? [] : {};
                        
                        if (Array.isArray(existingData)) {
                            const newItems = fileData[key] as any[];
                            const existingMap = new Map(existingData.map((item: any) => [item.id, item]));
                            newItems.forEach(item => existingMap.set(item.id, item));
                            localStorage.setItem(storageKey, JSON.stringify(Array.from(existingMap.values())));
                        } else { // Object (schedules, settings)
                            const merged = { ...existingData, ...fileData[key] };
                            localStorage.setItem(storageKey, JSON.stringify(merged));
                        }
                    }
                }
            }
            showToast("Імпорт завершено. Сторінка буде перезавантажена.");
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            showToast("Під час імпорту сталася помилка.");
            console.error("Import error:", e);
        }
    };
    
    const handleExport = async (isComplex: boolean) => {
        try {
            const dataToExport: Partial<AllData> & {unitName?: string, cachedDbFile?: {name: string, data: string}, excelMapping?: any} = {};
            
            for (const key of DATA_KEYS) {
                if (exportSelections[key]) {
                    const storageKey = key === 'settings' ? 'app-settings' : key === 'customWeaponTypes' ? 'custom-weapon-types' : key;
                    const data = localStorage.getItem(storageKey);
                    if (data) {
                        (dataToExport as any)[key] = JSON.parse(data);
                    }
                }
            }
            
            if (isComplex) {
                const dbFile = await getFileFromDB();
                if (dbFile) {
                    const base64Data = await fileToBase64(dbFile);
                    dataToExport.cachedDbFile = { name: dbFile.name, data: base64Data };
                }
                dataToExport.excelMapping = JSON.parse(localStorage.getItem('excel-import-settings') || '{}');
                dataToExport.unitName = localStorage.getItem('unitName')?.replace(/^"|"$/g, '') || '';
            }

            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
            const link = document.createElement("a");
            link.href = jsonString;
            const date = new Date().toISOString().slice(0, 10);
            link.download = `naryady-${isComplex ? 'complex-backup' : 'export'}-${date}.json`;
            link.click();
            showToast("Експорт успішно розпочато.");
            onClose();
        } catch (error) {
            showToast("Помилка під час експорту даних.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[150] p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex border-b border-border-color px-2">
                    <button onClick={() => setActiveTab('import')} className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'import' ? 'border-b-2 border-accent text-header' : 'text-secondary-text hover:text-primary-text'}`}>Імпорт</button>
                    <button onClick={() => setActiveTab('export')} className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'export' ? 'border-b-2 border-accent text-header' : 'text-secondary-text hover:text-primary-text'}`}>Експорт</button>
                </div>

                {activeTab === 'import' && (
                    <div className="p-4 space-y-4 overflow-y-auto">
                        <input type="file" onChange={handleFileChange} accept=".json" className="w-full text-sm text-primary-text file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover"/>
                        {fileData && (
                            <div className="space-y-3">
                                <h3 className="font-semibold text-header">Дані для імпорту:</h3>
                                {DATA_KEYS.map(key => fileData[key] !== undefined && (
                                    <div key={key} className="bg-secondary p-3 rounded-md border border-border-color flex items-center justify-between">
                                        <div className="flex items-center">
                                            <input type="checkbox" id={`import-${key}`} checked={importSelections[key].import} onChange={e => setImportSelections(p => ({...p, [key]: {...p[key], import: e.target.checked}}))} className="h-4 w-4 rounded"/>
                                            <label htmlFor={`import-${key}`} className="ml-3 text-primary-text">{DATA_KEY_NAMES[key]}</label>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <label><input type="radio" name={`mode-${key}`} value="replace" checked={importSelections[key].mode === 'replace'} onChange={() => setImportSelections(p => ({...p, [key]: {...p[key], mode: 'replace'}}))} /> Замінити</label>
                                            <label><input type="radio" name={`mode-${key}`} value="merge" checked={importSelections[key].mode === 'merge'} onChange={() => setImportSelections(p => ({...p, [key]: {...p[key], mode: 'merge'}}))} /> Об'єднати</label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'export' && (
                     <div className="p-4 space-y-3 overflow-y-auto">
                        <h3 className="font-semibold text-header">Виберіть дані для експорту:</h3>
                        {DATA_KEYS.map(key => (
                            <div key={key} className="bg-secondary p-3 rounded-md border border-border-color flex items-center">
                                <input type="checkbox" id={`export-${key}`} checked={exportSelections[key]} onChange={e => setExportSelections(p => ({...p, [key]: e.target.checked}))} className="h-4 w-4 rounded"/>
                                <label htmlFor={`export-${key}`} className="ml-3 text-primary-text">{DATA_KEY_NAMES[key]}</label>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end p-4 border-t border-border-color gap-2">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скасувати</button>
                    {activeTab === 'import' ? (
                        <button onClick={handleImport} disabled={!fileData} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover disabled:opacity-50">Імпортувати</button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => handleExport(false)} className="bg-secondary text-primary-text px-4 py-2 rounded-lg hover:bg-primary border border-border-color">Звичайний експорт</button>
                            <button onClick={() => handleExport(true)} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Комплексний бекап</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportExportModal;