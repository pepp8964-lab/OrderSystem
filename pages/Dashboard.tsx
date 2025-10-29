import React, { useMemo, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useLocalStorage from '../hooks/useLocalStorage';
import { Person, Category, ScheduleData, Weapon, AllData, Subdivision, CustomWeaponType, AppSettings } from '../types';
import { DutyStatus } from '../constants';
import { UKRAINIAN_MONTHS } from '../constants';
import Card from '../components/Card';
import { UsersIcon, TagIcon, CalendarIcon, UploadIcon, DownloadIcon, DatabaseIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, EditIcon, FileImportIcon } from '../components/icons/Icons';
import { useToast, useActionLog } from '../context/ThemeContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { saveFileToDB, getFileFromDB, deleteFileFromDB } from '../utils/db';
import { defaultSettings } from '../utils/defaults';


declare const XLSX: any;

type ExcelMapping = {
    fullName: string;
    lastName: string;
    firstName: string;
    patronymic: string;
    rank: string;
    position: string;
    tin: string;
    subdivision: string;
    dobFull: string;
    dobDay: string;
    dobMonth: string;
    dobYear: string;
    phone: string;
};

type Conflict = {
    type: 'person' | 'category' | 'weapon';
    key: string;
    existing: Person | Category | Weapon;
    incoming: Person | Category | Weapon;
    resolution?: 'keep' | 'replace';
}

type DatabaseFileInfo = {
    name: string;
    lastModified: number;
    uploadedAt?: number;
};

const ConflictResolutionModal: React.FC<{
    conflict: Conflict;
    onResolve: (resolution: 'keep' | 'replace') => void;
}> = ({ conflict, onResolve }) => {
    const isExistingArchived = !!(conflict.existing as any).deletedTimestamp;

    const renderCard = (item: Person | Category | Weapon, type: 'person' | 'category' | 'weapon', title: string) => {
        return (
            <div className="bg-secondary p-4 rounded-lg border border-border-color">
                <h4 className="font-bold text-header mb-2">{title}</h4>
                {type === 'person' && (item as Person) && (
                    <>
                        <p>{(item as Person).fullName}</p>
                        <p className="text-sm text-secondary-text">ІНН: {(item as Person).tin}</p>
                        <p className="text-sm text-secondary-text">Звання: {(item as Person).rank}</p>
                    </>
                )}
                {type === 'category' && (item as Category) && <p>{(item as Category).name}</p>}
                {type === 'weapon' && (item as Weapon) && (
                    <>
                        <p>{(item as Weapon).type} №{(item as Weapon).serialNumber}</p>
                    </>
                )}
            </div>
        );
    };
    
    const typeName = { person: 'особи', category: 'категорії', weapon: 'зброї' }[conflict.type];

    return (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-2xl">
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">{isExistingArchived ? 'Конфлікт: знайдено архівний запис' : 'Вирішення конфлікту'}</h2></div>
                <div className="p-4 space-y-4">
                    <p className="text-primary-text">
                        {isExistingArchived
                            ? <>Існуючий запис для ключа <strong>{conflict.key}</strong> знаходиться в архіві.</>
                            : <>Знайдено дублікат для {typeName} з ключем: <strong>{conflict.key}</strong></>
                        }
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderCard(conflict.existing, conflict.type, `Існуючий запис ${isExistingArchived ? '(в архіві)' : ''}`)}
                        {renderCard(conflict.incoming, conflict.type, 'Новий запис (з файлу)')}
                    </div>
                </div>
                <div className="p-4 border-t border-border-color flex justify-center gap-4">
                    <button onClick={() => onResolve('keep')} className="bg-secondary px-6 py-2 rounded-lg hover:bg-primary border border-border-color">{isExistingArchived ? 'Залишити в архіві' : 'Залишити існуючий'}</button>
                    <button onClick={() => onResolve('replace')} className="bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent-hover">{isExistingArchived ? 'Відновити та замінити' : 'Замінити на новий'}</button>
                </div>
            </div>
        </div>
    );
};


const ExportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [selected, setSelected] = useState({ people: true, categories: true, schedules: true, weapons: true, subdivisions: true, customWeaponTypes: true });
    const [isExporting, setIsExporting] = useState(false);
    const { showToast } = useToast();
    const { logAction } = useActionLog();

    const handleExport = () => {
        setIsExporting(true);
        try {
            const dataToExport: AllData = {};
            if (selected.people) dataToExport.people = JSON.parse(localStorage.getItem('people') || '[]');
            if (selected.categories) dataToExport.categories = JSON.parse(localStorage.getItem('categories') || '[]');
            if (selected.schedules) dataToExport.schedules = JSON.parse(localStorage.getItem('schedules') || '{}');
            if (selected.weapons) dataToExport.weapons = JSON.parse(localStorage.getItem('weapons') || '[]');
            if (selected.subdivisions) dataToExport.subdivisions = JSON.parse(localStorage.getItem('subdivisions') || '[]');
            if (selected.customWeaponTypes) dataToExport.customWeaponTypes = JSON.parse(localStorage.getItem('custom-weapon-types') || '[]');

            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
            const link = document.createElement("a");
            link.href = jsonString;
            const date = new Date().toISOString().slice(0, 10);
            link.download = `naryady-backup-${date}.json`;
            link.click();
            showToast("Збереження успішно завершено.");
            const logMessage = `Виконано збереження проєкту (Особовий склад: ${selected.people ? 'Так' : 'Ні'}, Категорії: ${selected.categories ? 'Так' : 'Ні'}, Графік: ${selected.schedules ? 'Так' : 'Ні'}, Зброя: ${selected.weapons ? 'Так' : 'Ні'}, Структура: ${selected.subdivisions ? 'Так' : 'Ні'})`;
            logAction(logMessage);
        } catch (error) {
            console.error("Export failed:", error);
            showToast("Помилка під час збереження проєкту.");
        } finally {
            setIsExporting(false);
            onClose();
        }
    };

    const toggleSelection = (key: keyof typeof selected) => {
        setSelected(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const options: {key: keyof typeof selected, label: string}[] = [
        { key: 'people', label: 'Особовий склад' },
        { key: 'categories', label: 'Категорії' },
        { key: 'schedules', label: 'Графік' },
        { key: 'weapons', label: 'Зброя' },
        { key: 'subdivisions', label: 'Структура'},
        { key: 'customWeaponTypes', label: 'Типи зброї'},
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Зберегти проєкт</h2></div>
                <div className="p-4 space-y-3">
                    <p className="text-primary-text">Виберіть дані для збереження:</p>
                    {options.map(({ key, label }) => (
                        <div key={key} className="flex items-center bg-secondary p-2 rounded-md">
                            <input type="checkbox" id={`export-${String(key)}`} checked={selected[key]} onChange={() => toggleSelection(key)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                            <label htmlFor={`export-${String(key)}`} className="ml-3 text-primary-text">{label}</label>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-border-color flex justify-end gap-2">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скасувати</button>
                    <button onClick={handleExport} disabled={isExporting} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover disabled:bg-gray-500">
                        {isExporting ? 'Збереження...' : 'Зберегти'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const JsonImportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { showToast } = useToast();
    const { logAction } = useActionLog();
    const [file, setFile] = useState<File | null>(null);
    const [fileData, setFileData] = useState<AllData | null>(null);
    const [selectedData, setSelectedData] = useState<Record<keyof AllData, boolean>>({people: false, categories: false, schedules: false, weapons: false, settings: false, subdivisions: false, customWeaponTypes: false});
    const [replaceData, setReplaceData] = useState(false);
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [currentConflictIndex, setCurrentConflictIndex] = useState(-1);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f && f.name.endsWith('.json')) {
            setFile(f);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    setFileData(data);
                    setSelectedData({
                        people: !!data.people,
                        categories: !!data.categories,
                        schedules: !!data.schedules,
                        weapons: !!data.weapons,
                        settings: !!data.settings,
                        subdivisions: !!data.subdivisions,
                        customWeaponTypes: !!data.customWeaponTypes,
                    });
                } catch (error) {
                    showToast("Некоректний формат файлу JSON.");
                    setFileData(null);
                    setFile(null);
                }
            };
            reader.readAsText(f);
        } else {
            showToast("Непідтримуваний тип файлу. Виберіть .json");
        }
    };
    
    const handleJsonImport = () => {
        if (!fileData || !file) return;

        if (replaceData) {
            if (selectedData.people) localStorage.setItem('people', JSON.stringify(fileData.people || []));
            if (selectedData.categories) localStorage.setItem('categories', JSON.stringify(fileData.categories || []));
            if (selectedData.schedules) localStorage.setItem('schedules', JSON.stringify(fileData.schedules || {}));
            if (selectedData.weapons) localStorage.setItem('weapons', JSON.stringify(fileData.weapons || []));
            if (selectedData.settings) localStorage.setItem('app-settings', JSON.stringify(fileData.settings || {}));
            if (selectedData.subdivisions) localStorage.setItem('subdivisions', JSON.stringify(fileData.subdivisions || []));
            if (selectedData.customWeaponTypes) localStorage.setItem('custom-weapon-types', JSON.stringify(fileData.customWeaponTypes || []));
            showToast("Дані успішно замінено.");
            logAction("Виконано імпорт з заміною даних.");
            onClose();
            window.location.reload(); // Reload to reflect changes globally
            return;
        }

        const conflictsToResolve: Conflict[] = [];
        const existingPeople: Person[] = JSON.parse(localStorage.getItem('people') || '[]');
        const existingCategories: Category[] = JSON.parse(localStorage.getItem('categories') || '[]');
        const existingWeapons: Weapon[] = JSON.parse(localStorage.getItem('weapons') || '[]');

        if (selectedData.people && fileData.people) {
            fileData.people.forEach(incoming => {
                const existing = existingPeople.find(e => e.tin === incoming.tin);
                if (existing) conflictsToResolve.push({ type: 'person', key: incoming.tin, existing, incoming });
            });
        }
        if (selectedData.categories && fileData.categories) {
            fileData.categories.forEach(incoming => {
                const existing = existingCategories.find(e => e.name === incoming.name);
                if (existing) conflictsToResolve.push({ type: 'category', key: incoming.name, existing, incoming });
            });
        }
        if (selectedData.weapons && fileData.weapons) {
            fileData.weapons.forEach(incoming => {
                const existing = existingWeapons.find(e => e.serialNumber === incoming.serialNumber);
                if (existing) conflictsToResolve.push({ type: 'weapon', key: incoming.serialNumber, existing, incoming });
            });
        }

        if (conflictsToResolve.length > 0) {
            setConflicts(conflictsToResolve);
            setCurrentConflictIndex(0);
        } else {
            mergeData([]);
        }
    };
    
    const mergeData = (resolvedConflicts: Conflict[]) => {
        if (!fileData) return;
        
        const merge = <T extends {id: string, deletedTimestamp: number | null}>(key: 'people' | 'categories' | 'weapons', uniqueId: keyof T & string) => {
            if (!selectedData[key] || !fileData[key]) return;
            const existing: T[] = JSON.parse(localStorage.getItem(key) || '[]') as T[];
            const incoming: T[] = (fileData[key as keyof AllData] as unknown as T[]) || [];
            
            const resolvedReplaces = resolvedConflicts
                .filter(c => (c.type === ({people: 'person', categories: 'category', weapons: 'weapon'}[key])) && c.resolution === 'replace')
                .map(c => (c.incoming as unknown as T));
            
            const itemsToReplace = new Map(resolvedReplaces.map(item => [String(item[uniqueId]), item]));
            
            const updatedExisting = existing.map(item => {
                if (itemsToReplace.has(String(item[uniqueId]))) {
                    const replacement = itemsToReplace.get(String(item[uniqueId]))!;
                    return { ...replacement, id: item.id, deletedTimestamp: null };
                }
                return item;
            });

            const existingIds = new Set(existing.map(item => String(item[uniqueId])));
            const newItems = incoming.filter(item => !existingIds.has(String(item[uniqueId])));
            
            localStorage.setItem(key, JSON.stringify([...updatedExisting, ...newItems]));
        };
        
        merge<Person>('people', 'tin');
        merge<Category>('categories', 'name');
        merge<Weapon>('weapons', 'serialNumber');

        if (selectedData.schedules && fileData.schedules) {
            const existingSchedules: ScheduleData = JSON.parse(localStorage.getItem('schedules') || '{}');
            const newSchedules = { ...existingSchedules, ...fileData.schedules };
            localStorage.setItem('schedules', JSON.stringify(newSchedules));
        }

        if (selectedData.settings && fileData.settings) {
            localStorage.setItem('app-settings', JSON.stringify(fileData.settings));
        }
        
        if (selectedData.subdivisions && fileData.subdivisions) {
            localStorage.setItem('subdivisions', JSON.stringify(fileData.subdivisions));
        }
        
        if (selectedData.customWeaponTypes && fileData.customWeaponTypes) {
            localStorage.setItem('custom-weapon-types', JSON.stringify(fileData.customWeaponTypes));
        }

        showToast("Імпорт (злиття) завершено.");
        logAction("Виконано імпорт (злиття) даних.");
        onClose();
        window.location.reload();
    };

    const handleConflictResolved = (resolution: 'keep' | 'replace') => {
        const updatedConflicts = [...conflicts];
        updatedConflicts[currentConflictIndex].resolution = resolution;
        setConflicts(updatedConflicts);

        if (currentConflictIndex < conflicts.length - 1) {
            setCurrentConflictIndex(currentConflictIndex + 1);
        } else {
            mergeData(updatedConflicts);
        }
    };
    
    const handleToggleSelection = (key: keyof AllData) => {
        if (fileData && fileData[key]) {
            setSelectedData(prev => ({ ...prev, [key]: !prev[key] }));
        }
    };
    
    const importOptions: { key: keyof AllData; label: string }[] = [
        { key: 'people', label: 'Особовий склад' },
        { key: 'categories', label: 'Категорії' },
        { key: 'weapons', label: 'Зброя' },
        { key: 'schedules', label: 'Графік' },
        { key: 'settings', label: 'Налаштування' },
        { key: 'subdivisions', label: 'Структура' },
        { key: 'customWeaponTypes', label: 'Типи зброї'},
    ];

    if (currentConflictIndex >= 0) {
        return <ConflictResolutionModal conflict={conflicts[currentConflictIndex]} onResolve={handleConflictResolved} />;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Відкрити проєкт (.json)</h2></div>
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {!file && <input type="file" accept=".json" onChange={handleFileChange} className="w-full bg-secondary p-2 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover"/>}
                    {fileData && (
                        <>
                            <div className="space-y-3">
                                <p className="text-primary-text mb-2">Виберіть дані для імпорту з файлу <strong>{file?.name}</strong>:</p>
                                {importOptions.map(({ key, label }) => {
                                    const isDisabled = !fileData[key];
                                    return (
                                    <div key={key} className={`flex items-center bg-secondary p-2 rounded-md ${isDisabled ? 'opacity-50' : ''}`}>
                                        <input type="checkbox" id={`import-${key}`} checked={!isDisabled && selectedData[key]} onChange={() => handleToggleSelection(key)} disabled={isDisabled} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                        <label htmlFor={`import-${key}`} className={`ml-3 text-primary-text ${isDisabled ? 'text-secondary-text' : ''}`}>{label}</label>
                                    </div>
                                    );
                                })}
                                <div className="flex items-center bg-secondary p-2 rounded-md mt-4">
                                    <input type="checkbox" id="replace-data" checked={replaceData} onChange={e => setReplaceData(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                    <label htmlFor="replace-data" className="ml-3 text-yellow-500 text-sm">Замінити існуючі дані (перезаписати все)</label>
                                </div>
                            </div>
                            <div className="p-4 border-t border-border-color flex justify-end gap-2 -mx-4 -mb-4">
                                <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скасувати</button>
                                <button onClick={handleJsonImport} disabled={!fileData || Object.values(selectedData).every(v => !v)} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover disabled:bg-gray-500">
                                    Імпортувати
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const DatabaseModal: React.FC<{ onClose: () => void; onSaveSuccess?: () => void; }> = ({ onClose, onSaveSuccess }) => {
    const [databaseFile, setDatabaseFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();
    const { logAction } = useActionLog();
    const [, setSettings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
    const [existingFile, setExistingFile] = useState<DatabaseFileInfo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const loadFile = async () => {
            const file = await getFileFromDB();
            if (file) {
                setExistingFile({ name: file.name, lastModified: file.lastModified });
            }
        };
        loadFile();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            setDatabaseFile(file);
        } else {
            showToast("Непідтримуваний тип файлу. Виберіть .xlsx або .xls");
        }
    };

    const handleSave = async () => {
        if (!databaseFile) return;
        setIsSaving(true);
        try {
            await saveFileToDB(databaseFile);
            setSettings(prev => ({...prev, dbFilePath: databaseFile.name}));
            showToast("Файл бази даних успішно збережено.");
            logAction(`Оновлено файл локальної бази даних: ${databaseFile.name}`);
            setExistingFile({ name: databaseFile.name, lastModified: databaseFile.lastModified });
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            console.error("Failed to save to DB:", error);
            showToast("Помилка збереження файлу.");
        } finally {
            setIsSaving(false);
            setDatabaseFile(null);
            if (!onSaveSuccess) { // Only close if not navigating away
                onClose();
            }
        }
    };
    
    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteFileFromDB();
            setSettings(prev => ({...prev, dbFilePath: ''}));
            showToast("Файл бази даних видалено.");
            logAction("Видалено файл локальної бази даних.");
            setExistingFile(null);
        } catch (error) {
            console.error("Failed to delete from DB:", error);
            showToast("Помилка видалення файлу.");
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Локальна база даних (Excel)</h2></div>
                <div className="p-4 space-y-4">
                    {existingFile ? (
                        <div className="bg-secondary p-3 rounded-md border border-border-color">
                            <p className="text-sm text-primary-text">Поточний файл: <strong className="text-header">{existingFile.name}</strong></p>
                            <p className="text-xs text-secondary-text">Оновлено: {new Date(existingFile.lastModified).toLocaleString()}</p>
                            <button onClick={handleDelete} disabled={isDeleting} className="mt-2 text-sm text-red-500 hover:underline disabled:opacity-50">{isDeleting ? 'Видалення...' : 'Видалити'}</button>
                        </div>
                    ) : (
                        <p className="text-sm text-secondary-text text-center">Файл бази даних не завантажено.</p>
                    )}
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="w-full bg-secondary p-2 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent-hover"/>
                    {databaseFile && <p className="text-sm text-primary-text">Вибрано: {databaseFile.name}</p>}
                </div>
                <div className="p-4 border-t border-border-color flex justify-end gap-2">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Закрити</button>
                    <button onClick={handleSave} disabled={!databaseFile || isSaving} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover disabled:bg-gray-500">
                        {isSaving ? 'Збереження...' : 'Зберегти'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const Dashboard: React.FC = () => {
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [schedules] = useLocalStorage<ScheduleData>('schedules', {});
    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const [settings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
    const [isExporting, setIsExporting] = useState(false);
    const [isImportingJson, setIsImportingJson] = useState(false);
    const [isManagingDB, setIsManagingDB] = useState(false);
    const [date, setDate] = useState(new Date());
    const [dbFileInfo, setDbFileInfo] = useState<DatabaseFileInfo | null>(null);
    const [isLoadingDbInfo, setIsLoadingDbInfo] = useState(true);
    const [autoLoadStatus, setAutoLoadStatus] = useState<'loading' | 'success' | 'not_found' | 'not_configured' | 'disabled'>('loading');
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleDbSaveSuccess = () => {
        setIsManagingDB(false);
        navigate('/people?action=import');
    };

    useEffect(() => {
        const fetchDbInfo = async () => {
            setIsLoadingDbInfo(true);
            try {
                const file = await getFileFromDB();
                if (file) {
                    setDbFileInfo({ name: file.name, lastModified: file.lastModified });
                } else {
                    setDbFileInfo(null);
                }
            } catch (e) {
                console.error("Failed to get DB file info", e);
                setDbFileInfo(null);
            } finally {
                setIsLoadingDbInfo(false);
            }
        };
        fetchDbInfo();
    }, [isManagingDB]); // Refresh when DB modal is closed
    
    useEffect(() => {
        const checkAutoLoad = async () => {
            if (!settings.experimentalFeatures.quickDbLoadEnabled) {
                setAutoLoadStatus('disabled');
                return;
            }
            if (!settings.dbFilePath) {
                setAutoLoadStatus('not_configured');
                return;
            }
            try {
                const file = await getFileFromDB();
                if (file && file.name === settings.dbFilePath) {
                    setAutoLoadStatus('success');
                } else {
                    setAutoLoadStatus('not_found');
                }
            } catch {
                setAutoLoadStatus('not_found');
            }
        };
        checkAutoLoad();
    }, [settings]);

    const handleDownloadTemplate = () => {
        const headers = [
            "Підрозділ", "Посада", "Звання", "ПІБ (альтернатива)",
            "День народження", "Місяць народження", "Рік народження",
            "Прізвище", "Ім'я", "По-батькові", "ІНН", "Телефон"
        ];
        
        const hints = [
            "(Рекомендована колонка: E)", "(Рекомендована колонка: F)", "(Рекомендована колонка: J)", "(Рекомендована колонка: L)",
            "(Рекомендована колонка: P)", "(Рекомендована колонка: Q)", "(Рекомендована колонка: R)",
            "(Рекомендована колонка: U)", "(Рекомендована колонка: V)", "(Рекомендована колонка: W)", "(Рекомендована колонка: X)", "(Рекомендована колонка: AC)"
        ];
        
        const example = [
            "1 взвод", "стрілець", "солдат", "Петренко І.І.",
            "15", "3", "1990",
            "Петренко", "Іван", "Іванович", "1234567890", "0991234567"
        ];

        const ws_data = [headers, hints, example];
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Шаблон");

        const cols = headers.map(header => ({ wch: header.length + 15 }));
        ws['!cols'] = cols;

        XLSX.writeFile(wb, "Шаблон_бази_даних.xlsx");
        showToast("Завантаження шаблону розпочато.");
    };

    const activePeople = useMemo(() => people.filter(p => !p.deletedTimestamp), [people]);
    const activeCategories = useMemo(() => categories.filter(c => !c.deletedTimestamp), [categories]);
    const activeWeapons = useMemo(() => weapons.filter(w => !w.deletedTimestamp), [weapons]);
    const peopleMap = useMemo(() => new Map(activePeople.map(p => [p.id, p])), [activePeople]);

    const stats = useMemo(() => ({
        people: activePeople.length,
        categories: activeCategories.length,
        weapons: activeWeapons.length,
        subdivisions: subdivisions.length,
    }), [activePeople, activeCategories, activeWeapons, subdivisions]);
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

    const getDutiesForDate = (checkDate: Date) => {
        const day = checkDate.getDate();
        const duties: { person: Person; category: Category }[] = [];
        const checkYearMonth = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}`;

        Object.keys(schedules).forEach(categoryId => {
            const categorySchedule = schedules[categoryId]?.[checkYearMonth];
            if (categorySchedule) {
                Object.keys(categorySchedule).forEach(personId => {
                    if (categorySchedule[personId]?.[day] === DutyStatus.ON_DUTY) {
                        const person = peopleMap.get(personId);
                        const category = activeCategories.find(c => c.id === categoryId);
                        if (person && category) {
                            duties.push({ person, category });
                        }
                    }
                });
            }
        });
        return duties;
    };

    const monthlyStats = useMemo(() => {
        const stats = new Map<string, number>();
        activePeople.forEach(p => stats.set(p.id, 0));

        Object.keys(schedules).forEach(catId => {
            const catSchedule = schedules[catId]?.[yearMonth];
            if (catSchedule) {
                Object.keys(catSchedule).forEach(personId => {
                    if (peopleMap.has(personId)) {
                        const duties = Object.values(catSchedule[personId]).filter(s => s === DutyStatus.ON_DUTY).length;
                        stats.set(personId, (stats.get(personId) || 0) + duties);
                    }
                });
            }
        });
        
        const sorted = Array.from(stats.entries())
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);

        return {
            top: sorted.slice(0, 5).map(([id, count]) => ({ person: peopleMap.get(id)!, count })),
            bottom: sorted.slice(-5).map(([id, count]) => ({ person: peopleMap.get(id)!, count })).reverse(),
        };
    }, [schedules, yearMonth, activePeople, peopleMap]);
    
    const groupedDutiesForDate = useMemo(() => {
        const duties = getDutiesForDate(date);
        const groups = new Map<string, { category: Category; people: Person[] }>();

        duties.forEach(({ person, category }) => {
            if (!groups.has(category.id)) {
                groups.set(category.id, { category, people: [] });
            }
            groups.get(category.id)!.people.push(person);
        });
        
        groups.forEach(group => {
            group.people.sort((a, b) => a.fullName.localeCompare(b.fullName));
        });

        return Array.from(groups.values()).sort((a,b) => a.category.order - b.category.order);
    }, [date, schedules, activePeople, activeCategories]);


    const changeDate = (offset: number) => {
        setDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + offset);
            return newDate;
        });
    };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-header">Головна</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4">
            <UsersIcon className="w-12 h-12 text-accent" />
            <div>
                <p className="text-secondary-text">Особовий склад</p>
                <p className="text-3xl font-bold text-header">{stats.people}</p>
            </div>
        </Card>
        <Card className="flex items-center gap-4">
            <TagIcon className="w-12 h-12 text-accent" />
            <div>
                <p className="text-secondary-text">Категорії нарядів</p>
                <p className="text-3xl font-bold text-header">{stats.categories}</p>
            </div>
        </Card>
        <Card className="flex items-center gap-4">
            <CalendarIcon className="w-12 h-12 text-accent" />
            <div>
                <p className="text-secondary-text">Підрозділи</p>
                <p className="text-3xl font-bold text-header">{stats.subdivisions}</p>
            </div>
        </Card>
        <Card className="flex items-center gap-4">
            <div className="flex-grow flex flex-col gap-2">
                <button onClick={() => setIsImportingJson(true)} className="flex items-center gap-2 p-2 bg-secondary rounded-md hover:bg-primary border border-border-color transition-colors"><UploadIcon />Відкрити проєкт</button>
                <button onClick={() => setIsExporting(true)} className="flex items-center gap-2 p-2 bg-secondary rounded-md hover:bg-primary border border-border-color transition-colors"><DownloadIcon/>Зберегти проєкт</button>
                <button onClick={() => setIsManagingDB(true)} className="flex items-center gap-2 p-2 bg-secondary rounded-md hover:bg-primary border border-border-color transition-colors"><DatabaseIcon/>Завантажити файл бази Excel</button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 p-2 bg-secondary rounded-md hover:bg-primary border border-border-color transition-colors"><FileImportIcon />Завантажити шаблон бази</button>
            </div>
        </Card>
      </div>
      
      <Card title="Статус локальної бази">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-header">Завантажений файл Excel (в кеші)</h3>
              {isLoadingDbInfo ? (
                <p className="text-secondary-text">Завантаження...</p>
              ) : dbFileInfo ? (
                <>
                  <p className="text-primary-text font-mono">{dbFileInfo.name}</p>
                  <p className="text-xs text-secondary-text">Останнє оновлення: {new Date(dbFileInfo.lastModified).toLocaleString()}</p>
                </>
              ) : (
                <p className="text-yellow-400">Файл не завантажено. Завантажте його через кнопку "Завантажити файл бази Excel".</p>
              )}
            </div>
            <div className="flex-1 border-t sm:border-t-0 sm:border-l border-border-color pt-4 sm:pt-0 sm:pl-4">
                <h3 className="font-semibold text-header">Автоматичне завантаження</h3>
                <p className="text-xs text-secondary-text">Збережений файл для автозавантаження:</p>
                <p className="text-primary-text font-mono mb-2">{settings.dbFilePath || 'Не налаштовано'}</p>
                
                {autoLoadStatus === 'loading' && <p className="text-sm text-secondary-text">Перевірка статусу...</p>}
                {autoLoadStatus === 'success' && <p className="text-sm text-green-400">Статус: Файл готовий до автоматичного завантаження.</p>}
                {autoLoadStatus === 'not_found' && <p className="text-sm text-red-400">Статус: Помилка. Збережений файл не знайдено в кеші. Спробуйте завантажити його знову.</p>}
                {autoLoadStatus === 'not_configured' && <p className="text-sm text-yellow-400">Статус: Не налаштовано. Збережіть файл бази, щоб увімкнути.</p>}
                {autoLoadStatus === 'disabled' && <p className="text-sm text-secondary-text">Статус: Вимкнено в <NavLink to="/settings" className="underline hover:text-accent">Налаштуваннях</NavLink>.</p>}
            </div>
          </div>
      </Card>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Наряд на сьогодні" className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-header">{date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => changeDate(-1)} className="p-2 rounded-full hover:bg-secondary"><ChevronLeftIcon /></button>
                        <button onClick={() => setDate(new Date())} className="text-sm bg-secondary px-3 py-1 rounded-lg hover:bg-primary border border-border-color">Сьогодні</button>
                        <button onClick={() => changeDate(1)} className="p-2 rounded-full hover:bg-secondary"><ChevronRightIcon /></button>
                    </div>
                </div>
                {groupedDutiesForDate.length > 0 ? (
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                        {groupedDutiesForDate.map(({ category, people }) => (
                            <div key={category.id}>
                                <h4 className="text-md font-semibold text-header flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${category.color}`}></span>
                                    {category.name}
                                </h4>
                                <div className="flex flex-wrap gap-2 mt-2 pl-5">
                                    {people.map(person => (
                                        <div key={person.id} className="bg-secondary px-2 py-1 rounded-md border border-border-color/50">
                                            <p className="text-sm font-semibold text-primary-text">{person.fullName}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-center text-secondary-text py-8">На сьогодні нарядів не призначено.</p>}
            </Card>

            <Card title={`Статистика за ${UKRAINIAN_MONTHS[month]}`}>
                <h4 className="font-semibold text-header mb-2">Найбільше нарядів</h4>
                <div className="space-y-2">
                    {monthlyStats.top.map(({person, count}) => (
                        <div key={person.id} className="flex justify-between items-center text-sm">
                            <span className="text-primary-text">{person.fullName}</span>
                            <span className="font-bold text-header bg-secondary px-2 py-1 rounded-md">{count}</span>
                        </div>
                    ))}
                </div>
            </Card>
       </div>
       
       {isExporting && <ExportModal onClose={() => setIsExporting(false)} />}
       {isImportingJson && <JsonImportModal onClose={() => setIsImportingJson(false)} />}
       {isManagingDB && <DatabaseModal onClose={() => setIsManagingDB(false)} onSaveSuccess={handleDbSaveSuccess} />}
    </div>
  );
};

export default Dashboard;