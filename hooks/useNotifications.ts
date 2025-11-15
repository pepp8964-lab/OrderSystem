import { useMemo } from 'react';
import useLocalStorage from './useLocalStorage';
import { Person, Category, ScheduleData, DutyStatus, Weapon } from '../types';
import { CHANGELOG_DATA } from '../pages/Updates';

interface Notification {
    text: string;
    link: string;
    type: 'person' | 'schedule' | 'weapon' | 'update';
}

interface GroupedNotifications {
    update: Notification[];
    person: Notification[];
    schedule: Notification[];
    weapon: Notification[];
}

const useNotifications = () => {
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [schedules] = useLocalStorage<ScheduleData>('schedules', {});
    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [lastVersionSeen, setLastVersionSeen] = useLocalStorage('last-version-seen', '');
    const [lockedDays] = useLocalStorage<Record<string, number[]>>('schedule-locked-days', {});

    const notifications = useMemo(() => {
        const messages: Notification[] = [];
        try {
            const currentVersion = CHANGELOG_DATA[0]?.version;
            if (currentVersion && currentVersion !== lastVersionSeen) {
                messages.push({
                    text: `Доступна нова версія ${currentVersion}! Перегляньте оновлення.`,
                    link: '/updates',
                    type: 'update',
                });
            }

            const activePeople = people?.filter(p => !p.deletedTimestamp) || [];
            const activeCategories = categories?.filter(c => !c.deletedTimestamp) || [];
            const activeWeapons = weapons?.filter(w => !w.deletedTimestamp) || [];
            
            const newPeopleCount = activePeople.filter(p => p.isNew).length;
            if (newPeopleCount > 0) {
                messages.push({ text: `Є ${newPeopleCount} нових ос., що потребують погодження.`, link: '/people?highlight=newlyImported', type: 'person' });
            }

            const unrecognizedRankCount = activePeople.filter(p => !p.rankCategory && !p.isNew).length;
            if (unrecognizedRankCount > 0) {
                messages.push({ text: `${unrecognizedRankCount} ос. мають нерозпізнане звання.`, link: '/people', type: 'person' });
            }
            
            const unassignedPeopleCount = activePeople.filter(p => p.categoryIds?.length === 0 && !p.isNew).length;
            if (unassignedPeopleCount > 0) {
                 messages.push({ text: `${unassignedPeopleCount} ос. не розподілено по категоріях.`, link: '/people', type: 'person' });
            }

            const weaponMap = new Map(activeWeapons.filter(w => w.personId).map(w => [w.personId!, w]));
            activeCategories.forEach(category => {
                if (category.weaponAssignment?.type === 'personal') {
                    const peopleInCategory = activePeople.filter(p => p.categoryIds?.includes(category.id));
                    const peopleWithoutWeapon = peopleInCategory.filter(p => !weaponMap.has(p.id));
                    if (peopleWithoutWeapon.length > 0) {
                        messages.push({ text: `Категорія "${category.shortName}": ${peopleWithoutWeapon.length} ос. не мають іменної зброї.`, link: '/people', type: 'weapon' });
                    }
                }
                if ((category.weaponAssignment?.type === 'public' || category.weaponAssignment?.type === 'reserve')) {
                    category.weaponAssignment?.groups?.forEach((group, index) => {
                        if (group.weapons.length < category.dutySize) {
                            messages.push({ text: `Категорія "${category.shortName}", Група ${index + 1}: не вистачає ${category.dutySize - group.weapons.length} од. зброї.`, link: '/categories', type: 'weapon' });
                        }
                    });
                }
            });
            
            const activeCategoryIds = new Set(activeCategories.map(c => c.id));
            const unassignedPublicWeapons = activeWeapons.filter(w => (w.assignmentType === 'громадська' || w.assignmentType === 'резервна') && (!w.categoryId || !activeCategoryIds.has(w.categoryId)));
            if (unassignedPublicWeapons.length > 0) {
                messages.push({ text: `${unassignedPublicWeapons.length} од. зброї не закріплено за категоріями.`, link: '/weapons', type: 'weapon' });
            }
            
            if (activeCategories.length > 0) {
                const today = new Date();
                const year = today.getFullYear();
                const monthNum = today.getMonth() + 1;
                const yearMonth = `${year}-${String(monthNum).padStart(2, '0')}`;
                const daysInMonth = new Date(year, monthNum, 0).getDate();
                const lockedDaysForMonth = lockedDays[yearMonth] || [];
                
                const dailyDutyAssignments = new Map<number, {personId: string, categoryName: string}[]>();

                activeCategories.forEach(cat => {
                    const monthSchedule = schedules?.[cat.id]?.[yearMonth];
                    if (monthSchedule) {
                        for (const personId in monthSchedule) {
                            for (const dayStr in monthSchedule[personId]) {
                                if (monthSchedule[personId][dayStr] === DutyStatus.ON_DUTY) {
                                    const day = parseInt(dayStr, 10);
                                    const assignments = dailyDutyAssignments.get(day) || [];
                                    assignments.push({ personId, categoryName: cat.shortName });
                                    dailyDutyAssignments.set(day, assignments);
                                }
                            }
                        }
                    }
                });

                const peopleMap = new Map(activePeople.map(p => [p.id, p]));

                dailyDutyAssignments.forEach((assignments, day) => {
                    const dutiesByPerson = assignments.reduce((acc, val) => {
                        acc[val.personId] = (acc[val.personId] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);

                    for (const personId in dutiesByPerson) {
                        if (dutiesByPerson[personId] > 1) {
                            const person = peopleMap.get(personId);
                            if (person) {
                                messages.push({
                                    text: `Подвійний наряд для ${person.fullName} на ${day} число.`,
                                    link: `/schedule?highlightDay=${day}&highlightMonth=${today.getMonth()}&highlightYear=${year}`,
                                    type: 'schedule'
                                });
                            }
                        }
                    }
                });

                activeCategories.forEach(category => {
                    const monthSchedule = schedules?.[category.id]?.[yearMonth];
                    if (!monthSchedule) {
                        messages.push({ text: `Графік для "${category.shortName}" на цей місяць не заповнено.`, link: `/schedule?category=${category.id}`, type: 'schedule' });
                        return; 
                    }

                    const peopleForCategory = activePeople.filter(p => p.categoryIds?.includes(category.id));
                    const problematicDays: number[] = [];

                    for (let day = 1; day <= daysInMonth; day++) {
                        let dutyCount = 0;
                        peopleForCategory.forEach(person => {
                            if (monthSchedule?.[person.id]?.[day] === DutyStatus.ON_DUTY) {
                                dutyCount++;
                            }
                        });

                        if (dutyCount < category.dutySize && !lockedDaysForMonth.includes(day)) {
                            problematicDays.push(day);
                        }
                    }
                    if (problematicDays.length > 0) {
                        const daysString = problematicDays.join(',');
                        messages.push({ text: `Графік "${category.shortName}": не заповнено дні: ${problematicDays.join(', ')}.`, link: `/schedule?category=${category.id}&highlightDay=${daysString}&highlightMonth=${today.getMonth()}&highlightYear=${year}`, type: 'schedule' });
                    }
                });
            }

            return messages;
        } catch (e) {
            console.error("Fatal error during notification generation:", e);
            return [{ text: 'Помилка при перевірці сповіщень.', link: '/', type: 'person' }];
        }
    }, [people, categories, schedules, weapons, lastVersionSeen, lockedDays]);
    
    const groupedNotifications = useMemo(() => {
        return notifications.reduce((acc, notif) => {
            acc[notif.type].push(notif);
            return acc;
        }, { update: [], person: [], schedule: [], weapon: [] } as GroupedNotifications);
    }, [notifications]);

    const totalNotifications = notifications.length;

    return { notifications, groupedNotifications, totalNotifications, setLastVersionSeen };
};

export default useNotifications;
