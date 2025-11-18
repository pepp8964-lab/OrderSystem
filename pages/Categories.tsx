import React, { useState, useMemo, useRef, useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { Category, Person, Weapon, WeaponAssignment, WeaponGroup, CustomWeaponType } from '../types';
import Card from '../components/Card';
import { AddUserIcon, EditIcon, LinkIcon, UnlinkIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, XIcon, ReorderIcon } from '../components/icons/Icons';
import { useToast, useActionLog } from '../context/ThemeContext';
import { PRESET_COLORS, RANK_CATEGORIES } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';

const SelectWeaponsModal: React.FC<{
    onClose: () => void;
    onSave: (weaponIds: string[]) => void;
    availableWeapons: Weapon[];
    requiredCount: number;
    initialSelection: string[];
}> = ({ onClose, onSave, availableWeapons, requiredCount, initialSelection }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection);
    const { showToast } = useToast();

    const handleToggle = (id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(wId => wId !== id);
            }
            if (prev.length < requiredCount) {
                return [...prev, id];
            }
            showToast(`Можна вибрати лише ${requiredCount} од. зброї.`);
            return prev;
        });
    };
    
    const handleSave = () => {
        if (selectedIds.length !== requiredCount) {
            showToast(`Будь ласка, виберіть рівно ${requiredCount} од. зброї.`);
            return;
        }
        onSave(selectedIds);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-xl font-bold text-header">Вибрати зброю ({selectedIds.length}/{requiredCount})</h2>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto">
                    {availableWeapons.map(w => (
                        <div key={w.id} className="flex items-center bg-secondary p-2 rounded-md">
                            <input
                                type="checkbox"
                                id={`weapon-${w.id}`}
                                checked={selectedIds.includes(w.id)}
                                onChange={() => handleToggle(w.id)}
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                            />
                            <label htmlFor={`weapon-${w.id}`} className="ml-3 text-primary-text">
                                {w.type} №{w.serialNumber}
                                {w.assignmentType === 'резервна' && <span className="text-xs text-accent ml-2">[Резерв]</span>}
                            </label>
                        </div>
                    ))}
                     {availableWeapons.length === 0 && <p className="text-secondary-text text-center">Немає доступної зброї цього типу.</p>}
                </div>
                <div className="flex justify-end space-x-2 p-4 border-t border-border-color">
                    <button type="button" onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                    <button onClick={handleSave} className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover transition-colors">Зберегти</button>
                </div>
            </div>
        </div>
    );
};


const CategoryFormModal: React.FC<{
    onClose: () => void;
    onSave: (category: Omit<Category, 'id' | 'deletedTimestamp' | 'parentId' | 'order' | 'isCollapsed' | 'groupName'>, id?: string) => void;
    categoryToEdit?: Category | null;
    weapons: Weapon[];
    customWeaponTypes: CustomWeaponType[];
}> = ({ onClose, onSave, categoryToEdit, weapons, customWeaponTypes }) => {
    const [name, setName] = useState('');
    const [shortName, setShortName] = useState('');
    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [dutySize, setDutySize] = useState(1);
    const [rankCategories, setRankCategories] = useState<string[]>([]);
    const [allowConsecutiveDuties, setAllowConsecutiveDuties] = useState(false);
    const [weaponAssignment, setWeaponAssignment] = useState<WeaponAssignment>({ type: 'none', groups: [{weapons:[]}, {weapons:[]}, {weapons:[]}], ammoCount: 0 });
    const [selectingWeaponGroup, setSelectingWeaponGroup] = useState<number | null>(null);

    const { showToast } = useToast();

    useEffect(() => {
        if (categoryToEdit) {
            setName(categoryToEdit.name);
            setShortName(categoryToEdit.shortName);
            setColor(categoryToEdit.color);
            setDutySize(categoryToEdit.dutySize);
            setRankCategories(categoryToEdit.rankCategories);
            setAllowConsecutiveDuties(categoryToEdit.allowConsecutiveDuties);
            const wa = categoryToEdit.weaponAssignment || { type: 'none', groups: [{weapons:[]}, {weapons:[]}, {weapons:[]}], requiredWeaponType: customWeaponTypes[0]?.name || '', ammoCount: 0 };
             if (wa.requiredWeaponType && !wa.ammoType) {
                const selectedType = customWeaponTypes.find(t => t.name === wa.requiredWeaponType);
                wa.ammoType = selectedType?.ammoType || '';
            }
            setWeaponAssignment(wa);
        }
    }, [categoryToEdit, customWeaponTypes]);
    
    const weaponsMap = useMemo(() => new Map(weapons.map(w => [w.id, w])), [weapons]);

    const handleRankToggle = (rank: string) => {
        setRankCategories(prev => prev.includes(rank) ? prev.filter(r => r !== rank) : [...prev, rank]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !shortName.trim() || rankCategories.length === 0) {
            showToast("Заповніть усі поля.");
            return;
        }
        onSave({ name, shortName, color, dutySize, rankCategories, allowConsecutiveDuties, weaponAssignment }, categoryToEdit?.id);
    };

    const handleWeaponGroupSave = (weaponIds: string[]) => {
        if (selectingWeaponGroup === null) return;
        setWeaponAssignment(prev => {
            const newGroups = [...(prev.groups || [{weapons:[]}, {weapons:[]}, {weapons:[]}])] as [WeaponGroup, WeaponGroup, WeaponGroup];
            newGroups[selectingWeaponGroup] = { weapons: weaponIds };

            if (prev.rotationType === 'static' && selectingWeaponGroup === 0) {
                newGroups[1] = { weapons: weaponIds };
                newGroups[2] = { weapons: weaponIds };
            }
            if (prev.rotationType === 'every_other_day' && selectingWeaponGroup === 1) {
                newGroups[2] = { ...newGroups[0] };
            }
            return { ...prev, groups: newGroups };
        });
    };
    
    const handleRemoveWeaponFromGroup = (groupIndex: number, weaponId: string) => {
        setWeaponAssignment(prev => {
            const newGroups = [...(prev.groups || [{weapons:[]}, {weapons:[]}, {weapons:[]}])] as [WeaponGroup, WeaponGroup, WeaponGroup];
            newGroups[groupIndex] = { weapons: newGroups[groupIndex].weapons.filter(id => id !== weaponId) };
            return { ...prev, groups: newGroups };
        });
    };

    const handleRotationTypeChange = (type: 'static' | 'every_other_day' | 'daily') => {
        setWeaponAssignment(prev => {
            if (prev.rotationType === type) return prev;
            const newGroups = [...(prev.groups || [{weapons:[]}, {weapons:[]}, {weapons:[]}])] as [WeaponGroup, WeaponGroup, WeaponGroup];
            const baseGroupWeapons = newGroups[0].weapons;

            if (type === 'static' && baseGroupWeapons.length > 0) {
                newGroups[1] = { weapons: baseGroupWeapons };
                newGroups[2] = { weapons: baseGroupWeapons };
                 showToast("Групи 2 та 3 оновлено згідно з Групою 1.", );
            }
            if (type === 'every_other_day' && newGroups[1].weapons.length > 0) {
                newGroups[2] = { weapons: baseGroupWeapons };
                showToast("Групу 3 оновлено згідно з Групою 1.");
            }
            return { ...prev, rotationType: type, groups: newGroups };
        });
    };
    
    const availableWeaponsForGroup = useMemo(() => {
        if (weaponAssignment.type === 'none' || weaponAssignment.type === 'personal' || selectingWeaponGroup === null) return [];
        
        const assignmentTypes: Weapon['assignmentType'][] = [];
        if (weaponAssignment.type === 'public') {
            assignmentTypes.push('громадська');
            if (weaponAssignment.useReserve) {
                assignmentTypes.push('резервна');
            }
        } else if (weaponAssignment.type === 'reserve') {
            assignmentTypes.push('резервна');
        }

        const assignedInOtherGroups = (weaponAssignment.groups || [])
            .filter((_, index) => index !== selectingWeaponGroup)
            .flatMap(g => g.weapons);
        
        return weapons.filter(w => 
            !w.deletedTimestamp && 
            assignmentTypes.includes(w.assignmentType) &&
            (!weaponAssignment.requiredWeaponType || w.type === weaponAssignment.requiredWeaponType) &&
            (w.categoryId === null || w.categoryId === categoryToEdit?.id) &&
            !assignedInOtherGroups.includes(w.id)
        );
    }, [weapons, weaponAssignment, categoryToEdit, selectingWeaponGroup]);
    
    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-xl font-bold text-header">{categoryToEdit ? 'Редагувати категорію' : 'Створити категорію'}</h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                    {/* Left Column */}
                    <div className="space-y-4">
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Повна назва (для наказів)" className="w-full bg-secondary p-2 rounded-md border border-border-color" />
                        <input type="text" value={shortName} onChange={e => setShortName(e.target.value)} placeholder="Скорочена назва (для тегів)" className="w-full bg-secondary p-2 rounded-md border border-border-color" />
                        <div>
                            <label className="block text-sm font-medium text-primary-text mb-2">Склад, що підходить</label>
                            <div className="flex flex-wrap gap-2 p-2 bg-secondary rounded-md border border-border-color">
                                {RANK_CATEGORIES.map(rank => (
                                    <button type="button" key={rank} onClick={() => handleRankToggle(rank)}
                                        className={`px-3 py-1 rounded-md text-sm ${rankCategories.includes(rank) ? 'bg-accent text-white' : 'bg-primary'}`}>
                                        {rank}
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div>
                            <label htmlFor="dutySize" className="block text-sm font-medium text-primary-text mb-1">Кількість осіб в наряді</label>
                            <input id="dutySize" type="number" min="1" value={dutySize} onChange={e => setDutySize(parseInt(e.target.value, 10) || 1)} className="w-full bg-secondary p-2 rounded-md border border-border-color" />
                        </div>
                         <div className="flex items-center justify-between bg-secondary p-2 rounded-md border border-border-color">
                            <label className="text-sm font-medium text-primary-text">Дозволити наряди поспіль</label>
                            <button type="button" onClick={() => setAllowConsecutiveDuties(p => !p)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${allowConsecutiveDuties ? 'bg-accent' : 'bg-gray-400'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${allowConsecutiveDuties ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary-text mb-2">Колір тегу</label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map(c => (
                                    <button type="button" key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full ${c} ${color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-accent' : ''}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                     {/* Right Column */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-header">Закріплення зброї</h3>
                        <div className="space-y-2">
                             {['none', 'personal', 'public', 'reserve'].map(type => (
                                <div key={type} className="flex items-center">
                                    <input type="radio" id={`weapon-${type}`} name="weaponAssignmentType" value={type} checked={weaponAssignment.type === type} onChange={() => setWeaponAssignment(p => ({...p, type: type as any}))} className="h-4 w-4 text-accent border-gray-300 focus:ring-accent"/>
                                    <label htmlFor={`weapon-${type}`} className="ml-3 block text-sm font-medium text-primary-text">{ {none: 'Без зброї', personal: 'Іменна', public: 'Громадська', reserve: 'Резервна'}[type] }</label>
                                </div>
                             ))}
                        </div>
                        
                        {(weaponAssignment.type === 'personal' || weaponAssignment.type === 'public' || weaponAssignment.type === 'reserve') && (
                             <div className="space-y-4 p-3 bg-secondary rounded-lg border border-border-color">
                                <div>
                                    <label className="block text-sm font-medium text-primary-text mb-2">Тип зброї</label>
                                    <select 
                                        value={weaponAssignment.requiredWeaponType || ''} 
                                        onChange={e => {
                                            const selectedType = customWeaponTypes.find(t => t.name === e.target.value);
                                            setWeaponAssignment(p => ({
                                                ...p, 
                                                requiredWeaponType: e.target.value,
                                                ammoType: selectedType?.ammoType || '',
                                                groups: [{weapons:[]}, {weapons:[]}, {weapons:[]}]
                                            }));
                                        }} 
                                        className="w-full bg-primary p-2 rounded-md border border-border-color"
                                    >
                                        <option value="">Виберіть тип</option>
                                        {customWeaponTypes.map(type => <option key={type.name} value={type.name}>{type.name}</option>)}
                                    </select>
                                </div>

                                {weaponAssignment.requiredWeaponType && (
                                    <div>
                                        <label className="block text-sm font-medium text-primary-text mb-2">Кількість набоїв ({weaponAssignment.ammoType || 'N/A'})</label>
                                        <input
                                            type="number"
                                            value={weaponAssignment.ammoCount || ''}
                                            onChange={e => setWeaponAssignment(p => ({...p, ammoCount: Number(e.target.value) >= 0 ? Number(e.target.value) : 0 }))}
                                            placeholder="Введіть кількість"
                                            className="w-full bg-primary p-2 rounded-md border border-border-color"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {(weaponAssignment.type === 'public' || weaponAssignment.type === 'reserve') && (
                            <div className="space-y-4 p-3 bg-secondary rounded-lg border border-border-color">
                                <div className="flex items-center">
                                    <input type="checkbox" id="takeFree" checked={weaponAssignment.takeFree} onChange={e => setWeaponAssignment(p => ({...p, takeFree: e.target.checked}))} className="h-4 w-4 text-accent border-gray-300 focus:ring-accent" />
                                    <label htmlFor="takeFree" className="ml-3 block text-sm font-medium text-primary-text">Брати вільне</label>
                                </div>
                                {weaponAssignment.type === 'public' && (
                                    <div className="flex items-center pl-4">
                                        <input type="checkbox" id="useReserve" checked={weaponAssignment.useReserve} onChange={e => setWeaponAssignment(p => ({...p, useReserve: e.target.checked}))} className="h-4 w-4 text-accent border-gray-300 focus:ring-accent" />
                                        <label htmlFor="useReserve" className="ml-3 block text-sm font-medium text-primary-text">Використовувати резерв</label>
                                    </div>
                                )}
                                <div className={`${weaponAssignment.takeFree ? 'opacity-50' : ''}`}>
                                     <div>
                                        <label className="block text-sm font-medium text-primary-text mb-2 mt-2">Тип ротації (якщо не "Брати вільне")</label>
                                        <select disabled={weaponAssignment.takeFree} value={weaponAssignment.rotationType || 'daily'} onChange={e => handleRotationTypeChange(e.target.value as any)} className="w-full bg-primary p-2 rounded-md border border-border-color disabled:opacity-70">
                                            <option value="daily">Щоденно</option>
                                            <option value="every_other_day">Через день</option>
                                            <option value="static">Не змінювати</option>
                                        </select>
                                    </div>
                                    {[0, 1, 2].map(i => (
                                        <div key={i}>
                                            <label className="block text-sm font-medium text-primary-text mb-1">Група {i+1}</label>
                                            <div className="p-2 border border-border-color rounded-md bg-primary min-h-[4rem]">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-xs text-secondary-text">Вибрано: {weaponAssignment.groups?.[i]?.weapons.length || 0}/{dutySize}</p>
                                                    <button type="button" disabled={weaponAssignment.takeFree} onClick={() => setSelectingWeaponGroup(i)} className="text-xs bg-accent text-white px-2 py-1 rounded-md hover:bg-accent-hover disabled:opacity-50">Вибрати</button>
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {weaponAssignment.groups?.[i]?.weapons.map(wId => (
                                                        <span key={wId} className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                                                            {weaponsMap.get(wId)?.serialNumber || 'N/A'}
                                                            <button type="button" disabled={weaponAssignment.takeFree} onClick={() => handleRemoveWeaponFromGroup(i, wId)} className="text-secondary-text hover:text-red-500 disabled:opacity-50">
                                                                <XIcon className="w-3 h-3"/>
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end space-x-2 p-4 border-t border-border-color">
                    <button type="button" onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                    <button type="submit" className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover transition-colors">Зберегти</button>
                </div>
            </form>
        </div>

        {selectingWeaponGroup !== null && (
             <SelectWeaponsModal
                onClose={() => setSelectingWeaponGroup(null)}
                onSave={handleWeaponGroupSave}
                availableWeapons={availableWeaponsForGroup}
                requiredCount={dutySize}
                initialSelection={weaponAssignment.groups?.[selectingWeaponGroup]?.weapons || []}
             />
        )}
        </>
    );
};


const AddPersonToCategoryModal: React.FC<{
    onClose: () => void;
    onAdd: (personIds: string[]) => void;
    people: Person[];
}> = ({ onClose, onAdd, people }) => {
    const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

    const handleTogglePerson = (id: string) => {
        setSelectedPersonIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
    };

    const handleSave = () => {
        onAdd(selectedPersonIds);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color">
                    <h2 className="text-xl font-bold text-header">Додати особу до категорії</h2>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto">
                    {people.map(person => (
                        <div key={person.id} className="flex items-center bg-secondary p-2 rounded-md">
                            <input 
                                type="checkbox"
                                id={`person-${person.id}`}
                                checked={selectedPersonIds.includes(person.id)}
                                onChange={() => handleTogglePerson(person.id)}
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                            />
                            <label htmlFor={`person-${person.id}`} className="ml-3 text-primary-text">
                                {person.fullName}
                            </label>
                        </div>
                    ))}
                    {people.length === 0 && <p className="text-secondary-text text-center">Всі особи вже в цій категорії.</p>}
                </div>
                <div className="flex justify-end space-x-2 p-4 border-t border-border-color">
                    <button type="button" onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                    <button onClick={handleSave} className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover transition-colors">Додати</button>
                </div>
            </div>
        </div>
    );
};

const AttachCategoryModal: React.FC<{
    onClose: () => void;
    onAttach: (parentId: string) => void;
    categories: Category[];
    currentCategoryId: string;
}> = ({ onClose, onAttach, categories, currentCategoryId }) => {
    const potentialParents = useMemo(() => {
        return categories.filter(c => !c.parentId && c.id !== currentCategoryId);
    }, [categories, currentCategoryId]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border-color"><h2 className="text-xl font-bold text-header">Прикріпити до категорії</h2></div>
                <div className="p-4 space-y-2 overflow-y-auto">
                    {potentialParents.map(cat => (
                        <button key={cat.id} onClick={() => onAttach(cat.id)} className="w-full text-left bg-secondary p-3 rounded-md hover:bg-primary transition-colors border border-border-color">
                            {cat.name}
                        </button>
                    ))}
                    {potentialParents.length === 0 && <p className="text-secondary-text text-center">Немає доступних батьківських категорій.</p>}
                </div>
                <div className="flex justify-end p-4 border-t border-border-color">
                    <button type="button" onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Скасувати</button>
                </div>
            </div>
        </div>
    );
};


const Categories: React.FC = () => {
    const [categories, setCategories] = useLocalStorage<Category[]>('categories', []);
    const [people, setPeople] = useLocalStorage<Person[]>('people', []);
    const [weapons, setWeapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [customWeaponTypes] = useLocalStorage<CustomWeaponType[]>('custom-weapon-types', []);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [addingToCategory, setAddingToCategory] = useState<Category | null>(null);
    const [attachingCategory, setAttachingCategory] = useState<Category | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
    const [categoryToPermanentlyDelete, setCategoryToPermanentlyDelete] = useState<Category | null>(null);
    const { showToast } = useToast();
    const { logAction } = useActionLog();

    const dragItem = useRef<string | null>(null);
    const dragOverItem = useRef<string | null>(null);
    const dragParent = useRef<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState('');

    useEffect(() => {
        if (editingNameId && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [editingNameId]);

    const handleStartEditName = (category: Category) => {
        setEditingNameId(category.id);
        setEditingNameValue(category.groupName || category.name);
    };

    const handleSaveName = () => {
        if (!editingNameId || !editingNameValue.trim()) {
            setEditingNameId(null);
            return;
        }
        const originalCategory = categories.find(c => c.id === editingNameId);
        const originalGroupName = originalCategory?.groupName || originalCategory?.name;

        if (originalCategory && originalGroupName !== editingNameValue.trim()) {
            setCategories(prev =>
                prev.map(c => (c.id === editingNameId ? { ...c, groupName: editingNameValue.trim() } : c))
            );
            logAction(`Перейменовано групу "${originalGroupName}" на "${editingNameValue.trim()}"`);
        }
        setEditingNameId(null);
    };
    
    const handleNameEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveName();
        } else if (e.key === 'Escape') {
            setEditingNameId(null);
        }
    };


    useEffect(() => {
        let needsUpdate = false;
        const updatedCategories = categories.map((cat, index) => {
            if (typeof cat.order !== 'number') {
                needsUpdate = true;
                return { ...cat, order: index };
            }
            return cat;
        });

        if (needsUpdate) {
            setCategories(updatedCategories);
        }
    }, [categories, setCategories]);


    const handleSaveCategory = (categoryData: Omit<Category, 'id' | 'deletedTimestamp' | 'parentId' | 'order' | 'isCollapsed' | 'groupName'>, idToUpdate?: string) => {
        let updatedWeapons = [...weapons];
        if (idToUpdate) {
            updatedWeapons = updatedWeapons.map(w => w.categoryId === idToUpdate ? {...w, categoryId: null} : w);
        }
        
        const weaponIdsToAssign = categoryData.weaponAssignment?.groups?.flatMap(g => g.weapons) || [];
        updatedWeapons = updatedWeapons.map(w => weaponIdsToAssign.includes(w.id) ? {...w, categoryId: idToUpdate || 'temp_id'} : w);

        if (idToUpdate) {
            setCategories(prev => prev.map(c => c.id === idToUpdate ? { ...c, ...categoryData } : c));
            showToast("Категорію оновлено.");
            logAction(`Оновлено категорію "${categoryData.name}"`);
        } else {
            const newId = crypto.randomUUID();
            updatedWeapons = updatedWeapons.map(w => w.categoryId === 'temp_id' ? {...w, categoryId: newId} : w);
            setCategories(prev => {
                const newCategory: Category = {
                    id: newId,
                    ...categoryData,
                    deletedTimestamp: null,
                    parentId: null,
                    order: prev.length,
                    isCollapsed: false,
                };
                return [...prev, newCategory];
            });
            showToast("Категорію створено.");
            logAction(`Створено нову категорію "${categoryData.name}"`);
        }
        setWeapons(updatedWeapons);
        setIsAddingCategory(false);
        setEditingCategory(null);
    };

    const handleDeleteCategory = (category: Category) => setCategoryToDelete(category);
    const handlePermanentDelete = (category: Category) => setCategoryToPermanentlyDelete(category);
    
    const handleConfirmDeleteCategory = () => {
        if (!categoryToDelete) return;

        setCategories(prev => {
            let newCats = prev.map(c => c.id === categoryToDelete.id ? { ...c, deletedTimestamp: Date.now() } : c);
            if (!categoryToDelete.parentId) {
                newCats = newCats.map(c => c.parentId === categoryToDelete.id ? { ...c, parentId: null } : c);
            }
            return newCats;
        });

        showToast(`Категорію "${categoryToDelete.name}" архівувано.`);
        logAction(`Архівувано категорію "${categoryToDelete.name}"`);
        setCategoryToDelete(null);
    };
    
    const handleConfirmPermanentDelete = () => {
        if (!categoryToPermanentlyDelete) return;
        setCategories(prev => prev.filter(c => c.id !== categoryToPermanentlyDelete.id));
        showToast(`Категорію "${categoryToPermanentlyDelete.name}" видалено.`);
        logAction(`Назавжди видалено категорію "${categoryToPermanentlyDelete.name}"`);
        setCategoryToPermanentlyDelete(null);
    }

    const handleRestoreCategory = (id: string) => {
         const category = categories.find(c => c.id === id);
         setCategories(prev => prev.map(c => c.id === id ? { ...c, deletedTimestamp: null } : c));
         showToast(`Категорію "${category?.name}" відновлено.`);
         logAction(`Відновлено категорію "${category?.name}" з архіву.`);
    }

    const handleAddPeopleToCategory = (personIds: string[]) => {
        if (!addingToCategory) return;
        setPeople(prev => prev.map(p => {
            if (personIds.includes(p.id)) {
                return { ...p, categoryIds: [...new Set([...p.categoryIds, addingToCategory.id])] };
            }
            return p;
        }));
        showToast(`Додано ${personIds.length} осіб до "${addingToCategory.name}".`);
        logAction(`Додано ${personIds.length} осіб до категорії "${addingToCategory.name}"`);
    };

    const handleAttachCategory = (parentId: string) => {
        if (!attachingCategory) return;
        setCategories(prev => {
            const childrenOfParent = prev.filter(c => c.parentId === parentId);
            const parentCat = prev.find(c => c.id === parentId);
            const isFirstChild = childrenOfParent.length === 0;
            
            return prev.map(c => {
                if (c.id === attachingCategory.id) {
                    return { ...c, parentId, order: childrenOfParent.length };
                }
                if (c.id === parentId && isFirstChild && !parentCat?.groupName) {
                    return { ...c, groupName: c.name };
                }
                return c;
            });
        });
        showToast(`Категорію прикріплено.`);
        logAction(`Категорію "${attachingCategory.name}" прикріплено до "${categories.find(c=>c.id === parentId)?.name}"`);
        setAttachingCategory(null);
    };

    const handleDetachCategory = (categoryId: string) => {
        setCategories(prev => {
            const categoryToDetach = prev.find(c => c.id === categoryId);
            if (!categoryToDetach || !categoryToDetach.parentId) return prev;
    
            const parentId = categoryToDetach.parentId;
            const siblingsCount = prev.filter(c => c.parentId === parentId).length;
    
            return prev.map(c => {
                if (c.id === categoryId) {
                    const { parentId: _removed, ...rest } = c;
                    return { ...rest, parentId: null, order: prev.length };
                }
                if (c.id === parentId && siblingsCount === 1) {
                    const newCat = { ...c, isCollapsed: false };
                    delete (newCat as Partial<Category>).groupName;
                    return newCat;
                }
                return c;
            });
        });
        showToast(`Категорію відкріплено.`);
        logAction(`Категорію відкріплено.`);
    };

    const handleDragSort = () => {
        const draggedId = dragItem.current;
        const targetId = dragOverItem.current;
        const parentId = dragParent.current;

        if (!draggedId || !targetId || draggedId === targetId) return;

        setCategories(currentCategories => {
            const allCats = [...currentCategories];
            const contextItems = allCats.filter(c => (c.parentId || null) === (parentId || null)).sort((a, b) => a.order - b.order);
            const draggedIdx = contextItems.findIndex(c => c.id === draggedId);
            const targetIdx = contextItems.findIndex(c => c.id === targetId);

            if (draggedIdx === -1 || targetIdx === -1) return currentCategories;

            const [removed] = contextItems.splice(draggedIdx, 1);
            contextItems.splice(targetIdx, 0, removed);
            
            const updatedOrderMap = new Map(contextItems.map((item, index) => [item.id, index]));

            return allCats.map(c => {
                if (updatedOrderMap.has(c.id)) {
                    return { ...c, order: updatedOrderMap.get(c.id)! };
                }
                return c;
            });
        });
        
        dragItem.current = null;
        dragOverItem.current = null;
        dragParent.current = null;
    };
    
    const toggleCollapse = (categoryId: string) => {
        setCategories(prev => prev.map(c => c.id === categoryId ? {...c, isCollapsed: !c.isCollapsed} : c));
    };

    const activePeople = useMemo(() => people.filter(p => !p.deletedTimestamp), [people]);
    
    const sortedRenderableItems = useMemo(() => {
        const sourceCategories = showArchived ? categories.filter(c => c.deletedTimestamp) : categories.filter(c => !c.deletedTimestamp);
        const categoryMap = new Map(sourceCategories.map(c => [c.id, { ...c, children: [] as Category[] }]));
        const roots: (Category & { children: Category[] })[] = [];

        for (const category of sourceCategories) {
            if (category.parentId && categoryMap.has(category.parentId)) {
                const parent = categoryMap.get(category.parentId)!;
                if(sourceCategories.some(sc => sc.id === category.id)) {
                    parent.children.push(category);
                }
            } else {
                roots.push(categoryMap.get(category.id)!);
            }
        }
        roots.forEach(root => root.children.sort((a, b) => a.order - b.order));
        return roots.sort((a, b) => a.order - b.order);
    }, [categories, showArchived]);

    const peopleByCategory = useMemo(() => {
        const map = new Map<string, Person[]>();
        const sourceCategories = showArchived ? categories.filter(c => c.deletedTimestamp) : categories.filter(c => !c.deletedTimestamp)
        sourceCategories.forEach(cat => map.set(cat.id, []));
        activePeople.forEach(person => {
            person.categoryIds.forEach(catId => {
                if (map.has(catId)) {
                    map.get(catId)?.push(person);
                }
            });
        });
        return map;
    }, [categories, showArchived, activePeople]);

    const peopleNotInCurrentCategory = useMemo(() => {
        if (!addingToCategory) return [];
        const peopleInCat = peopleByCategory.get(addingToCategory.id)?.map(p => p.id) || [];
        const availableByRank = activePeople.filter(p => addingToCategory.rankCategories.includes(p.rankCategory as string));
        return availableByRank.filter(p => !peopleInCat.includes(p.id));
    }, [addingToCategory, peopleByCategory, activePeople]);

    const CategoryRow: React.FC<{ category: Category; numberPrefix: string; isChild?: boolean; isDraggable?: boolean }> = ({ category, numberPrefix, isChild = false, isDraggable = false }) => {
        const peopleCount = peopleByCategory.get(category.id)?.length || 0;
        return (
            <div className="flex items-center gap-2 md:gap-4 p-2 bg-secondary rounded-lg border border-border-color group">
                {isDraggable && <ReorderIcon className="w-5 h-5 text-secondary-text cursor-grab flex-shrink-0" />}
                <span className="font-mono text-sm text-secondary-text">{numberPrefix}</span>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${category.color || 'bg-accent'}`} />
                <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-header truncate" title={category.name}>{category.name}</h3>
                    <p className="text-xs text-secondary-text truncate">{category.shortName}</p>
                </div>
                <div className="hidden md:flex items-center gap-3 text-xs text-secondary-text flex-shrink-0">
                    <span>К-сть: <strong className="text-primary-text">{category.dutySize}</strong></span>
                    <span>Склад: <strong className="text-primary-text">{category.rankCategories?.join(', ')}</strong></span>
                    <span>Осіб: <strong className="text-primary-text">{peopleCount}</strong></span>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                    {showArchived ? (
                        <>
                            <button onClick={() => handlePermanentDelete(category)} className="p-2 rounded-full hover:bg-red-500/20 text-red-500" title="Видалити"><XIcon className="w-5 h-5"/></button>
                            <button onClick={() => handleRestoreCategory(category.id)} className="p-2 rounded-full hover:bg-green-500/20 text-green-500" title="Відновити"><ReorderIcon className="w-5 h-5"/></button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setAddingToCategory(category)} className="p-2 rounded-full hover:bg-accent/20 text-accent" title="Додати особу"><AddUserIcon className="w-5 h-5"/></button>
                            <button onClick={() => setEditingCategory(category)} className="p-2 rounded-full hover:bg-accent/20 text-accent" title="Редагувати"><EditIcon className="w-5 h-5"/></button>
                            {isChild ? 
                                <button onClick={() => handleDetachCategory(category.id)} className="p-2 rounded-full hover:bg-accent/20 text-accent" title="Відкріпити"><UnlinkIcon className="w-5 h-5"/></button>
                                : <button onClick={() => setAttachingCategory(category)} className="p-2 rounded-full hover:bg-accent/20 text-accent" title="Прикріпити до групи"><LinkIcon className="w-5 h-5"/></button>
                            }
                            <button onClick={() => handleDeleteCategory(category)} className="p-2 rounded-full hover:bg-red-500/20 text-red-500" title="Архівувати"><XIcon className="w-5 h-5"/></button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-header">Категорії нарядів</h1>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setShowArchived(s => !s)} className="bg-secondary text-primary-text px-4 py-2 rounded-lg hover:bg-primary transition-colors shadow-md border border-border-color">{showArchived ? "Активні категорії" : "Архів"}</button>
                    <button onClick={() => { setIsAddingCategory(true); setEditingCategory(null); }} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md">Створити</button>
                </div>
            </div>
            
            {(sortedRenderableItems.length === 0) ? (
                 <p className="text-center text-secondary-text mt-8">{showArchived ? "Архів категорій порожній." : "Немає жодної категорії."}</p>
            ) : (
                <div className="space-y-4">
                    {sortedRenderableItems.map((item, groupIndex) => {
                        const isGroup = item.children && item.children.length > 0;
                        const groupNumber = groupIndex + 1;
                        return (
                            <div key={item.id}
                                draggable={!showArchived}
                                onDragStart={(e) => { dragItem.current = item.id; dragParent.current = item.parentId || null; }}
                                onDragEnter={(e) => dragOverItem.current = item.id}
                                onDragEnd={handleDragSort}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                <Card className="p-4 space-y-3">
                                    <div className="flex items-center gap-2 group">
                                        <ReorderIcon className="w-5 h-5 text-secondary-text cursor-grab" />
                                        <span className="font-mono text-xl text-secondary-text">{groupNumber}.</span>
                                        {isGroup && (
                                            <button onClick={() => toggleCollapse(item.id)} className="p-1 rounded-full hover:bg-secondary">
                                                {item.isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                                            </button>
                                        )}
                                        {editingNameId === item.id ? (
                                             <input
                                                ref={nameInputRef} type="text" value={editingNameValue}
                                                onChange={(e) => setEditingNameValue(e.target.value)}
                                                onBlur={handleSaveName} onKeyDown={handleNameEditKeyDown}
                                                className="bg-primary text-header font-bold p-1 text-xl rounded-md border border-accent focus:outline-none"
                                            />
                                        ) : (
                                            <h2 className="text-xl font-bold text-header cursor-pointer" onDoubleClick={() => handleStartEditName(item)}>
                                                {item.groupName || item.name}
                                            </h2>
                                        )}
                                        {!showArchived && (
                                            <button onClick={() => handleStartEditName(item)} className="text-secondary-text opacity-0 group-hover:opacity-100 transition-opacity" title="Редагувати назву групи">
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <CategoryRow category={item} numberPrefix={`${groupNumber}.1`} isDraggable={false} />

                                        {isGroup && !item.isCollapsed && (
                                            <div className="category-children-container space-y-2 pt-2">
                                                {item.children.map((child, childIndex) => (
                                                    <div key={child.id}
                                                        className="category-child-item"
                                                        draggable={!showArchived}
                                                        onDragStart={(e) => { e.stopPropagation(); dragItem.current = child.id; dragParent.current = child.parentId || null; }}
                                                        onDragEnter={(e) => { e.stopPropagation(); dragOverItem.current = child.id; }}
                                                        onDragEnd={(e) => { e.stopPropagation(); handleDragSort(); }}
                                                        onDragOver={(e) => e.preventDefault()}
                                                    >
                                                        <CategoryRow category={child} numberPrefix={`${groupNumber}.${childIndex + 2}`} isChild isDraggable />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        )
                    })}
                </div>
            )}

            {(isAddingCategory || editingCategory) && (
                <CategoryFormModal 
                    onClose={() => { setIsAddingCategory(false); setEditingCategory(null); }}
                    onSave={handleSaveCategory}
                    categoryToEdit={editingCategory}
                    weapons={weapons}
                    customWeaponTypes={customWeaponTypes}
                />
            )}

            {addingToCategory && (
                <AddPersonToCategoryModal 
                    onClose={() => setAddingToCategory(null)}
                    onAdd={handleAddPeopleToCategory}
                    people={peopleNotInCurrentCategory}
                />
            )}
            
            {attachingCategory && (
                <AttachCategoryModal
                    onClose={() => setAttachingCategory(null)}
                    onAttach={handleAttachCategory}
                    categories={sortedRenderableItems.filter(c => c.id !== attachingCategory.id)}
                    currentCategoryId={attachingCategory.id}
                />
            )}

            <ConfirmationModal
                isOpen={!!categoryToDelete}
                onClose={() => setCategoryToDelete(null)}
                onConfirm={handleConfirmDeleteCategory}
                title="Архівувати категорію"
                message={<>Ви впевнені, що хочете архівувати категорію <strong>{categoryToDelete?.name}</strong>? Це від'єднає всі дочірні категорії, якщо вони є.</>}
            />

            <ConfirmationModal
                isOpen={!!categoryToPermanentlyDelete}
                onClose={() => setCategoryToPermanentlyDelete(null)}
                onConfirm={handleConfirmPermanentDelete}
                title="Видалити категорію назавжди"
                message={<>Ви впевнені, що хочете <strong>НАЗАВЖДИ</strong> видалити категорію <strong>{categoryToPermanentlyDelete?.name}</strong>? Цю дію неможливо буде скасувати.</>}
                confirmButtonText="Так, видалити"
                confirmButtonClassName="bg-red-800 hover:bg-red-900"
            />
        </div>
    );
};

export default Categories;