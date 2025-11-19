import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Person, Category, ScheduleData, DutyStatus, Weapon, Subdivision, AllData, Commander } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PrintIcon, CopyIcon, PlusIcon } from '../components/icons/Icons';
import useLocalStorage from '../hooks/useLocalStorage';
import { useToast } from '../context/ThemeContext';
import { formatHierarchicalPositionForRoster } from '../utils/peopleUtils';
import { UKRAINIAN_MONTHS_GENITIVE } from '../constants';

declare const saveAs: any;

const mmToTwips = (mm: number) => Math.round(mm * 56.7);

const generateId = () => Math.random().toString(36).substr(2, 9);

const toLowerCaseWithExceptions = (str: string, exceptions: string[] = ['БП', 'РАО']) => {
    if (!str) return '';
    const upperExceptions = new Set(exceptions.map(e => e.toUpperCase()));
    return str.split(' ').map(word => 
        upperExceptions.has(word.toUpperCase()) ? word.toUpperCase() : word.toLowerCase()
    ).join(' ');
};

type RosterBlockData = {
    id: string;
    type: 'main' | 'external' | 'text';
    title: string;
    text?: string;
    dataSource?: AllData;
    isSubPoint?: boolean;
};

// Helper function extracted from component to avoid dependency cycles and re-creation
const getDutiesForDate = (date: Date, localSchedules: ScheduleData, localCategories: Category[], localPeople: Person[]) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const duties: { person: Person; category: Category }[] = [];
    const peopleMap = new Map(localPeople.map(p => [p.id, p]));

    for (const categoryId in localSchedules) {
        const categorySchedule = localSchedules[categoryId]?.[yearMonth];
        if (categorySchedule) {
            for (const personId in categorySchedule) {
                if (categorySchedule[personId]?.[day] === DutyStatus.ON_DUTY) {
                    const person = peopleMap.get(personId);
                    const category = localCategories.find(c => c.id === categoryId);
                    if (person && category) {
                        duties.push({ person, category });
                    }
                }
            }
        }
    }
    return duties;
};

const AddBlockModal: React.FC<{
    onClose: () => void;
    onAdd: (block: Omit<RosterBlockData, 'id' | 'type'>, type: 'main' | 'external' | 'text') => void;
}> = ({ onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [isSubPoint, setIsSubPoint] = useState(false);
    const [contentType, setContentType] = useState<'block' | 'line' | 'multiline'>('block');
    const [fileData, setFileData] = useState<AllData | undefined>(undefined);
    const [fileName, setFileName] = useState('');
    const { showToast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    setFileData(data);
                    if (data.unitName && !title) {
                        setTitle(data.unitName);
                    }
                    showToast("Файл підрозділу завантажено.");
                } catch (error) {
                    showToast("Некоректний формат файлу.");
                }
            };
            reader.readAsText(file);
        }
    };
    
    const handleAdd = () => {
        if (!title.trim()) {
            showToast("Будь ласка, введіть назву.");
            return;
        }
        let type: 'main' | 'external' | 'text' = 'text';
        if (contentType === 'block') {
            type = fileData ? 'external' : 'main'; // Main implies current unit data, external implies loaded data
        }
        
        onAdd({ title, text, dataSource: fileData, isSubPoint }, type);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[100] p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Додати запис до наказу</h2></div>
                <div className="p-4 space-y-4">
                    <div className="flex gap-4">
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input type="radio" checked={!isSubPoint} onChange={() => setIsSubPoint(false)} className="text-accent focus:ring-accent" />
                             <span className="text-primary-text">Пункт (1, 2...)</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                             <input type="radio" checked={isSubPoint} onChange={() => setIsSubPoint(true)} className="text-accent focus:ring-accent" />
                             <span className="text-primary-text">Підпункт (продовження)</span>
                         </label>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-secondary-text">Тип контенту</label>
                        <select value={contentType} onChange={(e) => setContentType(e.target.value as any)} className="w-full bg-secondary p-2 rounded-md border border-border-color">
                            <option value="block">Блок з нарядами (Авто)</option>
                            <option value="line">Один рядок тексту</option>
                            <option value="multiline">Мультистрока (кілька абзаців)</option>
                        </select>
                    </div>

                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Назва / Заголовок" className="w-full bg-secondary p-2 rounded-md border border-border-color"/>
                    
                    {contentType !== 'block' && (
                        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Текст..." className="w-full bg-secondary p-2 rounded-md border border-border-color h-24"/>
                    )}

                    {contentType === 'block' && (
                        <div>
                             <label className="w-full text-center cursor-pointer bg-secondary p-3 rounded-md border border-border-color hover:bg-primary block">
                                 {fileName ? `Файл: ${fileName}` : "Завантажити файл підрозділу (опціонально)"}
                                 <input type="file" onChange={handleFileChange} accept=".json" className="hidden" />
                             </label>
                             {!fileData && <p className="text-xs text-secondary-text mt-1 text-center">Якщо файл не вибрано, будуть використані дані поточного підрозділу.</p>}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-border-color">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скасувати</button>
                    <button onClick={handleAdd} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Додати</button>
                </div>
            </div>
        </div>
    );
};

const RosterBlock: React.FC<{ 
    block: RosterBlockData; 
    people: Person[]; 
    categories: Category[]; 
    schedules: ScheduleData; 
    dutyDate: Date;
}> = ({ block, people, categories, schedules, dutyDate }) => {
    const dutiesForBlock = useMemo(() => {
        if (block.type === 'text') return [];
        const blockPeople = block.dataSource?.people || people;
        const blockCategories = block.dataSource?.categories || categories;
        const blockSchedules = block.dataSource?.schedules || schedules;
        const allDuties = getDutiesForDate(dutyDate, blockSchedules, blockCategories, blockPeople);
        return allDuties.filter(duty => duty.person && duty.person.type !== 'subdivision');
    }, [dutyDate, block, people, categories, schedules]);

    return (
        <div className={`bg-secondary p-3 rounded-lg border border-border-color ${block.isSubPoint ? 'ml-8' : ''}`}>
            <h3 className="text-lg font-bold text-header mb-2">{block.title} <span className='text-xs text-secondary-text font-normal'>{block.isSubPoint ? '(Підпункт)' : '(Пункт)'}</span></h3>
            {block.type === 'text' ? (
                <p className="text-primary-text whitespace-pre-wrap">{block.text}</p>
            ) : (
                <div>
                        <div className="space-y-1">
                        {dutiesForBlock.length > 0 ? (
                            // Group by category for display in block card
                            Object.entries(dutiesForBlock.reduce((acc, duty) => {
                                const catName = duty.category.name;
                                if (!acc[catName]) acc[catName] = [];
                                acc[catName].push(duty.person.fullName);
                                return acc;
                            }, {} as Record<string, string[]>)).map(([catName, names]) => (
                                <div key={catName} className="text-sm border-b border-border-color/20 pb-1 mb-1 last:border-0">
                                    <span className="font-bold text-primary-text">{catName}:</span>
                                    <span className="text-secondary-text ml-2">{names.join(', ')}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-secondary-text text-sm text-center italic">Немає призначених нарядів на цю дату.</p>
                        )}
                        </div>
                </div>
            )}
        </div>
    );
};

const Formation: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'order' | 'weekly-text'>('order');
    const { showToast } = useToast();
    
    // Global data
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [schedules] = useLocalStorage<ScheduleData>('schedules', {});
    const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [unitName] = useLocalStorage<string>('unitName', '');

    // Order Generation State
    const [formationDate, setFormationDate] = useState(new Date());
    const [dutyDate, setDutyDate] = useState(new Date(new Date().setDate(new Date().getDate() + 1)));
    const [orderLocation, setOrderLocation] = useState('с. Орлівщина');
    const [lastOrderNumber, setLastOrderNumber] = useLocalStorage<number>('last-order-number', 317);
    const [orderNumber, setOrderNumber] = useState(`${lastOrderNumber + 1} нр`);
    
    const [commander, setCommander] = useLocalStorage<Commander>('commander', { rank: '', name: '', unitNumber: 'А1363', isActing: false });

    const initialBlock: RosterBlockData = { id: 'main', type: 'main', title: 'Добовий наряд', isSubPoint: false }; // Root point 1
    const [blocks, setBlocks] = useState<RosterBlockData[]>([initialBlock]);
    const [isAddingBlock, setIsAddingBlock] = useState(false);

    const getWeekTuesdayDate = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const offset = day >= 2 ? -(day - 2) : -(day + 5);
        date.setDate(date.getDate() + offset);
        return date;
    };
    const [weekStartDate, setWeekStartDate] = useState(getWeekTuesdayDate(new Date()));
    
    const changeWeek = (offset: number) => {
        setWeekStartDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + offset * 7);
            return newDate;
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Текст скопійовано.");
        }, () => {
            showToast("Не вдалося скопіювати текст.");
        });
    };
    
    const handleAddBlock = (blockData: Omit<RosterBlockData, 'id' | 'type'>, type: 'main' | 'external' | 'text') => {
        const newBlock: RosterBlockData = {
            id: generateId(),
            type: type,
            ...blockData
        };
        setBlocks(prev => [...prev, newBlock]);
        setIsAddingBlock(false);
    };

    const handleGenerateAndDownloadOrder = async () => {
        try {
            // Dynamic import to avoid loading issues
            const docx = await import('docx');
            const { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType, ImageRun } = docx;

            const docChildren: any[] = []; 
            
            // 1. Logo (Try to fetch)
            try {
                const response = await fetch('assets/logo.svg');
                 if (response.ok) {
                    const svgText = await response.text();
                     docChildren.push(new Paragraph({
                        children: [
                            new ImageRun({
                                data: new TextEncoder().encode(svgText),
                                transformation: { width: 50, height: 50 },
                                type: "svg",
                                fallback: {
                                    type: "png",
                                    data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]), // 1x1 transparent png
                                    transformation: { width: 50, height: 50 }
                                }
                            } as any)
                        ],
                         alignment: AlignmentType.CENTER,
                         spacing: { after: 100 }
                    }));
                }
            } catch (e) {
                console.warn("Could not load logo for document", e);
            }

            // 2. Header Text
            docChildren.push(new Paragraph({ style: "docHeader", text: "МІНІСТЕРСТВО ОБОРОНИ УКРАЇНИ" }));
            docChildren.push(new Paragraph({ style: "docHeader", text: "НАКАЗ" }));
            docChildren.push(new Paragraph({ 
                style: "docSubHeader", 
                text: `командира військової частини ${commander.unitNumber}`, 
                spacing: { before: 0, after: 0, line: 240 },
                alignment: AlignmentType.CENTER
            }));
            docChildren.push(new Paragraph({ 
                style: "docSubHeader", 
                text: "(по стройовій частині)", 
                spacing: { before: 0, after: 600, line: 240 }, 
                alignment: AlignmentType.CENTER
            }));

            // 3. Date/Location/Number Line
            const formattedFormationDate = formationDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
            docChildren.push(new Paragraph({
                style: "dateLine",
                tabStops: [ { type: TabStopType.CENTER, position: 4535 }, { type: TabStopType.RIGHT, position: 9070 } ],
                children: [
                    new TextRun(formattedFormationDate),
                    new TextRun({ text: `\t${orderLocation}` }),
                    new TextRun({ text: `\t№ ${orderNumber}` }),
                ],
            }));

            // 4. Body
            const formatDateForBody = (date: Date): string => {
                const day = date.getDate();
                const month = UKRAINIAN_MONTHS_GENITIVE[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };
            const formattedDutyDate = formatDateForBody(dutyDate);

            // Counters Logic
            let mainPointCounter = 0; 
            let subPointCounter = 0;
            
            for (const block of blocks) {
                // Handle Point/Subpoint Headers
                if (!block.isSubPoint) {
                     mainPointCounter++;
                     subPointCounter = 0; // Reset internal counter for new main point
                     
                     let titleText = block.id === 'main' 
                         ? `${mainPointCounter}. ${block.title} на ${formattedDutyDate} року призначити у складі:` 
                         : `${mainPointCounter}. ${block.title}`;
                     
                     docChildren.push(new Paragraph({
                        children: [new TextRun({ text: titleText })],
                        spacing: { after: 120 }
                    }));
                } else {
                    // If it's a text block added as a subpoint, give it a number.
                    // If it's a roster block, the numbering is handled inside the roster loop to account for categories.
                     if (block.type === 'text' && block.title) {
                        subPointCounter++;
                        docChildren.push(new Paragraph({
                            children: [new TextRun({ text: `${mainPointCounter}.${subPointCounter}. ${block.title}` })],
                            spacing: { after: 120 }
                        }));
                    }
                }

                if (block.type === 'text') {
                    if (block.text) {
                         docChildren.push(new Paragraph({
                            children: [new TextRun(block.text)],
                            indent: { firstLine: mmToTwips(12.5) }
                         }));
                    }
                    continue;
                }

                // Roster Generation
                const blockPeople = block.dataSource?.people || people;
                const blockCategories = block.dataSource?.categories || categories;
                const blockSchedules = block.dataSource?.schedules || schedules;
                const blockSubdivisions = block.dataSource?.subdivisions || subdivisions;
                const blockWeapons = block.dataSource?.weapons || weapons;
                
                const dutiesForBlock = getDutiesForDate(dutyDate, blockSchedules, blockCategories, blockPeople);
                
                if (dutiesForBlock.length > 0) {
                     
                     const sortedParentCategories = blockCategories
                        .filter(c => !c.parentId && !c.deletedTimestamp)
                        .sort((a,b) => a.order - b.order);
                     
                     for (const parent of sortedParentCategories) {
                        const children = blockCategories
                            .filter(c => c.parentId === parent.id && !c.deletedTimestamp)
                            .sort((a,b) => a.order - b.order);

                        const categoryGroup = [parent, ...children];
                        
                        let hasDutiesInGroup = false;
                        let isFirstInCategoryGroup = true;

                        for (const category of categoryGroup) {
                            const peopleInThisCategory = dutiesForBlock.filter(d => d.category.id === category.id).map(d => d.person);
                            
                            if (peopleInThisCategory.length === 0) continue;
                            hasDutiesInGroup = true;

                             const personnelStrings = peopleInThisCategory.map(person => {
                                const position = toLowerCaseWithExceptions(formatHierarchicalPositionForRoster(person, blockSubdivisions));
                                const weapon = blockWeapons.find(w => w.personId === person.id);
                                
                                let weaponDetails = '';
                                if(weapon) {
                                    const ammoCount = category.weaponAssignment?.ammoCount;
                                    const ammoType = category.weaponAssignment?.ammoType;
                                    weaponDetails = `(${weapon.type} № ${weapon.serialNumber}${ammoCount ? `, набої ${ammoType || ''} – ${ammoCount} шт` : ''})`;
                                }

                                const lastName = person.lastName || '';
                                const firstName = person.firstName || '';
                                const patronymic = person.patronymic || '';
                                const firstInitial = firstName.trim() ? `${firstName.trim().charAt(0)}.` : '';
                                const patronymicInitial = patronymic.trim() ? `${patronymic.trim().charAt(0)}.` : '';
                                const initials = [firstInitial, patronymicInitial].filter(Boolean).join('');
                                
                                return `${position} ${toLowerCaseWithExceptions(person.rank)} ${lastName.toUpperCase()} ${initials} ${weaponDetails}`.trim();
                            });

                            let fullText = `${category.name} – ${personnelStrings.join(', ')}`;

                            if (isFirstInCategoryGroup) {
                                 // Assign a sub-number to the group start
                                 subPointCounter++;
                                docChildren.push(new Paragraph({
                                    children: [new TextRun({ text: `${mainPointCounter}.${subPointCounter}. ${fullText}`})],
                                }));
                                isFirstInCategoryGroup = false;
                            } else {
                                docChildren.push(new Paragraph({
                                    children: [new TextRun(fullText)],
                                    indent: { firstLine: mmToTwips(12.5) }
                                }));
                            }
                        }
                        
                         if (hasDutiesInGroup) {
                             docChildren.push(new Paragraph({ style: "noIndent", text: "" }));
                         }
                     }
                }
            }

            // 5. Footer
            docChildren.push(new Paragraph({
                children: [new TextRun("Добовий наряд озброюється за окремим розпорядженням чергового частини.")],
                spacing: { before: 120, after: 0 } // Remove after spacing here
            }));

            // 6. Signature Block
            const commanderRole = commander.isActing ? `ТВО командира військової частини ${commander.unitNumber}` : `Командир військової частини ${commander.unitNumber}`;
            
            // Add specific spacing before the signature block
            docChildren.push(new Paragraph({
                style: "signature",
                tabStops: [{ type: TabStopType.RIGHT, position: 9638 }],
                children: [
                     new TextRun({ text: commanderRole }),
                ],
                spacing: { before: 720, after: 0, line: 240 } // ~3 lines spacing (720 twips)
            }));
            docChildren.push(new Paragraph({
                style: "signature",
                tabStops: [{ type: TabStopType.RIGHT, position: 9638 }],
                children: [
                    new TextRun({ text: toLowerCaseWithExceptions(commander.rank) }),
                    new TextRun({ text: `\t${commander.name}` })
                ]
            }));

            // Document generation
            const doc = new Document({
                styles: {
                    default: {
                        document: { 
                            run: { size: 28, font: "Times New Roman" },
                            paragraph: { spacing: { after: 0, before: 0, line: 240 }, alignment: AlignmentType.JUSTIFIED, indent: { firstLine: mmToTwips(12.5) } },
                        },
                    },
                    paragraphStyles: [
                        { id: "docHeader", name: "Doc Header", basedOn: "Normal", next: "Normal", run: { bold: true }, paragraph: { alignment: AlignmentType.CENTER, indent: { firstLine: 0 }, spacing: { after: 300 } } },
                        { id: "docSubHeader", name: "Doc SubHeader", basedOn: "Normal", next: "Normal", paragraph: { alignment: AlignmentType.CENTER, indent: { firstLine: 0 }, spacing: { after: 100 } } },
                        { id: "dateLine", name: "Date Line", basedOn: "Normal", next: "Normal", paragraph: { indent: { firstLine: 0 }, spacing: { after: 600 }, alignment: AlignmentType.LEFT } },
                        { id: "noIndent", name: "No Indent", basedOn: "Normal", next: "Normal", paragraph: { indent: { firstLine: 0 } } },
                         { id: "signature", name: "Signature", basedOn: "Normal", next: "Normal", paragraph: { indent: { firstLine: 0 } } } 
                    ]
                },
                sections: [{ properties: { page: { margin: { top: mmToTwips(15), right: mmToTwips(10), bottom: mmToTwips(15), left: mmToTwips(30) } } }, children: docChildren }],
            });
            
            const orderNumOnly = parseInt(orderNumber.replace(/\D/g, ''), 10);
            if (!isNaN(orderNumOnly)) { setLastOrderNumber(orderNumOnly); }
            const filename = `наказ по наряду №${orderNumber} від ${formattedFormationDate}.docx`;

            Packer.toBlob(doc).then(blob => {
                saveAs(blob, filename);
                showToast("Формування наказу завершено.");
            });

        } catch (error) {
            console.error("Failed to generate order:", error);
            showToast(`Не вдалося сформувати наказ: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    
    // Weekly Text Logic
    const WeeklyRosterView = () => {
        const startDate = weekStartDate;
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
        const weekdays = ['НЕДІЛЯ', 'ПОНЕДІЛОК', 'ВІВТОРОК', 'СЕРЕДА', 'ЧЕТВЕР', "П'ЯТНИЦЯ", 'СУБОТА'];
        const weekdaysLower = ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', "п'ятницю", 'суботу'];
        
        const activeCategories = categories.filter(c => !c.deletedTimestamp);
        const header = `🟢 До уваги наряд на тиждень (${formatDate(startDate)} ${weekdaysLower[startDate.getDay()]} - ${formatDate(endDate)} ${weekdaysLower[endDate.getDay()]}):`;

        const weeklyDuties: { [date: string]: { person: Person; category: Category }[] } = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateString = d.toISOString().split('T')[0];
            weeklyDuties[dateString] = getDutiesForDate(d, schedules, activeCategories, people);
        }
        
        const parentCategories = activeCategories.filter(c => !c.parentId && !c.deletedTimestamp);
        
        const renderSection = (title: string, lines: string[]) => (
             <div className="bg-secondary p-3 rounded-lg border border-border-color space-y-2">
                <div className="flex justify-between items-start">
                     <h4 className="font-bold text-header">{title}</h4>
                     <button onClick={() => copyToClipboard(`${title}\n${lines.join('\n')}`)} className="p-1 text-secondary-text hover:text-accent" title="Копіювати блок"><CopyIcon className="w-4 h-4"/></button>
                </div>
                <ul className="space-y-1">
                    {lines.map((line, idx) => (
                        <li key={idx} className="text-sm text-primary-text font-mono whitespace-pre-wrap flex justify-between items-start group">
                            <span>{line}</span>
                             <button onClick={() => copyToClipboard(line)} className="p-1 text-secondary-text hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity" title="Копіювати рядок"><CopyIcon className="w-3 h-3"/></button>
                        </li>
                    ))}
                </ul>
            </div>
        );

        return (
             <div className="space-y-4">
                <div className="bg-card p-4 rounded-lg border border-border-color flex justify-between items-center">
                    <h2 className="text-lg font-bold text-header">{header}</h2>
                    <button onClick={() => copyToClipboard(header)} className="p-2 rounded-full hover:bg-secondary transition-colors"><CopyIcon/></button>
                </div>
                
                {parentCategories.map(parent => {
                    const children = activeCategories.filter(c => c.parentId === parent.id);
                    const childIds = children.map(c => c.id);
                    const categoryIdsInGroup = [parent.id, ...childIds];

                    const lines: string[] = [];

                    for (let i = 0; i < 7; i++) {
                        const d = new Date(startDate);
                        d.setDate(startDate.getDate() + i);
                        const dateString = d.toISOString().split('T')[0];
                        const dutiesForDay = weeklyDuties[dateString];
                        
                        const parentDuties = dutiesForDay.filter(duty => duty.category.id === parent.id);
                        const childDuties = dutiesForDay.filter(duty => childIds.includes(duty.category.id));

                        if (parentDuties.length > 0 || childDuties.length > 0) {
                            const getLastName = (p: Person) => p.fullName.split(' ')[0].toUpperCase();
                            const parentNames = parentDuties.map(d => getLastName(d.person)).join(', ');
                            const childNames = childDuties.map(d => getLastName(d.person)).join(', ');
                            
                            let line = `${formatDate(d)} ${weekdays[d.getDay()]} - `;
                            if (parentNames && childNames) {
                                line += `${parentNames} -- ${childNames}`;
                            } else if (parentNames) {
                                line += parentNames;
                            } else if (childNames) {
                                line += childNames;
                            }
                            lines.push(line);
                        }
                    }
                    
                    if (lines.length > 0) {
                        return <div key={parent.id}>{renderSection(`⚜ ${parent.groupName || parent.name} ⚜`, lines)}</div>;
                    }
                    return null;
                })}
             </div>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <h1 className="text-3xl font-bold text-header">Формування</h1>
            <div className="flex border-b border-border-color px-2">
                <button onClick={() => setActiveTab('order')} className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'order' ? 'border-b-2 border-accent text-header' : 'text-secondary-text hover:text-primary-text'}`}>Наказ</button>
                <button onClick={() => setActiveTab('weekly-text')} className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'weekly-text' ? 'border-b-2 border-accent text-header' : 'text-secondary-text hover:text-primary-text'}`}>Доведення</button>
            </div>
            
            {isAddingBlock && <AddBlockModal onClose={() => setIsAddingBlock(false)} onAdd={handleAddBlock} />}

            {activeTab === 'order' && (
                <div className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2">
                     <div className="bg-card p-4 rounded-xl border border-border-color space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-secondary-text mb-1">Дата формування (шапка)</label>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setFormationDate(d => new Date(d.setDate(d.getDate() - 1)))} className="p-1 rounded-full hover:bg-secondary"><ChevronLeftIcon className="w-4 h-4"/></button>
                                    <input type="date" value={formationDate.toISOString().split('T')[0]} onChange={e => setFormationDate(new Date(e.target.value))} className="bg-secondary p-2 rounded-md border border-border-color flex-grow"/>
                                    <button onClick={() => setFormationDate(d => new Date(d.setDate(d.getDate() + 1)))} className="p-1 rounded-full hover:bg-secondary"><ChevronRightIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary-text mb-1">Дата наряду (в тексті)</label>
                                <div className="flex items-center gap-2">
                                     <button onClick={() => setDutyDate(d => new Date(d.setDate(d.getDate() - 1)))} className="p-1 rounded-full hover:bg-secondary"><ChevronLeftIcon className="w-4 h-4"/></button>
                                    <input type="date" value={dutyDate.toISOString().split('T')[0]} onChange={e => setDutyDate(new Date(e.target.value))} className="bg-secondary p-2 rounded-md border border-border-color flex-grow"/>
                                     <button onClick={() => setDutyDate(d => new Date(d.setDate(d.getDate() + 1)))} className="p-1 rounded-full hover:bg-secondary"><ChevronRightIcon className="w-4 h-4"/></button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Номер наказу" className="bg-secondary p-2 rounded-md border border-border-color"/>
                            <input type="text" value={orderLocation} onChange={e => setOrderLocation(e.target.value)} placeholder="Місце" className="bg-secondary p-2 rounded-md border border-border-color"/>
                             <input type="text" value={commander.unitNumber} onChange={e => setCommander(prev => ({...prev, unitNumber: e.target.value}))} placeholder="№ Частини (А1363)" className="bg-secondary p-2 rounded-md border border-border-color"/>
                        </div>
                         <div className="bg-secondary/30 p-3 rounded-lg border border-border-color">
                             <label className="block text-xs font-bold text-secondary-text mb-2 uppercase">Командування</label>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={commander.isActing} onChange={e => setCommander(prev => ({...prev, isActing: e.target.checked}))} className="text-accent focus:ring-accent" />
                                    <span className="text-sm text-primary-text">ТВО</span>
                                </div>
                                <input type="text" value={commander.rank} onChange={e => setCommander(prev => ({...prev, rank: e.target.value}))} placeholder="Звання (полковник)" className="bg-primary p-2 rounded-md border border-border-color text-sm"/>
                                <input type="text" value={commander.name} onChange={e => setCommander(prev => ({...prev, name: e.target.value}))} placeholder="ПІБ (Віктор ВОЛОХОСЬКИЙ)" className="bg-primary p-2 rounded-md border border-border-color text-sm"/>
                             </div>
                         </div>
                     </div>

                    {blocks.map((block, index) => (
                        <div key={block.id} className="relative group">
                             <RosterBlock block={block} people={people} categories={categories} schedules={schedules} dutyDate={dutyDate} />
                             {index > 0 && (
                                <button onClick={() => setBlocks(prev => prev.filter(b => b.id !== block.id))} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-card rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                             )}
                        </div>
                    ))}
                    
                    <button onClick={() => setIsAddingBlock(true)} className="w-full flex justify-center items-center gap-2 p-4 bg-secondary rounded-lg border-2 border-dashed border-border-color hover:border-accent hover:text-accent transition-colors">
                        <PlusIcon /> Додати запис
                    </button>

                    <div className="sticky bottom-4 bg-card p-4 rounded-xl border border-border-color shadow-xl mt-4">
                         <button onClick={handleGenerateAndDownloadOrder} className="w-full bg-accent text-white px-4 py-3 rounded-lg hover:bg-accent-hover font-bold text-lg shadow-lg flex justify-center items-center gap-3">
                             <PrintIcon className="w-6 h-6"/> Сформувати файл наказу (.docx)
                         </button>
                    </div>
                </div>
            )}
            
            {activeTab === 'weekly-text' && (
                <div className="flex-grow flex flex-col space-y-4 h-full">
                     <div className="p-4 bg-card rounded-xl border border-border-color flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h2 className="text-xl font-bold text-header">Наряд на тиждень</h2>
                         <div className="flex items-center space-x-2">
                            <button onClick={() => changeWeek(-1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronLeftIcon /></button>
                            <h3 className="text-base font-semibold text-header text-center w-48">
                                {`${weekStartDate.toLocaleDateString('uk-UA')} - ${new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 6)).toLocaleDateString('uk-UA')}`}
                            </h3>
                            <button onClick={() => changeWeek(1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronRightIcon /></button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                         <WeeklyRosterView />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Formation;