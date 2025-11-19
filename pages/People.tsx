import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import useLocalStorage from '../hooks/useLocalStorage';
import { Person, Category, Weapon, ScheduleData, DutyStatus, Subdivision } from '../types';
import { RANKS, RANK_CATEGORY_SHORT_MAP, RANK_SYNONYMS, RANK_CATEGORIES, RANK_FULL_SYNONYMS } from '../constants';
import Card from '../components/Card';
import { useToast, useActionLog } from '../context/ThemeContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { CheckIcon, TrashIcon, XIcon, SyncIcon, ViewGridIcon, ViewListIcon, ViewBlocksIcon, InfoIcon, FileImportIcon, UserPlusIcon, UsersIcon, DownloadIcon, LinkIcon, ChevronUpIcon, ChevronDownIcon, PhoneIcon, StarIcon, ChevronRightIcon } from '../components/icons/Icons';
import PersonInfoModal from '../components/PersonInfoModal';
import { getFileFromDB, getPhoto, savePhoto, deletePhoto } from '../utils/db';
import { formatHierarchicalPositionForRoster, generateFullPosition, getHierarchicalPath } from '../utils/peopleUtils';


declare const XLSX: any;

type ImportedPersonData = { 
    fullName: string; 
    lastName: string;
    firstName: string;
    patronymic: string;
    phone?: string;
    rank: string; 
    position: string; 
    tin: string; 
    subdivision: string;
    subdivisionRowIndex: number;
    dateOfBirth?: string;
    isExisting: boolean;
};

type ExcelMapping = {
    fullName: string;
    lastName: string;
    firstName: string;
    patronymic: string;
    phone: string;
    rank: string;
    position: string;
    tin: string;
    subdivision: string;
    dobFull: string;
    dobDay: string;
    dobMonth: string;
    dobYear: string;
};

type ActualizationConflict = {
    type: 'personUpdate';
    key: string;
    existing: Person;
    incoming: { rank: string; position: string; subdivision: string, subdivisionRowIndex: number, dateOfBirth?: string, phone?: string, lastName: string, firstName: string, patronymic: string };
    resolution?: 'keep' | 'update';
};

type ViewMode = 'grid' | 'blocks' | 'list';
type SortByType = 'fullName' | 'rank' | 'position' | 'totalDuties' | 'dutiesThisMonth' | 'subdivision';

const normalizeRank = (rank: string): string => {
    if (!rank) return '';
    let normalized = rank.toLowerCase().trim().replace(/\s+/g, ' ');

    if (RANK_FULL_SYNONYMS[normalized]) {
        return RANK_FULL_SYNONYMS[normalized];
    }
    
    const words = normalized.split(' ');
    if (words.length > 1) {
        const synonym = RANK_SYNONYMS[words[0]];
        if (synonym) {
            words[0] = synonym;
            return words.join(' ');
        }
    }
    
    return normalized;
};


const getRankCategory = (rank: string): string | undefined => {
    if (!rank) return undefined;
    const cleanRank = normalizeRank(rank);
    for (const category in RANKS) {
        if ((RANKS as any)[category].includes(cleanRank)) {
            return RANK_CATEGORY_SHORT_MAP[category];
        }
    }
    return undefined;
};


const PersonFormModal: React.FC<{ person?: Person; onSave: (person: Person) => void; onCancel: () => void; categories: Category[]; people: Person[] }> = ({ person, onSave, onCancel, categories, people }) => {
    const { showToast } = useToast();
    
    const createInitialState = useCallback((p?: Person) => {
        const type = p?.type || 'person';
        if (p?.id) {
             const normalizedRank = normalizeRank(p.rank || '');
            return {
                ...p,
                type,
                rank: normalizedRank,
                rankCategory: p.rankCategory || getRankCategory(normalizedRank),
                lastName: p.lastName || '',
                firstName: p.firstName || '',
                patronymic: p.patronymic || '',
                phone: p.phone || '',
            };
        }
        return {
            type, fullName: '', lastName: '', firstName: '', patronymic: '', phone: '',
            rank: '', rankCategory: undefined, position: '', tin: '',
            categoryIds: [], isNew: false, createdTimestamp: Date.now(), source: 'manual' as const,
            linkedPersonId: null,
            linkedCategoryId: null,
        };
    }, []);
    
    const [formData, setFormData] = useState(() => createInitialState(person));
    const [tinError, setTinError] = useState('');
    const [mainPersonSearch, setMainPersonSearch] = useState('');

    useEffect(() => {
        setFormData(createInitialState(person));
    }, [person, createInitialState]);
    
    useEffect(() => {
        if (!formData.linkedPersonId) {
            setFormData(prev => ({...prev, linkedCategoryId: null}));
        }
    }, [formData.linkedPersonId]);

    useEffect(() => {
        if (formData.type === 'person' && formData.tin) {
            const isDuplicate = people.some(p => p.tin === formData.tin && p.id !== person?.id);
            if (isDuplicate) {
                setTinError('Особа з таким ІНН вже існує.');
            } else {
                setTinError('');
            }
        } else {
            setTinError('');
        }
    }, [formData.tin, formData.type, person?.id, people]);


    const handleRankSelect = (newRank: string) => {
        const normalizedRank = normalizeRank(newRank);
        const newRankCategory = getRankCategory(normalizedRank);

        setFormData(prev => ({
            ...prev,
            rank: normalizedRank,
            rankCategory: newRankCategory,
            categoryIds: prev.categoryIds.filter(catId => {
                const cat = categories.find(c => c.id === catId);
                return cat?.rankCategories.includes(newRankCategory as string);
            })
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCategoryToggle = (categoryId: string) => {
        setFormData(prev => {
            const newCategoryIds = prev.categoryIds.includes(categoryId)
                ? prev.categoryIds.filter(id => id !== categoryId)
                : [...prev.categoryIds, categoryId];
            return { ...prev, categoryIds: newCategoryIds };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.type === 'person' && tinError && !person?.id) {
            showToast(tinError);
            return;
        }
        if (formData.type === 'person' && !formData.rankCategory) {
            showToast('Звання не розпізнано. Будь ласка, виберіть коректне звання зі списку.');
            return;
        }
        if (formData.type === 'subdivision' && !formData.rankCategory) {
            showToast('Будь ласка, виберіть категорію звання для підрозділу.');
            return;
        }
        if (formData.linkedPersonId && !formData.linkedCategoryId) {
            showToast('Будь ласка, виберіть категорію для залежної особи.');
            return;
        }
        
        const finalCategoryIds = formData.linkedPersonId && formData.linkedCategoryId
            ? [formData.linkedCategoryId]
            : formData.categoryIds;

        let finalData = { ...formData };
        if (formData.type === 'person') {
            const { lastName, firstName, patronymic } = formData;
            const patronymicInitial = (patronymic || '').trim() ? `${(patronymic || '').trim().charAt(0)}.` : '';
            finalData.fullName = `${(lastName || '').trim()} ${(firstName || '').trim().charAt(0)}.${patronymicInitial}`;
        }

        onSave({
            id: person?.id || crypto.randomUUID(),
            deletedTimestamp: person?.deletedTimestamp || null,
            ...finalData,
            categoryIds: finalCategoryIds,
            // Ensure fields for other type are cleared
            rank: formData.type === 'person' ? formData.rank : '',
            position: formData.type === 'person' ? formData.position : '',
            tin: formData.type === 'person' ? formData.tin : '',
        } as Person);
    };

    const availableCategories = useMemo(() => {
        if (!formData.rankCategory) return [];
        return categories.filter(cat => cat.rankCategories.includes(formData.rankCategory as string));
    }, [formData.rankCategory, categories]);
    
    const setEntityType = (type: 'person' | 'subdivision') => {
        setFormData(prev => ({...createInitialState(), type: type, fullName: prev.fullName}));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onCancel}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color flex justify-between items-center">
                    <h2 className="text-xl font-bold text-header">{person?.id ? "Редагувати" : "Додати"}</h2>
                    <div className="flex items-center bg-secondary p-1 rounded-lg border border-border-color">
                        <button type="button" onClick={() => setEntityType('person')} className={`px-3 py-1 text-sm rounded-md ${formData.type === 'person' ? 'bg-accent text-white' : ''}`}>Особа</button>
                        <button type="button" onClick={() => setEntityType('subdivision')} className={`px-3 py-1 text-sm rounded-md ${formData.type === 'subdivision' ? 'bg-accent text-white' : ''}`}>Підрозділ</button>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {formData.type === 'person' ? (
                         <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Прізвище" required className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent" />
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="Ім'я" required className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent" />
                                <input type="text" name="patronymic" value={formData.patronymic} onChange={handleChange} placeholder="По батькові" className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent" />
                            </div>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Номер телефону" className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent" />
                            <div>
                                <label className="block mb-2 text-sm font-medium text-secondary-text">Звання</label>
                                {!formData.rankCategory && <p className="text-xs text-yellow-400 mb-2">Поточне звання: '{person?.rank || 'не вказано'}' - не розпізнано. Виберіть правильний варіант.</p>}
                                <div className="space-y-3 p-2 bg-secondary rounded-md border border-border-color">
                                    {Object.entries(RANKS).map(([category, ranks]) => (
                                        <div key={category}>
                                            <h4 className="font-semibold text-primary-text text-sm mb-2">{category}</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {ranks.map(r => {
                                                    const isSelected = formData.rank === r;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={r}
                                                            onClick={() => handleRankSelect(r)}
                                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 border ${isSelected ? 'bg-accent text-white font-bold border-accent' : 'bg-primary text-secondary-text border-border-color hover:bg-secondary hover:border-accent'}`}
                                                        >
                                                            {r}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <input type="text" name="position" value={formData.position} onChange={handleChange} placeholder="Посада" required className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent" />
                             <div>
                                <input type="text" name="tin" value={formData.tin} onChange={handleChange} placeholder="ІНН" required className={`w-full bg-secondary p-2 rounded-md border focus:outline-none focus:ring-2 ${tinError ? 'border-red-500 ring-red-500/50' : 'border-border-color focus:ring-accent'}`} />
                                {tinError && <p className="text-xs text-red-500 mt-1">{tinError}</p>}
                            </div>
                             <div>
                                <label className="block mb-2 text-sm font-medium text-secondary-text">Залежність від</label>
                                 <input
                                    type="search"
                                    value={mainPersonSearch}
                                    onChange={e => setMainPersonSearch(e.target.value)}
                                    placeholder="Пошук за прізвищем..."
                                    className="w-full bg-primary p-2 rounded-md border border-border-color mb-2"
                                />
                                <select
                                    name="linkedPersonId"
                                    value={formData.linkedPersonId || ''}
                                    onChange={handleChange}
                                    className="w-full bg-secondary p-2 rounded-md border border-border-color"
                                >
                                    <option value="">Немає</option>
                                    {people.filter(p => p.id !== person?.id && p.type === 'person' && p.fullName.toLowerCase().includes(mainPersonSearch.toLowerCase()))
                                        .sort((a, b) => a.fullName.localeCompare(b.fullName))
                                        .map(p => (
                                        <option key={p.id} value={p.id}>{p.fullName}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-secondary-text mt-1">Якщо основна особа в наряді, ця особа буде автоматично в наряді. В інші дні - недоступна.</p>
                            </div>
                        </>
                    ) : (
                         <>
                            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Назва підрозділу" required className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent" />
                            <div>
                                <label className="block mb-2 text-sm font-medium text-secondary-text">Категорія звання</label>
                                <select name="rankCategory" value={formData.rankCategory || ''} onChange={e => setFormData(p => ({...p, rankCategory: e.target.value}))} className="w-full bg-secondary p-2 rounded-md border border-border-color">
                                    <option value="">Виберіть категорію</option>
                                    {RANK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                     {formData.linkedPersonId && formData.type === 'person' ? (
                        <div>
                            <label className="block mb-2 text-sm font-medium text-secondary-text">Категорія для залежності (виберіть одну)</label>
                            <div className="flex flex-wrap gap-2 p-2 bg-secondary rounded-md border border-border-color min-h-[40px]">
                                {availableCategories.length > 0 ? availableCategories.map(cat => {
                                    const isSelected = formData.linkedCategoryId === cat.id;
                                    const isAnySelected = !!formData.linkedCategoryId;
                                    return (
                                        <button
                                            type="button"
                                            key={cat.id}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    linkedCategoryId: isSelected ? null : cat.id
                                                }));
                                            }}
                                            className={`px-3 py-1 rounded-full text-sm font-semibold transition-all duration-200 border-2 ${
                                                isSelected
                                                ? `text-white ${cat.color || 'bg-accent'}`
                                                : `bg-primary text-secondary-text ${isAnySelected ? 'opacity-40 cursor-not-allowed' : 'hover:border-accent'}`
                                            }`}
                                            style={{ borderColor: 'transparent' }}
                                            disabled={isAnySelected && !isSelected}
                                        >
                                            {cat.shortName || cat.name}
                                        </button>
                                    )
                                }) : <p className="text-sm text-secondary-text">Немає доступних категорій для цього складу.</p>}
                            </div>
                        </div>
                     ) : (
                        <div>
                            <label className="block mb-2 text-sm font-medium text-secondary-text">Категорії ({formData.rankCategory || 'не визначено'})</label>
                            <div className="flex flex-wrap gap-2 p-2 bg-secondary rounded-md border border-border-color min-h-[40px]">
                                {formData.rankCategory ? (
                                    availableCategories.length > 0 ? availableCategories.map(cat => {
                                        const isSelected = formData.categoryIds.includes(cat.id);
                                        return (
                                            <button
                                                type="button"
                                                key={cat.id}
                                                onClick={() => handleCategoryToggle(cat.id)}
                                                className={`px-3 py-1 rounded-full text-sm font-semibold transition-all duration-200 border-2 ${
                                                    isSelected 
                                                    ? `text-white ${cat.color || 'bg-accent'}`
                                                    : 'bg-primary text-primary-text'
                                                }`}
                                                style={{
                                                    borderColor: isSelected ? '#000000' : 'transparent'
                                                }}
                                            >
                                                {cat.shortName || cat.name}
                                            </button>
                                        )
                                    }) : <p className="text-sm text-secondary-text">Немає доступних категорій для цього складу.</p>
                                ) : <p className="text-sm text-secondary-text">Спочатку виберіть звання.</p>}
                            </div>
                        </div>
                     )}
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onCancel} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                        <button type="submit" disabled={!!(tinError && !person?.id)} className="bg-accent px-4 py-2 rounded-md hover:bg-accent-hover transition-colors text-white disabled:bg-gray-500 disabled:cursor-not-allowed">Зберегти</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ImportModal: React.FC<{ onImport: (people: ImportedPersonData[]) => void; onCancel: () => void; people: Person[] }> = ({ onImport, onCancel, people }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoadingFile, setIsLoadingFile] = useState(true);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [columns, setColumns] = useLocalStorage<ExcelMapping>('excel-import-settings', { fullName: '', lastName: '', firstName: '', patronymic: '', phone: '', rank: '', position: '', tin: '', subdivision: '', dobFull: '', dobDay: '', dobMonth: '', dobYear: '' });
    const [ignoreRowsBelow, setIgnoreRowsBelow] = useLocalStorage<number>('excel-import-ignore-rows', 0);
    const [previewData, setPreviewData] = useState<ImportedPersonData[]>([]);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [rankFilter, setRankFilter] = useState('all');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const { showToast } = useToast();
    const [hideExisting, setHideExisting] = useState(true);
    const [showSettings, setShowSettings] = useState(true);

    const existingTins = useMemo(() => new Set(people.map(p => p.tin).filter(Boolean)), [people]);
    const areColumnsSet = useMemo(() => (columns.fullName || (columns.lastName && columns.firstName)) && columns.rank && columns.position && columns.tin && columns.subdivision, [columns]);

    useEffect(() => {
        const loadCachedFile = async () => {
            setIsLoadingFile(true);
            try {
                const cachedFile = await getFileFromDB();
                if (cachedFile) {
                    setFile(cachedFile);
                    const data = await cachedFile.arrayBuffer();
                    const workbook = XLSX.read(data, { type: 'binary' });
                    setSheets(workbook.SheetNames);
                    setSelectedSheet(workbook.SheetNames[0] || '');
                }
            } catch (error) {
                console.error("Failed to load file from DB for import", error);
                showToast("Не вдалося завантажити файл з локальної бази.");
            } finally {
                setIsLoadingFile(false);
            }
        };
        loadCachedFile();
    }, []);
    
    const handleDownloadDB = async () => {
        const cachedFile = await getFileFromDB();
        if (cachedFile) {
            const url = URL.createObjectURL(cachedFile);
            const a = document.createElement('a');
            a.href = url;
            a.download = cachedFile.name || 'database.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("Завантаження кешованої бази даних розпочато.");
        } else {
            showToast("Файл бази даних не знайдено в кеші.");
        }
    };
    
    const handleApplyDefaults = () => {
        setColumns({ fullName: 'L', lastName: 'U', firstName: 'V', patronymic: 'W', phone: 'AC', rank: 'J', position: 'F', tin: 'X', subdivision: 'E', dobFull: '', dobDay: 'P', dobMonth: 'Q', dobYear: 'R' });
        setIgnoreRowsBelow(1804);
        showToast("Застосовано рекомендовані налаштування.");
    };

    const handlePreview = async () => {
        if (!areColumnsSet) {
            showToast("Налаштуйте стовпці для імпорту.");
            setShowSettings(true);
            return;
        }
        if (!file || !selectedSheet) {
            showToast("Будь ласка, виберіть файл та аркуш для попереднього перегляду.");
            return;
        }
        setIsProcessing(true);
        setProcessingProgress(0);
        setShowSettings(false);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[selectedSheet];
            const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const getColIndex = (col: string): number => {
                if (!col || typeof col !== 'string') return -1;
                const normalizedCol = col.toUpperCase();
                let result = 0;
                for (let i = 0; i < normalizedCol.length; i++) {
                    result *= 26;
                    result += normalizedCol.charCodeAt(i) - 64; // A=1, B=2
                }
                return result - 1;
            };

            const colMap = {
                fullName: getColIndex(columns.fullName),
                lastName: getColIndex(columns.lastName),
                firstName: getColIndex(columns.firstName),
                patronymic: getColIndex(columns.patronymic),
                phone: getColIndex(columns.phone),
                rank: getColIndex(columns.rank),
                position: getColIndex(columns.position),
                tin: getColIndex(columns.tin),
                subdivision: getColIndex(columns.subdivision),
                dobFull: getColIndex(columns.dobFull),
                dobDay: getColIndex(columns.dobDay),
                dobMonth: getColIndex(columns.dobMonth),
                dobYear: getColIndex(columns.dobYear),
            };

            const dataToParse = jsonData.slice(1).filter(row => row && row.some(cell => cell != null && cell !== ''));
            const stopRow = ignoreRowsBelow > 0 ? Math.min(ignoreRowsBelow -1, dataToParse.length) : dataToParse.length;
            
            const parsedData: ImportedPersonData[] = [];
            
            for (let i = 0; i < stopRow; i++) {
                const row = dataToParse[i];
                const excelRowNumber = i + 2;

                let fullName = '';
                let lastName = '', firstName = '', patronymic = '';

                if (colMap.lastName !== -1 && row[colMap.lastName] && colMap.firstName !== -1 && row[colMap.firstName]) {
                    lastName = String(row[colMap.lastName]).trim();
                    firstName = String(row[colMap.firstName]).trim();
                    patronymic = String(row[colMap.patronymic] || '').trim();
                    const patronymicInitial = patronymic ? `${patronymic.charAt(0)}.` : '';
                    fullName = `${lastName} ${firstName.charAt(0)}.${patronymicInitial}`;
                } else if (colMap.fullName !== -1 && row[colMap.fullName]) {
                    fullName = String(row[colMap.fullName]).trim();
                    const parts = fullName.split(/\s+/);
                    lastName = parts[0] || '';
                    firstName = parts[1] || '';
                    patronymic = parts[2] || '';
                }

                const tin = colMap.tin !== -1 ? String(row[colMap.tin] || '').trim() : '';
                const phone = colMap.phone !== -1 ? String(row[colMap.phone] || '').trim() : undefined;

                let dob = '';
                if (colMap.dobFull !== -1 && row[colMap.dobFull]) {
                    const dateValue = row[colMap.dobFull];
                    if (typeof dateValue === 'number') { // Excel date serial number
                        const excelEpoch = new Date(1899, 11, 30);
                        const d = new Date(excelEpoch.getTime() + dateValue * 86400000);
                        dob = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
                    } else if (typeof dateValue === 'string') {
                        dob = dateValue;
                    }
                } else if (colMap.dobDay !== -1 && colMap.dobMonth !== -1 && colMap.dobYear !== -1) {
                    const day = String(row[colMap.dobDay] || '').padStart(2, '0');
                    const month = String(row[colMap.dobMonth] || '').padStart(2, '0');
                    const year = row[colMap.dobYear];
                    if(day && month && year) dob = `${day}.${month}.${year}`;
                }

                if (fullName && tin) {
                    parsedData.push({
                        fullName,
                        lastName,
                        firstName,
                        patronymic,
                        phone,
                        rank: String(row[colMap.rank] || ''),
                        position: String(row[colMap.position] || ''),
                        tin,
                        subdivision: String(row[colMap.subdivision] || ''),
                        subdivisionRowIndex: excelRowNumber,
                        dateOfBirth: dob,
                        isExisting: existingTins.has(tin)
                    });
                }
                const progress = Math.round(((i + 1) / stopRow) * 100);
                 if (progress % 5 === 0) {
                   setProcessingProgress(progress);
                   await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            
            setPreviewData(parsedData);
            setSelectedRows([]);

        } catch (error) {
            console.error("Error parsing Excel sheet:", error);
            showToast("Помилка обробки аркуша. Перевірте назви стовпців.");
        } finally {
            setIsProcessing(false);
            setProcessingProgress(0);
        }
    };

    const handleSelectRow = (index: number) => {
        if (previewData[index].isExisting) return;
        setSelectedRows(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
    }

    const toggleSelectAll = () => {
        const selectableIndexes = filteredPreviewData
            .map(p => previewData.indexOf(p))
            .filter(index => !previewData[index].isExisting);
        
        const allSelectableFilteredSelected = selectableIndexes.every(index => selectedRows.includes(index));

        if (allSelectableFilteredSelected) {
            setSelectedRows(prev => prev.filter(index => !selectableIndexes.includes(index)));
        } else {
            setSelectedRows(prev => [...new Set([...prev, ...selectableIndexes])]);
        }
    }
    
    const handleImport = () => {
        const peopleToImport = previewData.filter((p, index) => selectedRows.includes(index) && !p.isExisting);
        onImport(peopleToImport);
    };

    const handleCancel = () => {
        onCancel();
    }

    const filteredPreviewData = useMemo(() => {
        return previewData
            .filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(p => {
                 if (rankFilter === 'all') return true;
                 const rankCategory = getRankCategory(normalizeRank(p.rank));
                 return rankCategory === rankFilter;
            })
            .filter(p => !hideExisting || !p.isExisting);
    }, [previewData, searchTerm, rankFilter, hideExisting]);

    const allFilteredSelectableSelected = useMemo(() => {
        const selectableIndexes = filteredPreviewData
            .map(p => previewData.indexOf(p))
            .filter(index => !previewData[index].isExisting);
        return selectableIndexes.length > 0 && selectableIndexes.every(index => selectedRows.includes(index));
    }, [filteredPreviewData, selectedRows, previewData]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={handleCancel}>
            <div className="bg-card text-primary-text rounded-xl border border-border-color shadow-lg w-full max-w-7xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color">
                  <h2 className="text-xl font-bold text-header">Імпорт з Excel</h2>
                </div>
                <div className="p-4 flex-grow overflow-y-auto space-y-4">
                    {/* Settings Section */}
                    <div className="bg-secondary/50 rounded-lg border border-border-color">
                        <button onClick={() => setShowSettings(s => !s)} className="w-full flex justify-between items-center p-3">
                            <h3 className="text-lg font-semibold text-header">Крок 1: Налаштування стовпців</h3>
                            {showSettings ? <ChevronUpIcon /> : <ChevronRightIcon />}
                        </button>
                        {showSettings && (
                            <div className="p-4 border-t border-border-color space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                     <div>
                                        <h4 className="text-md font-semibold text-header mb-2">Основні дані</h4>
                                        <div className="space-y-2">
                                            <input type="text" placeholder="Прізвище та ініціали (L)" value={columns.fullName} onChange={e => setColumns(c => ({...c, fullName: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <div className="flex items-center gap-2"><div className="flex-grow border-t border-border-color"></div><span className="text-secondary-text text-xs">АБО</span><div className="flex-grow border-t border-border-color"></div></div>
                                            <input type="text" placeholder="Прізвище (U)" value={columns.lastName} onChange={e => setColumns(c => ({...c, lastName: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="Ім'я (V)" value={columns.firstName} onChange={e => setColumns(c => ({...c, firstName: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="По-батькові (W)" value={columns.patronymic} onChange={e => setColumns(c => ({...c, patronymic: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-md font-semibold text-header mb-2">Службові дані</h4>
                                        <div className="space-y-2">
                                            <input type="text" placeholder="Телефон (AC)" value={columns.phone} onChange={e => setColumns(c => ({...c, phone: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="Звання (J)" value={columns.rank} onChange={e => setColumns(c => ({...c, rank: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="Посада (F)" value={columns.position} onChange={e => setColumns(c => ({...c, position: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="ІНН (X)" value={columns.tin} onChange={e => setColumns(c => ({...c, tin: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="Підрозділ (E)" value={columns.subdivision} onChange={e => setColumns(c => ({...c, subdivision: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-md font-semibold text-header mb-2">Дата народження</h4>
                                        <div className="space-y-2">
                                            <input type="text" placeholder="Повна дата (напр. DD.MM.YYYY)" value={columns.dobFull} onChange={e => setColumns(c => ({...c, dobFull: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <div className="flex items-center gap-2"><div className="flex-grow border-t border-border-color"></div><span className="text-secondary-text text-xs">АБО</span><div className="flex-grow border-t border-border-color"></div></div>
                                            <input type="text" placeholder="День (P)" value={columns.dobDay} onChange={e => setColumns(c => ({...c, dobDay: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="Місяць (Q)" value={columns.dobMonth} onChange={e => setColumns(c => ({...c, dobMonth: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                            <input type="text" placeholder="Рік (R)" value={columns.dobYear} onChange={e => setColumns(c => ({...c, dobYear: e.target.value.toUpperCase()}))} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                        </div>
                                    </div>
                                    <div>
                                         <h4 className="text-md font-semibold text-header mb-2">Інше</h4>
                                         <input type="number" placeholder="Не зчитувати після рядка (0 - вимк.)" value={ignoreRowsBelow || ''} onChange={e => setIgnoreRowsBelow(Number(e.target.value) || 0)} className="w-full bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                    </div>
                                </div>
                                 <div className="flex justify-between items-center gap-2 mt-4 pt-4 border-t border-border-color">
                                    <div className="flex gap-2">
                                        <button onClick={handleApplyDefaults} className="text-sm bg-secondary text-primary-text px-3 py-1 rounded-md hover:bg-primary border border-border-color text-center">Рекомендовані</button>
                                        <button onClick={handleDownloadDB} className="text-sm bg-secondary text-primary-text p-2 rounded-md hover:bg-primary border border-border-color" title="Завантажити кешовану базу даних"><DownloadIcon /></button>
                                    </div>
                                    <div>
                                        {sheets.length > 0 && <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)} className="bg-secondary p-2 rounded-md border border-border-color text-primary-text"><option value="">Виберіть аркуш</option>{sheets.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Preview Section */}
                     <div className="w-full bg-secondary p-3 rounded-md border border-border-color text-center">
                        {isLoadingFile ? <p>Завантаження файлу бази...</p> : file ? (
                             <button onClick={handlePreview} disabled={isProcessing || !file || !areColumnsSet} className="w-full bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover transition-colors disabled:bg-gray-500 disabled:cursor-wait">
                                {isProcessing ? 'Обробка...' : 'Крок 2: Попередній перегляд'}
                            </button>
                        ) : (
                            <div className="w-full bg-yellow-900/50 p-3 rounded-md border border-yellow-700 text-center">
                                <p className="text-yellow-300 font-semibold">Файл бази даних не завантажено.</p>
                                <p className="text-sm text-yellow-400 mt-1">Будь ласка, перейдіть на <a href="#/" className="underline font-bold" onClick={onCancel}>Головну сторінку</a> та завантажте файл бази.</p>
                            </div>
                        )}
                    </div>
                    
                    {isProcessing && processingProgress > 0 && (
                        <div className="w-full bg-secondary rounded-full h-2.5">
                            <div className="bg-accent h-2.5 rounded-full" style={{ width: `${processingProgress}%`, transition: 'width 0.3s ease' }}></div>
                        </div>
                    )}

                    {previewData.length > 0 && (
                        <>
                            <div className="flex flex-wrap items-center gap-4">
                                <input type="search" placeholder="Пошук..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow bg-secondary p-2 rounded-md border border-border-color text-primary-text" />
                                <div className="flex items-center gap-2 bg-secondary p-1 rounded-lg border border-border-color">
                                    <button onClick={() => setRankFilter('all')} className={`px-3 py-1 text-sm rounded-md ${rankFilter === 'all' ? 'bg-accent text-white' : ''}`}>Всі</button>
                                    {RANK_CATEGORIES.map(cat => (
                                        <button key={cat} onClick={() => setRankFilter(cat)} className={`px-3 py-1 text-sm rounded-md ${rankFilter === cat ? 'bg-accent text-white' : ''}`}>{cat}</button>
                                    ))}
                                </div>
                                <div className="flex items-center">
                                    <input type="checkbox" id="hideExisting" checked={hideExisting} onChange={e => setHideExisting(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                    <label htmlFor="hideExisting" className="ml-2 text-primary-text">Сховати вже доданих</label>
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <input type="checkbox" id="selectAll" checked={allFilteredSelectableSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                <label htmlFor="selectAll">
                                    {allFilteredSelectableSelected ? 'Зняти виділення' : 'Вибрати всіх'}
                                </label>
                            </div>
                            <div className="flex-grow overflow-y-auto border border-border-color rounded-md">
                                <table className="w-full text-left text-primary-text">
                                    <thead className="bg-secondary sticky top-0"><tr><th className="p-2 w-10"></th><th className="p-2">ПІБ</th><th className="p-2">Посада</th><th className="p-2">Звання</th><th className="p-2">ІНН</th></tr></thead>
                                    <tbody>
                                        {filteredPreviewData.map((p, i) => (
                                            <tr key={i} className={`border-t border-border-color ${p.isExisting ? 'bg-secondary opacity-60' : ''}`}>
                                                <td className="p-2">
                                                    <input type="checkbox" disabled={p.isExisting} checked={!p.isExisting && selectedRows.includes(previewData.indexOf(p))} onChange={() => handleSelectRow(previewData.indexOf(p))} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent disabled:opacity-70" />
                                                </td>
                                                <td className="p-2">{p.fullName}</td>
                                                <td className="p-2">{p.position}</td>
                                                <td className="p-2">{p.rank}</td>
                                                <td className="p-2">{p.tin}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end space-x-2 p-4 border-t border-border-color">
                    <button type="button" onClick={handleCancel} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                    <button onClick={handleImport} disabled={previewData.length === 0 || selectedRows.length === 0} className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover disabled:bg-gray-500 transition-colors">Імпортувати</button>
                </div>
            </div>
        </div>
    );
};

const ActualizationModal: React.FC<{ people: Person[]; setPeople: React.Dispatch<React.SetStateAction<Person[]>>; onCancel: () => void }> = ({ people, setPeople, onCancel }) => {
    const [file, setFile] = useState<File | null>(null);
    const [conflicts, setConflicts] = useState<ActualizationConflict[]>([]);
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const { showToast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const handleAnalyze = async () => {
        if (!file) return;
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const settingsStr = localStorage.getItem('excel-import-settings');
            const settings: ExcelMapping = settingsStr ? JSON.parse(settingsStr) : {
                fullName: 'L', rank: 'J', position: 'F', subdivision: 'E', tin: 'X', phone: '', lastName: '', firstName: '', patronymic: '', dobFull: '', dobDay: '', dobMonth: '', dobYear: ''
            };
            
            const getColIndex = (col: string) => {
                if (!col) return -1;
                let result = 0;
                for (let i = 0; i < col.length; i++) {
                    result *= 26;
                    result += col.charCodeAt(i) - 64;
                }
                return result - 1;
            };

            const colMap = {
                fullName: getColIndex(settings.fullName),
                rank: getColIndex(settings.rank),
                position: getColIndex(settings.position),
                subdivision: getColIndex(settings.subdivision),
                tin: getColIndex(settings.tin),
            };
            
            const newConflicts: ActualizationConflict[] = [];
            const peopleMap = new Map(people.map(p => [p.tin, p]));
            const nameMap = new Map(people.map(p => [p.fullName.toLowerCase(), p]));

            for (let i = 1; i < jsonData.length; i++) {
                 const row = jsonData[i];
                 if (!row) continue;
                 
                 const tin = colMap.tin !== -1 ? String(row[colMap.tin] || '').trim() : '';
                 const fullName = colMap.fullName !== -1 ? String(row[colMap.fullName] || '').trim() : '';
                 
                 let person = tin ? peopleMap.get(tin) : null;
                 if (!person && fullName) {
                     person = nameMap.get(fullName.toLowerCase());
                 }

                 if (person) {
                     const newRank = colMap.rank !== -1 ? String(row[colMap.rank] || '').trim() : '';
                     const newPosition = colMap.position !== -1 ? String(row[colMap.position] || '').trim() : '';
                     const newSubdivision = colMap.subdivision !== -1 ? String(row[colMap.subdivision] || '').trim() : '';
                     const excelRow = i + 1;

                     const hasRankChange = newRank && normalizeRank(newRank) !== normalizeRank(person.rank);
                     const hasPositionChange = newPosition && newPosition !== person.position;
                     const hasSubdivisionChange = newSubdivision && newSubdivision !== person.subdivision;
                     const hasRowIndexChange = excelRow !== person.subdivisionRowIndex;

                     if (hasRankChange || hasPositionChange || hasSubdivisionChange || hasRowIndexChange) {
                         newConflicts.push({
                             type: 'personUpdate',
                             key: person.id,
                             existing: person,
                             incoming: {
                                 rank: newRank || person.rank,
                                 position: newPosition || person.position,
                                 subdivision: newSubdivision || person.subdivision || '',
                                 subdivisionRowIndex: excelRow,
                                 lastName: person.lastName,
                                 firstName: person.firstName,
                                 patronymic: person.patronymic
                             },
                             resolution: 'update'
                         });
                     }
                 }
            }
            
            setConflicts(newConflicts);
            setStep('review');
            if (newConflicts.length === 0) {
                showToast("Змін не виявлено.");
            }

        } catch (error) {
            console.error(error);
            showToast("Помилка обробки файлу.");
        }
    };

    const handleApply = () => {
        setPeople(prev => {
            const updatesMap = new Map(conflicts.filter(c => c.resolution === 'update').map(c => [c.existing.id, c.incoming]));
            return prev.map(p => {
                if (updatesMap.has(p.id)) {
                    const update = updatesMap.get(p.id)!;
                    const newRank = normalizeRank(update.rank);
                    return {
                        ...p,
                        rank: newRank,
                        rankCategory: getRankCategory(newRank) || p.rankCategory,
                        position: update.position,
                        subdivision: update.subdivision,
                        subdivisionRowIndex: update.subdivisionRowIndex
                    };
                }
                return p;
            });
        });
        showToast(`Оновлено ${conflicts.filter(c => c.resolution === 'update').length} осіб.`);
        onCancel();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onCancel}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-xl font-bold text-header">Актуалізація даних</h2>
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
                    {step === 'upload' ? (
                        <div className="space-y-4">
                            <p className="text-primary-text">Завантажте актуальний файл штату (Excel) для оновлення звань, посад та підрозділів існуючих людей.</p>
                            <input type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="w-full text-primary-text" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <p className="text-primary-text mb-2">Знайдено {conflicts.length} змін.</p>
                             {conflicts.map(c => (
                                 <div key={c.key} className="bg-secondary p-2 rounded border border-border-color flex justify-between items-center text-sm">
                                     <div className="flex-grow">
                                         <p className="font-bold text-header">{c.existing.fullName}</p>
                                         <div className="grid grid-cols-2 gap-x-4 text-secondary-text mt-1">
                                             <div className="flex gap-1"><span>Звання:</span> <span>{c.existing.rank} &rarr; <span className={c.existing.rank !== c.incoming.rank ? "text-accent" : ""}>{c.incoming.rank}</span></span></div>
                                             <div className="flex gap-1"><span>Посада:</span> <span>{c.existing.position} &rarr; <span className={c.existing.position !== c.incoming.position ? "text-accent" : ""}>{c.incoming.position}</span></span></div>
                                             <div className="flex gap-1"><span>Підрозділ:</span> <span>{c.existing.subdivision} &rarr; <span className={c.existing.subdivision !== c.incoming.subdivision ? "text-accent" : ""}>{c.incoming.subdivision}</span></span></div>
                                             <div className="flex gap-1"><span>Рядок:</span> <span>{c.existing.subdivisionRowIndex} &rarr; <span className={c.existing.subdivisionRowIndex !== c.incoming.subdivisionRowIndex ? "text-accent" : ""}>{c.incoming.subdivisionRowIndex}</span></span></div>
                                         </div>
                                     </div>
                                     <div className="ml-4">
                                         <input type="checkbox" checked={c.resolution === 'update'} onChange={() => {
                                             setConflicts(prev => prev.map(xc => xc.key === c.key ? { ...xc, resolution: xc.resolution === 'update' ? 'keep' : 'update' } : xc));
                                         }} className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"/>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-border-color flex justify-end gap-2">
                    <button onClick={onCancel} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color text-primary-text">Скасувати</button>
                    {step === 'upload' ? (
                        <button onClick={handleAnalyze} disabled={!file} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover disabled:opacity-50">Аналізувати</button>
                    ) : (
                        <button onClick={handleApply} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Застосувати ({conflicts.filter(c => c.resolution === 'update').length})</button>
                    )}
                </div>
            </div>
        </div>
    );
};

const FullPositionModal: React.FC<{ person: Person; onClose: () => void; onSave: (personId: string, customPosition: string) => void; subdivisions: Subdivision[]; }> = ({ person, onClose, onSave, subdivisions }) => {
    const [editedPosition, setEditedPosition] = useState('');

    useEffect(() => {
        const generatedPosition = generateFullPosition(person, subdivisions);
        setEditedPosition(person.customFullPosition || generatedPosition);
    }, [person, subdivisions]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-xl font-bold text-header">Повна посада: {person.fullName}</h2>
                </div>
                <div className="p-6">
                    <textarea 
                        value={editedPosition}
                        onChange={(e) => setEditedPosition(e.target.value)}
                        className="w-full h-24 bg-secondary p-2 rounded-md border border-border-color text-primary-text text-lg"
                    />
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-border-color">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Закрити</button>
                    <button onClick={() => onSave(person.id, editedPosition)} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Зберегти</button>
                </div>
            </div>
        </div>
    );
};

const People: React.FC = () => {
    const [people, setPeople] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [schedules, setSchedules] = useLocalStorage<ScheduleData>('schedules', {});
    const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const [isImporting, setIsImporting] = useState(false);
    const [isActualizing, setIsActualizing] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | undefined>(undefined);
    const [infoPerson, setInfoPerson] = useState<Person | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
    const [personToPermanentlyDelete, setPersonToPermanentlyDelete] = useState<Person | null>(null);
    const [sortBy, setSortBy] = useState<SortByType>('fullName');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [filterByRank, setFilterByRank] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [subdivisionFilter, setSubdivisionFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [tinConflict, setTinConflict] = useState<{ existing: Person, incoming: Person } | null>(null);
    const [viewMode, setViewMode] = useLocalStorage<ViewMode>('people-view-mode', 'grid');
    
    const [selection, setSelection] = useState<string[]>([]);
    const [selectionModeFor, setSelectionModeFor] = useState<'new' | 'approved' | 'archived' | null>(null);
    const selectionTimeout = useRef<number | null>(null);
    const newlyImportedRef = useRef<HTMLDivElement>(null);
    const [searchParams] = useSearchParams();
    const [isHighlighting, setIsHighlighting] = useState(false);
    
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { showToast } = useToast();
    const { logAction } = useActionLog();

    const getDirectSubdivision = useCallback((personRowIndex: number | undefined, allSubdivisions: Subdivision[]) => {
        if (!personRowIndex) return null;
        const potentialSubs = allSubdivisions.filter(s => s.rowIndex <= personRowIndex).sort((a, b) => b.rowIndex - a.rowIndex);
        return potentialSubs.length > 0 ? potentialSubs[0] : null;
    }, []);
    
    const getSubdivisionDescendants = useCallback((parentId: string, allSubs: Subdivision[]): string[] => {
        const children = allSubs.filter(s => s.parentId === parentId);
        if (children.length === 0) return [];
        return children.flatMap(c => [c.id, ...getSubdivisionDescendants(c.id, allSubs)]);
    }, []);


    useEffect(() => {
        const needsMigration = people.some(p => p.createdTimestamp === undefined);
        if (needsMigration) {
            const now = Date.now();
            setPeople(prev => prev.map(p => ({
                ...p,
                createdTimestamp: p.createdTimestamp || now,
                type: p.type || 'person',
                source: p.source || 'import'
            })));
        }
    }, [people, setPeople]);

    useEffect(() => {
        if (searchParams.get('action') === 'import') {
            setIsImporting(true);
        }
        const highlight = searchParams.get('highlight');
        if (highlight === 'newlyImported' && newlyImportedRef.current) {
            newlyImportedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setIsHighlighting(true);
            const timer = setTimeout(() => setIsHighlighting(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);


    const activeCategories = useMemo(() => categories.filter(c => !c.deletedTimestamp), [categories]);
    const isSelectionMode = selectionModeFor !== null;

    const dutyStats = useMemo(() => {
        const stats = new Map<string, { totalDuties: number; dutiesThisMonth: number; overallIndex: number; monthlyIndex: number; busiestCategory: string | null; }>();
        const now = new Date();
        const yearMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
        const personCategoryDuties = new Map<string, Map<string, { total: number, thisMonth: number }>>();
        people.forEach(p => personCategoryDuties.set(p.id, new Map()));
    
        for (const catId in schedules) {
            const catSchedule = schedules[catId];
            for (const ym in catSchedule) {
                const isThisMonth = ym === yearMonthKey;
                for (const personId in catSchedule[ym]) {
                    if (personCategoryDuties.has(personId)) {
                        const personDuties = personCategoryDuties.get(personId)!;
                        if (!personDuties.has(catId)) {
                            personDuties.set(catId, { total: 0, thisMonth: 0 });
                        }
                        const duties = Object.values(catSchedule[ym][personId]).filter(s => s === DutyStatus.ON_DUTY).length;
                        personDuties.get(catId)!.total += duties;
                        if (isThisMonth) {
                            personDuties.get(catId)!.thisMonth += duties;
                        }
                    }
                }
            }
        }
    
        const categoryStats = new Map<string, { totalDuties: number, dutiesThisMonth: number, peopleCount: number }>();
        activeCategories.forEach(cat => {
            const peopleInCat = people.filter(p => !p.deletedTimestamp && p.categoryIds.includes(cat.id));
            let totalDuties = 0;
            let dutiesThisMonth = 0;
            peopleInCat.forEach(p => {
                const duties = personCategoryDuties.get(p.id)?.get(cat.id);
                if (duties) {
                    totalDuties += duties.total;
                    dutiesThisMonth += duties.thisMonth;
                }
            });
            categoryStats.set(cat.id, { totalDuties, dutiesThisMonth, peopleCount: peopleInCat.length });
        });
    
        people.forEach(person => {
            let maxOverallIndex = 0;
            let maxMonthlyIndex = 0;
            let busiestCategoryName: string | null = null;
            let maxLoad = -1;
    
            const personDutiesByCategory = personCategoryDuties.get(person.id);
    
            if (personDutiesByCategory && person.categoryIds.length > 0) {
                person.categoryIds.forEach(catId => {
                    const duties = personDutiesByCategory.get(catId);
                    const catData = categoryStats.get(catId);
                    if (duties && catData && catData.peopleCount > 0) {
                        const avgTotal = catData.totalDuties / catData.peopleCount;
                        const avgMonthly = catData.dutiesThisMonth / catData.peopleCount;
                        
                        const currentOverallIndex = avgTotal > 0 ? duties.total / avgTotal : 0;
                        const currentMonthlyIndex = avgMonthly > 0 ? duties.thisMonth / avgMonthly : 0;

                        if (currentOverallIndex > maxLoad) {
                             maxLoad = currentOverallIndex;
                             maxOverallIndex = currentOverallIndex;
                             maxMonthlyIndex = currentMonthlyIndex;
                             busiestCategoryName = activeCategories.find(c => c.id === catId)?.name || null;
                        }
                    }
                });
            }
            
            const totalDuties = Array.from(personDutiesByCategory?.values() || []).reduce((sum, d) => sum + d.total, 0);
            const dutiesThisMonth = Array.from(personDutiesByCategory?.values() || []).reduce((sum, d) => sum + d.thisMonth, 0);
    
            stats.set(person.id, {
                totalDuties,
                dutiesThisMonth,
                overallIndex: maxOverallIndex,
                monthlyIndex: maxMonthlyIndex,
                busiestCategory: busiestCategoryName
            });
        });
    
        return stats;
    }, [people, activeCategories, schedules]);

    const subdivisionStats = useMemo(() => {
        const stats = new Map<string, { total: number; approved: number }>();
        const personTypePeople = people.filter(p => p.type === 'person');
        const uniqueSubdivisionNames = [...new Set(people.map(p => p.subdivision).filter(Boolean))];

        uniqueSubdivisionNames.forEach(subName => {
            if(subName) {
                const peopleInSub = personTypePeople.filter(p => p.subdivision === subName);
                stats.set(subName, {
                    total: peopleInSub.length,
                    approved: peopleInSub.filter(p => !p.isNew).length
                });
            }
        });
        return stats;
    }, [people]);

    const handleSave = useCallback((person: Person) => {
        const isEditing = people.some(p => p.id === person.id);

        if (!isEditing && person.type === 'person') {
            const existingPerson = people.find(p => p.tin === person.tin);
            if (existingPerson) {
                setTinConflict({ existing: existingPerson, incoming: person });
                setEditingPerson(undefined);
                return;
            }
        }
        
        let personToSave = { ...person, isNew: person.isNew ?? false };
        if (!personToSave.linkedPersonId) {
            personToSave.linkedCategoryId = null;
        }

        setPeople(prev => {
            if (isEditing) {
                return prev.map(p => p.id === personToSave.id ? personToSave : p);
            }
            return [...prev, personToSave];
        });
        showToast(isEditing ? 'Дані оновлено.' : 'Особу/підрозділ додано.');
        logAction(isEditing ? `Відредаговано "${person.fullName}"` : `Додано нового/у "${person.fullName}"`);
        setEditingPerson(undefined);
    }, [setPeople, showToast, logAction, people]);

    const handleSavePhoto = useCallback(async (personId: string, photoDataUrl: string) => {
        try {
            await savePhoto(personId, photoDataUrl);
            setPeople(prev => prev.map(p => p.id === personId ? { ...p, hasPhoto: true } : p));
            showToast("Фото оновлено.");
            logAction(`Оновлено фото для особи з ID: ${personId}`);
        } catch (error) {
            console.error("Failed to save photo:", error);
            showToast("Не вдалося зберегти фото.");
        }
    }, [setPeople, showToast, logAction]);

    const handleResolveTinConflict = () => {
        if (!tinConflict) return;
        setPeople(prev => prev.map(p => p.id === tinConflict.existing.id ? { ...tinConflict.incoming, id: p.id, isNew: false } : p));
        showToast(`Дані для "${tinConflict.existing.fullName}" оновлено.`);
        logAction(`Оновлено дані для "${tinConflict.existing.fullName}" через дублікат ІНН.`);
        setTinConflict(null);
    };
    
    const approvePerson = (person: Person) => {
        if (!person.fullName || (person.type === 'person' && (!person.rank || !person.rankCategory || !person.position || !person.tin))) {
            showToast("Будь ласка, заповніть всі поля перед погодженням.");
            setEditingPerson(person);
            return;
        }
        setPeople(prev => prev.map(p => p.id === person.id ? { ...p, isNew: false } : p));
        showToast(`"${person.fullName}" погоджено.`);
        logAction(`Погоджено "${person.fullName}"`);
    };

    const handleDelete = (person: Person) => setPersonToDelete(person);
    const handlePermanentDelete = (person: Person) => setPersonToPermanentlyDelete(person);

    const handleConfirmDelete = () => {
        if (!personToDelete) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayDate = today.getDate();
        const todayMonth = today.getMonth();
        const todayYear = today.getFullYear();

        setSchedules(prevSchedules => {
            const newSchedules = JSON.parse(JSON.stringify(prevSchedules));
            for (const catId in newSchedules) {
                for (const yearMonth in newSchedules[catId]) {
                    const [year, month] = yearMonth.split('-').map(Number);
                    const scheduleDate = new Date(year, month - 1, 1);

                    if (scheduleDate >= today || (year === todayYear && month -1 === todayMonth)) {
                         const personSchedule = newSchedules[catId][yearMonth][personToDelete.id];
                        if (personSchedule) {
                            if (year === todayYear && month - 1 === todayMonth) {
                                for (const day in personSchedule) {
                                    if (parseInt(day) >= todayDate) {
                                        delete personSchedule[day];
                                    }
                                }
                            } else {
                                delete newSchedules[catId][yearMonth][personToDelete.id];
                            }
                        }
                    }
                }
            }
            return newSchedules;
        });
        
        setDeletingId(personToDelete.id);
        
        setTimeout(() => {
            setPeople(prev => prev.map(p => p.id === personToDelete.id ? { ...p, deletedTimestamp: Date.now() } : p));
            showToast(`"${personToDelete.fullName}" архівувано.`);
            logAction(`Архівувано "${personToDelete.fullName}"`);
            setPersonToDelete(null);
            setDeletingId(null);
        }, 500); 
    };

    const handleConfirmPermanentDelete = async () => {
        if (!personToPermanentlyDelete) return;
        
        setSchedules(prevSchedules => {
            const newSchedules = JSON.parse(JSON.stringify(prevSchedules));
            for (const catId in newSchedules) {
                for (const yearMonth in newSchedules[catId]) {
                    if (newSchedules[catId][yearMonth][personToPermanentlyDelete.id]) {
                        delete newSchedules[catId][yearMonth][personToPermanentlyDelete.id];
                    }
                }
            }
            return newSchedules;
        });

        if (personToPermanentlyDelete.hasPhoto) {
            await deletePhoto(personToPermanentlyDelete.id);
        }
        
        setDeletingId(personToPermanentlyDelete.id);

        setTimeout(() => {
            setPeople(prev => prev.filter(p => p.id !== personToPermanentlyDelete.id));
            showToast(`"${personToPermanentlyDelete.fullName}" видалено назавжди.`);
            logAction(`Назавжди видалено "${personToPermanentlyDelete.fullName}"`);
            setPersonToPermanentlyDelete(null);
            setDeletingId(null);
        }, 500);
    }
    
    const handleRestore = (id: string) => {
        const person = people.find(p => p.id === id);
        setPeople(prev => prev.map(p => p.id === id ? { ...p, deletedTimestamp: null } : p));
        showToast(`"${person?.fullName}" відновлено.`);
        logAction(`Відновлено з архіву "${person?.fullName}"`);
    }

    const handleImport = (importedPeople: ImportedPersonData[]) => {
        const newPeople: Person[] = importedPeople.map(p => {
            const normalizedRank = normalizeRank(p.rank);
            return {
                ...p,
                id: crypto.randomUUID(),
                type: 'person',
                rank: normalizedRank,
                rankCategory: getRankCategory(normalizedRank),
                categoryIds: [],
                deletedTimestamp: null,
                isNew: true,
                createdTimestamp: Date.now(),
                source: 'import',
            };
        });
        setPeople(prev => [...prev, ...newPeople]);
        showToast(`Імпортовано ${newPeople.length} ос.`);
        logAction(`Імпортовано ${newPeople.length} осіб з файлу.`);
        setIsImporting(false);
    };
    
    const newlyImportedPeople = useMemo(() => people.filter(p => p.isNew && !p.deletedTimestamp).sort((a,b) => a.fullName.localeCompare(b.fullName)), [people]);
    const approvedPeople = useMemo(() => people.filter(p => !p.isNew && !p.deletedTimestamp), [people]);
    const archivedPeople = useMemo(() => people.filter(p => p.deletedTimestamp), [people]);

    const sortedSubdivisionsForFilter = useMemo(() => 
        [...subdivisions]
            .sort((a, b) => a.rowIndex - b.rowIndex)
            .map(s => s.name), 
    [subdivisions]);


    const filteredAndSortedApproved = useMemo(() => {
        const subFilterIds = new Set<string>();
        if (subdivisionFilter !== 'all') {
            const selectedSub = subdivisions.find(s => s.name === subdivisionFilter);
            if (selectedSub) {
                subFilterIds.add(selectedSub.id);
                const descendantIds = getSubdivisionDescendants(selectedSub.id, subdivisions);
                descendantIds.forEach(id => subFilterIds.add(id));
            }
        }

        return approvedPeople
            .filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(p => filterByRank === 'all' || p.rankCategory === filterByRank)
            .filter(p => categoryFilter === 'all' || p.categoryIds.includes(categoryFilter))
            .filter(p => {
                if (subdivisionFilter === 'all') return true;
                if (subFilterIds.size === 0) return false;
                const directSub = getDirectSubdivision(p.subdivisionRowIndex, subdivisions);
                return directSub ? subFilterIds.has(directSub.id) : false;
            })
            .sort((a, b) => {
                let compare = 0;
                switch (sortBy) {
                    case 'totalDuties':
                        compare = (dutyStats.get(b.id)?.totalDuties || 0) - (dutyStats.get(a.id)?.totalDuties || 0);
                        break;
                    case 'dutiesThisMonth':
                        compare = (dutyStats.get(b.id)?.dutiesThisMonth || 0) - (dutyStats.get(a.id)?.dutiesThisMonth || 0);
                        break;
                    case 'subdivision': {
                        const subA = getDirectSubdivision(a.subdivisionRowIndex, subdivisions);
                        const subB = getDirectSubdivision(b.subdivisionRowIndex, subdivisions);
                        compare = (subA?.rowIndex ?? Infinity) - (subB?.rowIndex ?? Infinity);
                        if (compare === 0) {
                            compare = a.fullName.localeCompare(b.fullName);
                        }
                        break;
                    }
                    case 'rank':
                        const rankIndexA = Object.values(RANKS).flat().indexOf(a.rank.toLowerCase());
                        const rankIndexB = Object.values(RANKS).flat().indexOf(b.rank.toLowerCase());
                        compare = rankIndexA - rankIndexB;
                        break;
                    case 'position':
                        compare = a.position.localeCompare(b.position);
                        break;
                    case 'fullName':
                    default:
                        compare = a.fullName.localeCompare(b.fullName);
                        break;
                }
                return sortDirection === 'asc' ? compare : -compare;
            });
    }, [approvedPeople, searchTerm, filterByRank, categoryFilter, subdivisionFilter, sortBy, sortDirection, dutyStats, subdivisions, getDirectSubdivision, getSubdivisionDescendants]);

     const filteredAndSortedArchived = useMemo(() => {
        return archivedPeople
            .filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a,b) => a.fullName.localeCompare(b.fullName))
    }, [archivedPeople, searchTerm]);

    const cancelSelectionMode = () => {
        setSelectionModeFor(null);
        setSelection([]);
    };

    const handleCardMouseDown = (personId: string, context: 'new' | 'approved' | 'archived') => {
        if (isSelectionMode) return;
        selectionTimeout.current = window.setTimeout(() => {
            setSelectionModeFor(context);
            setSelection(prev => [...prev, personId]);
        }, 500);
    };

    const handleCardMouseUp = () => {
        if (selectionTimeout.current) clearTimeout(selectionTimeout.current);
    };

    const handleCardClick = (personId: string) => {
        if (isSelectionMode) {
            setSelection(prev => 
                prev.includes(personId) 
                ? prev.filter(id => id !== personId) 
                : [...prev, personId]
            );
        }
    };
    
    const handleSelectAll = () => {
        let allIds: string[] = [];
        if (selectionModeFor === 'new') allIds = newlyImportedPeople.map(p => p.id);
        if (selectionModeFor === 'approved') allIds = filteredAndSortedApproved.map(p => p.id);
        if (selectionModeFor === 'archived') allIds = filteredAndSortedArchived.map(p => p.id);

        if (selection.length === allIds.length) {
            setSelection([]);
        } else {
            setSelection(allIds);
        }
    }
    
    const handleBulkApprove = () => {
        let approvedCount = 0;
        setPeople(prev => prev.map(p => {
            if (selection.includes(p.id)) {
                 if (!p.fullName || (p.type === 'person' && (!p.rank || !p.rankCategory || !p.position || !p.tin))) {
                     showToast(`Неможливо погодити "${p.fullName}" - не всі поля заповнені.`);
                     return p;
                }
                approvedCount++;
                return { ...p, isNew: false };
            }
            return p;
        }));
        if(approvedCount > 0) {
            showToast(`Погоджено ${approvedCount} ос.`);
            logAction(`Погоджено ${approvedCount} ос.`);
        }
        cancelSelectionMode();
    };

    const handleBulkArchive = () => {
        setPeople(prev => prev.map(p => selection.includes(p.id) ? { ...p, deletedTimestamp: Date.now() } : p));
        showToast(`Архівувано ${selection.length} ос.`);
        logAction(`Архівувано ${selection.length} ос.`);
        cancelSelectionMode();
    };

    const handleBulkDelete = () => {
        setPeople(prev => prev.filter(p => !selection.includes(p.id)));
        showToast(`Видалено ${selection.length} ос.`);
        logAction(`Назавжди видалено ${selection.length} ос.`);
        cancelSelectionMode();
    };

    const handleBulkRestore = () => {
        setPeople(prev => prev.map(p => selection.includes(p.id) ? { ...p, deletedTimestamp: null } : p));
        showToast(`Відновлено ${selection.length} ос.`);
        logAction(`Відновлено ${selection.length} ос.`);
        cancelSelectionMode();
    };

    const assignedWeapons = useMemo(() => {
        const map = new Map<string, Weapon>();
        weapons.filter(w => w.personId && !w.deletedTimestamp).forEach(w => map.set(w.personId!, w));
        return map;
    }, [weapons]);

    const { linkedToMap, linkedFromMap } = useMemo(() => {
        const linkedTo = new Map<string, Person[]>();
        const linkedFrom = new Map<string, Person>();
        const peopleMap = new Map(people.map(p => [p.id, p]));

        people.forEach(p => {
            if (p.linkedPersonId) {
                const mainPerson = peopleMap.get(p.linkedPersonId);
                if (mainPerson) {
                    linkedFrom.set(p.id, mainPerson);
                    if (!linkedTo.has(mainPerson.id)) {
                        linkedTo.set(mainPerson.id, []);
                    }
                    linkedTo.get(mainPerson.id)!.push(p);
                }
            }
        });
        return { linkedToMap: linkedTo, linkedFromMap: linkedFrom };
    }, [people]);
    
    const StarRating: React.FC<{ index: number }> = ({ index }) => {
        const starCount = useMemo(() => {
            if (index < 0.5) return 1;
            if (index < 0.8) return 2;
            if (index < 1.2) return 3;
            if (index < 1.6) return 4;
            return 5;
        }, [index]);
    
        return (
            <div className="flex text-yellow-400" title={`Індекс навантаження: ${index.toFixed(2)}`}>
                {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} filled={i < starCount} className="w-3 h-3" />
                ))}
            </div>
        );
    };

    const PersonCard: React.FC<{person: Person, context: 'new' | 'approved' | 'archived', isCompact: boolean, linkedTo?: Person[], linkedFrom?: Person}> = ({ person, context, isCompact, linkedTo, linkedFrom }) => {
        const isSelected = selection.includes(person.id);
        const shouldAnimate = isHighlighting && context === 'new';
        const isBeingDeleted = deletingId === person.id;
        const [photoUrl, setPhotoUrl] = useState<string | null>(null);
        const fullPosition = useMemo(() => formatHierarchicalPositionForRoster(person, subdivisions), [person, subdivisions]);
        const stats = dutyStats.get(person.id);

        useEffect(() => {
            if (person.hasPhoto) {
                getPhoto(person.id).then(url => {
                    if (url) setPhotoUrl(url);
                });
            } else {
                setPhotoUrl(null);
            }
        }, [person.hasPhoto, person.id]);
        
        const cardClasses = {
            grid: 'flex flex-col justify-between p-3',
            blocks: 'flex flex-col justify-between text-center p-3',
            list: 'flex items-center justify-between w-full'
        };

        if (person.type === 'subdivision') {
             const currentStats = subdivisionStats.get(person.fullName);
             return (
                 <Card 
                      className={`${cardClasses[viewMode]} transition-all duration-300 relative ${isSelectionMode ? 'cursor-pointer' : ''} ${context === 'archived' ? 'opacity-60' : ''} ${context === 'new' ? '!border-2 !border-red-500' : ''} ${isSelected && selectionModeFor === context ? 'ring-2 ring-accent' : ''} ${shouldAnimate ? 'animate-pulse-attention' : ''} ${isBeingDeleted ? 'is-deleting' : ''}`}
                      onMouseDown={() => handleCardMouseDown(person.id, context)}
                      onMouseUp={handleCardMouseUp}
                      onMouseLeave={handleCardMouseUp}
                      onClick={() => handleCardClick(person.id)}
                 >
                     <div>
                        <h3 className={`text-lg font-bold text-header ${isSelectionMode && selectionModeFor === context ? 'ml-6' : ''}`}>{person.fullName}</h3>
                        <div className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-secondary-text">Всього в програмі:</span>
                                <span className="font-bold text-header bg-secondary px-2 py-1 rounded-md">{currentStats?.total || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-secondary-text">З них погоджено:</span>
                                <span className="font-bold text-header bg-secondary px-2 py-1 rounded-md">{currentStats?.approved || 0}</span>
                            </div>
                        </div>
                    </div>
                     <div className="flex justify-end space-x-2 mt-4 border-t border-border-color pt-4">
                        {context === 'archived' ? (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(person); }} className="text-xs bg-red-800 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors">Видалити</button>
                                <button onClick={(e) => { e.stopPropagation(); handleRestore(person.id); }} className="text-xs bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-500 transition-colors">Відновити</button>
                            </>
                        ) : (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); setEditingPerson(person);}} className="text-xs bg-secondary px-3 py-1 rounded-md hover:bg-primary transition-colors border border-border-color">Редагувати</button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(person);}} className="text-xs bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-500 transition-colors">Архівувати</button>
                            </>
                        )}
                    </div>
                 </Card>
             )
        }

        return (
            <Card 
                className={`${cardClasses[viewMode]} transition-all duration-300 relative ${isSelectionMode ? 'cursor-pointer' : 'hover:shadow-xl hover:-translate-y-1 transform'} ${context === 'archived' ? 'opacity-60' : ''} ${context === 'new' ? '!border-2 !border-red-500' : ''} ${isSelected && selectionModeFor === context ? 'ring-2 ring-accent' : ''} ${shouldAnimate ? 'animate-pulse-attention' : ''} ${isBeingDeleted ? 'is-deleting' : ''}`}
                onMouseDown={() => handleCardMouseDown(person.id, context)}
                onMouseUp={handleCardMouseUp}
                onMouseLeave={handleCardMouseUp}
                onClick={() => handleCardClick(person.id)}
            >
                 {isSelectionMode && selectionModeFor === context && (
                     <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 ${isSelected ? 'bg-accent border-accent' : 'bg-card border-secondary-text'} flex items-center justify-center`}>
                        {isSelected && <CheckIcon />}
                    </div>
                )}
                <div className="flex flex-col flex-grow">
                     {viewMode === 'grid' ? (
                        <div className="flex items-start gap-3 w-full">
                            <div className="relative flex-shrink-0">
                                <div className="w-16 h-16 rounded-full bg-secondary bg-cover bg-center border-2 border-border-color/50" style={{ backgroundImage: `url(${photoUrl})` }}>
                                    {!photoUrl && <UsersIcon className="w-8 h-8 text-secondary-text m-3" />}
                                </div>
                                <div className="absolute -bottom-2 -right-1" title={person.source === 'manual' ? 'Додано вручну' : 'Імпортовано з файлу'}>
                                    {person.source === 'manual' ? <UserPlusIcon className="w-5 h-5 text-secondary-text bg-card rounded-full p-0.5" /> : <FileImportIcon className="w-5 h-5 text-secondary-text bg-card rounded-full p-0.5" />}
                                </div>
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className={`text-base font-bold text-header truncate ${isSelectionMode && selectionModeFor === context ? 'ml-6' : ''}`} title={person.fullName}>{person.fullName}</h3>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2 text-right">
                                       {person.isNew && <span className="text-xs font-bold bg-red-500 text-white px-2 py-1 rounded">Погодження</span>}
                                       {person.rankCategory ? <span className="text-xs font-bold bg-accent/20 text-accent px-2 py-1 rounded">{person.rankCategory}</span> : <span className="text-xs font-bold bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">Не розпізнано</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-secondary-text truncate" title={person.rank}>{person.rank}</p>
                                    {stats && <StarRating index={stats.overallIndex} />}
                                </div>
                                <p className="text-xs text-primary-text mt-1 truncate" title={fullPosition}>
                                    {fullPosition}
                                </p>
                                {person.phone && (
                                    <p className="text-xs text-secondary-text mt-1 flex items-center gap-1">
                                        <PhoneIcon className="w-3 h-3" /> {person.phone}
                                    </p>
                                )}
                            </div>
                        </div>
                     ) : (
                         <div className="flex flex-col items-center">
                              <div className="relative flex-shrink-0 mb-2">
                               <div className="w-20 h-20 rounded-full bg-secondary bg-cover bg-center border-2 border-border-color/50" style={{ backgroundImage: `url(${photoUrl})` }}>
                                  {!photoUrl && <UsersIcon className="w-10 h-10 text-secondary-text m-4" />}
                               </div>
                                <div className="absolute -bottom-1 -right-1" title={person.source === 'manual' ? 'Додано вручну' : 'Імпортовано з файлу'}>
                                    {person.source === 'manual' ? <UserPlusIcon className="w-5 h-5 text-secondary-text bg-card rounded-full p-0.5" /> : <FileImportIcon className="w-5 h-5 text-secondary-text bg-card rounded-full p-0.5" />}
                                </div>
                            </div>
                            <h3 className="text-md font-bold text-header truncate" title={person.fullName}>{person.fullName}</h3>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-secondary-text truncate" title={person.rank}>{person.rank}</p>
                                {stats && <StarRating index={stats.overallIndex} />}
                            </div>
                            <p className="text-xs text-primary-text mt-1 w-full truncate" title={fullPosition}>{fullPosition}</p>
                             {person.phone && (
                                <p className="text-xs text-secondary-text mt-1 flex items-center gap-1">
                                    <PhoneIcon className="w-3 h-3" /> {person.phone}
                                </p>
                            )}
                            {person.rankCategory ? <span className="text-xs font-bold bg-accent/20 text-accent px-2 py-0.5 rounded mt-1">{person.rankCategory}</span> : <span className="text-xs font-bold bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">?</span>}
                        </div>
                     )}

                    <div className="flex-grow"></div>
                    
                    <div className="mt-3 flex flex-wrap gap-2">
                        {person.categoryIds.map(id => {
                            const cat = activeCategories.find(c => c.id === id);
                            return cat ? <span key={id} className={`text-xs text-white px-3 py-1 rounded-full font-semibold ${cat.color || 'bg-accent'}`}>{cat.shortName || cat.name}</span> : null;
                        })}
                    </div>

                    {(linkedFrom || (linkedTo && linkedTo.length > 0)) && (
                        <div className="mt-2 pt-2 border-t border-border-color/50 text-xs text-secondary-text flex items-center gap-1">
                            <LinkIcon className="w-4 h-4 flex-shrink-0" />
                            {linkedFrom && <span>Прив'язаний до: <strong className="text-primary-text">{linkedFrom.fullName.split(' ')[0]}</strong></span>}
                            {linkedTo && linkedTo.length > 0 && <span>Основний для: <strong className="text-primary-text">{linkedTo.map(p => p.fullName.split(' ')[0]).join(', ')}</strong></span>}
                        </div>
                    )}
                </div>
                
                <div className={`flex justify-between items-center mt-3 ${viewMode !== 'blocks' ? 'border-t border-border-color pt-3' : ''}`}>
                    <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setInfoPerson(person); }} className="text-secondary-text hover:text-accent p-1"><InfoIcon /></button>
                    </div>

                     <div className="flex justify-end items-center flex-wrap gap-1.5">
                        {context === 'archived' ? (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(person); }} className="text-[10px] bg-red-800 text-white px-2 py-1 rounded-md hover:bg-red-700 transition-colors">Видалити</button>
                                <button onClick={(e) => { e.stopPropagation(); handleRestore(person.id); }} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-500 transition-colors">Відновити</button>
                            </>
                        ) : (
                            <>
                                {person.isNew && <button onClick={(e) => { e.stopPropagation(); approvePerson(person);}} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-500 transition-colors">Погодити</button>}
                                <button onClick={(e) => { e.stopPropagation(); setEditingPerson(person);}} className="text-[10px] bg-secondary px-2 py-1 rounded-md hover:bg-primary transition-colors border border-border-color">Редагувати</button>
                                {person.isNew ? (
                                    <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(person); }} className="text-[10px] bg-red-800 text-white px-2 py-1 rounded-md hover:bg-red-700 transition-colors">Видалити</button>
                                ) : (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(person);}} className="text-[10px] bg-red-600 text-white px-2 py-1 rounded-md hover:bg-red-500 transition-colors">Архівувати</button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </Card>
        );
    };
    
    const renderActionToolbar = () => {
        if (!isSelectionMode) return null;

        const currentList = selectionModeFor === 'new' ? newlyImportedPeople : selectionModeFor === 'approved' ? filteredAndSortedApproved : filteredAndSortedArchived;
        const allSelected = selection.length > 0 && selection.length === currentList.length;

        return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-card/90 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-border-color flex items-center gap-2">
                 <button onClick={handleSelectAll} className="text-xs bg-secondary text-primary-text px-3 py-2 rounded-md hover:bg-primary transition-colors">{allSelected ? "Зняти виділення" : "Вибрати всіх"}</button>
                {selectionModeFor === 'new' && <button onClick={handleBulkApprove} disabled={selection.length === 0} className="text-xs bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-500 transition-colors disabled:bg-gray-500">Погодити обране</button>}
                {(selectionModeFor === 'new' || selectionModeFor === 'approved') && <button onClick={handleBulkArchive} disabled={selection.length === 0} className="text-xs bg-yellow-600 text-white px-3 py-2 rounded-md hover:bg-yellow-500 transition-colors disabled:bg-gray-500">Архівувати</button>}
                {selectionModeFor === 'archived' && <button onClick={handleBulkRestore} disabled={selection.length === 0} className="text-xs bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-500 transition-colors disabled:bg-gray-500">Відновити всі</button>}
                {selectionModeFor === 'archived' && <button onClick={handleBulkDelete} disabled={selection.length === 0} className="text-xs bg-red-800 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-500">Видалити</button>}
                <button onClick={cancelSelectionMode} className="p-2 rounded-full hover:bg-secondary transition-colors"><XIcon /></button>
            </div>
        )
    };

    const renderPeople = (peopleList: Person[], context: 'new' | 'approved' | 'archived') => {
        if (viewMode === 'list' && context !== 'new') {
            return (
                <Card>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border-color">
                                <th className="p-2">ПІБ</th>
                                <th className="p-2">Звання</th>
                                <th className="p-2">Посада</th>
                                <th className="p-2">Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            {peopleList.map(person => {
                                const fullPosition = formatHierarchicalPositionForRoster(person, subdivisions);
                                return (
                                <tr key={person.id} className={`border-b border-border-color/50 hover:bg-secondary ${deletingId === person.id ? 'is-deleting' : ''}`}>
                                    <td className="p-2 font-semibold">{person.fullName}</td>
                                    <td className="p-2 text-secondary-text">{person.rank}</td>
                                    <td className="p-2 max-w-xs truncate" title={fullPosition}>{fullPosition}</td>
                                    <td className="p-2">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setInfoPerson(person)} className="text-secondary-text hover:text-accent p-1"><InfoIcon /></button>
                                            <button onClick={() => setEditingPerson(person)} className="text-secondary-text hover:text-accent p-1">Редагувати</button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </Card>
            );
        }

        const gridClasses = {
            grid: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
            blocks: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
            list: ''
        };

        return (
            <div className={`grid ${gridClasses[viewMode]} gap-4`}>
                {peopleList.map(person => <PersonCard 
                    key={person.id} 
                    person={person} 
                    context={context} 
                    isCompact={viewMode === 'blocks'} 
                    linkedTo={linkedToMap.get(person.id)}
                    linkedFrom={linkedFromMap.get(person.id)}
                />)}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {renderActionToolbar()}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-header">Особовий склад</h1>
                <div className="space-x-2 flex items-center flex-shrink-0">
                    <button onClick={() => setIsActualizing(true)} className="bg-secondary text-primary-text px-4 py-2 rounded-lg hover:bg-primary transition-colors shadow-md border border-border-color flex items-center gap-2">
                        <SyncIcon /> Актуалізувати
                    </button>
                    <button onClick={() => { setShowArchived(s => !s); cancelSelectionMode(); }} className="bg-secondary text-primary-text px-4 py-2 rounded-lg hover:bg-primary transition-colors shadow-md border border-border-color">{showArchived ? "Активний склад" : "Архів"}</button>
                    <button onClick={() => setIsImporting(true)} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md">Додати з файлу</button>
                    <button onClick={() => setEditingPerson({} as Person)} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md">Додати</button>
                </div>
            </div>

            {infoPerson && (
                <PersonInfoModal 
                    person={infoPerson}
                    onClose={() => setInfoPerson(null)}
                    onSavePhoto={handleSavePhoto}
                    fullPosition={formatHierarchicalPositionForRoster(infoPerson, subdivisions)}
                    dutyStats={dutyStats.get(infoPerson.id)}
                />
            )}
            {editingPerson && (
                <PersonFormModal
                    person={editingPerson.id ? editingPerson : undefined}
                    onSave={handleSave}
                    onCancel={() => setEditingPerson(undefined)}
                    categories={activeCategories}
                    people={people}
                />
            )}

            <Card>
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-grow">
                        <input type="search" placeholder="Пошук за ПІБ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent" />
                    </div>
                    {!showArchived && (
                        <>
                        <div className="flex items-center bg-secondary rounded-lg border border-border-color p-1">
                            <button onClick={() => setViewMode('grid')} className={`p-1 rounded ${viewMode === 'grid' ? 'bg-accent text-white' : ''}`}><ViewGridIcon/></button>
                            <button onClick={() => setViewMode('blocks')} className={`p-1 rounded ${viewMode === 'blocks' ? 'bg-accent text-white' : ''}`}><ViewBlocksIcon/></button>
                            <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-accent text-white' : ''}`}><ViewListIcon/></button>
                        </div>
                        <div>
                            <label className="text-sm text-secondary-text mr-2">Сортувати:</label>
                             <div className="flex items-center gap-1">
                                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="bg-secondary p-2 rounded-md border border-border-color">
                                    <option value="fullName">За ПІБ</option>
                                    <option value="rank">За званням</option>
                                    <option value="position">За посадою</option>
                                    <option value="totalDuties">За к-стю нарядів (всього)</option>
                                    <option value="dutiesThisMonth">За к-стю нарядів (місяць)</option>
                                    <option value="subdivision">За підрозділом</option>
                                </select>
                                <button onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')} className="p-2 bg-secondary rounded-md border border-border-color">
                                    {sortDirection === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                </button>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select value={filterByRank} onChange={e => setFilterByRank(e.target.value)} className="bg-secondary p-2 rounded-md border border-border-color">
                                <option value="all">Всі звання</option>
                                {RANK_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-secondary p-2 rounded-md border border-border-color">
                                <option value="all">Всі категорії</option>
                                {activeCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                             <select value={subdivisionFilter} onChange={e => setSubdivisionFilter(e.target.value)} className="bg-secondary p-2 rounded-md border border-border-color">
                                <option value="all">Всі підрозділи</option>
                                {sortedSubdivisionsForFilter.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                        </div>
                        </>
                    )}
                </div>
            </Card>

            {isImporting && <ImportModal people={people} onImport={handleImport} onCancel={() => setIsImporting(false)} />}
            {isActualizing && <ActualizationModal people={people} setPeople={setPeople} onCancel={() => setIsActualizing(false)} />}
            
            {renderPeople(showArchived ? filteredAndSortedArchived : filteredAndSortedApproved, showArchived ? 'archived' : 'approved')}

            {!showArchived && approvedPeople.length === 0 && (
                 <p className="text-center text-secondary-text mt-8">
                    Немає жодної особи. Спробуйте додати вручну або імпортувати з файлу.
                </p>
            )}

             {!showArchived && newlyImportedPeople.length > 0 && (
                <div ref={newlyImportedRef}>
                    <div className="my-8 border-t-2 border-dashed border-border-color">
                        <h2 className="text-center text-secondary-text bg-secondary w-fit mx-auto px-4 -mt-4">Потребують погодження</h2>
                    </div>
                    {renderPeople(newlyImportedPeople, 'new')}
                </div>
            )}
            
             {showArchived && filteredAndSortedArchived.length === 0 && <p className="text-center text-secondary-text mt-8">Архів порожній.</p>}

            <ConfirmationModal
                isOpen={!!tinConflict}
                onClose={() => setTinConflict(null)}
                onConfirm={handleResolveTinConflict}
                title="Знайдено дублікат за ІНН"
                message={<>
                    <p>Особа з ІНН <strong>{tinConflict?.existing.tin}</strong> вже існує: <strong>{tinConflict?.existing.fullName}</strong>.</p>
                    <p className="mt-2">Бажаєте оновити дані існуючої особи даними, що ви ввели?</p>
                </>}
                confirmButtonText="Так, оновити"
            />
             <ConfirmationModal
                isOpen={!!personToDelete}
                onClose={() => setPersonToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Архівувати особу"
                message={<>Ви впевнені, що хочете архівувати <strong>{personToDelete?.fullName}</strong>?</>}
            />
             <ConfirmationModal
                isOpen={!!personToPermanentlyDelete}
                onClose={() => setPersonToPermanentlyDelete(null)}
                onConfirm={handleConfirmPermanentDelete}
                title="Видалити особу назавжди"
                message={<>Ви впевнені, що хочете <strong>НАЗАВЖДИ</strong> видалити <strong>{personToPermanentlyDelete?.fullName}</strong>? Цю дію неможливо буде скасувати.</>}
                confirmButtonText="Так, видалити"
                confirmButtonClassName="bg-red-800 hover:bg-red-900"
            />
        </div>
    );
};

export default People;