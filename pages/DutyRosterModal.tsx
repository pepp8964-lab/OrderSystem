import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Person, Category, ScheduleData, DutyStatus, Weapon, Subdivision } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, PrintIcon, CopyIcon, PhoneIcon } from '../components/icons/Icons';
import useLocalStorage from '../hooks/useLocalStorage';
import { useToast } from '../context/ThemeContext';
import { formatHierarchicalPositionForRoster } from './People';

interface DutyRosterModalProps {
    onClose: () => void;
    people: Person[];
    categories: Category[];
    schedules: ScheduleData;
    subdivisions: Subdivision[];
}

const DutyRosterModal: React.FC<DutyRosterModalProps> = ({ onClose, people, categories, schedules, subdivisions }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [weaponGroupOverrides, setWeaponGroupOverrides] = useLocalStorage<Record<string, Record<string, number>>>('weapon-group-overrides', {});
    const [rosterView, setRosterView] = useState<'daily' | 'weekly-text'>('daily');
    const { showToast } = useToast();
    
    const getWeekTuesdayDate = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay(); // Sun: 0, Mon: 1, Tue: 2, ...
        const offset = day >= 2 ? -(day - 2) : -(day + 5);
        date.setDate(date.getDate() + offset);
        return date;
    };

    const [weekStartDate, setWeekStartDate] = useState(getWeekTuesdayDate(new Date()));

    const activePeople = useMemo(() => people.filter(p => !p.deletedTimestamp), [people]);
    const activeCategories = useMemo(() => {
        const allCategories = categories.filter(c => !c.deletedTimestamp);
        return allCategories.sort((a,b) => a.order - b.order);
    }, [categories]);

    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const activeWeapons = useMemo(() => weapons.filter(w => !w.deletedTimestamp), [weapons]);
    const peopleMap = useMemo(() => new Map(activePeople.map(p => [p.id, p])), [activePeople]);
    const weaponsMap = useMemo(() => new Map(activeWeapons.map(w => [w.id, w])), [activeWeapons]);

    const getDayOfYear = (date: Date) => {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    };

    const getDutiesForDate = useCallback((date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        const duties: { person: Person; category: Category }[] = [];
        for (const categoryId in schedules) {
            const categorySchedule = schedules[categoryId]?.[yearMonth];
            if (categorySchedule) {
                for (const personId in categorySchedule) {
                    if (categorySchedule[personId]?.[day] === DutyStatus.ON_DUTY) {
                        const person = peopleMap.get(personId);
                        const category = activeCategories.find(c => c.id === categoryId);
                        if (person && category) {
                            duties.push({ person, category });
                        }
                    }
                }
            }
        }
        return duties;
    }, [schedules, peopleMap, activeCategories]);
    
    const getWeaponForPersonOnDuty = useCallback((person: Person, category: Category, date: Date, forUsageCheck: boolean = false): Weapon | null => {
        const assignment = category.weaponAssignment;
        if (!assignment || assignment.type === 'none') return null;

        const personalWeapon = activeWeapons.find(w => w.personId === person.id);
        if(assignment.type === 'personal' || personalWeapon) return personalWeapon;

        if ((assignment.type === 'public' || assignment.type === 'reserve') && assignment.groups) {
            if (assignment.takeFree && !forUsageCheck) {
                const yesterday = new Date(date);
                yesterday.setDate(yesterday.getDate() - 1);
                const dutiesToday = getDutiesForDate(date);
                const dutiesYesterday = getDutiesForDate(yesterday);
                const weaponsUsedToday = new Set(dutiesToday.map(d => getWeaponForPersonOnDuty(d.person, d.category, date, true)?.id).filter(Boolean));
                const weaponsUsedYesterday = new Set(dutiesYesterday.map(d => getWeaponForPersonOnDuty(d.person, d.category, yesterday, true)?.id).filter(Boolean));
                
                const assignmentTypes: Weapon['assignmentType'][] = ['громадська'];
                if(assignment.type === 'public' && assignment.useReserve) {
                    assignmentTypes.push('резервна');
                }

                const freeWeapon = activeWeapons.find(w => 
                    assignmentTypes.includes(w.assignmentType) &&
                    (!assignment.requiredWeaponType || w.type === assignment.requiredWeaponType) &&
                    !w.personId &&
                    !weaponsUsedToday.has(w.id) &&
                    !weaponsUsedYesterday.has(w.id)
                );
                return freeWeapon || null;
            }

            const dayOfYear = getDayOfYear(date);
            const dateString = date.toISOString().split('T')[0];
            const override = weaponGroupOverrides[dateString]?.[category.id];

            let groupIndex = override !== undefined ? override : 0;
            
            if (override === undefined) {
                switch (assignment.rotationType) {
                    case 'daily': groupIndex = (dayOfYear - 1) % 3; break;
                    case 'every_other_day': groupIndex = Math.floor((dayOfYear - 1) / 2) % 2; // Corrected logic
                    case 'static': default: groupIndex = 0; break;
                }
            }

            const group = assignment.groups[groupIndex];
            if (!group || group.weapons.length === 0) return null;

            const peopleOnDutyThatDayForCategory = getDutiesForDate(date).filter(d => d.category.id === category.id);
            const personIndex = peopleOnDutyThatDayForCategory.findIndex(d => d.person.id === person.id);

            if (personIndex !== -1 && group.weapons[personIndex]) {
                return weaponsMap.get(group.weapons[personIndex]) || null;
            }
        }
        return null;
    }, [activeWeapons, getDutiesForDate, weaponGroupOverrides, weaponsMap]);
    
    const dutiesForViewDate = useMemo(() => getDutiesForDate(viewDate), [viewDate, getDutiesForDate]);

    const groupedDuties = useMemo(() => {
        const categoryMap = new Map(activeCategories.map(c => [c.id, c]));
        const groups = new Map<string, { parent: Category; duties: { person: Person; category: Category, weapon: Weapon | null }[] }>();
        dutiesForViewDate.forEach(({ person, category }) => {
            let parent = category.parentId ? categoryMap.get(category.parentId) : category;
             if (parent && !parent.deletedTimestamp) {
                if (!groups.has(parent.id)) {
                    groups.set(parent.id, { parent, duties: [] });
                }
                const weapon = getWeaponForPersonOnDuty(person, category, viewDate);
                groups.get(parent.id)!.duties.push({ person, category, weapon });
            }
        });
        return Array.from(groups.values()).sort((a, b) => a.parent.order - b.parent.order);
    }, [dutiesForViewDate, activeCategories, viewDate, getWeaponForPersonOnDuty]);


     const changeViewDate = (offset: number) => {
        setViewDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + offset);
            return newDate;
        });
    };
    
     const handleGroupChange = (categoryId: string, groupIndex: number) => {
        const dateString = viewDate.toISOString().split('T')[0];
        setWeaponGroupOverrides(prev => {
            const newOverrides = { ...prev };
            if (!newOverrides[dateString]) newOverrides[dateString] = {};
            newOverrides[dateString][categoryId] = groupIndex;
            return newOverrides;
        });
    };

    const handlePrint = () => {
        const title = `Добовий наряд на ${viewDate.toLocaleDateString('uk-UA')}`;
        const styles = `
            body { font-family: sans-serif; margin: 20px; }
            h1, h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        `;
        let content = `<h1>${title}</h1>`;
        
        groupedDuties.forEach(({ parent, duties }) => {
            content += `<h2>${parent.groupName || parent.name}</h2>`;
            content += `<table>
                <thead><tr><th>#</th><th>Звання та ПІБ</th><th>Посада</th><th>Зброя</th><th>Патрони</th></tr></thead>
                <tbody>`;
            duties.forEach(({ person, category, weapon }, index) => {
                const ammoCount = category.weaponAssignment?.ammoCount;
                const ammoType = category.weaponAssignment?.ammoType;
                const fullName = `${person.lastName || ''} ${person.firstName || ''} ${person.patronymic || ''}`.trim();
                const fullPosition = formatHierarchicalPositionForRoster(person, subdivisions).toLowerCase();
                content += `<tr>
                    <td>${index + 1}</td>
                    <td>${person.rank.toLowerCase()} ${fullName} ${person.phone ? `<br><small>${person.phone}</small>` : ''}</td>
                    <td>${fullPosition}</td>
                    <td>${weapon ? `${weapon.type} №${weapon.serialNumber}` : 'Без зброї'}</td>
                    <td>${weapon && ammoCount ? `${ammoCount} (${ammoType || '?'})` : '-'}</td>
                </tr>`;
            });
            content += `</tbody></table>`;
        });
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>${title}</title><style>${styles}</style></head><body>${content}</body></html>`);
            printWindow.document.close();
            printWindow.print();
        }
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

        const header = `🟢 До уваги наряд на тиждень (${formatDate(startDate)} ${weekdaysLower[startDate.getDay()]} - ${formatDate(endDate)} ${weekdaysLower[endDate.getDay()]}):\n\n`;

        const weeklyDuties: { [date: string]: { person: Person; category: Category }[] } = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateString = d.toISOString().split('T')[0];
            weeklyDuties[dateString] = getDutiesForDate(d);
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

    }, [weekStartDate, getDutiesForDate, activeCategories]);
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Текст скопійовано до буферу обміну.");
        }, () => {
            showToast("Не вдалося скопіювати текст.");
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex border-b border-border-color px-2">
                    <button onClick={() => setRosterView('daily')} className={`px-4 py-3 text-sm font-medium transition-colors ${rosterView === 'daily' ? 'border-b-2 border-accent text-header' : 'text-secondary-text hover:text-primary-text'}`}>Добовий наряд</button>
                    <button onClick={() => setRosterView('weekly-text')} className={`px-4 py-3 text-sm font-medium transition-colors ${rosterView === 'weekly-text' ? 'border-b-2 border-accent text-header' : 'text-secondary-text hover:text-primary-text'}`}>Текст на тиждень</button>
                </div>
               
                {rosterView === 'daily' && (
                    <>
                        <div className="p-4 border-b border-border-color flex justify-between items-center">
                            <h2 className="text-xl font-bold text-header">Добовий наряд</h2>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => changeViewDate(-1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronLeftIcon /></button>
                                <h3 className="text-lg font-semibold text-header text-center w-64">{viewDate.toLocaleDateString('uk-UA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                                <button onClick={() => changeViewDate(1)} className="p-2 rounded-full hover:bg-secondary transition-colors"><ChevronRightIcon /></button>
                            </div>
                            <button onClick={handlePrint} className="p-2 rounded-full hover:bg-secondary transition-colors" title="Друк"><PrintIcon/></button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-4">
                            {groupedDuties.length > 0 ? (
                                groupedDuties.map(({ parent, duties }) => (
                                    <div key={parent.id} className="bg-secondary p-3 rounded-lg border border-border-color">
                                        <h4 className="font-bold text-header mb-2">{parent.groupName || parent.name}</h4>
                                        <div className="space-y-2">
                                            {duties.map(({ person, category, weapon }) => {
                                                const fullName = `${person.lastName || ''} ${person.firstName || ''} ${person.patronymic || ''}`.trim();
                                                const fullPosition = formatHierarchicalPositionForRoster(person, subdivisions).toLowerCase();
                                                return (
                                                    <div key={person.id + category.id} className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <p className="text-primary-text">{person.rank.toLowerCase()} {fullName}</p>
                                                            <p className="text-xs text-secondary-text">
                                                                {fullPosition}
                                                            </p>
                                                            <p className="text-xs text-secondary-text flex items-center gap-1">
                                                                <PhoneIcon className="w-3 h-3" />
                                                                {person.phone || 'немає номеру'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right text-sm">
                                                            <p className="text-primary-text">{weapon ? `${weapon.type} №${weapon.serialNumber}` : 'Без зброї'}</p>
                                                            <p className="text-xs text-secondary-text">
                                                                {weapon && category.weaponAssignment?.ammoCount ? `${category.weaponAssignment.ammoCount} шт. (${category.weaponAssignment.ammoType || '?'})` : ''}
                                                            </p>
                                                            {category.weaponAssignment?.type === 'public' && !category.weaponAssignment.takeFree && (
                                                                <div className="flex gap-1 justify-end mt-1">
                                                                    {[0,1,2].map(i => (
                                                                        <button key={i} onClick={() => handleGroupChange(category.id, i)} className={`w-5 h-5 text-xs rounded ${weaponGroupOverrides[viewDate.toISOString().split('T')[0]]?.[category.id] === i ? 'bg-accent text-white' : 'bg-primary'}`}>{i+1}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-secondary-text text-center py-4">На вибрану дату немає нікого в наряді.</p>
                            )}
                        </div>
                    </>
                )}

                {rosterView === 'weekly-text' && (
                    <>
                         <div className="p-4 border-b border-border-color flex justify-between items-center">
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
                         <div className="p-4 overflow-y-auto">
                            <textarea
                                readOnly
                                value={weeklyRosterText}
                                className="w-full h-96 bg-secondary text-primary-text p-3 rounded-md border border-border-color font-mono text-sm whitespace-pre"
                                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                            />
                        </div>
                    </>
                )}
                 <div className="flex justify-end p-4 border-t border-border-color">
                    <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Закрити</button>
                </div>
            </div>
        </div>
    );
};

export default DutyRosterModal;