import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, UsersIcon, TagIcon, CalendarIcon, MenuIcon, WeaponIcon, HistoryIcon, SettingsIcon, StructureIcon, BellIcon, LaboratoryIcon, ExitIcon, SearchIcon, QuestionMarkCircleIcon } from './icons/Icons';
import { useModal } from '../context/ThemeContext';
import { useSearch } from '../context/SearchContext';
import useNotifications from '../hooks/useNotifications';

interface SidebarProps {
    openExitModal: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openExitModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { openRosterModal, openHotkeyHelp, toggleNotifications, isNotificationsOpen } = useModal();
  const { searchQuery, setSearchQuery, setIsSearchOpen } = useSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const { totalNotifications } = useNotifications();


  const mainNavItems = [
    { to: '/', icon: <HomeIcon />, label: 'Головна' },
    { to: '/people', icon: <UsersIcon />, label: 'Особовий склад' },
    { to: '/structure', icon: <StructureIcon />, label: 'Структура' },
    { to: '/categories', icon: <TagIcon />, label: 'Категорії' },
    { to: '/weapons', icon: <WeaponIcon />, label: 'Зброя' },
    { to: '/history', icon: <HistoryIcon />, label: 'Історія' },
    { to: '/updates', icon: <BellIcon />, label: 'Оновлення' },
    { to: '/settings', icon: <SettingsIcon />, label: 'Налаштування' },
    { to: '/laboratory', icon: <LaboratoryIcon />, label: 'Лабораторія', isSpecial: true },
  ];
  const scheduleNavItem = { to: '/schedule', icon: <CalendarIcon />, label: 'Графік' };


  const linkClasses = "flex items-center px-4 py-4 text-gray-200 hover:bg-accent hover:text-white transition-all duration-200 rounded-lg";
  const activeLinkClasses = "bg-accent text-white shadow-lg";

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsSearchOpen(query.length > 0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchRef.current?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <button 
        className="non-printable fixed top-4 left-4 z-20 p-2 rounded-md bg-sidebar/80 backdrop-blur-sm text-white lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Відкрити меню"
        aria-expanded={isOpen}
      >
        <MenuIcon />
      </button>
      <aside className={`non-printable bg-sidebar w-72 min-h-screen p-6 flex-shrink-0 flex flex-col justify-between fixed lg:relative z-40 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl backdrop-blur-lg`}>
        <div className="flex-grow flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <button onClick={openExitModal} className="text-center hover:bg-white/10 p-2 rounded-lg transition-colors">
                <h1 className="text-white text-4xl font-bold tracking-wider">СОН</h1>
                <p className="text-secondary-text text-xs tracking-widest">Система обліку нарядів</p>
            </button>
            <button onClick={toggleNotifications} className={`p-3 rounded-full relative transition-colors ${isNotificationsOpen ? 'bg-accent text-white' : 'text-gray-200 hover:bg-accent'}`}>
                <BellIcon />
                {totalNotifications > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-sidebar">
                        {totalNotifications}
                    </span>
                )}
            </button>
          </div>
          <div className="relative mb-6">
              <SearchIcon className="w-5 h-5 absolute top-1/2 -translate-y-1/2 left-3 text-secondary-text pointer-events-none" />
              <input
                  ref={searchRef}
                  type="search"
                  placeholder="Пошук... (Ctrl+K)"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => { if(searchQuery) setIsSearchOpen(true) }}
                  className="w-full bg-primary text-primary-text pl-10 pr-4 py-2 rounded-lg border border-border-color focus:outline-none focus:ring-2 focus:ring-accent"
              />
          </div>
          <nav className="flex-grow">
            <ul className="space-y-2">
              {mainNavItems.map(item => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : ''}`}
                  >
                    {item.icon}
                    <span className={`ml-4 font-medium ${item.isSpecial ? 'animate-gradient-text' : ''}`}>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
             <ul className="mt-8 space-y-2">
                 <li>
                    <NavLink
                        to={scheduleNavItem.to}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : ''}`}
                    >
                        {scheduleNavItem.icon}
                        <span className="ml-4 font-medium">{scheduleNavItem.label}</span>
                    </NavLink>
                 </li>
                 <li>
                    <button 
                      onClick={() => { openRosterModal(); setIsOpen(false); }}
                      className="w-full text-center bg-accent/20 text-accent px-4 py-3 rounded-lg hover:bg-accent hover:text-white transition-colors mt-2 text-sm font-semibold"
                    >
                      Довести наряд
                    </button>
                 </li>
            </ul>
          </nav>
        </div>
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                 <button
                    onClick={openExitModal}
                    className="w-full flex items-center justify-center px-4 py-3 text-gray-200 hover:bg-red-600/80 hover:text-white transition-all duration-200 rounded-lg border border-border-color hover:border-red-600"
                >
                    <ExitIcon />
                    <span className="ml-4 font-medium">Закрити</span>
                </button>
                 <button onClick={openHotkeyHelp} className="flex-shrink-0 p-3 text-gray-200 hover:bg-accent hover:text-white rounded-lg border border-border-color" title="Гарячі клавіші (Shift+?)">
                    <QuestionMarkCircleIcon />
                </button>
            </div>
            <div className="text-center text-xs text-secondary-text pt-2">
                <p>@ 2025 Everest-CODE Danil Khablak ^-^</p>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;