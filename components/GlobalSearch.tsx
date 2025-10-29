import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useLocalStorage from '../hooks/useLocalStorage';
import { useSearch } from '../context/SearchContext';
import { Person, Category, Weapon, Subdivision } from '../types';
import { UsersIcon, TagIcon, WeaponIcon, StructureIcon } from './icons/Icons';

type SearchResult = {
    id: string;
    name: string;
    type: 'person' | 'category' | 'weapon' | 'subdivision';
    link: string;
    details?: string;
};

const GlobalSearch: React.FC = () => {
    const { searchQuery, setIsSearchOpen, setSearchQuery } = useSearch();
    const [people] = useLocalStorage<Person[]>('people', []);
    const [categories] = useLocalStorage<Category[]>('categories', []);
    const [weapons] = useLocalStorage<Weapon[]>('weapons', []);
    const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
    const navigate = useNavigate();
    const searchContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setIsSearchOpen]);

    const searchResults = React.useMemo(() => {
        if (!searchQuery) return [];
        const query = searchQuery.toLowerCase();
        const results: SearchResult[] = [];

        people.filter(p => !p.deletedTimestamp).forEach(p => {
            if (p.fullName.toLowerCase().includes(query) || 
                p.tin.includes(query) ||
                (p.lastName && p.lastName.toLowerCase().includes(query)) ||
                (p.firstName && p.firstName.toLowerCase().includes(query)) ||
                (p.patronymic && p.patronymic.toLowerCase().includes(query))
            ) {
                results.push({ id: p.id, name: p.fullName, type: 'person', link: '/people', details: p.rank });
            }
        });
        categories.filter(c => !c.deletedTimestamp).forEach(c => {
            if (c.name.toLowerCase().includes(query) || c.shortName.toLowerCase().includes(query)) {
                results.push({ id: c.id, name: c.name, type: 'category', link: '/categories' });
            }
        });
        weapons.filter(w => !w.deletedTimestamp).forEach(w => {
            if (w.serialNumber.toLowerCase().includes(query) || w.type.toLowerCase().includes(query)) {
                results.push({ id: w.id, name: `${w.type} №${w.serialNumber}`, type: 'weapon', link: '/weapons' });
            }
        });
        subdivisions.forEach(s => {
            if (s.name.toLowerCase().includes(query)) {
                results.push({ id: s.id, name: s.name, type: 'subdivision', link: '/structure' });
            }
        });

        return results;
    }, [searchQuery, people, categories, weapons, subdivisions]);

    const groupedResults = React.useMemo(() => {
        return searchResults.reduce((acc, result) => {
            const type = result.type;
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(result);
            return acc;
        }, {} as Record<SearchResult['type'], SearchResult[]>);
    }, [searchResults]);
    
    const handleResultClick = (link: string) => {
        navigate(link);
        setIsSearchOpen(false);
        setSearchQuery('');
    };

    const typeInfo = {
        person: { title: 'Особовий склад', icon: <UsersIcon className="w-5 h-5" /> },
        category: { title: 'Категорії', icon: <TagIcon className="w-5 h-5" /> },
        weapon: { title: 'Зброя', icon: <WeaponIcon className="w-5 h-5" /> },
        subdivision: { title: 'Підрозділи', icon: <StructureIcon className="w-5 h-5" /> },
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-30" >
            <div ref={searchContainerRef} className="absolute top-24 left-80 w-full max-w-xl bg-card rounded-xl border border-border-color shadow-2xl max-h-[70vh] flex flex-col">
                {searchResults.length > 0 ? (
                    <div className="overflow-y-auto p-2">
                        {(Object.keys(groupedResults) as Array<keyof typeof groupedResults>).map((type) => (
                            <div key={type} className="p-2">
                                <h3 className="text-sm font-semibold text-secondary-text mb-2 px-2 flex items-center gap-2">
                                    {typeInfo[type].icon}
                                    {typeInfo[type].title}
                                </h3>
                                <ul className="space-y-1">
                                    {groupedResults[type].map(result => (
                                        <li key={result.id}>
                                            <button onClick={() => handleResultClick(result.link)} className="w-full text-left p-2 rounded-md hover:bg-secondary transition-colors">
                                                <p className="text-primary-text">{result.name}</p>
                                                {result.details && <p className="text-xs text-secondary-text">{result.details}</p>}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-16 text-center text-secondary-text">
                        Нічого не знайдено за запитом "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
};

export default GlobalSearch;