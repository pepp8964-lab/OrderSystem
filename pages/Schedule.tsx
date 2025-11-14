import React, { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import useLocalStorage from '../hooks/useLocalStorage';
import { Person, Category, ScheduleData, AllData, AppSettings, Subdivision } from '../types';
import { DutyStatus } from '../constants';
import { UKRAINIAN_MONTHS, DUTY_STATUS_BG_COLORS, DUTY_STATUS_TEXT_COLORS, DUTY_STATUS_FULL_TEXT, DUTY_STATUS_ABBREVIATIONS, UKRAINIAN_WEEKDAYS_SHORT } from '../constants';
import Card from '../components/Card';
import { TrashIcon, PrintIcon, XIcon, SaveIcon, LaboratoryIcon, SyncIcon } from '../components/icons/Icons';
import ConfirmationModal from '../components/ConfirmationModal';
import { useToast, useActionLog } from '../context/ThemeContext';
import { GoogleGenAI, Type } from "@google/genai";
import { defaultSettings } from '../utils/defaults';

type Tool = DutyStatus | 'CLEAR';

type AutofillStats = {
    totalDuties: number;
    lastDuty: number; // Day of the month
};

type ForecastSuggestion = {
    day: number;
    action: 'ADD' | 'REPLACE';
    personToAdd: string;
    personToRemove?: string;
    reason: string;
};

interface AnalysisReport {
    scope: 'month' | 'all';
    problems: { day: number; message: string; level: 'warning' | 'info' }[];
    fairness: {
        totalDuties: number;
        avgDuties: number;
        minDuties: number;
        maxDuties: number;
        mostFrequent: Person[];
        leastFrequent: Person[];
    } | null;
    restPeriods: {
        avgRest: number;
        minRest: { person: Person, days: number } | null;
    } | null;
    weekendDuties: { person: Person, count: number }[] | null;
    suggestions: ForecastSuggestion[] | null;
}

type TrendReport = {
    totalDuties: number;
    structuredCounts: { subdivision: Subdivision; count: number; percentage: number; }[];
} | null;

const Schedule: React.FC = () => {
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [schedules, setSchedules] = useLocalStorage<ScheduleData>('schedules', {});
    const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const { showToast } = useToast();
    const { logAction } = useActionLog();
    const [searchParams] = useSearchParams();
    
    const [settings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);

    const [isAutofillModalOpen, setIsAutofillModalOpen] = useState(false);
    const [isAutofilling, setIsAutofilling] = useState(false);
    const [autofillProgress, setAutofillProgress] = useState(0);
    const [autofillStartDate, setAutofillStartDate] = useState(new Date());
    const [replaceExistingDuties, setReplaceExistingDuties] = useState(false);
    const [autofillAllCategories, setAutofillAllCategories] = useState(false);
    const [autofillMode, setAutofillMode] = useState<'standard' | 'fair'>('standard');
    const [standardDaysToFill, setStandardDaysToFill] = useState<number>(0);

    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
    const [isClearMonthModalOpen, setIsClearMonthModalOpen] = useState(false);
    const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
    const [trendReport, setTrendReport] = useState<TrendReport>(null);
    const [isForecasting, setIsForecasting] = useState(false);

    const tableRef = useRef<HTMLTableElement>(null);
    const tableBodyRef = useRef<HTMLTableSectionElement>(null);
    const boundingBoxes = useRef<Map<string, DOMRect>>(new Map());

    const sortedActiveCategories = useMemo(() => {
        const allCategories = categories.filter(c => !c.deletedTimestamp);
        
        const childrenMap = new Map<string, Category[]>();
        allCategories.forEach(cat => {
            if (cat.parentId) {
                const children = childrenMap.get(cat.parentId) || [];
                children.push(cat);
                childrenMap.set(cat.parentId, children);
            }
        });
    
        childrenMap.forEach(children => children.sort((a, b) => a.order - b.order));
    
        const sortedList: Category[] = [];
        const parentCategories = allCategories
            .filter(c => !c.parentId)
            .sort((a, b) => a.order - b.order);
    
        const addWithChildren = (category: Category) => {
            sortedList.push(category);
            const children = childrenMap.get(category.id);
            if (children) {
                children.forEach(addWithChildren);
            }
        };
    
        parentCategories.forEach(addWithChildren);
    
        return sortedList;
    }, [categories]);
    
    const categoryGroupsForTags = useMemo(() => {
        const parentCategories = sortedActiveCategories.filter(c => !c.parentId).sort((a,b) => a.order - b.order);
        const childMap = new Map<string, Category[]>();
        sortedActiveCategories.forEach(c => {
            if (c.parentId) {
                if (!childMap.has(c.parentId)) {
                    childMap.set(c.parentId, []);
                }
                childMap.get(c.parentId)!.push(c);
            }
        });
    
        childMap.forEach(children => children.sort((a, b) => a.order - b.order));
    
        return parentCategories.map(p => ({
            parent: p,
            children: childMap.get(p.id) || []
        }));
    }, [sortedActiveCategories]);

    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

    useEffect(() => {
        const categoryIdFromUrl = searchParams.get('category');
        if (categoryIdFromUrl && sortedActiveCategories.find(c => c.id === categoryIdFromUrl)) {
            setSelectedCategoryId(categoryIdFromUrl);
        } else if (sortedActiveCategories.length > 0 && !sortedActiveCategories.find(c => c.id === selectedCategoryId)) {
            setSelectedCategoryId(sortedActiveCategories[0].id);
        } else if (sortedActiveCategories.length === 0) {
            setSelectedCategoryId('');
        }
    }, [sortedActiveCategories, selectedCategoryId, searchParams]);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTool, setActiveTool] = useState<Tool>(DutyStatus.ON_DUTY);
    const [rangeStart, setRangeStart] = useState<{ personId: string; day: number } | null>(null);
    const [clearingInfo, setClearingInfo] = useState<{personId: string, day: number} | null>(null);
    const [replacementInfo, setReplacementInfo] = useState<{ day: number; personId: string } | null>(null);
    const [isReplacing, setIsReplacing] = useState<{ day: number; personId: string } | null>(null);
    const [pendingRangeUpdate, setPendingRangeUpdate] = useState<{ personId: string; day1: number; day2: number; status: Tool } | null>(null);
    const [highlightedDays, setHighlightedDays] = useState<number[]>([]);
    const [showArchivedInSchedule, setShowArchivedInSchedule] = useState<boolean>(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

    useEffect(() => {
        const year = searchParams.get('highlightYear');
        const month = searchParams.get('highlightMonth');
        const days = searchParams.get('highlightDay');

        if (year && month && days) {
            setCurrentDate(new Date(parseInt(year), parseInt(month), 1));
            setHighlightedDays(days.split(',').map(Number));
        } else {
            setHighlightedDays([]);
        }
    }, [searchParams]);

    const findDutyOnDay = useCallback((personId: string, date: Date): Category | null => {
        const checkYear = date.getFullYear();
        const checkMonth = date.getMonth();
        const checkDay = date.getDate();
        const checkYearMonth = `${checkYear}-${String(checkMonth + 1).padStart(2, '0')}`;
        
        for (const category of sortedActiveCategories) {
            const categorySchedule = schedules[category.id]?.[checkYearMonth];
            if (categorySchedule && categorySchedule[personId]?.[checkDay] === DutyStatus.ON_DUTY) {
                return category;
            }
        }
        return null;
    }, [schedules, sortedActiveCategories]);
    
    const selectedCategory = useMemo(() => categories.find(c => c.id === selectedCategoryId), [categories, selectedCategoryId]);
    
    const allDutiesMap = useMemo(() => {
        const map = new Map<string, Map<number, { categoryId: string; categoryName: string }>>();
        const allActiveCategories = categories.filter(c => !c.deletedTimestamp);
        const categoryNameMap = new Map(allActiveCategories.map(c => [c.id, c.shortName]));

        for (const [categoryId, categorySchedule] of Object.entries(schedules)) {
            if (!categoryNameMap.has(categoryId)) continue;

            const monthSchedule = categorySchedule?.[yearMonth];
            if (monthSchedule) {
                for (const [personId, personDailySchedule] of Object.entries(monthSchedule)) {
                    if (!map.has(personId)) {
                        map.set(personId, new Map());
                    }
                    const personMap = map.get(personId)!;
                    for (const [day, status] of Object.entries(personDailySchedule)) {
                        if (status === DutyStatus.ON_DUTY) {
                            personMap.set(parseInt(day, 10), { categoryId, categoryName: categoryNameMap.get(categoryId) || '' });
                        }
                    }
                }
            }
        }
        return map;
    }, [schedules, yearMonth, categories]);

    const peopleForCategory = useMemo(() => {
        if (!selectedCategoryId || !selectedCategory) return { active: [], archived: [] };
        
        const peopleMap = new Map(people.map(p => [p.id, p]));

        const calculateAvailability = (person: Person) => {
            let unavailableDays = 0;
            const personSchedule = schedules[selectedCategoryId]?.[yearMonth]?.[person.id] || {};

            for (let day = 1; day <= daysInMonth; day++) {
                let isUnavailable = false;
                const status = personSchedule[day];

                if (status && status !== DutyStatus.AVAILABLE) {
                    isUnavailable = true;
                }

                const otherDuty = allDutiesMap.get(person.id)?.get(day);
                if (otherDuty && otherDuty.categoryId !== selectedCategoryId) {
                    isUnavailable = true;
                }

                const prevDate = new Date(year, month, day - 1);
                const dutyOnPrevDay = findDutyOnDay(person.id, prevDate);
                if (dutyOnPrevDay && !dutyOnPrevDay.allowConsecutiveDuties) {
                    isUnavailable = true;
                }
                
                const nextDate = new Date(year, month, day + 1);
                const dutyOnNextDay = findDutyOnDay(person.id, nextDate);
                if (dutyOnNextDay && !dutyOnNextDay.allowConsecutiveDuties) {
                    isUnavailable = true;
                }

                if (isUnavailable) {
                    unavailableDays++;
                }
            }
            return daysInMonth - unavailableDays;
        };

        const allPeopleForCategory = people.filter(p => p.categoryIds.includes(selectedCategoryId));

        const active = allPeopleForCategory
            .filter(p => !p.deletedTimestamp)
            .map(person => ({ ...person, availableDays: calculateAvailability(person) }))
            .sort((a, b) => {
                 const hasAnyStatusThisMonth = a.availableDays < daysInMonth || b.availableDays < daysInMonth;
                 if (!hasAnyStatusThisMonth) return a.fullName.localeCompare(b.fullName);
                 if (a.availableDays !== b.availableDays) return b.availableDays - a.availableDays;
                 return a.fullName.localeCompare(b.fullName);
            });

        const archived = allPeopleForCategory.filter(p => p.deletedTimestamp);

        return { active, archived };

    }, [people, selectedCategoryId, selectedCategory, schedules, year, month, yearMonth, daysInMonth, allDutiesMap, findDutyOnDay]);
    
    useEffect(() => {
        if (tableBodyRef.current) {
            const newBoxes = new Map<string, DOMRect>();
            const rows = tableBodyRef.current.querySelectorAll('tr[data-person-id]');
            rows.forEach(row => {
                const personId = (row as HTMLElement).dataset.personId;
                if (personId) {
                    newBoxes.set(personId, row.getBoundingClientRect());
                }
            });
            boundingBoxes.current = newBoxes;
        }
    }, [peopleForCategory]);

    useLayoutEffect(() => {
        if (tableBodyRef.current) {
            const rows = tableBodyRef.current.querySelectorAll('tr[data-person-id]');
            rows.forEach(row => {
                const personId = (row as HTMLElement).dataset.personId;
                if (personId) {
                    const oldBox = boundingBoxes.current.get(personId);
                    const newBox = row.getBoundingClientRect();

                    if (oldBox && oldBox.top !== newBox.top) {
                        const dy = oldBox.top - newBox.top;
                        requestAnimationFrame(() => {
                            (row as HTMLElement).style.transform = `translateY(${dy}px)`;
                            (row as HTMLElement).style.transition = 'transform 0s';

                            requestAnimationFrame(() => {
                                (row as HTMLElement).style.transform = '';
                                (row as HTMLElement).style.transition = 'transform 300ms ease-in-out';
                            });
                        });
                    }
                }
            });
        }
    }, [peopleForCategory]);

    useEffect(() => {
        if (!settings.highlightOnHover || !tableRef.current) return;

        const table = tableRef.current;
        const cleanupClasses = () => {
            table.querySelectorAll('.schedule-highlight-row-hover, .schedule-highlight-col-hover').forEach(el => {
                el.classList.remove('schedule-highlight-row-hover', 'schedule-highlight-col-hover');
            });
        };

        const handleMouseOver = (e: MouseEvent) => {
            const cell = (e.target as HTMLElement).closest('td');
            if (!cell || !table.contains(cell) || cell.classList.contains('sticky')) return;
    
            cleanupClasses();
    
            const row = cell.parentElement as HTMLTableRowElement;
            const colIndex = cell.cellIndex;
    
            row.classList.add('schedule-highlight-row-hover');
            
            Array.from(table.rows).forEach((r: HTMLTableRowElement) => {
                if (r.cells[colIndex]) {
                    r.cells[colIndex].classList.add('schedule-highlight-col-hover');
                }
            });
        };
    
        const handleMouseLeave = (e: MouseEvent) => {
            if (!table.contains(e.relatedTarget as Node)) {
                cleanupClasses();
            }
        };
        
        table.addEventListener('mouseover', handleMouseOver);
        table.addEventListener('mouseleave', handleMouseLeave);
    
        return () => {
            table.removeEventListener('mouseover', handleMouseOver);
            table.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [settings.highlightOnHover]);
    
    useEffect(() => {
        // This effect will synchronize the state of linked people based on their main person.
        let changesMade = false;
        const newSchedules = JSON.parse(JSON.stringify(schedules));

        const allLinkedPeople = people.filter(p => p.linkedPersonId && p.linkedCategoryId);

        for (const linkedPerson of allLinkedPeople) {
            const mainPersonId = linkedPerson.linkedPersonId!;
            const linkedCategoryId = linkedPerson.linkedCategoryId!;

            const categorySchedule = newSchedules[linkedCategoryId] ??= {};
            const monthSchedule = categorySchedule[yearMonth] ??= {};
            const personSchedule = monthSchedule[linkedPerson.id] ??= {};

            for (let day = 1; day <= daysInMonth; day++) {
                const isMainOnDuty = findDutyOnDay(mainPersonId, new Date(year, month, day));
                const currentLinkedStatus = personSchedule[day];

                if (isMainOnDuty) {
                    if (currentLinkedStatus !== DutyStatus.ON_DUTY) {
                        personSchedule[day] = DutyStatus.ON_DUTY;
                        changesMade = true;
                    }
                } else {
                    // If main is not on duty, linked person should not be on duty
                    if (currentLinkedStatus === DutyStatus.ON_DUTY) {
                        delete personSchedule[day];
                        changesMade = true;
                    }
                }
            }
        }

        if (changesMade) {
            setSchedules(newSchedules);
        }
    }, [schedules, people, yearMonth, daysInMonth, findDutyOnDay, setSchedules, year, month]);


    const handleExportData = () => {
        try {
            const dataToExport: AllData = {
                people: JSON.parse(localStorage.getItem('people') || '[]'),
                categories: JSON.parse(localStorage.getItem('categories') || '[]'),
                schedules: JSON.parse(localStorage.getItem('schedules') || '{}'),
                weapons: JSON.parse(localStorage.getItem('weapons') || '[]'),
            };

            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
            const link = document.createElement("a");
            link.href = jsonString;
            const date = new Date().toISOString().slice(0, 10);
            link.download = `naryady-backup-${date}.json`;
            link.click();
            showToast("Експорт успішно розпочато.");
            logAction("Виконано експорт всіх даних з сторінки графіка.");
        } catch (error) {
            console.error("Export failed:", error);
            showToast("Помилка під час експорту даних.");
        }
    };

    const handlePrint = () => {
        if (!selectedCategory) {
            showToast("Немає категорії для друку.");
            return;
        }
    
        let styles = `
            body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
                background: #fff; 
                color: #000; 
                margin: 20px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            h1 { text-align: center; font-size: 1.5rem; margin-bottom: 20px; }
            table { border-collapse: collapse; width: 100%; font-size: 9px; table-layout: fixed; }
            th, td { 
                border: 1px solid #000; 
                padding: 2px; 
                text-align: center; 
                height: 22px; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            th { background: #f2f2f2; font-weight: bold; }
            td:first-child, th:first-child { 
                text-align: left; 
                width: 250px !important;
                white-space: normal;
                word-wrap: break-word;
                font-weight: bold;
                padding-left: 5px;
            }
            th:not(:first-child), td:not(:first-child) { width: 22px !important; }
            .weekend { background-color: #e0e0e0 !important; }
            .duty-cell { background-color: #000000 !important; }
            .absence-cell { text-decoration: line-through; color: #000 !important; font-weight: bold; }
        `;
    
        const dutyColors: { [key in DutyStatus]?: string } = {};
        for (const key in DUTY_STATUS_BG_COLORS) {
            if(key !== DutyStatus.AVAILABLE && key !== DutyStatus.ON_DUTY){
                const colorVar = DUTY_STATUS_BG_COLORS[key as DutyStatus].match(/var\(([^)]+)\)/);
                if (colorVar) {
                    switch(key) {
                        case DutyStatus.SICK: dutyColors[key] = '#facc15'; break;
                        case DutyStatus.TRIP: dutyColors[key] = '#3b82f6'; break;
                        case DutyStatus.HOSPITAL: dutyColors[key] = '#ef4444'; break;
                        case DutyStatus.LEAVE: dutyColors[key] = '#a855f7'; break;
                        case DutyStatus.OTHER: dutyColors[key] = '#64748b'; break;
                    }
                }
            }
        }
    
        Object.entries(dutyColors).forEach(([status, color]) => {
            const key = status.replace(/\s+/g, '-').toLowerCase();
            styles += `.status-${key} { background-color: ${color} !important; }`;
        });
    
        let thead = `<thead><tr><th>ПІБ</th>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            thead += `<th class="${isWeekend ? 'weekend' : ''}">${day}</th>`;
        }
        thead += '</tr></thead>';
    
        let tbody = '<tbody>';
        peopleForCategory.active.forEach(person => {
            tbody += `<tr><td>${person.fullName}</td>`;
            const personSchedule = schedules[selectedCategoryId]?.[yearMonth]?.[person.id] || {};
            for (let day = 1; day <= daysInMonth; day++) {
                const status = personSchedule[day];
                const date = new Date(year, month, day);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                let cellClass = isWeekend ? 'weekend' : '';
                let cellContent = '&nbsp;';
                if (status === DutyStatus.ON_DUTY) {
                    cellClass += ' duty-cell';
                } else if (status && status !== DutyStatus.AVAILABLE) {
                    const statusKey = status.replace(/\s+/g, '-').toLowerCase();
                    cellClass += ` absence-cell status-${statusKey}`;
                    cellContent = DUTY_STATUS_ABBREVIATIONS[status] || '?';
                }
                tbody += `<td class="${cellClass}">${cellContent}</td>`;
            }
            tbody += '</tr>';
        });
        tbody += '</tbody>';
    
        let legendHtml = `<div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #000; font-size: 10px;"><h3>Легенда:</h3><ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 10px 20px;">`;
        legendHtml += `<li><span style="display: inline-block; width: 14px; height: 14px; background-color: #000; border: 1px solid #000; vertical-align: middle; margin-right: 5px;"></span> ${DUTY_STATUS_FULL_TEXT[DutyStatus.ON_DUTY]}</li>`;
        legendHtml += `<li><span style="display: inline-block; width: 14px; height: 14px; background-color: #e0e0e0; border: 1px solid #000; vertical-align: middle; margin-right: 5px;"></span> Вихідний</li>`;
        
        Object.entries(DUTY_STATUS_FULL_TEXT).forEach(([status, label]) => {
            if (status as DutyStatus !== DutyStatus.ON_DUTY) {
                const color = dutyColors[status as DutyStatus];
                if (color) {
                    legendHtml += `<li><span style="display: inline-block; width: 14px; height: 14px; background-color: ${color}; border: 1px solid #000; vertical-align: middle; margin-right: 5px;"></span> ${label}</li>`;
                }
            }
        });
        legendHtml += `</ul></div>`;

        const title = `Графік - ${selectedCategory.name} - ${UKRAINIAN_MONTHS[month]} ${year}`;
        const htmlContent = `
            <!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head>
            <body><h1>${title}</h1><table>${thead}${tbody}</table>${legendHtml}</body></html>
        `;
    
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.print();
        } else {
            showToast("Не вдалося відкрити нову вкладку. Перевірте налаштування блокування спливаючих вікон.");
        }
    };

    const handleStatusUpdate = (personId: string, day: number, status: Tool) => {
        setSchedules(prev => {
            const newSchedules = JSON.parse(JSON.stringify(prev));
            const categorySchedule = newSchedules[selectedCategoryId] ??= {};
            const monthSchedule = categorySchedule[yearMonth] ??= {};
            const personSchedule = monthSchedule[personId] ??= {};
            
            if (status === 'CLEAR') {
                delete personSchedule[day];
            } else {
                personSchedule[day] = status;
            }
            return newSchedules;
        });
        const personName = people.find(p => p.id === personId)?.fullName;
        logAction(`Змінено статус для "${personName}" на ${day} число на "${status}" в категорії "${selectedCategory?.shortName}"`);
    };
    
    const handleRangeUpdate = (personId: string, day1: number, day2: number, status: Tool) => {
        const start = Math.min(day1, day2);
        const end = Math.max(day1, day2);
        
        setSchedules(prev => {
            const newSchedules = JSON.parse(JSON.stringify(prev));
            const categorySchedule = newSchedules[selectedCategoryId] ??= {};
            const monthSchedule = categorySchedule[yearMonth] ??= {};
            const personSchedule = monthSchedule[personId] ??= {};

            for (let day = start; day <= end; day++) {
                 if (status === 'CLEAR') {
                    delete personSchedule[day];
                } else {
                    personSchedule[day] = status;
                }
            }
            return newSchedules;
        });
        const personName = people.find(p => p.id === personId)?.fullName;
        logAction(`Змінено статус для "${personName}" з ${start} по ${end} число на "${status}" в категорії "${selectedCategory?.shortName}"`);
    };

    const handleDutyReplacement = (newPersonId: string, oldPersonId: string, day: number) => {
        setSchedules(prev => {
            const newSchedules = JSON.parse(JSON.stringify(prev));
            const categorySchedule = newSchedules[selectedCategoryId] ??= {};
            const monthSchedule = categorySchedule[yearMonth] ??= {};

            const newPersonSchedule = monthSchedule[newPersonId] ??= {};
            newPersonSchedule[day] = DutyStatus.ON_DUTY;

            const oldPersonSchedule = monthSchedule[oldPersonId] ??= {};
            delete oldPersonSchedule[day];
            
            return newSchedules;
        });
        showToast("Заміну виконано.");
        const oldPersonName = people.find(p => p.id === oldPersonId)?.fullName;
        const newPersonName = people.find(p => p.id === newPersonId)?.fullName;
        logAction(`Заміна в наряді ${day} числа: "${oldPersonName}" на "${newPersonName}" в категорії "${selectedCategory?.shortName}"`);

    };

    const handleCellClick = (personId: string, day: number) => {
        const person = people.find(p => p.id === personId);
        if (!selectedCategory || !person || person.deletedTimestamp) return;

        if (person.linkedPersonId) {
            showToast("Статус залежних осіб змінюється автоматично.");
            return;
        }
        
        const personSchedule = schedules[selectedCategoryId]?.[yearMonth]?.[personId] || {};
        
        const prevDate = new Date(year, month, day - 1);
        const dutyOnPrevDay = findDutyOnDay(person.id, prevDate);

        const nextDate = new Date(year, month, day + 1);
        const dutyOnNextDay = findDutyOnDay(person.id, nextDate);

        const isDayOff = (dutyOnPrevDay && !dutyOnPrevDay.allowConsecutiveDuties) || (dutyOnNextDay && !dutyOnNextDay.allowConsecutiveDuties);

        const otherDuty = allDutiesMap.get(personId)?.get(day);
        const isBusyInOtherCategory = otherDuty && otherDuty.categoryId !== selectedCategoryId;
        
        if (isDayOff || isBusyInOtherCategory) return;

        const currentStatus = personSchedule[day] || DutyStatus.AVAILABLE;

        if (isReplacing) {
            if (day === isReplacing.day) {
                if (personId === isReplacing.personId) {
                     setIsReplacing(null);
                     showToast("Заміну скасовано.");
                     return;
                }
                if (currentStatus === DutyStatus.AVAILABLE) {
                    handleDutyReplacement(personId, isReplacing.personId, day);
                } else {
                    showToast("Заміна неможлива: дата зайнята.");
                }
            } else {
                showToast("Заміну скасовано: потрібно вибрати особу на той самий день.");
            }
            setIsReplacing(null);
            return;
        }

        const isAbsenceTool = activeTool !== DutyStatus.ON_DUTY && activeTool !== 'CLEAR';
        if (isAbsenceTool) {
            if (rangeStart && rangeStart.personId === personId) {
                const startDay = Math.min(rangeStart.day, day);
                const endDay = Math.max(rangeStart.day, day);
                let hasConflict = false;
                for (let d = startDay; d <= endDay; d++) {
                    if (personSchedule[d] && personSchedule[d] !== DutyStatus.AVAILABLE) {
                        hasConflict = true;
                        break;
                    }
                }

                if (hasConflict) {
                    setPendingRangeUpdate({ personId, day1: rangeStart.day, day2: day, status: activeTool });
                } else {
                    handleRangeUpdate(personId, rangeStart.day, day, activeTool);
                }
                setRangeStart(null);
            } else {
                setRangeStart({ personId, day });
            }
        } else if (activeTool === 'CLEAR') {
            setClearingInfo({personId, day});
        } else if (activeTool === DutyStatus.ON_DUTY) {
            if (currentStatus === DutyStatus.ON_DUTY) {
                setReplacementInfo({ personId, day });
            } else if (currentStatus !== DutyStatus.AVAILABLE) {
                showToast("Неможливо виставити наряд: дата вже зайнята!");
            } else {
                const dutyCountOnDay = peopleForCategory.active.filter(p => {
                    const schedule = schedules[selectedCategoryId]?.[yearMonth]?.[p.id];
                    return schedule && schedule[day] === DutyStatus.ON_DUTY;
                }).length;

                if (dutyCountOnDay >= selectedCategory.dutySize) {
                    showToast(`Ліміт наряду (${selectedCategory.dutySize} ос.) на цей день вже досягнуто.`);
                    return;
                }
                handleStatusUpdate(personId, day, DutyStatus.ON_DUTY);
            }
            setRangeStart(null);
        }
    };
    
    const handleConfirmClear = () => {
        if (!clearingInfo) return;
        const {personId, day} = clearingInfo;
        const currentStatus = schedules[selectedCategoryId]?.[yearMonth]?.[personId]?.[day];

        if (Object.values(DutyStatus).includes(currentStatus as DutyStatus) && currentStatus !== DutyStatus.ON_DUTY && currentStatus !== DutyStatus.AVAILABLE) {
            const personSchedule = schedules[selectedCategoryId]?.[yearMonth]?.[personId] || {};
            let start = day, end = day;
            while(personSchedule[start-1] === currentStatus) start--;
            while(personSchedule[end+1] === currentStatus) end++;
            handleRangeUpdate(personId, start, end, 'CLEAR');
        } else {
            handleStatusUpdate(personId, day, 'CLEAR');
        }
        setClearingInfo(null);
    };

    const handleConfirmReplacement = () => {
        if (!replacementInfo) return;
        setIsReplacing(replacementInfo);
        setReplacementInfo(null);
    };

     const handleConfirmOverwrite = () => {
        if (!pendingRangeUpdate) return;
        const { personId, day1, day2, status } = pendingRangeUpdate;
        handleRangeUpdate(personId, day1, day2, status);
        setPendingRangeUpdate(null);
    };


    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
        setRangeStart(null);
        setIsReplacing(null);
    };
    
    const handleOpenAutofillModal = () => {
        const firstDayOfMonth = new Date(year, month, 1);
        setAutofillStartDate(firstDayOfMonth);
        setIsAutofillModalOpen(true);
    };

    // --- EXPERIMENTAL FEATURES ---

    const handleAutofill = async () => {
        const categoriesToFill = autofillAllCategories 
            ? sortedActiveCategories 
            : selectedCategory ? [selectedCategory] : [];
    
        if (categoriesToFill.length === 0) {
            showToast("Спочатку виберіть категорію або опцію 'Заповнити всі'.");
            return;
        }
        
        for (const category of categoriesToFill) {
            const eligiblePeople = people.filter(p => p.categoryIds.includes(category.id) && !p.deletedTimestamp);
            if (eligiblePeople.length < category.dutySize) {
                showToast(`Авторозстановка неможлива: недостатньо людей для категорії "${category.name}" (потрібно ${category.dutySize}, є ${eligiblePeople.length}).`);
                return;
            }
        }
        
        setIsAutofilling(true);
        setAutofillProgress(0);
    
        const startDate = new Date(autofillStartDate);
        startDate.setHours(0, 0, 0, 0);
    
        const fillYear = startDate.getFullYear();
        const fillMonth = startDate.getMonth();
        const daysInFillMonth = new Date(fillYear, fillMonth + 1, 0).getDate();
    
        let changesMade = false;
        const newSchedules = JSON.parse(JSON.stringify(schedules));
        const allActiveCategories = categories.filter(c => !c.deletedTimestamp);
    
        const isAvailable = (personId: string, day: number, year: number, month: number, schedulesSnapshot: ScheduleData) => {
            const currentYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
            for (const cat of allActiveCategories) {
                const status = schedulesSnapshot[cat.id]?.[currentYearMonth]?.[personId]?.[day];
                if (status && status !== DutyStatus.AVAILABLE) return false;
            }
            
            const prevDate = new Date(year, month, day - 1);
            const prevYearMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
            for (const cat of allActiveCategories) {
                const prevDayDuty = schedulesSnapshot[cat.id]?.[prevYearMonth]?.[personId]?.[prevDate.getDate()] === DutyStatus.ON_DUTY;
                if (prevDayDuty && !cat.allowConsecutiveDuties) return false;
            }
            return true;
        };
    
        const totalSteps = (daysInFillMonth - startDate.getDate() + 1) * categoriesToFill.length;
        let currentStep = 0;
    
        for (const category of categoriesToFill) {
            const fillYearMonth = `${fillYear}-${String(fillMonth + 1).padStart(2, '0')}`;
            const eligiblePeople = people.filter(p => p.categoryIds.includes(category.id) && !p.deletedTimestamp);
            
            const dutyStats: Record<string, { totalDuties: number; lastDuty: number }> = {};
            eligiblePeople.forEach(p => {
                dutyStats[p.id] = { totalDuties: 0, lastDuty: -daysInFillMonth };
                Object.values(schedules).forEach(catSchedule => {
                    Object.values(catSchedule).forEach(monthSchedule => {
                        const personSchedule = (monthSchedule as MonthlySchedule)[p.id];
                        if (personSchedule) {
                            dutyStats[p.id].totalDuties += Object.values(personSchedule).filter(s => s === DutyStatus.ON_DUTY).length;
                        }
                    });
                });
            });
    
            for (let day = startDate.getDate(); day <= daysInFillMonth; day++) {
                const categorySchedule = newSchedules[category.id] ??= {};
                const monthSchedule = categorySchedule[fillYearMonth] ??= {};
    
                const dutiesOnDay = eligiblePeople.filter(p => monthSchedule[p.id]?.[day] === DutyStatus.ON_DUTY);
                let dutiesToFill = category.dutySize - dutiesOnDay.length;
                
                if (replaceExistingDuties) {
                    dutiesOnDay.forEach(p => delete monthSchedule[p.id][day]);
                    dutiesToFill = category.dutySize;
                }
                
                if (dutiesToFill <= 0) continue;
                
                let candidates = eligiblePeople
                    .filter(p => !monthSchedule[p.id]?.[day])
                    .filter(p => isAvailable(p.id, day, fillYear, fillMonth, newSchedules));
                
                if (autofillMode === 'fair') {
                    candidates.sort((a, b) => {
                        const statsA = dutyStats[a.id];
                        const statsB = dutyStats[b.id];
                        if (statsA.totalDuties !== statsB.totalDuties) return statsA.totalDuties - statsB.totalDuties;
                        return statsA.lastDuty - statsB.lastDuty;
                    });
                } else {
                     candidates.sort((a, b) => dutyStats[a.id].lastDuty - dutyStats[b.id].lastDuty);
                }
    
                const peopleToAssign = candidates.slice(0, dutiesToFill);
                peopleToAssign.forEach(p => {
                    monthSchedule[p.id] ??= {};
                    monthSchedule[p.id][day] = DutyStatus.ON_DUTY;
                    dutyStats[p.id].totalDuties++;
                    dutyStats[p.id].lastDuty = day;
                    changesMade = true;
                });
    
                currentStep++;
                setAutofillProgress(Math.round((currentStep / totalSteps) * 100));
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    
        setSchedules(newSchedules);
        
        if (changesMade) {
            logAction(`Виконано автозаповнення (${autofillMode}) з ${startDate.toLocaleDateString()}`);
            showToast("Автозаповнення завершено успішно!");
        } else {
            showToast("Автозаповнення завершено. Змін не було внесено.");
        }
        
        setIsAutofilling(false);
        setIsAutofillModalOpen(false);
        setCurrentDate(startDate);
    };

    const runAnalysis = (scope: 'month' | 'all') => {
        if (!selectedCategory) return;
        const report: AnalysisReport = { scope, problems: [], fairness: null, restPeriods: null, weekendDuties: null, suggestions: null };
        const peopleMap = new Map(peopleForCategory.active.map(p => [p.id, p]));

        if (scope === 'month') {
            const monthSchedule = schedules[selectedCategoryId]?.[yearMonth] || {};
            for (let day = 1; day <= daysInMonth; day++) {
                const dutiesOnDay = peopleForCategory.active.filter(p => monthSchedule[p.id]?.[day] === DutyStatus.ON_DUTY).length;
                if (dutiesOnDay < selectedCategory.dutySize) {
                    report.problems.push({ day, message: `Недостатньо людей (${dutiesOnDay}/${selectedCategory.dutySize})`, level: 'warning' });
                }
            }
            peopleForCategory.active.forEach(p => {
                const personSchedule = monthSchedule[p.id] || {};
                for (let day = 1; day < daysInMonth; day++) {
                    if (personSchedule[day] === DutyStatus.ON_DUTY && personSchedule[day+1] === DutyStatus.ON_DUTY && !selectedCategory.allowConsecutiveDuties) {
                        report.problems.push({ day: day+1, message: `${p.fullName}: наряди поспіль без дозволу.`, level: 'warning' });
                    }
                }
            });
        }
        
        const dutyCounts = new Map<string, number>(); const dutyDays = new Map<string, number[]>(); const weekendDutyCounts = new Map<string, number>();
        peopleForCategory.active.forEach(p => { dutyCounts.set(p.id, 0); dutyDays.set(p.id, []); weekendDutyCounts.set(p.id, 0); });

        const processMonth = (ym: string) => {
            const [y, m] = ym.split('-').map(Number);
            const monthSchedule = schedules[selectedCategoryId]?.[ym] || {};
            for (const [personId, personDailySchedule] of Object.entries(monthSchedule)) {
                if (dutyCounts.has(personId)) {
                    for (const [dayStr, status] of Object.entries(personDailySchedule)) {
                        if (status === DutyStatus.ON_DUTY) {
                            const day = parseInt(dayStr, 10);
                            if (!isNaN(day)) {
                                dutyCounts.set(personId, (dutyCounts.get(personId) || 0) + 1);
                                dutyDays.get(personId)?.push(new Date(y, m - 1, day).getTime());
                                const date = new Date(y, m - 1, day);
                                if (date.getDay() === 0 || date.getDay() === 6) {
                                    weekendDutyCounts.set(personId, (weekendDutyCounts.get(personId) || 0) + 1);
                                }
                            }
                        }
                    }
                }
            }
        };

        if (scope === 'month') { processMonth(yearMonth); } else {
            for (const ym of Object.keys(schedules[selectedCategoryId] || {})) {
                processMonth(ym);
            }
        }

        const counts = Array.from(dutyCounts.values());
        if (counts.length > 0) {
            const totalDuties = counts.reduce((a, b) => a + b, 0);
            report.fairness = { totalDuties, avgDuties: parseFloat((totalDuties / counts.length).toFixed(1)), minDuties: Math.min(...counts), maxDuties: Math.max(...counts), mostFrequent: [], leastFrequent: [], };
            report.fairness.mostFrequent = Array.from(dutyCounts.entries()).filter(([, count]) => count === report.fairness!.maxDuties).map(([id]) => peopleMap.get(id)! as Person);
            report.fairness.leastFrequent = Array.from(dutyCounts.entries()).filter(([, count]) => count === report.fairness!.minDuties).map(([id]) => peopleMap.get(id)! as Person);
            
            const restPeriods: { person: Person; rests: number[] }[] = [];
            let minRest: { person: Person, days: number } | null = null;
            let totalRestDays = 0, totalRestIntervals = 0;

            dutyDays.forEach((days, personId) => {
                if (days.length > 1) {
                    days.sort((a,b) => a - b);
                    const rests: number[] = [];
                    for (let i = 1; i < days.length; i++) {
                        const diff = (days[i] - days[i-1]) / (1000 * 60 * 60 * 24) - 1;
                        rests.push(diff);
                        if (!minRest || diff < minRest.days) {
                            minRest = { person: peopleMap.get(personId)! as Person, days: diff };
                        }
                    }
                    totalRestDays += rests.reduce((a, b) => a + b, 0);
                    totalRestIntervals += rests.length;
                    restPeriods.push({ person: peopleMap.get(personId)! as Person, rests });
                }
            });
            report.restPeriods = { avgRest: totalRestIntervals > 0 ? parseFloat((totalRestDays / totalRestIntervals).toFixed(1)) : 0, minRest, };
            report.weekendDuties = Array.from(weekendDutyCounts.entries()).map(([personId, count]) => ({ person: peopleMap.get(personId)! as Person, count })).sort((a, b) => b.count - a.count);
        }

        setAnalysisReport(report);
        setIsAnalysisModalOpen(true);
        if (settings.experimentalFeatures.enabled && settings.experimentalFeatures.improvedDutyForecastEnabled) {
            generateForecast(dutyCounts, report);
        }
    };

    const generateForecast = async (dutyCounts: Map<string, number>, initialReport: AnalysisReport) => {
        if (!selectedCategory) return;
        setIsForecasting(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const today = new Date();
            
            const eligiblePeople = peopleForCategory.active;
            const currentCategorySchedule: Record<string, string[]> = {};
            const unavailability: Record<string, {day: number, reason: string}[]> = {};
            
            eligiblePeople.forEach(p => {
                const duties = [];
                const personScheduleAll = allDutiesMap.get(p.id) || new Map();
                for (let day = 1; day <= daysInMonth; day++) {
                    const duty = personScheduleAll.get(day);
                    if (duty && duty.categoryId === selectedCategoryId) {
                        duties.push(day.toString());
                    } else if (duty) {
                        unavailability[p.fullName] = unavailability[p.fullName] || [];
                        unavailability[p.fullName].push({day, reason: `Duty: ${duty.categoryName}`});
                    }
                }
                if (duties.length > 0) { currentCategorySchedule[p.fullName] = duties; }
            });

            const prompt = `System Instruction: You are an expert military unit scheduler. Your task is to analyze a duty roster and provide optimal suggestions to fill gaps and ensure fairness among personnel for the remainder of the current month.

            User Prompt:
            Analyze the following duty schedule for the category "${selectedCategory.name}".

            Rules:
            1. The required number of people on duty each day is ${selectedCategory.dutySize}.
            2. Consecutive duties for the same person are ${selectedCategory.allowConsecutiveDuties ? 'allowed' : 'not allowed'}. If not allowed, a person must have a day of rest after a duty.
            3. Today's date is ${today.toLocaleDateString()}. Analyze and provide suggestions from today until the end of the month.
            4. The current month has ${daysInMonth} days.

            Eligible Personnel (with total duties so far this month):
            ${eligiblePeople.map(p => `- ${p.fullName} (Total duties: ${dutyCounts.get(p.id) || 0})`).join('\n')}

            Current schedule for this category (person: [days on duty]):
            ${JSON.stringify(currentCategorySchedule)}

            Personnel unavailability (duties in other categories, leave, etc.):
            ${JSON.stringify(unavailability)}

            Based on these rules and data, provide a list of suggestions to complete and optimize the schedule. Prioritize fairness by assigning duties to those with fewer total duties. Avoid assigning duties on days a person is unavailable. The response must be a valid JSON array matching the provided schema.`;

            const schema = {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.INTEGER, description: 'The day of the month for the suggestion.' },
                    action: { type: Type.STRING, description: 'The action to take: "ADD" or "REPLACE".' },
                    personToAdd: { type: Type.STRING, description: 'The full name of the person to add to the duty.' },
                    personToRemove: { type: Type.STRING, description: '(Optional) The full name of the person to remove from the duty if the action is "REPLACE".' },
                    reason: { type: Type.STRING, description: 'A brief justification for the suggestion (e.g., "Fills gap", "Improves fairness").' }
                  },
                  required: ['day', 'action', 'personToAdd', 'reason']
                }
            };
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: schema
                }
            });

            const suggestions = JSON.parse(response.text);
            setAnalysisReport(prev => prev ? { ...prev, suggestions } : null);

        } catch (error) {
            console.error("Error generating forecast:", error);
            showToast("Не вдалося отримати прогноз від AI.");
            setAnalysisReport(prev => prev ? { ...prev, suggestions: [] } : null);
        } finally {
            setIsForecasting(false);
        }
    };

    const applyForecast = () => {
        if (!analysisReport?.suggestions || !selectedCategory) return;
        
        const peopleNameMap = new Map(peopleForCategory.active.map(p => [p.fullName, p.id]));
        let changesCount = 0;

        setSchedules(prev => {
            const newSchedules = JSON.parse(JSON.stringify(prev));
            const categorySchedule = newSchedules[selectedCategoryId] ??= {};
            const monthSchedule = categorySchedule[yearMonth] ??= {};

            analysisReport.suggestions!.forEach(suggestion => {
                const { day, action, personToAdd, personToRemove } = suggestion;
                const personToAddId = peopleNameMap.get(personToAdd);
                
                if (!personToAddId) return;

                if (action === 'ADD') {
                    monthSchedule[personToAddId] ??= {};
                    monthSchedule[personToAddId][day] = DutyStatus.ON_DUTY;
                    changesCount++;
                } else if (action === 'REPLACE' && personToRemove) {
                    const personToRemoveId = peopleNameMap.get(personToRemove);
                    if (personToRemoveId) {
                        if (monthSchedule[personToRemoveId]) {
                            delete monthSchedule[personToRemoveId][day];
                        }
                        monthSchedule[personToAddId] ??= {};
                        monthSchedule[personToAddId][day] = DutyStatus.ON_DUTY;
                        changesCount++;
                    }
                }
            });
            return newSchedules;
        });

        showToast(`Застосовано ${changesCount} пропозицій від AI.`);
        logAction(`Застосовано ${changesCount} пропозицій від AI для "${selectedCategory.name}"`);
        setIsAnalysisModalOpen(false);
    };

    const runTrendAnalysis = () => {
        if (!selectedCategory) return;
        
        const subMap = new Map(subdivisions.map(s => [s.id, s]));
        const counts = new Map<string, number>();
        subdivisions.forEach(s => counts.set(s.id, 0));
        let totalDuties = 0;

        const getDirectSubdivision = (person: Person) => {
            if (!person.subdivisionRowIndex) return null;
            return subdivisions
                .filter(s => s.rowIndex <= person.subdivisionRowIndex!)
                .sort((a, b) => b.rowIndex - a.rowIndex)[0] || null;
        };

        const categorySchedule = schedules[selectedCategoryId] || {};
        // FIX: Replaced Object.values().forEach() with a for...in loop to avoid potential type inference issues where `monthSchedule` could become `unknown`.
        for (const monthKey in categorySchedule) {
            const monthSchedule = categorySchedule[monthKey];
            Object.entries(monthSchedule).forEach(([personId, daySchedule]) => {
                const person = people.find(p => p.id === personId);
                if (!person) return;

                const dutyCount = Object.values(daySchedule).filter(s => s === DutyStatus.ON_DUTY).length;
                if (dutyCount > 0) {
                    totalDuties += dutyCount;
                    const directSub = getDirectSubdivision(person);
                    let currentSub = directSub;
                    while (currentSub) {
                        counts.set(currentSub.id, (counts.get(currentSub.id) || 0) + dutyCount);
                        currentSub = currentSub.parentId ? subMap.get(currentSub.parentId) : null;
                    }
                }
            });
        }
        
        if (totalDuties > 0) {
            const rootSubdivisions = subdivisions.filter(s => !s.parentId);
            setTrendReport({
                totalDuties,
                structuredCounts: rootSubdivisions
                    .map(sub => ({ subdivision: sub, count: counts.get(sub.id) || 0, percentage: parseFloat((((counts.get(sub.id) || 0) / totalDuties) * 100).toFixed(1)) }))
                    .sort((a, b) => b.count - a.count),
            });
        } else {
            setTrendReport(null);
        }
        setIsTrendModalOpen(true);
    };

    const handleClearMonth = (mode: 'duties' | 'all') => {
        if (!selectedCategory) return;
        setSchedules(prev => {
            const newSchedules: ScheduleData = JSON.parse(JSON.stringify(prev));
            if (!newSchedules[selectedCategoryId]?.[yearMonth]) return prev;
            
            if (mode === 'all') {
                delete newSchedules[selectedCategoryId][yearMonth];
            } else { // 'duties'
                const monthSchedule = newSchedules[selectedCategoryId][yearMonth];
                for (const personId of Object.keys(monthSchedule)) {
                    const personSchedule = monthSchedule[personId];
                    if (personSchedule) {
                        for (const dayStr of Object.keys(personSchedule)) {
                            const schedule = personSchedule as Record<string, DutyStatus>;
                            if (schedule[dayStr] === DutyStatus.ON_DUTY) {
                                delete schedule[dayStr];
                            }
                        }
                    }
                }
            }
            return newSchedules;
        });
        const logMessage = mode === 'all' 
            ? `Очищено всі статуси для "${selectedCategory.name}" за ${UKRAINIAN_MONTHS[month]} ${year}.`
            : `Очищено наряди для "${selectedCategory.name}" за ${UKRAINIAN_MONTHS[month]} ${year}.`;
        logAction(logMessage);
        showToast(mode === 'all' ? "Всі статуси на місяць очищено." : "Наряди на місяць очищено.");
        setIsClearMonthModalOpen(false);
    };
    
    const renderTableRows = (peopleList: Person[], isArchived: boolean) => {
        return peopleList.map(person => {
            const personSchedule = schedules[selectedCategoryId]?.[yearMonth]?.[person.id] || {};
            
            return (
                <tr key={person.id} data-person-id={person.id} className={isArchived ? 'opacity-50' : ''}>
                    <td className={`sticky left-0 bg-card p-1 whitespace-nowrap text-sm border-b border-r border-border-color z-10 ${isArchived ? 'text-secondary-text' : 'text-header'}`}>{person.fullName}</td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const status = personSchedule[day] || DutyStatus.AVAILABLE;
                        
                        let isDayOff = false;
                        let unavailabilityReason = "";
                        const prevDate = new Date(year, month, day - 1);
                        const dutyOnPrevDay = findDutyOnDay(person.id, prevDate);
                        if (dutyOnPrevDay && !dutyOnPrevDay.allowConsecutiveDuties) {
                            isDayOff = true;
                            unavailabilityReason = `Відсипний після "${dutyOnPrevDay.shortName}"`;
                        }
                        
                        const nextDate = new Date(year, month, day + 1);
                        const dutyOnNextDay = findDutyOnDay(person.id, nextDate);
                        if (dutyOnNextDay && !dutyOnNextDay.allowConsecutiveDuties) {
                            isDayOff = true;
                            unavailabilityReason = unavailabilityReason 
                                ? `${unavailabilityReason} / Підготовка до "${dutyOnNextDay.shortName}"`
                                : `Підготовка до "${dutyOnNextDay.shortName}"`;
                        }
                        
                        const otherDuty = allDutiesMap.get(person.id)?.get(day);
                        const isBusyInOtherCategory = otherDuty && otherDuty.categoryId !== selectedCategoryId;
                        if (isBusyInOtherCategory) {
                            unavailabilityReason = `В наряді: ${otherDuty.categoryName}`;
                        }
                        if(isArchived) {
                             unavailabilityReason = "В архіві";
                        }
                        
                        let isLinkedAndUnavailable = false;
                        if (person.linkedPersonId) {
                            const mainPersonOnDuty = findDutyOnDay(person.linkedPersonId, new Date(year, month, day));
                            if (!mainPersonOnDuty) {
                                const statusInLinkedCategory = schedules[person.linkedCategoryId!]?.[yearMonth]?.[person.id]?.[day];
                                if (!statusInLinkedCategory || statusInLinkedCategory === DutyStatus.AVAILABLE) {
                                    isLinkedAndUnavailable = true;
                                    const mainPerson = people.find(p => p.id === person.linkedPersonId);
                                    unavailabilityReason = `Залежить від ${mainPerson?.fullName.split(' ')[0] || 'N/A'}`;
                                }
                            }
                        }

                        const isUnavailable = isDayOff || isBusyInOtherCategory || isArchived || isLinkedAndUnavailable;
                        
                        const isAbsence = status !== DutyStatus.AVAILABLE && status !== DutyStatus.ON_DUTY;
                        const isAbsenceStart = isAbsence && personSchedule[day - 1] !== status;
                        const isAbsenceEnd = isAbsence && personSchedule[day + 1] !== status;

                        const statusTextColorClass = DUTY_STATUS_TEXT_COLORS[status];
                        const abbreviation = DUTY_STATUS_ABBREVIATIONS[status];
                        
                        const isReplacingMode = !!isReplacing;
                        const isReplacementColumn = isReplacing && day === isReplacing.day;

                        const isRangeStart = rangeStart?.personId === person.id && rangeStart?.day === day;
                        
                        const dayOfWeek = new Date(year, month, day).getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                        return (
                            <td key={day} 
                                className={`p-0 text-center border-b border-r border-border-color transition-opacity
                                    ${isWeekend ? 'schedule-weekend-glow' : ''}
                                    ${isAbsence && !isAbsenceStart ? 'border-l-transparent' : ''} 
                                    ${isAbsence && !isAbsenceEnd ? 'border-r-transparent' : ''}
                                    ${isReplacingMode && !isReplacementColumn ? 'opacity-30' : ''}
                                    ${highlightedDays.includes(day) ? 'schedule-day-highlight-problem' : ''}`}
                                onClick={() => isUnavailable ? null : handleCellClick(person.id, day)}
                                title={status !== DutyStatus.AVAILABLE ? DUTY_STATUS_FULL_TEXT[status] : unavailabilityReason}
                            >
                                <div className={`w-full h-8 flex items-center justify-center text-xs font-normal transition-all duration-150 relative
                                    ${isUnavailable || (isReplacingMode && !isReplacementColumn) ? 'bg-day-off cursor-not-allowed' : 'cursor-pointer'}
                                    ${status !== DutyStatus.AVAILABLE ? `${DUTY_STATUS_BG_COLORS[status]} ${statusTextColorClass}` : ''}
                                    ${isAbsence && isAbsenceStart ? 'rounded-l-lg' : ''}
                                    ${isAbsence && isAbsenceEnd ? 'rounded-r-lg' : ''}
                                    ${isRangeStart ? 'range-start-pulse' : ''}
                                `}>
                                     {isUnavailable ? (
                                        <XIcon className="w-4 h-4 text-secondary-text" />
                                    ) : (
                                        status !== DutyStatus.AVAILABLE && <span>{abbreviation}</span>
                                    )}
                                </div>
                            </td>
                        );
                    })}
                </tr>
            )
        });
    }

    return (
        <div className="space-y-6 flex flex-col h-full">
            <h1 className="text-3xl font-bold text-header non-printable">Графік нарядів</h1>
            
            <Card className="non-printable">
                 <div className="mb-4 pb-4 border-b border-border-color">
                    <p className="text-center text-sm text-secondary-text mb-2">Інструмент</p>
                    <div className="flex flex-wrap justify-center items-center gap-1">
                        {Object.entries(DUTY_STATUS_FULL_TEXT).map(([status, label]) => (
                            <button
                                key={status}
                                onClick={() => {
                                    setActiveTool(status as DutyStatus);
                                    setRangeStart(null);
                                }}
                                title={label}
                                className={`w-10 h-8 rounded-lg text-sm font-semibold border-2 transition-all duration-200 flex items-center justify-center ${
                                    activeTool === status
                                        ? 'border-accent scale-110'
                                        : 'border-transparent'
                                } ${DUTY_STATUS_BG_COLORS[status as DutyStatus]} ${DUTY_STATUS_TEXT_COLORS[status as DutyStatus]}`}
                            >
                                {DUTY_STATUS_ABBREVIATIONS[status as DutyStatus]}
                            </button>
                        ))}
                        <button
                            key="clear"
                            onClick={() => { setActiveTool('CLEAR'); setRangeStart(null); }}
                            title="Очистити статус"
                            className={`w-10 h-8 rounded-lg text-sm font-semibold border-2 transition-all duration-200 flex items-center justify-center ${
                                activeTool === 'CLEAR' ? 'border-accent scale-110' : 'border-transparent'
                            } bg-secondary text-primary-text`}
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                     <div className="flex items-center space-x-2 sm:space-x-4">
                        <button onClick={() => changeMonth(-1)} className="p-2 bg-sidebar rounded-md hover:bg-accent text-white transition-colors">&lt;</button>
                        <span className="text-lg font-semibold w-32 text-center text-header">{`${UKRAINIAN_MONTHS[month]} ${year}`}</span>
                        <button onClick={() => changeMonth(1)} className="p-2 bg-sidebar rounded-md hover:bg-accent text-white transition-colors">&gt;</button>
                        <button onClick={handleExportData} className="p-2 bg-sidebar rounded-md hover:bg-accent text-white transition-colors" title="Зберегти/Експортувати всі дані">
                            <SaveIcon />
                        </button>
                        <button onClick={handlePrint} className="p-2 bg-sidebar rounded-md hover:bg-accent text-white transition-colors" title="Друк графіка">
                            <PrintIcon />
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {categoryGroupsForTags.map(({ parent, children }) => {
                            if (children.length > 0) {
                                return (
                                    <div key={parent.id} className="flex items-center bg-secondary p-0.5 rounded-lg border border-border-color">
                                        <button onClick={() => { setSelectedCategoryId(parent.id); setRangeStart(null); setIsReplacing(null);}} className={`px-2 py-1.5 text-sm rounded-l-md ${selectedCategoryId === parent.id ? 'bg-accent text-white' : 'hover:bg-primary'}`}>{parent.shortName}</button>
                                        {children.map((child, index) => (
                                            <button 
                                                key={child.id} 
                                                onClick={() => { setSelectedCategoryId(child.id); setRangeStart(null); setIsReplacing(null);}} 
                                                className={`px-2 py-1.5 text-sm ${selectedCategoryId === child.id ? 'bg-accent text-white' : 'hover:bg-primary'} ${index === children.length - 1 ? 'rounded-r-md' : ''}`}
                                            >
                                                {child.shortName}
                                            </button>
                                        ))}
                                    </div>
                                );
                            } else {
                                return (
                                    <button 
                                        key={parent.id} 
                                        onClick={() => { setSelectedCategoryId(parent.id); setRangeStart(null); setIsReplacing(null);}} 
                                        className={`px-3 py-2 text-sm rounded-lg transition-all duration-200 ${selectedCategoryId === parent.id ? 'bg-accent text-white shadow-md' : 'bg-secondary hover:bg-primary border border-border-color'}`}
                                    >
                                        {parent.shortName}
                                    </button>
                                );
                            }
                        })}
                    </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-color">
                    <div className="flex items-center gap-1 flex-wrap">
                        {settings.experimentalFeatures.enabled && settings.experimentalFeatures.autofillEnabled && 
                            <button onClick={handleOpenAutofillModal} className="bg-secondary text-primary-text px-3 py-1.5 rounded-lg hover:bg-primary border border-border-color text-sm flex items-center gap-2" title="Автозаповнення"><SyncIcon/></button>
                        }
                        {settings.experimentalFeatures.enabled && settings.experimentalFeatures.quickAnalysisEnabled && 
                            <button onClick={() => runAnalysis('month')} className="bg-secondary text-primary-text px-3 py-1.5 rounded-lg hover:bg-primary border border-border-color text-sm flex items-center gap-2" title="Детальний аналіз"><LaboratoryIcon className="w-5 h-5"/></button>
                        }
                        {settings.experimentalFeatures.enabled && settings.experimentalFeatures.trendAnalysisEnabled && 
                            <button onClick={runTrendAnalysis} className="bg-secondary text-primary-text px-3 py-1.5 rounded-lg hover:bg-primary border border-border-color text-sm" title="Аналіз тенденцій">📈</button>
                        }
                        <button onClick={() => setIsClearMonthModalOpen(true)} className="bg-secondary text-red-500 px-3 py-1.5 rounded-lg hover:bg-primary border border-border-color text-sm" title="Очистити місяць"><TrashIcon /></button>
                    </div>
                    <div className="flex items-center">
                        <label htmlFor="showArchivedInSchedule" className="text-sm text-secondary-text mr-3">
                            Показати архівних
                        </label>
                        <input
                            type="checkbox"
                            id="showArchivedInSchedule"
                            checked={showArchivedInSchedule}
                            onChange={e => setShowArchivedInSchedule(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                        />
                    </div>
                </div>
            </Card>

            <div className="flex-1 overflow-auto relative schedule-container">
                {selectedCategory ? (
                    <div className="overflow-x-auto">
                        <table ref={tableRef} className="w-full border-collapse text-xs table-fixed min-w-[1200px]">
                            <thead className="sticky top-0 z-20 bg-card">
                                <tr>
                                    <th className="sticky left-0 bg-card p-1 text-left w-40 border-b border-r border-border-color z-30">ПІБ</th>
                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                        const date = new Date(year, month, day);
                                        const dayOfWeek = date.getDay();
                                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                        return (
                                            <th key={day} className={`p-1 border-b border-r border-border-color w-8 ${isWeekend ? 'schedule-weekend-glow' : ''}`}>
                                                <div>{UKRAINIAN_WEEKDAYS_SHORT[dayOfWeek === 0 ? 6 : dayOfWeek - 1]}</div>
                                                <div>{day}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody ref={tableBodyRef}>
                                {renderTableRows(peopleForCategory.active, false)}
                                {showArchivedInSchedule && peopleForCategory.archived.length > 0 && (
                                    <>
                                        <tr>
                                            <td colSpan={daysInMonth + 1} className="py-2 bg-secondary text-center text-sm font-semibold text-secondary-text">Архів</td>
                                        </tr>
                                        {renderTableRows(peopleForCategory.archived, true)}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-secondary-text">Виберіть категорію для перегляду графіка.</p>
                    </div>
                )}
            </div>
            
            {isAutofillModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
                    <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md">
                        <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Автозаповнення графіка</h2></div>
                        <div className="p-4 space-y-4">
                            {isAutofilling ? (
                                <div className="space-y-2">
                                    <p className="text-center">Заповнення... {autofillProgress}%</p>
                                    <div className="w-full bg-secondary rounded-full h-4">
                                        <div className="bg-accent h-4 rounded-full text-xs font-medium text-blue-100 text-center p-0.5 leading-none" style={{ width: `${autofillProgress}%`, transition: 'width 0.2s ease-in-out' }}>
                                            {autofillProgress > 10 && `${autofillProgress}%`}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-secondary-text mb-2">Режим розстановки</label>
                                        <div className="flex items-center bg-secondary p-1 rounded-lg border border-border-color">
                                            <button onClick={() => setAutofillMode('standard')} className={`flex-1 px-3 py-1 text-sm rounded-md ${autofillMode === 'standard' ? 'bg-accent text-white' : ''}`}>Стандартно</button>
                                            <button onClick={() => setAutofillMode('fair')} className={`flex-1 px-3 py-1 text-sm rounded-md ${autofillMode === 'fair' ? 'bg-accent text-white' : ''}`}>Справедливо</button>
                                        </div>
                                    </div>
                                    {autofillMode === 'standard' && (
                                        <div>
                                            <label htmlFor="standard-days" className="block text-sm font-medium text-secondary-text mb-1">К-сть незаповнених слотів для розстановки (0 = всі)</label>
                                            <input type="number" id="standard-days" value={standardDaysToFill} onChange={e => setStandardDaysToFill(parseInt(e.target.value) || 0)} min="0" className="w-full bg-secondary p-2 rounded-md border border-border-color" />
                                        </div>
                                    )}
                                    <div>
                                        <label htmlFor="autofill-date" className="block text-sm font-medium text-secondary-text mb-1">Дата початку</label>
                                        <div className="flex items-center gap-2">
                                            <input type="date" id="autofill-date" value={autofillStartDate.toISOString().split('T')[0]} onChange={e => setAutofillStartDate(new Date(e.target.value))} className="w-full bg-secondary p-2 rounded-md border border-border-color" />
                                            <button type="button" onClick={() => setAutofillStartDate(new Date())} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Сьогодні</button>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <input type="checkbox" id="replaceDuties" checked={replaceExistingDuties} onChange={e => setReplaceExistingDuties(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                        <label htmlFor="replaceDuties" className="ml-2 text-primary-text text-sm">Замінити існуючі наряди</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input type="checkbox" id="fillAll" checked={autofillAllCategories} onChange={e => setAutofillAllCategories(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                                        <label htmlFor="fillAll" className="ml-2 text-primary-text text-sm">Заповнити всі категорії</label>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-border-color">
                            <button onClick={() => setIsAutofillModalOpen(false)} disabled={isAutofilling} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color disabled:opacity-50">Скасувати</button>
                            <button onClick={handleAutofill} disabled={isAutofilling} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover disabled:opacity-50">{isAutofilling ? 'Заповнення...' : 'Почати'}</button>
                        </div>
                    </div>
                </div>
            )}

            {isAnalysisModalOpen && analysisReport && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
                    <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Аналіз графіка: {selectedCategory?.name}</h2></div>
                        <div className="p-2 border-b border-border-color flex justify-center gap-2">
                             <button onClick={() => runAnalysis('month')} className={`px-3 py-1 text-sm rounded-md ${analysisReport.scope === 'month' ? 'bg-accent text-white' : 'bg-secondary'}`}>За місяць</button>
                             <button onClick={() => runAnalysis('all')} className={`px-3 py-1 text-sm rounded-md ${analysisReport.scope === 'all' ? 'bg-accent text-white' : 'bg-secondary'}`}>За весь час</button>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto">
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    {analysisReport.fairness && ( <Card title="Розподіл нарядів" className="bg-secondary/50"> <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"> <div><p className="text-sm text-secondary-text">Всього</p><p className="text-2xl font-bold text-header">{analysisReport.fairness.totalDuties}</p></div> <div><p className="text-sm text-secondary-text">Середнє</p><p className="text-2xl font-bold text-header">{analysisReport.fairness.avgDuties}</p></div> <div><p className="text-sm text-secondary-text">Максимум</p><p className="text-2xl font-bold text-header">{analysisReport.fairness.maxDuties}</p></div> <div><p className="text-sm text-secondary-text">Мінімум</p><p className="text-2xl font-bold text-header">{analysisReport.fairness.minDuties}</p></div> </div> <p className="text-xs text-secondary-text mt-3"><strong>Найбільше:</strong> {analysisReport.fairness.mostFrequent.map(p => p.fullName).join(', ')}</p> <p className="text-xs text-secondary-text"><strong>Найменше:</strong> {analysisReport.fairness.leastFrequent.map(p => p.fullName).join(', ')}</p> </Card> )}
                                    {analysisReport.restPeriods && ( <Card title="Періоди відпочинку" className="bg-secondary/50 mt-4"> <p>Середній відпочинок: <strong className="text-header">{analysisReport.restPeriods.avgRest} днів</strong></p> {analysisReport.restPeriods.minRest && <p>Мінімальний відпочинок: <strong className="text-red-400">{analysisReport.restPeriods.minRest.days} днів</strong> у <strong className="text-header">{analysisReport.restPeriods.minRest.person.fullName}</strong></p>} </Card> )}
                                    {analysisReport.weekendDuties && ( <Card title="Наряди у вихідні" className="bg-secondary/50 mt-4"> <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">{analysisReport.weekendDuties.map(item => <li key={item.person.id}>{item.person.fullName}: <strong className="text-header">{item.count}</strong></li>)}</ul> </Card> )}
                                    {analysisReport.problems.length > 0 && ( <Card title="Проблеми (поточний місяць)" className="bg-secondary/50 mt-4"> {analysisReport.problems.map((f, i) => ( <div key={i} className={`p-2 rounded-md border ${f.level === 'warning' ? 'bg-yellow-900/50 border-yellow-700 text-yellow-300' : 'bg-blue-900/50 border-blue-700 text-blue-300'}`}> <strong>{f.day} число:</strong> {f.message} </div> ))} </Card> )}
                                </div>
                                <div>
                                    {settings.experimentalFeatures.improvedDutyForecastEnabled && (
                                        <Card title="Прогноз від AI" className="bg-secondary/50">
                                            {isForecasting && <p className="text-secondary-text text-center">AI аналізує графік...</p>}
                                            {!isForecasting && !analysisReport.suggestions && <p className="text-secondary-text text-center">Прогноз не було згенеровано.</p>}
                                            {analysisReport.suggestions && (
                                                <div className="space-y-2">
                                                    {analysisReport.suggestions.length > 0 ? (
                                                        <>
                                                            <div className="max-h-80 overflow-y-auto space-y-2">
                                                                {analysisReport.suggestions.map((s, i) => (
                                                                    <div key={i} className="p-2 bg-primary rounded-md border border-border-color text-sm">
                                                                        <p className="font-bold text-header">День {s.day}: {s.action === 'ADD' ? 'Додати' : 'Замінити'}</p>
                                                                        <p className="text-primary-text">{s.action === 'REPLACE' ? `${s.personToRemove} → ${s.personToAdd}` : s.personToAdd}</p>
                                                                        <p className="text-xs text-secondary-text italic">Причина: {s.reason}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button onClick={applyForecast} className="w-full bg-accent text-white font-bold px-3 py-1.5 rounded-lg hover:bg-accent-hover shadow-lg mt-2">Застосувати пропозиції</button>
                                                        </>
                                                    ) : <p className="text-secondary-text text-center">Пропозицій від AI немає.</p>}
                                                </div>
                                            )}
                                        </Card>
                                    )}
                                </div>
                           </div>
                        </div>
                        <div className="flex justify-end p-4 border-t border-border-color">
                            <button onClick={() => setIsAnalysisModalOpen(false)} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Закрити</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isTrendModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
                    <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-lg">
                        <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Аналіз тенденцій: {selectedCategory?.name}</h2></div>
                        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                            {trendReport ? (
                                <>
                                    <p className="text-secondary-text">Проаналізовано <strong className="text-header">{trendReport.totalDuties}</strong> нарядів за весь час.</p>
                                    {trendReport.structuredCounts.map(item => (
                                        <div key={item.subdivision.id} className="bg-secondary p-2 rounded-md">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-primary-text">{item.subdivision.name}</span>
                                                <span className="text-sm text-secondary-text">{item.count} ({item.percentage}%)</span>
                                            </div>
                                            <div className="w-full bg-primary rounded-full h-2.5"><div className="bg-accent h-2.5 rounded-full" style={{width: `${item.percentage}%`}}></div></div>
                                        </div>
                                    ))}
                                    {trendReport.structuredCounts.length > 0 && (
                                        <div className="text-sm mt-3 p-2 bg-primary rounded-md border border-border-color">
                                            <p><strong>Прогноз:</strong></p>
                                            <p>Найбільше залучався особовий склад з підрозділу <strong className="text-accent">{trendReport.structuredCounts[0].subdivision.name}</strong>.</p>
                                            {trendReport.structuredCounts.length > 1 && <p>Для вирівнювання навантаження, рекомендується частіше залучати особовий склад з <strong className="text-accent">{trendReport.structuredCounts[trendReport.structuredCounts.length - 1].subdivision.name}</strong>.</p>}
                                        </div>
                                    )}
                                </>
                            ) : <p className="text-secondary-text text-center">Немає даних для аналізу тенденцій по цій категорії.</p>}
                        </div>
                        <div className="flex justify-end p-4 border-t border-border-color">
                            <button onClick={() => setIsTrendModalOpen(false)} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Закрити</button>
                        </div>
                    </div>
                </div>
            )}

            {isClearMonthModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
                    <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-lg">
                        <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Очистити графік на місяць?</h2></div>
                        <div className="p-4 space-y-4">
                            <p className="text-primary-text">Виберіть, що саме ви хочете очистити для категорії <strong className="text-header">{selectedCategory?.name}</strong> за <strong className="text-header">{UKRAINIAN_MONTHS[month]} {year}</strong>.</p>
                             <div className="flex flex-col gap-2">
                                <button onClick={() => handleClearMonth('duties')} className="w-full text-left bg-secondary p-3 rounded-md hover:bg-primary transition-colors border border-border-color">
                                    <p className="font-semibold text-primary-text">Очистити тільки наряди</p>
                                    <p className="text-sm text-secondary-text">Відпустки, лікарняні та інші статуси залишаться.</p>
                                </button>
                                 <button onClick={() => handleClearMonth('all')} className="w-full text-left bg-red-900/50 p-3 rounded-md hover:bg-red-900/80 transition-colors border border-red-700">
                                    <p className="font-semibold text-red-300">Очистити все</p>
                                    <p className="text-sm text-red-400">Будуть видалені всі статуси (наряди, відпустки і т.д.) за цей місяць.</p>
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end p-4 border-t border-border-color">
                            <button onClick={() => setIsClearMonthModalOpen(false)} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скасувати</button>
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmationModal isOpen={!!clearingInfo} onClose={() => setClearingInfo(null)} onConfirm={handleConfirmClear} title="Очистити статус" message={<>Ви впевнені, що хочете очистити статус для цього дня? Якщо це частина діапазону (напр. відпустка), буде очищено весь діапазон.</>} confirmButtonText="Так, очистити" />
            <ConfirmationModal isOpen={!!replacementInfo} onClose={() => setReplacementInfo(null)} onConfirm={handleConfirmReplacement} title="Заміна в наряді" message={<>Натисніть на іншу вільну особу в цей день, щоб виконати заміну.</>} confirmButtonText="Почати заміну" />
            <ConfirmationModal isOpen={!!pendingRangeUpdate} onClose={() => setPendingRangeUpdate(null)} onConfirm={handleConfirmOverwrite} title="Перезаписати статус?" message={<>Вибраний діапазон містить дні з іншим статусом. Ви впевнені, що хочете їх перезаписати?</>} confirmButtonText="Так, перезаписати" />

        </div>
    );
};

export default Schedule;