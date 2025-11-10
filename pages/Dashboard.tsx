import React, { useMemo, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useLocalStorage from '../hooks/useLocalStorage';
import { Person, Category, ScheduleData, Weapon, AllData, Subdivision, CustomWeaponType, AppSettings, DutyStatus } from '../types';
import { UKRAINIAN_MONTHS } from '../constants';
import Card from '../components/Card';
import { UsersIcon, TagIcon, CalendarIcon, UploadIcon, DownloadIcon, DatabaseIcon, FileImportIcon, HistoryIcon, WeaponIcon } from '../components/icons/Icons';
import { useToast, useActionLog } from '../context/ThemeContext';
import { saveFileToDB, getFileFromDB } from '../utils/db';
import { defaultSettings } from '../utils/defaults';
import { CHANGELOG_DATA } from './Updates';


declare const XLSX: any;

type DatabaseFileInfo = {
    name: string;
    lastModified: number;
    uploadedAt?: number;
};

const getDutiesForDate = (date: Date, schedules: ScheduleData, peopleMap: Map<string, Person>, activeCategories: Category[]) => {
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
};

const getAbsencesForDate = (date: Date, schedules: ScheduleData, peopleMap: Map<string, Person>) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const absences: { person: Person; status: DutyStatus }[] = [];
    const absenceStatuses = [DutyStatus.SICK, DutyStatus.TRIP, DutyStatus.HOSPITAL, DutyStatus.LEAVE, DutyStatus.OTHER];
    
    const personIdsWithDuty = new Set<string>();
     for (const categoryId in schedules) {
        const categorySchedule = schedules[categoryId]?.[yearMonth];
        if (categorySchedule) {
            for (const personId in categorySchedule) {
                if(categorySchedule[personId]?.[day] === DutyStatus.ON_DUTY) {
                    personIdsWithDuty.add(personId);
                }
            }
        }
    }

    for (const categoryId in schedules) {
        const categorySchedule = schedules[categoryId]?.[yearMonth];
        if (categorySchedule) {
            for (const personId in categorySchedule) {
                if (personIdsWithDuty.has(personId)) continue;
                
                const status = categorySchedule[personId]?.[day];
                if (status && absenceStatuses.includes(status)) {
                    const person = peopleMap.get(personId);
                    if (person && !absences.some(a => a.person.id === personId)) {
                        absences.push({ person, status });
                    }
                }
            }
        }
    }
    return absences.sort((a,b) => a.person.fullName.localeCompare(b.person.fullName));
};


const Dashboard: React.FC = () => {
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [schedules] = useLocalStorage<ScheduleData>('schedules', {});
    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const [settings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
    const [dutyViewDate, setDutyViewDate] = useState<'today' | 'tomorrow'>('today');

    const navigate = useNavigate();
    const { logs } = useActionLog();

    const activePeople = useMemo(() => people.filter(p => !p.deletedTimestamp), [people]);
    const activeCategories = useMemo(() => categories.filter(c => !c.deletedTimestamp), [categories]);
    const activeWeapons = useMemo(() => weapons.filter(w => !w.deletedTimestamp), [weapons]);
    const peopleMap = useMemo(() => new Map(activePeople.map(p => [p.id, p])), [activePeople]);
    const { showToast } = useToast();

    const notifications = useMemo(() => {
        const messages: string[] = [];
        const currentVersion = CHANGELOG_DATA[0]?.version;
        const lastVersionSeen = localStorage.getItem('last-version-seen');
        if (currentVersion && currentVersion !== lastVersionSeen) {
            messages.push(`Доступна нова версія ${currentVersion}!`);
        }
        const newPeopleCount = activePeople.filter(p => p.isNew).length;
        if (newPeopleCount > 0) {
            messages.push(`Є ${newPeopleCount} нових ос., що потребують погодження.`);
        }
        const unrecognizedRankCount = activePeople.filter(p => !p.rankCategory && !p.isNew).length;
        if (unrecognizedRankCount > 0) {
            messages.push(`${unrecognizedRankCount} ос. мають нерозпізнане звання.`);
        }
        return messages;
    }, [activePeople]);

    const stats = useMemo(() => ({
        people: activePeople.length,
        categories: activeCategories.length,
        weapons: activeWeapons.length,
        subdivisions: subdivisions.length,
    }), [activePeople, activeCategories, activeWeapons, subdivisions]);
    
    const date = useMemo(() => {
        const d = new Date();
        if (dutyViewDate === 'tomorrow') {
            d.setDate(d.getDate() + 1);
        }
        return d;
    }, [dutyViewDate]);

    const dutiesForDate = useMemo(() => getDutiesForDate(date, schedules, peopleMap, activeCategories), [date, schedules, peopleMap, activeCategories]);
    
    const absencesForToday = useMemo(() => getAbsencesForDate(new Date(), schedules, peopleMap), [schedules, peopleMap]);

    const weaponStats = useMemo(() => {
        const assigned = activeWeapons.filter(w => w.personId).length;
        return {
            total: activeWeapons.length,
            assigned,
            free: activeWeapons.length - assigned
        };
    }, [activeWeapons]);

    const groupedDutiesForDate = useMemo(() => {
        const groups = new Map<string, { category: Category; people: Person[] }>();
        dutiesForDate.forEach(({ person, category }) => {
            if (!groups.has(category.id)) {
                groups.set(category.id, { category, people: [] });
            }
            groups.get(category.id)!.people.push(person);
        });
        groups.forEach(group => group.people.sort((a, b) => a.fullName.localeCompare(b.fullName)));
        return Array.from(groups.values()).sort((a, b) => a.category.order - b.category.order);
    }, [dutiesForDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-header">Головна панель</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300" onClick={() => navigate('/people')}>
            <UsersIcon className="w-12 h-12 text-accent" />
            <div>
                <p className="text-secondary-text">Особовий склад</p>
                <p className="text-3xl font-bold text-header">{stats.people}</p>
            </div>
        </Card>
        <Card className="flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300" onClick={() => navigate('/categories')}>
            <TagIcon className="w-12 h-12 text-accent" />
            <div>
                <p className="text-secondary-text">Категорії нарядів</p>
                <p className="text-3xl font-bold text-header">{stats.categories}</p>
            </div>
        </Card>
         <Card className="flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300" onClick={() => navigate('/weapons')}>
            <WeaponIcon className="w-12 h-12 text-accent" />
            <div>
                <p className="text-secondary-text">Зброя</p>
                <p className="text-3xl font-bold text-header">{stats.weapons}</p>
            </div>
        </Card>
        <Card className="flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300" onClick={() => navigate('/history')}>
            <HistoryIcon className="w-12 h-12 text-accent" />
            <div>
                <p className="text-secondary-text">Дії за сьогодні</p>
                <p className="text-3xl font-bold text-header">{logs.length}</p>
            </div>
        </Card>
      </div>
      
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center bg-secondary p-1 rounded-lg border border-border-color">
                            <button onClick={() => setDutyViewDate('today')} className={`px-3 py-1 text-sm rounded-md ${dutyViewDate === 'today' ? 'bg-accent text-white' : ''}`}>Наряд на сьогодні</button>
                            <button onClick={() => setDutyViewDate('tomorrow')} className={`px-3 py-1 text-sm rounded-md ${dutyViewDate === 'tomorrow' ? 'bg-accent text-white' : ''}`}>На завтра</button>
                        </div>
                        <h3 className="text-lg font-semibold text-header">{date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
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
                    ) : <p className="text-center text-secondary-text py-8">На вибрану дату нарядів не призначено.</p>}
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Card title="Статус зброї">
                        <div className="space-y-2 text-center">
                            <div className="bg-secondary p-2 rounded-md">
                                <p className="text-sm text-secondary-text">Всього</p>
                                <p className="text-2xl font-bold text-header">{weaponStats.total}</p>
                            </div>
                             <div className="bg-secondary p-2 rounded-md">
                                <p className="text-sm text-secondary-text">Закріплено</p>
                                <p className="text-2xl font-bold text-green-400">{weaponStats.assigned}</p>
                            </div>
                             <div className="bg-secondary p-2 rounded-md">
                                <p className="text-sm text-secondary-text">Вільна</p>
                                <p className="text-2xl font-bold text-yellow-400">{weaponStats.free}</p>
                            </div>
                        </div>
                    </Card>
                     <Card title="Останні дії">
                         <div className="space-y-2 max-h-60 overflow-y-auto">
                            {logs.slice(0, 5).map(log => (
                                <div key={log.id} className="font-mono text-xs bg-secondary p-2 rounded-md border border-border-color">
                                    <span className="text-secondary-text">{log.timestamp} -- </span>
                                    <span className="text-primary-text">{log.message}</span>
                                </div>
                            ))}
                             {logs.length === 0 && <p className="text-secondary-text text-center text-sm py-4">Сьогодні ще не було жодних дій.</p>}
                        </div>
                    </Card>
                </div>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <Card title="Відсутній особовий склад">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {absencesForToday.length > 0 ? absencesForToday.map(({person, status}) => (
                             <div key={person.id} className="flex justify-between items-center bg-secondary p-2 rounded-md">
                                <span className="text-primary-text text-sm">{person.fullName}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full text-white`} style={{backgroundColor: `var(--color-duty-${status.toLowerCase()}-bg)`}}>{status}</span>
                            </div>
                        )) : <p className="text-secondary-text text-center text-sm py-4">Всі на місці.</p>}
                    </div>
                </Card>
                 <Card title="Проблемні зони">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                         {notifications.length > 0 ? notifications.map((notif, i) => (
                            <div key={i} className="text-sm text-yellow-300 bg-yellow-900/50 p-2 rounded-md border border-yellow-700">{notif}</div>
                         )) : <p className="text-secondary-text text-center text-sm py-4">Проблем не виявлено.</p>}
                    </div>
                </Card>
            </div>
       </div>
    </div>
  );
};

export default Dashboard;