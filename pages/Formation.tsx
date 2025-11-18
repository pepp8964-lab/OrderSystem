import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Person, Category, ScheduleData, DutyStatus, Weapon, Subdivision, AllData } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PrintIcon, CopyIcon, PhoneIcon, PlusIcon } from '../components/icons/Icons';
import useLocalStorage from '../hooks/useLocalStorage';
import { useToast } from '../context/ThemeContext';
import { formatHierarchicalPositionForRoster } from './People';
import { UKRAINIAN_MONTHS_GENITIVE } from '../constants';
import * as docx from 'docx';

declare const saveAs: any;

const mmToTwips = (mm: number) => Math.round(mm * 56.7);

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
};

const AddBlockModal: React.FC<{
    onClose: () => void;
    onAdd: (block: Omit<RosterBlockData, 'id' | 'type'>) => void;
}> = ({ onClose, onAdd }) => {
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
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
            showToast("Будь ласка, введіть назву підпункту.");
            return;
        }
        onAdd({ title, text, dataSource: fileData });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[100] p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Додати блок до наказу</h2></div>
                <div className="p-4 space-y-4">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Назва підпункту" className="w-full bg-secondary p-2 rounded-md border border-border-color"/>
                    <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Додатковий текст (необов'язково)" className="w-full bg-secondary p-2 rounded-md border border-border-color h-24"/>
                    <div>
                         <label className="w-full text-center cursor-pointer bg-secondary p-3 rounded-md border border-border-color hover:bg-primary block">
                             {fileName ? `Файл: ${fileName}` : "Вибрати комплексний файл підрозділу"}
                             <input type="file" onChange={handleFileChange} accept=".json" className="hidden" />
                         </label>
                    </div>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-border-color">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скасувати</button>
                    <button onClick={handleAdd} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Додати</button>
                </div>
            </div>
        </div>
    );
};


const Formation: React.FC = () => {
    const [viewDate, setViewDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState<'order' | 'weekly-text'>('order');
    const { showToast } = useToast();
    
    // Global data from this app's context
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [schedules] = useLocalStorage<ScheduleData>('schedules', {});
    const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [unitName] = useLocalStorage<string>('unitName', '');

    // Order generation state
    const [orderLocation, setOrderLocation] = useState('с. Орлівщина');
    const [lastOrderNumber, setLastOrderNumber] = useLocalStorage<number>('last-order-number', 317);
    const [orderNumber, setOrderNumber] = useState(`${lastOrderNumber + 1} нр`);
    
    const initialBlock: RosterBlockData = { id: 'main', type: 'main', title: unitName || 'Основний підрозділ' };
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
    
    // --- Data processing functions ---
    const getDutiesForDate = useCallback((date: Date, localSchedules: ScheduleData, localCategories: Category[], localPeople: Person[]) => {
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
    }, []);

    const changeViewDate = (offset: number) => {
        setViewDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + offset);
            return newDate;
        });
    };
    
    const changeWeek = (offset: number) => {
        setWeekStartDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + offset * 7);
            return newDate;
        });
    };

    const weeklyRosterText = useMemo(() => {
        const startDate = weekStartDate;
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
        const weekdays = ['НЕДІЛЯ', 'ПОНЕДІЛОК', 'ВІВТОРОК', 'СЕРЕДА', 'ЧЕТВЕР', "П'ЯТНИЦЯ", 'СУБОТА'];
        const weekdaysLower = ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', "п'ятницю", 'суботу'];
        
        const activeCategories = categories.filter(c => !c.deletedTimestamp);
        const header = `🟢 До уваги наряд на тиждень (${formatDate(startDate)} ${weekdaysLower[startDate.getDay()]} - ${formatDate(endDate)} ${weekdaysLower[endDate.getDay()]}):\n\n`;

        const weeklyDuties: { [date: string]: { person: Person; category: Category }[] } = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateString = d.toISOString().split('T')[0];
            weeklyDuties[dateString] = getDutiesForDate(d, schedules, activeCategories, people);
        }
        
        const parentCategories = activeCategories.filter(c => !c.parentId && !c.deletedTimestamp);
        
        let body = '';
        const parentCategoriesWithDuties = parentCategories.filter(parent => {
            const childIds = activeCategories.filter(c => c.parentId === parent.id).map(c => c.id);
            const categoryIdsInGroup = [parent.id, ...childIds];
            return Object.values(weeklyDuties).some(dailyDuties => 
                dailyDuties.some(duty => categoryIdsInGroup.includes(duty.category.id))
            );
        });

        parentCategoriesWithDuties.forEach((parent, index) => {
            const children = activeCategories.filter(c => c.parentId === parent.id);
            const childIds = children.map(c => c.id);
            
            body += `⚜ ${parent.groupName || parent.name} ⚜\n`;

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
                    body += line + '\n';
                }
            }
             if (index < parentCategoriesWithDuties.length - 1) {
                body += '\n';
            }
        });

        return header + body;

    }, [weekStartDate, getDutiesForDate, schedules, categories, people]);
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Текст скопійовано до буферу обміну.");
        }, () => {
            showToast("Не вдалося скопіювати текст.");
        });
    };
    
    const handleAddBlock = (blockData: Omit<RosterBlockData, 'id' | 'type'>) => {
        const newBlock: RosterBlockData = {
            id: crypto.randomUUID(),
            type: blockData.dataSource ? 'external' : 'text',
            ...blockData
        };
        setBlocks(prev => [...prev, newBlock]);
        setIsAddingBlock(false);
    };

    const handleGenerateAndDownloadOrder = async () => {
        const { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType } = docx;

        try {
            const docChildren: docx.Paragraph[] = [];
            
            const orderFormationDate = new Date(viewDate);
            orderFormationDate.setDate(viewDate.getDate() - 1);
            
            const formattedOrderDate = orderFormationDate.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            const formatDateForBody = (date: Date): string => {
                const day = date.getDate();
                const month = UKRAINIAN_MONTHS_GENITIVE[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };
            const formattedDutyDate = formatDateForBody(viewDate);

            docChildren.push(new Paragraph({ style: "docHeader", text: "МІНІСТЕРСТВО ОБОРОНИ УКРАЇНИ" }));
            docChildren.push(new Paragraph({ style: "docHeader", text: "НАКАЗ" }));
            docChildren.push(new Paragraph({ style: "docSubHeader", text: "командира військової частини А1363", spacing: { after: 100 } }));
            docChildren.push(new Paragraph({ style: "docSubHeader", text: "(по стройовій частині)", spacing: { after: 600 } }));

            docChildren.push(new Paragraph({
                style: "dateLine",
                children: [
                    new TextRun(formattedOrderDate),
                    new TextRun({ text: `\t${orderLocation}` }),
                    new TextRun({ text: `\t№ ${orderNumber}` }),
                ],
            }));

            let subPointCounter = 1;
            
            for (const block of blocks) {
                if (block.type === 'text') {
                     docChildren.push(new Paragraph({
                        children: [new TextRun({ text: `${subPointCounter}. ${block.title}`})],
                        spacing: { after: 120 }
                     }));
                     if (block.text) {
                         docChildren.push(new Paragraph({
                            children: [new TextRun(block.text)],
                         }));
                     }
                     subPointCounter++;
                     continue;
                }

                const blockPeople = block.dataSource?.people || people;
                const blockCategories = block.dataSource?.categories || categories;
                const blockSchedules = block.dataSource?.schedules || schedules;
                const blockSubdivisions = block.dataSource?.subdivisions || subdivisions;
                const blockWeapons = block.dataSource?.weapons || weapons;
                
                const dutiesForBlock = getDutiesForDate(viewDate, blockSchedules, blockCategories, blockPeople);
                if (dutiesForBlock.length === 0) continue;

                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: `${subPointCounter}. ${block.title}:` })],
                    spacing: { after: 240 }
                }));

                // ... [The rest of the complex duty roster generation logic]
                let innerCounter = 1;
                const sortedParentCategories = blockCategories.filter(c => !c.parentId && !c.deletedTimestamp).sort((a,b) => a.order - b.order);
                for (const parent of sortedParentCategories) {
                     const dutiesInGroup = dutiesForBlock.filter(d => d.category.parentId === parent.id || d.category.id === parent.id);
                     if (dutiesInGroup.length === 0) continue;

                     const uniqueCategoriesInGroup = dutiesInGroup.reduce((acc, duty) => {
                        if (!acc.find(c => c.id === duty.category.id)) { acc.push(duty.category); }
                        return acc;
                    }, [] as Category[]).sort((a,b) => a.order - b.order);

                    let isFirstInCategoryGroup = true;

                    for (const category of uniqueCategoriesInGroup) {
                        const peopleInThisCategory = dutiesForBlock.filter(d => d.category.id === category.id).map(d => d.person);
                        if (peopleInThisCategory.length === 0) continue;
                        
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
                        
                        let fullText = `${toLowerCaseWithExceptions(category.name)} – ${personnelStrings.join(', ')}`;

                        if (isFirstInCategoryGroup) {
                            docChildren.push(new Paragraph({
                                children: [new TextRun({ text: `${subPointCounter}.${innerCounter}. ${fullText}`})],
                            }));
                            isFirstInCategoryGroup = false;
                        } else {
                            docChildren.push(new Paragraph({
                                children: [new TextRun(fullText)],
                            }));
                        }
                    }
                     docChildren.push(new Paragraph({ style: "noIndent", text: "" }));
                     innerCounter++;
                }
                subPointCounter++;
            }

            const doc = new docx.Document({
                styles: {
                    default: {
                        document: { run: { size: 28, font: "Times New Roman" } },
                        paragraph: { spacing: { after: 0, before: 0, line: 240 }, alignment: AlignmentType.JUSTIFIED, indent: { firstLine: mmToTwips(12.5) } },
                    },
                    paragraphStyles: [
                        { id: "docHeader", name: "Doc Header", basedOn: "Normal", next: "Normal", run: { bold: true }, paragraph: { alignment: AlignmentType.CENTER, indent: { firstLine: 0 }, spacing: { after: 300 } } },
                        { id: "docSubHeader", name: "Doc SubHeader", basedOn: "Normal", next: "Normal", paragraph: { alignment: AlignmentType.CENTER, indent: { firstLine: 0 }, spacing: { after: 100 } } },
                        { id: "dateLine", name: "Date Line", basedOn: "Normal", next: "Normal", paragraph: { indent: { firstLine: 0 }, tabStops: [ { type: TabStopType.CENTER, position: 4535 }, { type: TabStopType.RIGHT, position: 9070 } ], spacing: { after: 600 }, alignment: AlignmentType.LEFT } },
                        { id: "noIndent", name: "No Indent", basedOn: "Normal", next: "Normal", paragraph: { indent: { firstLine: 0 } } }
                    ]
                },
                sections: [{ properties: { page: { margin: { top: mmToTwips(15), right: mmToTwips(10), bottom: mmToTwips(15), left: mmToTwips(30) } } }, children: docChildren }],
            });
            
            const orderNumOnly = parseInt(orderNumber.replace(/\D/g, ''), 10);
            if (!isNaN(orderNumOnly)) { setLastOrderNumber(orderNumOnly); }
            const filename = `наказ по наряду №${orderNumber} від ${formattedOrderDate}.docx`;

            Packer.toBlob(doc).then(blob => {
                saveAs(blob, filename);
                showToast("Формування наказу завершено.");
            });

        } catch (error) {
            console.error("Failed to generate order:", error);
            showToast(`Не вдалося сформувати наказ: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    
    const RosterBlock = ({ block }: { block: RosterBlockData }) => {
        const dutiesForBlock = useMemo(() => {
            const blockPeople = block.dataSource?.people || people;
            const blockCategories = block.dataSource?.categories || categories;
            const blockSchedules = block.dataSource?.schedules || schedules;
            const allDuties = getDutiesForDate(viewDate, blockSchedules, blockCategories, blockPeople);
            return allDuties.filter(duty => duty.person && duty.person.type !== 'subdivision');
        }, [viewDate, block, people, categories, schedules, getDutiesForDate]);

        return (
            <div className="bg-secondary p-3 rounded-lg border border-border-color">
                <h3 className="text-xl font-bold text-header mb-2">{block.title}</h3>
                {block.type === 'text' ? (
                    <p className="text-primary-text whitespace-pre-wrap">{block.text}</p>
                ) : dutiesForBlock.length > 0 ? (
                    <table className="w-full text-left text-sm">
                        <thead><tr className="border-b border-border-color"><th className="p-1">ПІБ</th><th className="p-1">Посада</th><th className="p-1">Категорія</th></tr></thead>
                        <tbody>
                            {dutiesForBlock.map(({person, category}) => (
                                <tr key={person.id + category.id} className="border-t border-border-color/50">
                                    <td className="p-1 font-semibold">{person.fullName}</td>
                                    <td className="p-1 text-xs">{formatHierarchicalPositionForRoster(person, block.dataSource?.subdivisions || subdivisions)}</td>
                                    <td className="p-1 text-xs">{category.shortName}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-secondary-text text-center py-4">Немає нарядів для цього блоку.</p>
                )}
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
                    <div className="p-4 bg-card rounded-xl border border-border-color flex justify-between items-center sticky top-0 z-10">
                        <div className="flex items-center space-x-2">
                            <button onClick={() => changeViewDate(-1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronLeftIcon /></button>
                            <h3 className="text-lg font-semibold text-header text-center w-64">{viewDate.toLocaleDateString('uk-UA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                            <button onClick={() => changeViewDate(1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronRightIcon /></button>
                        </div>
                        <div className="flex gap-2 items-center">
                            <input type="text" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Номер наказу" className="bg-secondary p-2 rounded-md border border-border-color w-28"/>
                            <input type="text" value={orderLocation} onChange={e => setOrderLocation(e.target.value)} placeholder="Місце" className="bg-secondary p-2 rounded-md border border-border-color"/>
                            <button onClick={handleGenerateAndDownloadOrder} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Сформувати</button>
                        </div>
                    </div>
                    {blocks.map(block => <RosterBlock key={block.id} block={block} />)}
                    <button onClick={() => setIsAddingBlock(true)} className="w-full flex justify-center items-center gap-2 p-4 bg-secondary rounded-lg border-2 border-dashed border-border-color hover:border-accent hover:text-accent transition-colors">
                        <PlusIcon /> Додати підпункт
                    </button>
                </div>
            )}
            
            {activeTab === 'weekly-text' && (
                <div className="flex-grow flex flex-col space-y-4">
                     <div className="p-4 bg-card rounded-xl border border-border-color flex justify-between items-center">
                        <h2 className="text-xl font-bold text-header">Наряд на тиждень</h2>
                         <div className="flex items-center space-x-2">
                            <button onClick={() => changeWeek(-1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronLeftIcon /></button>
                            <h3 className="text-base font-semibold text-header text-center">
                                {`${weekStartDate.toLocaleDateString('uk-UA')} - ${new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 6)).toLocaleDateString('uk-UA')}`}
                            </h3>
                            <button onClick={() => changeWeek(1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronRightIcon /></button>
                        </div>
                        <button onClick={() => copyToClipboard(weeklyRosterText)} className="p-2 rounded-full hover:bg-secondary transition-colors" title="Копіювати текст"><CopyIcon/></button>
                    </div>
                     <div className="p-4 bg-card rounded-xl border border-border-color flex-grow">
                        <textarea
                            readOnly
                            value={weeklyRosterText}
                            className="w-full h-full bg-secondary text-primary-text p-3 rounded-md border border-border-color font-mono text-sm whitespace-pre"
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Formation;