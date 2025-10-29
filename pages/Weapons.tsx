import React, { useState, useMemo, useCallback } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { Weapon, Person, Category, CustomWeaponType } from '../types';
import Card from '../components/Card';
import { useToast, useActionLog } from '../context/ThemeContext';
import ConfirmationModal from '../components/ConfirmationModal';
import { WEAPON_ASSIGNMENT_TYPES } from '../constants';
import { TrashIcon } from '../components/icons/Icons';

const AssignPersonModal: React.FC<{
    onClose: () => void;
    onAssign: (personId: string) => void;
    people: Person[];
}> = ({ onClose, onAssign, people }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredAndSortedPeople = useMemo(() => {
        return people
            .filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }, [people, searchTerm]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-xl font-bold text-header">Закріпити зброю за особою</h2>
                </div>
                <div className="p-4">
                    <input
                        type="search"
                        placeholder="Пошук..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-secondary p-2 rounded-md border border-border-color"
                    />
                </div>
                <div className="p-4 pt-0 space-y-2 overflow-y-auto">
                    {filteredAndSortedPeople.map(person => (
                        <button 
                            key={person.id} 
                            onClick={() => onAssign(person.id)}
                            className="w-full text-left bg-secondary p-3 rounded-md hover:bg-primary transition-colors border border-border-color"
                        >
                            <p className="font-semibold text-primary-text">{person.fullName}</p>
                            <p className="text-sm text-secondary-text">{person.rank}</p>
                        </button>
                    ))}
                    {filteredAndSortedPeople.length === 0 && <p className="text-secondary-text text-center pt-4">{people.length > 0 ? 'Нікого не знайдено.' : 'Немає вільних осіб для закріплення.'}</p>}
                </div>
                <div className="flex justify-end p-4 border-t border-border-color">
                    <button type="button" onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                </div>
            </div>
        </div>
    );
};

const WeaponFormModal: React.FC<{
    weapon?: Weapon;
    onSave: (weapon: Omit<Weapon, 'id' | 'deletedTimestamp'>) => void;
    onCancel: () => void;
    people: Person[];
    assignedPersonIds: string[];
    customWeaponTypes: CustomWeaponType[];
}> = ({ weapon, onSave, onCancel, people, assignedPersonIds, customWeaponTypes }) => {
    const [formData, setFormData] = useState({
        type: weapon?.type || (customWeaponTypes.length > 0 ? customWeaponTypes[0].name : ''),
        serialNumber: weapon?.serialNumber || '',
        assignmentType: weapon?.assignmentType || 'громадська',
        personId: weapon?.personId || null,
        categoryId: weapon?.categoryId || null,
    });
    const [isAssigning, setIsAssigning] = useState(false);
    const { showToast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleAssignTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value as Weapon['assignmentType'];
        setFormData(prev => ({
            ...prev,
            assignmentType: newType,
            personId: newType === 'іменна' ? prev.personId : null,
            categoryId: newType !== 'іменна' ? prev.categoryId : null
        }));
    };
    
    const handleAssignPerson = (personId: string) => {
        setFormData(prev => ({ ...prev, personId }));
        setIsAssigning(false);
        showToast("Особу вибрано.");
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.assignmentType === 'іменна' && !formData.personId) {
            showToast("Для іменної зброї потрібно вибрати особу.");
            return;
        }
        if (!formData.type) {
            showToast("Будь ласка, виберіть тип зброї. Якщо список порожній, додайте тип на сторінці 'Зброя'.");
            return;
        }
        onSave(formData);
    };

    const personName = useMemo(() => {
        if (!formData.personId) return "Не вибрано";
        return people.find(p => p.id === formData.personId)?.fullName || "Невідома особа";
    }, [formData.personId, people]);

    const availablePeople = useMemo(() => {
        return people.filter(p => !assignedPersonIds.includes(p.id) || p.id === weapon?.personId);
    }, [people, assignedPersonIds, weapon]);

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onCancel}>
                <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">{weapon ? "Редагувати зброю" : "Додати нову зброю"}</h2></div>
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-secondary p-2 rounded-md border border-border-color">
                            {customWeaponTypes.length > 0 ? (
                                customWeaponTypes.map(type => <option key={type.name} value={type.name}>{type.name}</option>)
                            ) : (
                                <option disabled value="">Спочатку додайте тип зброї</option>
                            )}
                        </select>
                        <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleChange} placeholder="Номер зброї" required className="w-full bg-secondary p-2 rounded-md border border-border-color" />
                        <select name="assignmentType" value={formData.assignmentType} onChange={handleAssignTypeChange} className="w-full bg-secondary p-2 rounded-md border border-border-color">
                            {WEAPON_ASSIGNMENT_TYPES.map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
                        </select>
                        
                        {formData.assignmentType === 'іменна' && (
                            <div className="bg-secondary p-2 rounded-md border border-border-color flex justify-between items-center">
                                <span className="text-sm text-primary-text">Особа: {personName}</span>
                                <button type="button" onClick={() => setIsAssigning(true)} className="text-xs bg-accent text-white px-3 py-1 rounded-md hover:bg-accent-hover">Вибрати</button>
                            </div>
                        )}

                        <div className="flex justify-end space-x-2 pt-2 border-t border-border-color">
                            <button type="button" onClick={onCancel} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                            <button type="submit" className="bg-accent px-4 py-2 rounded-md hover:bg-accent-hover transition-colors text-white">Зберегти</button>
                        </div>
                    </form>
                </div>
            </div>
            {isAssigning && (
                <AssignPersonModal 
                    onClose={() => setIsAssigning(false)}
                    onAssign={handleAssignPerson}
                    people={availablePeople}
                />
            )}
        </>
    );
};


const Weapons: React.FC = () => {
    const [weapons, setWeapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [customWeaponTypes, setCustomWeaponTypes] = useLocalStorage<CustomWeaponType[]>('custom-weapon-types', []);

    const [isAdding, setIsAdding] = useState(false);
    const [editingWeapon, setEditingWeapon] = useState<Weapon | undefined>(undefined);
    const [showArchived, setShowArchived] = useState(false);
    const [weaponToDelete, setWeaponToDelete] = useState<Weapon | null>(null);
    const [weaponToPermanentlyDelete, setWeaponToPermanentlyDelete] = useState<Weapon | null>(null);
    const [sortBy, setSortBy] = useState('serialNumber');
    const [filterByType, setFilterByType] = useState('all');
    const [filterByAssignment, setFilterByAssignment] = useState('all');

    const [newTypeName, setNewTypeName] = useState('');
    const [newAmmoType, setNewAmmoType] = useState('');

    const { showToast } = useToast();
    const { logAction } = useActionLog();

    const activePeople = useMemo(() => people.filter(p => !p.deletedTimestamp), [people]);
    const activeWeapons = useMemo(() => weapons.filter(w => !w.deletedTimestamp), [weapons]);
    const archivedWeapons = useMemo(() => weapons.filter(w => w.deletedTimestamp), [weapons]);

    const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p.fullName])), [people]);
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    
    const assignedPersonIds = useMemo(() => {
        return activeWeapons.map(w => w.personId).filter((id): id is string => id !== null);
    }, [activeWeapons]);

    const weaponsToDisplay = useMemo(() => {
        const source = showArchived ? archivedWeapons : activeWeapons;
        return source
            .filter(w => filterByType === 'all' || w.type === filterByType)
            .filter(w => filterByAssignment === 'all' || w.assignmentType === filterByAssignment)
            .sort((a, b) => {
                if (sortBy === 'serialNumber') {
                    return a.serialNumber.localeCompare(b.serialNumber, undefined, { numeric: true });
                }
                return 0;
            });
    }, [showArchived, archivedWeapons, activeWeapons, filterByType, filterByAssignment, sortBy]);

    const groupedWeapons = useMemo(() => {
        return weaponsToDisplay.reduce((acc, weapon) => {
            const type = weapon.type;
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(weapon);
            return acc;
        }, {} as Record<Weapon['type'], Weapon[]>);
    }, [weaponsToDisplay]);

    const handleSave = useCallback((weaponData: Omit<Weapon, 'id' | 'deletedTimestamp'>) => {
        const isEditing = !!editingWeapon;
        const weapon: Weapon = { 
            id: editingWeapon?.id || crypto.randomUUID(),
            ...weaponData,
            deletedTimestamp: null,
        };

        setWeapons(prev => {
            const existing = prev.find(w => w.id === weapon.id);
            if (existing) {
                return prev.map(w => w.id === weapon.id ? weapon : w);
            }
            return [...prev, weapon];
        });
        showToast(isEditing ? 'Дані зброї оновлено.' : 'Зброю додано.');
        logAction(isEditing ? `Оновлено дані зброї ${weapon.type} №${weapon.serialNumber}` : `Додано нову зброю ${weapon.type} №${weapon.serialNumber}`);
        setIsAdding(false);
        setEditingWeapon(undefined);
    }, [setWeapons, showToast, editingWeapon, logAction]);

    const handleDelete = (weapon: Weapon) => setWeaponToDelete(weapon);
    const handlePermanentDelete = (weapon: Weapon) => setWeaponToPermanentlyDelete(weapon);

    const handleConfirmDelete = () => {
        if (!weaponToDelete) return;

        setWeapons(prev => prev.map(w => w.id === weaponToDelete.id ? { ...w, deletedTimestamp: Date.now() } : w));
        showToast(`Зброю ${weaponToDelete.type} №${weaponToDelete.serialNumber} архівувано.`);
        logAction(`Архівувано зброю ${weaponToDelete.type} №${weaponToDelete.serialNumber}`);
        setWeaponToDelete(null);
    };

    const handleConfirmPermanentDelete = () => {
        if (!weaponToPermanentlyDelete) return;
        setWeapons(prev => prev.filter(w => w.id !== weaponToPermanentlyDelete.id));
        showToast(`Зброю ${weaponToPermanentlyDelete.type} №${weaponToPermanentlyDelete.serialNumber} видалено.`);
        logAction(`Назавжди видалено зброю ${weaponToPermanentlyDelete.type} №${weaponToPermanentlyDelete.serialNumber}`);
        setWeaponToPermanentlyDelete(null);
    }
    
    const handleRestore = (id: string) => {
        const weapon = weapons.find(w => w.id === id);
        setWeapons(prev => prev.map(w => w.id === id ? { ...w, deletedTimestamp: null } : w));
        showToast(`Зброю ${weapon?.type} №${weapon?.serialNumber} відновлено.`);
        logAction(`Відновлено зброю ${weapon?.type} №${weapon?.serialNumber} з архіву.`);
    };

    const handleAddType = (e: React.FormEvent) => {
        e.preventDefault();
        const name = newTypeName.trim();
        const ammo = newAmmoType.trim();
        if (!name || !ammo) {
            showToast("Назва типу та тип набоїв не можуть бути порожніми.");
            return;
        }
        if (customWeaponTypes.some(t => t.name === name)) {
            showToast("Такий тип зброї вже існує.");
            return;
        }
        
        const newType: CustomWeaponType = { name, ammoType: ammo };

        setCustomWeaponTypes(prev => [...prev, newType]);
        
        showToast(`Додано новий тип зброї: ${name}`);
        logAction(`Додано новий тип зброї: ${name} (${ammo})`);
        setNewTypeName('');
        setNewAmmoType('');
    };

    const handleDeleteType = (typeToDelete: string) => {
        const isInUse = weapons.some(w => w.type === typeToDelete && !w.deletedTimestamp);
        if (isInUse) {
            showToast(`Неможливо видалити тип "${typeToDelete}", оскільки він використовується існуючою зброєю.`);
            return;
        }
        
        setCustomWeaponTypes(prev => prev.filter(t => t.name !== typeToDelete));
        showToast(`Тип зброї "${typeToDelete}" видалено.`);
        logAction(`Видалено тип зброї "${typeToDelete}"`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-header">Зброя</h1>
                <div className="space-x-2">
                    <button onClick={() => setShowArchived(s => !s)} className="bg-secondary text-primary-text px-4 py-2 rounded-lg hover:bg-primary transition-colors shadow-md border border-border-color">{showArchived ? "Активна зброя" : "Архів"}</button>
                    <button onClick={() => { setEditingWeapon(undefined); setIsAdding(true); }} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md">Додати зброю</button>
                </div>
            </div>

            {(isAdding || editingWeapon) && (
                <WeaponFormModal
                    weapon={editingWeapon}
                    onSave={handleSave}
                    onCancel={() => { setIsAdding(false); setEditingWeapon(undefined); }}
                    people={activePeople}
                    assignedPersonIds={assignedPersonIds}
                    customWeaponTypes={customWeaponTypes}
                />
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    {!showArchived && (
                        <Card className="mb-6">
                            <div className="flex flex-wrap gap-4 items-center">
                                <div>
                                    <label htmlFor="sortBy" className="text-sm text-secondary-text mr-2">Сортувати:</label>
                                    <select id="sortBy" value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-secondary p-2 rounded-md border border-border-color">
                                        <option value="serialNumber">За номером</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="filterByType" className="text-sm text-secondary-text mr-2">Тип:</label>
                                    <select id="filterByType" value={filterByType} onChange={e => setFilterByType(e.target.value)} className="bg-secondary p-2 rounded-md border border-border-color">
                                        <option value="all">Всі</option>
                                        {customWeaponTypes.map(type => <option key={type.name} value={type.name}>{type.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="filterByAssignment" className="text-sm text-secondary-text mr-2">Закріплення:</label>
                                    <select id="filterByAssignment" value={filterByAssignment} onChange={e => setFilterByAssignment(e.target.value)} className="bg-secondary p-2 rounded-md border border-border-color">
                                        <option value="all">Всі</option>
                                        {WEAPON_ASSIGNMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                    </select>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div className="space-y-8">
                        {Object.keys(groupedWeapons).length > 0 ? Object.entries(groupedWeapons).map(([type, weaponsList]: [string, Weapon[]]) => (
                            <div key={type}>
                                <h2 className="text-2xl font-bold text-header mb-4 border-b border-border-color pb-2">{type}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {weaponsList.map(weapon => (
                                        <Card key={weapon.id} className={`flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transform transition-all duration-300 ${showArchived ? 'opacity-60' : ''}`}>
                                            <div>
                                                <h3 className="text-lg font-bold text-header">{weapon.type} № {weapon.serialNumber}</h3>
                                                <p className="text-sm text-secondary-text mt-1">Тип: {weapon.assignmentType}</p>
                                                {weapon.assignmentType === 'іменна' && weapon.personId && (
                                                    <p className="text-sm text-secondary-text mt-1">Власник: {peopleMap.get(weapon.personId) || 'Невідомо'}</p>
                                                )}
                                                {(weapon.assignmentType === 'громадська' || weapon.assignmentType === 'резервна') && weapon.categoryId && (
                                                    <p className="text-sm text-secondary-text mt-1">Наряд: {categoryMap.get(weapon.categoryId) || 'Невідомо'}</p>
                                                )}
                                            </div>
                                            <div className="flex justify-end space-x-2 mt-4 border-t border-border-color pt-4">
                                                {showArchived ? (
                                                    <>
                                                        <button onClick={() => handlePermanentDelete(weapon)} className="text-xs bg-red-800 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors">Видалити</button>
                                                        <button onClick={() => handleRestore(weapon.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-500 transition-colors">Відновити</button>
                                                    </>
                                                ) : (
                                                    <>
                                                    <button onClick={() => { setIsAdding(false); setEditingWeapon(weapon);}} className="text-xs bg-secondary px-3 py-1 rounded-md hover:bg-primary transition-colors border border-border-color">Редагувати</button>
                                                    <button onClick={() => handleDelete(weapon)} className="text-xs bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-500 transition-colors">Архівувати</button>
                                                    </>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-secondary-text mt-8">
                                {showArchived ? "Архів порожній." : "Немає зброї, що відповідає фільтрам."}
                            </p>
                        )}
                    </div>
                </div>
                <div className="lg:col-span-1">
                    <Card title="Типи зброї та набої" className="sticky top-6">
                        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                            {customWeaponTypes.map(type => (
                                <div key={type.name} className="bg-secondary p-2 rounded-md border border-border-color flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-primary-text">{type.name}</p>
                                        <p className="text-xs text-secondary-text">Тип набоїв: {type.ammoType}</p>
                                    </div>
                                    <button onClick={() => handleDeleteType(type.name)} className="p-2 text-red-500 rounded-full hover:bg-red-500/10"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            ))}
                             {customWeaponTypes.length === 0 && <p className="text-sm text-secondary-text text-center">Немає створених типів зброї.</p>}

                            <form onSubmit={handleAddType} className="space-y-3 pt-4 border-t border-border-color">
                                <h4 className="font-semibold text-header">Додати новий тип</h4>
                                <input 
                                    type="text" 
                                    value={newTypeName} 
                                    onChange={e => setNewTypeName(e.target.value)} 
                                    placeholder="Назва типу, напр. пістолет ПМ" 
                                    className="w-full bg-primary p-2 rounded-md border border-border-color" 
                                />
                                <input 
                                    type="text" 
                                    value={newAmmoType} 
                                    onChange={e => setNewAmmoType(e.target.value)} 
                                    placeholder="Тип набоїв, напр. 9x18" 
                                    className="w-full bg-primary p-2 rounded-md border border-border-color" 
                                />
                                <button type="submit" className="w-full bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Додати</button>
                            </form>
                        </div>
                    </Card>
                </div>
            </div>
             <ConfirmationModal
                isOpen={!!weaponToDelete}
                onClose={() => setWeaponToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Архівувати зброю"
                message={<>Ви впевнені, що хочете архівувати <strong>{weaponToDelete?.type} №{weaponToDelete?.serialNumber}</strong>?</>}
            />
            <ConfirmationModal
                isOpen={!!weaponToPermanentlyDelete}
                onClose={() => setWeaponToPermanentlyDelete(null)}
                onConfirm={handleConfirmPermanentDelete}
                title="Видалити зброю назавжди"
                message={<>Ви впевнені, що хочете <strong>НАЗАВЖДИ</strong> видалити <strong>{weaponToPermanentlyDelete?.type} №{weaponToPermanentlyDelete?.serialNumber}</strong>? Цю дію неможливо буде скасувати.</>}
                confirmButtonText="Так, видалити"
                confirmButtonClassName="bg-red-800 hover:bg-red-900"
            />
        </div>
    );
};

export default Weapons;