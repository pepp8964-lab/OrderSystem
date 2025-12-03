import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { Subdivision, Person, AppSettings } from '../types';
import Card from '../components/Card';
import { useToast, useActionLog } from '../context/ThemeContext';
import { ReorderIcon, UnlinkIcon, EditIcon, ChevronDownIcon, ChevronRightIcon } from '../components/icons/Icons';
import { getFileFromDB } from '../utils/db';
import { GoogleGenAI } from "@google/genai";
import { defaultSettings } from '../utils/defaults';

declare const XLSX: any;

type ExcelMapping = { subdivision: string; };

type SyncConflict = {
    type: 'new' | 'moved' | 'missing';
    name: string;
    oldRowIndex?: number;
    newRowIndex?: number;
    subdivision?: Subdivision;
};


const SyncConflictModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    conflicts: SyncConflict[];
}> = ({ isOpen, onClose, onConfirm, conflicts }) => {
    if (!isOpen) return null;

    const newItems = conflicts.filter(c => c.type === 'new');
    const movedItems = conflicts.filter(c => c.type === 'moved');
    const missingItems = conflicts.filter(c => c.type === 'missing');

    const renderConflictList = (title: string, items: SyncConflict[], colorClass: string) => (
        items.length > 0 && (
            <div>
                <h3 className={`font-bold ${colorClass} mb-2`}>{title} ({items.length})</h3>
                <div className="space-y-1 bg-secondary p-2 rounded-md max-h-40 overflow-y-auto border border-border-color">
                    {items.map((c, i) => (
                        <p key={i} className="text-sm text-primary-text">
                            {c.name}
                            {c.type === 'moved' && <span className="text-secondary-text"> (рядок {c.oldRowIndex} → {c.newRowIndex})</span>}
                            {c.type === 'new' && <span className="text-secondary-text"> (новий, рядок {c.newRowIndex})</span>}
                        </p>
                    ))}
                </div>
            </div>
        )
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Результати синхронізації</h2></div>
                <div className="p-4 space-y-4 overflow-y-auto">
                    <p className="text-primary-text">Знайдено наступні зміни між програмою та файлом. Підтвердіть, щоб застосувати.</p>
                    {renderConflictList("Додати нові підрозділи", newItems, "text-green-400")}
                    {renderConflictList("Оновити номери рядків", movedItems, "text-yellow-400")}
                    {renderConflictList("Не знайдено в файлі (буде проігноровано)", missingItems, "text-secondary-text")}
                </div>
                <div className="flex justify-end p-4 border-t border-border-color gap-2">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скасувати</button>
                    <button onClick={onConfirm} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Застосувати зміни</button>
                </div>
            </div>
        </div>
    );
};


const SubdivisionItem = React.memo<{
    sub: Subdivision & { children: any[] };
    systemCounts: Map<string, { direct: number; total: number; }>;
    fileStats: Map<string, { direct: number; total: number }>;
    selection: string[];
    editingId: string | null;
    editingName: string;
    editingDeclensionId: string | null;
    editingDeclensionName: string;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOverContainer: (e: React.DragEvent<HTMLDivElement>, id: string | null) => void;
    onSelect: (e: React.MouseEvent, id: string) => void;
    onToggleCollapse: (id: string) => void;
    onStartEdit: (sub: Subdivision) => void;
    onSaveEdit: () => void;
    onEditNameChange: (name: string) => void;
    onEditKeyDown: (e: React.KeyboardEvent) => void;
    onStartEditDeclension: (sub: Subdivision) => void;
    onSaveDeclension: () => void;
    onEditDeclensionChange: (name: string) => void;
    onEditDeclensionKeyDown: (e: React.KeyboardEvent) => void;
    onDetach: (id: string) => void;
    renderSubdivision: (sub: Subdivision & { children: any[] }) => React.ReactNode;
}>(({ 
    sub, systemCounts, fileStats, selection, editingId, editingName,
    editingDeclensionId, editingDeclensionName,
    onDragStart, onDrop, onDragOverContainer, onSelect, onToggleCollapse,
    onStartEdit, onSaveEdit, onEditNameChange, onEditKeyDown, 
    onStartEditDeclension, onSaveDeclension, onEditDeclensionChange, onEditDeclensionKeyDown,
    onDetach, renderSubdivision
}) => {
    const systemCount = systemCounts.get(sub.id);
    const fileStat = fileStats.get(sub.id);

    return (
        <div key={sub.id} className="space-y-2">
            <div
                draggable
                onDragStart={(e) => onDragStart(e, sub.id)}
                onDrop={(e) => { e.stopPropagation(); onDrop(e); }}
                onDragOver={(e) => { e.stopPropagation(); onDragOverContainer(e, sub.id); }}
                onDragEnter={(e) => e.stopPropagation()}
                onClick={(e) => onSelect(e, sub.id)}
                className={`group flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border-color cursor-pointer transition-all ${selection.includes(sub.id) ? 'ring-2 ring-accent' : ''}`}
            >
                <ReorderIcon className="w-5 h-5 text-secondary-text cursor-grab flex-shrink-0" />
                {sub.children.length > 0 && (
                    <button onClick={(e) => {e.stopPropagation(); onToggleCollapse(sub.id)}} className="p-1 rounded-full hover:bg-primary">
                        {sub.isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                    </button>
                )}
                 {editingId === sub.id ? (
                    <input 
                        type="text" 
                        value={editingName} 
                        onChange={e => onEditNameChange(e.target.value)} 
                        onBlur={onSaveEdit}
                        onKeyDown={onEditKeyDown}
                        autoFocus
                        className="flex-grow bg-primary p-1 rounded border border-accent"
                    />
                ) : (
                    <span className="flex-grow text-primary-text">{sub.name} <span className="text-xs text-secondary-text">(Рядок: {sub.rowIndex})</span></span>
                )}
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 text-sm font-bold mr-2" title="В: Всього в файлі | Дод.В: Додано в програмі (всього) | Дод.К: Додано в програмі (конкретно)">
                        <span className="text-red-500">В:{fileStat ? fileStat.total : 0}</span>
                        <span className="text-secondary-text">--</span>
                        <span className="text-green-500">Дод.В:{systemCount ? systemCount.total : 0}</span>
                        <span className="text-secondary-text">--</span>
                        <span className="text-blue-500">Дод.К:{systemCount ? systemCount.direct : 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm mr-2" title="Родовий відмінок">
                        {editingDeclensionId === sub.id ? (
                            <input 
                                type="text" 
                                value={editingDeclensionName}
                                onChange={e => onEditDeclensionChange(e.target.value)} 
                                onBlur={onSaveDeclension}
                                onKeyDown={onEditDeclensionKeyDown}
                                onClick={e => e.stopPropagation()}
                                autoFocus
                                className="w-48 bg-primary p-1 rounded border border-accent text-xs"
                            />
                        ) : (
                            <>
                                <span 
                                    onClick={(e) => { e.stopPropagation(); onStartEditDeclension(sub) }} 
                                    className={`italic truncate max-w-xs ${sub.genitiveCaseName ? 'text-secondary-text' : 'text-slate-500'}`}
                                >
                                    {sub.genitiveCaseName || 'не вказано'}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); onStartEditDeclension(sub)}} className="p-0.5 text-secondary-text hover:text-accent">
                                    <EditIcon className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                     <button onClick={(e) => { e.stopPropagation(); onStartEdit(sub)}} className="p-1 text-secondary-text hover:text-accent" title="Редагувати назву"><EditIcon className="w-5 h-5" /></button>
                     {sub.parentId && <button onClick={(e) => { e.stopPropagation(); onDetach(sub.id)}} className="p-1 text-secondary-text hover:text-accent" title="Відкріпити"><UnlinkIcon /></button>}
                </div>
            </div>
            {!sub.isCollapsed && sub.children.length > 0 && (
                <div 
                    className="pl-8 border-l-2 border-border-color/50 space-y-2 pt-2"
                    onDrop={(e) => { e.stopPropagation(); onDrop(e); }}
                    onDragOver={(e) => { e.stopPropagation(); onDragOverContainer(e, sub.id); }}
                >
                    {sub.children.map(child => renderSubdivision(child))}
                </div>
            )}
        </div>
    );
});

const Structure: React.FC = () => {
    const [subdivisions, setSubdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const [people] = useLocalStorage<Person[]>('people', []);
    const [settings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
    const { showToast } = useToast();
    const { logAction } = useActionLog();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingDeclensionId, setEditingDeclensionId] = useState<string | null>(null);
    const [editingDeclensionName, setEditingDeclensionName] = useState('');
    const [selection, setSelection] = useState<string[]>([]);
    const [fileStats, setFileStats] = useState<Map<string, { direct: number; total: number }>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [isDeclining, setIsDeclining] = useState(false);
    const [declensionProgress, setDeclensionProgress] = useState(0);
    const [totalToDecline, setTotalToDecline] = useState(0);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);

    const dragItem = useRef<string | null>(null);
    const dragOverContainer = useRef<string | null>(null);

    useEffect(() => {
        const calculateFileStats = async () => {
            try {
                const file = await getFileFromDB();
                const settings: ExcelMapping = JSON.parse(localStorage.getItem('excel-import-settings') || '{}');
                if (!file || !settings.subdivision) {
                    setFileStats(new Map());
                    return;
                }

                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                const sortedSubs = [...subdivisions].sort((a, b) => a.rowIndex - b.rowIndex);

                const getDirectSubdivision = (personRowIndex: number, allSubdivisions: Subdivision[]) => {
                    const potentialSubs = allSubdivisions
                        .filter(s => s.rowIndex <= personRowIndex)
                        .sort((a, b) => b.rowIndex - a.rowIndex);
                    return potentialSubs.length > 0 ? potentialSubs[0] : null;
                };

                const stats = new Map<string, { direct: number; total: number }>();
                subdivisions.forEach(s => stats.set(s.id, { direct: 0, total: 0 }));
                const subMap = new Map(subdivisions.map(s => [s.id, s]));

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const excelRowNumber = i + 2;
                    if (row && row.some(cell => cell && String(cell).trim() !== '')) { 
                        const directSub = getDirectSubdivision(excelRowNumber, sortedSubs);
                        if (directSub) {
                            const directStat = stats.get(directSub.id);
                            if (directStat) directStat.direct++;

                            let currentSub: Subdivision | undefined = directSub;
                            while (currentSub) {
                                const currentStat = stats.get(currentSub.id);
                                if (currentStat) currentStat.total++;
                                currentSub = currentSub.parentId ? subMap.get(currentSub.parentId) : undefined;
                            }
                        }
                    }
                }
                setFileStats(stats);
            } catch (error) {
                console.error("Error calculating file counts for structure:", error);
                setFileStats(new Map());
            }
        };
        calculateFileStats();
    }, [subdivisions]);

    const subdivisionTree = useMemo(() => {
        const subMap = new Map(subdivisions.map(s => [s.id, { ...s, children: [] as (Subdivision & { children: any[] })[] }]));
        const roots: (Subdivision & { children: any[] })[] = [];

        for (const sub of subdivisions) {
            if (sub.parentId && subMap.has(sub.parentId)) {
                subMap.get(sub.parentId)!.children.push(subMap.get(sub.id)!);
            } else {
                roots.push(subMap.get(sub.id)!);
            }
        }
        
        const sortByRowIndex = (a: Subdivision, b: Subdivision) => a.rowIndex - b.rowIndex;
        
        roots.forEach(r => r.children.sort(sortByRowIndex));
        roots.sort(sortByRowIndex);

        return roots;
    }, [subdivisions]);

    const systemCounts = useMemo(() => {
        const counts = new Map<string, { direct: number; total: number }>();
        const personTypePeople = people.filter(p => p.type === 'person' && !p.deletedTimestamp);

        const getDirectSubdivision = (personRowIndex: number) => {
            const potentialSubs = subdivisions.filter(s => s.rowIndex <= personRowIndex).sort((a, b) => b.rowIndex - a.rowIndex);
            return potentialSubs.length > 0 ? potentialSubs[0] : null;
        };

        subdivisions.forEach(s => counts.set(s.id, { direct: 0, total: 0 }));

        personTypePeople.forEach(p => {
            if (p.subdivisionRowIndex) {
                const directSub = getDirectSubdivision(p.subdivisionRowIndex);
                if (directSub) {
                    let currentSub: Subdivision | undefined = directSub;
                    const subMap = new Map(subdivisions.map(s => [s.id, s]));
                    
                    const directCount = counts.get(directSub.id);
                    if(directCount) directCount.direct++;

                    while (currentSub) {
                        const count = counts.get(currentSub.id);
                        if(count) count.total++;
                        currentSub = currentSub.parentId ? subMap.get(currentSub.parentId) : undefined;
                    }
                }
            }
        });
        return counts;
    }, [subdivisions, people]);

    const handleSelect = (e: React.MouseEvent, id: string) => {
        if (e.ctrlKey || e.metaKey) {
            setSelection(prev => prev.includes(id) ? prev.filter(selId => selId !== id) : [...prev, id]);
        } else {
            setSelection([id]);
        }
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        dragItem.current = id;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const draggedId = dragItem.current;
        if (!draggedId) return;

        const targetId = dragOverContainer.current;
        
        // Prevent dropping onto a child of itself
        let currentParent = targetId;
        const subMap = new Map(subdivisions.map(s => [s.id, s]));
        while (currentParent) {
            if (currentParent === draggedId) {
                showToast("Неможливо перемістити підрозділ всередину себе.");
                return;
            }
            currentParent = subMap.get(currentParent)?.parentId || null;
        }

        const itemsToMove = selection.includes(draggedId) ? selection : [draggedId];

        setSubdivisions(prev =>
            prev.map(sub =>
                itemsToMove.includes(sub.id) ? { ...sub, parentId: targetId } : sub
            )
        );
        logAction(`Переміщено ${itemsToMove.length} підрозділів.`);
        setSelection([]);
    };

    const handleDragOverContainer = useCallback((e: React.DragEvent<HTMLDivElement>, id: string | null) => {
        e.preventDefault();
        dragOverContainer.current = id;
    }, []);
    
    const handleStartEdit = (sub: Subdivision) => {
        setEditingId(sub.id);
        setEditingName(sub.name);
    };

    const handleSaveEdit = () => {
        if (!editingId) return;
        setSubdivisions(prev => prev.map(s => s.id === editingId ? { ...s, name: editingName } : s));
        setEditingId(null);
    };
    
    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveEdit();
        if (e.key === 'Escape') setEditingId(null);
    };

    const handleStartEditDeclension = (sub: Subdivision) => {
        setEditingDeclensionId(sub.id);
        setEditingDeclensionName(sub.genitiveCaseName || '');
    };

    const handleSaveDeclension = () => {
        if (!editingDeclensionId) return;
        setSubdivisions(prev => prev.map(s => s.id === editingDeclensionId ? { ...s, genitiveCaseName: editingDeclensionName } : s));
        setEditingDeclensionId(null);
    };

    const handleEditDeclensionKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveDeclension();
        if (e.key === 'Escape') setEditingDeclensionId(null);
    };

    const handleDetach = (id: string) => {
        setSubdivisions(prev => prev.map(s => s.id === id ? { ...s, parentId: null } : s));
    };

    const handleToggleCollapse = (id: string) => {
        setSubdivisions(prev => prev.map(s => s.id === id ? { ...s, isCollapsed: !s.isCollapsed } : s));
    };
    
    const handleSync = async () => {
        setIsSaving(true);
        try {
            const file = await getFileFromDB();
            const settings: ExcelMapping = JSON.parse(localStorage.getItem('excel-import-settings') || '{}');
            if (!file || !settings.subdivision) {
                showToast("Будь ласка, завантажте файл та налаштуйте стовпці для імпорту в налаштуваннях.");
                setIsSaving(false);
                return;
            }

            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
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
            const colIndex = getColIndex(settings.subdivision);
            
            const fileSubdivisionsMap = new Map<string, number>();
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row && row[colIndex]) {
                    const name = String(row[colIndex]).trim();
                    if (name && !/^\d+$/.test(name) && !fileSubdivisionsMap.has(name)) {
                        fileSubdivisionsMap.set(name, i + 2);
                    }
                }
            }

            const systemSubdivisionsMap = new Map<string, Subdivision>(subdivisions.map(s => [s.name, s]));
            const conflicts: SyncConflict[] = [];

            // Check for moved and missing
            for (const sub of subdivisions) {
                if (fileSubdivisionsMap.has(sub.name)) {
                    const newRowIndex = fileSubdivisionsMap.get(sub.name)!;
                    if (sub.rowIndex !== newRowIndex) {
                        conflicts.push({ type: 'moved', name: sub.name, oldRowIndex: sub.rowIndex, newRowIndex });
                    }
                } else {
                    conflicts.push({ type: 'missing', name: sub.name, subdivision: sub });
                }
            }

            // Check for new
            for (const [name, rowIndex] of fileSubdivisionsMap.entries()) {
                if (!systemSubdivisionsMap.has(name)) {
                    conflicts.push({ type: 'new', name, newRowIndex: rowIndex });
                }
            }
            
            if (conflicts.length > 0) {
                setSyncConflicts(conflicts);
                setIsSyncModalOpen(true);
            } else {
                showToast("Нових або змінених підрозділів не знайдено.");
            }
        } catch (error) {
            console.error("Structure sync failed:", error);
            showToast("Помилка синхронізації структури.");
        } finally {
            setIsSaving(false);
        }
    };
    
     const handleConfirmSync = () => {
        const newCount = syncConflicts.filter(c => c.type === 'new').length;
        const movedCount = syncConflicts.filter(c => c.type === 'moved').length;

        setSubdivisions(prev => {
            let updatedSubs = [...prev];
            
            // Handle moved items first
            updatedSubs = updatedSubs.map(sub => {
                const movedConflict = syncConflicts.find(c => c.type === 'moved' && c.name === sub.name);
                if (movedConflict) {
                    return { ...sub, rowIndex: movedConflict.newRowIndex! };
                }
                return sub;
            });

            // Handle new items
            const newItems = syncConflicts
                .filter(c => c.type === 'new')
                .map(c => ({
                    id: crypto.randomUUID(),
                    name: c.name,
                    rowIndex: c.newRowIndex!,
                    parentId: null
                }));
            
            updatedSubs.push(...newItems);

            return updatedSubs;
        });

        showToast(`Синхронізовано: ${newCount} нових, ${movedCount} оновлених.`);
        logAction(`Синхронізовано структуру: ${newCount} нових, ${movedCount} оновлених.`);
        setIsSyncModalOpen(false);
        setSyncConflicts([]);
    };
    
    const handleAiDecline = async () => {
        const subsToDecline = subdivisions.filter(s => selection.includes(s.id) && !s.genitiveCaseName);
        if (subsToDecline.length === 0) {
            showToast("Немає підрозділів для відмінювання або вони вже оброблені.");
            return;
        }
    
        setIsDeclining(true);
        setTotalToDecline(subsToDecline.length);
        setDeclensionProgress(0);
    
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
            let updatedSubs: Subdivision[] = [...subdivisions];
    
            for (let i = 0; i < subsToDecline.length; i++) {
                const sub = subsToDecline[i];
                const prompt = `Translate to Ukrainian genitive case: "${sub.name}". Provide only the translated phrase.`;
    
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt
                });
    
                const text = response.text.trim();
    
                updatedSubs = updatedSubs.map(s => s.id === sub.id ? { ...s, genitiveCaseName: text } : s);
                setDeclensionProgress(i + 1);
            }
    
            setSubdivisions(updatedSubs);
            showToast("Відмінювання завершено.");
            logAction(`AI відмінив ${subsToDecline.length} назв підрозділів.`);
    
        } catch (err) {
            console.error("AI declension failed:", err);
            showToast("Помилка відмінювання з AI.");
        } finally {
            setIsDeclining(false);
        }
    };

    const renderSubdivision = useCallback((sub: Subdivision & { children: any[] }) => (
        <SubdivisionItem 
            key={sub.id}
            sub={sub}
            systemCounts={systemCounts}
            fileStats={fileStats}
            selection={selection}
            editingId={editingId}
            editingName={editingName}
            editingDeclensionId={editingDeclensionId}
            editingDeclensionName={editingDeclensionName}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragOverContainer={handleDragOverContainer}
            onSelect={handleSelect}
            onToggleCollapse={handleToggleCollapse}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onEditNameChange={setEditingName}
            onEditKeyDown={handleEditKeyDown}
            onStartEditDeclension={handleStartEditDeclension}
            onSaveDeclension={handleSaveDeclension}
            onEditDeclensionChange={setEditingDeclensionName}
            onEditDeclensionKeyDown={handleEditDeclensionKeyDown}
            onDetach={handleDetach}
            renderSubdivision={renderSubdivision}
        />
    ), [subdivisions, systemCounts, fileStats, selection, editingId, editingName, editingDeclensionId, editingDeclensionName, handleDragOverContainer]);

    return (
        <div className="space-y-6" onDrop={handleDrop} onDragOver={(e) => handleDragOverContainer(e, null)}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-header">Структура підрозділів</h1>
                <div className="flex items-center gap-2">
                    {settings.experimentalFeatures.enabled && settings.experimentalFeatures.aiStructureDeclensionEnabled && (
                        <button onClick={handleAiDecline} disabled={isDeclining || selection.length === 0} className="bg-secondary text-primary-text px-4 py-2 rounded-lg hover:bg-primary transition-colors shadow-md border border-border-color disabled:opacity-50">
                            {isDeclining ? `AI Відмінює... (${declensionProgress}/${totalToDecline})` : `Відміняти з AI (${selection.length})`}
                        </button>
                    )}
                    <button onClick={handleSync} disabled={isSaving} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md disabled:opacity-50">
                        {isSaving ? 'Синхронізація...' : 'Синхронізувати з файлу'}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {subdivisionTree.map(sub => renderSubdivision(sub))}
            </div>

            <SyncConflictModal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                onConfirm={handleConfirmSync}
                conflicts={syncConflicts}
            />
        </div>
    );
};

export default Structure;