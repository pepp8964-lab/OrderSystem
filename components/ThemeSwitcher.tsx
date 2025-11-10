import React from 'react';
import { useTheme, Theme } from '../context/ThemeContext';

const themes: { name: Theme, displayName: string, group: 'dark' | 'light', colors: string[], isTop?: boolean }[] = [
    { name: 'dark', displayName: 'Deep Space', group: 'dark', colors: ['#0f172a', '#1e293b', '#818cf8'], isTop: true},
    { name: 'vibrant-dark', displayName: 'Vibrant', group: 'dark', colors: ['#0d0221', '#240b36', '#ff00e5']},
    { name: 'bw', displayName: 'Monochrome', group: 'dark', colors: ['#0a0a0a', '#141414', '#ffffff']},
    { name: 'br', displayName: 'Crimson', group: 'dark', colors: ['#0a0a0a', '#1a0505', '#ef4444'], isTop: true},
    { name: 'bb', displayName: 'Azure', group: 'dark', colors: ['#050a1a', '#0a142e', '#3b82f6'], isTop: true},
    { name: 'by', displayName: 'Amber', group: 'dark', colors: ['#1a1605', '#2e280a', '#facc15']},
    { name: 'mint-dark', displayName: 'Mint Dark', group: 'dark', colors: ['#064e3b', '#052e16', '#34d399']},
    { name: 'navy-dark', displayName: 'Navy Dark', group: 'dark', colors: ['#0f172a', '#1e293b', '#818cf8'], isTop: true},
    { name: 'rose-dark', displayName: 'Violet', group: 'dark', colors: ['#581c87', '#4c1d95', '#a78bfa']},
    { name: 'orange-dark', displayName: 'Fuchsia', group: 'dark', colors: ['#4a1d33', '#581c3c', '#f9a8d4']},
    { name: 'military', displayName: 'Military', group: 'dark', colors: ['#3d402b', '#2c2e1f', '#b99142'], isTop: true },
    { name: 'matrica', displayName: 'Matrica', group: 'dark', colors: ['#020b03', '#051407', '#33ff33'], isTop: true },
    { name: 'stalker', displayName: 'Stalker', group: 'dark', colors: ['#291c3d', '#1a1128', '#c039f0'] },
    { name: 'prime', displayName: 'Prime', group: 'dark', colors: ['#121212', '#1e1e1e', '#00c6ff'] },
    { name: 'robot', displayName: 'Robot', group: 'dark', colors: ['#0a192f', '#172a45', '#64ffda']},
    { name: 'cowboy', displayName: 'Cowboy', group: 'dark', colors: ['#4a2c2a', '#3e2723', '#d7ccc8']},
    { name: 'fall', displayName: 'Fall', group: 'dark', colors: ['#4a2511', '#3c1e0e', '#e85d04']},
    { name: 'christmas', displayName: 'Christmas', group: 'dark', colors: ['#0a3d1b', '#083116', '#d4af37']},
    { name: 'valentine', displayName: 'Valentine', group: 'dark', colors: ['#4c0033', '#3c0029', '#ff4d6d']},
    { name: 'halloween', displayName: 'Halloween', group: 'dark', colors: ['#0d0221', '#0a011a', '#ff7900']},
    { name: 'grass', displayName: 'Grass', group: 'dark', colors: ['#1e4620', '#143516', '#76c893']},
    { name: 'candy', displayName: 'Candy', group: 'dark', colors: ['#ff75a0', '#ff578f', '#00f5d4']},
    { name: 'potter', displayName: 'Harry Potter', group: 'dark', colors: ['#0c1445', '#050822', '#e3a000']},
    { name: 'spotlight', displayName: 'Spotlight', group: 'dark', colors: ['#000000', '#111111', '#ffffff']},
    { name: 'white', displayName: 'Classic Light', group: 'light', colors: ['#ffffff', '#f9fafb', '#06b6d4']},
    { name: 'mint', displayName: 'Mint Light', group: 'light', colors: ['#F0FDF4', '#DCFCE7', '#22C55E']},
    { name: 'navy', displayName: 'Navy Light', group: 'light', colors: ['#f8fafc', '#f1f5f9', '#4f46e5']},
    { name: 'rose', displayName: 'Rose', group: 'light', colors: ['#fff1f2', '#ffe4e6', '#f43f5e']},
    { name: 'orange', displayName: 'Orange', group: 'light', colors: ['#fff7ed', '#ffedd5', '#f97316']},
];

const ThemeSwatch: React.FC<{ themeInfo: typeof themes[0], isSelected: boolean, onClick: () => void }> = ({ themeInfo, isSelected, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-all duration-200 w-28 h-28 justify-center border-2 ${isSelected ? 'border-accent/50 bg-accent/10' : 'border-transparent hover:bg-secondary'}`}
            aria-label={`Switch to ${themeInfo.displayName} theme`}
        >
            <div className={`w-16 h-12 rounded-md overflow-hidden flex shadow-inner transition-all duration-200 relative ${isSelected ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''}`}>
                <div 
                    className="w-full h-full border-2 p-1.5 flex flex-col gap-1.5 relative"
                    style={{ backgroundColor: themeInfo.colors[1], borderColor: themeInfo.colors[0] }}
                >
                    <div className="w-3/4 h-2 rounded-sm" style={{ backgroundColor: themeInfo.colors[0] }}></div>
                    <div className="w-1/2 h-2 rounded-sm" style={{ backgroundColor: themeInfo.colors[0] }}></div>
                    <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full" style={{ backgroundColor: themeInfo.colors[2] }}></div>
                </div>
                {themeInfo.isTop && (
                    <span className="absolute top-1 right-1 text-xs font-bold text-white bg-red-600 px-1 rounded animate-top-pulse">TOP</span>
                )}
            </div>
            <span className={`text-xs font-medium ${isSelected ? 'text-header' : 'text-secondary-text'}`}>{themeInfo.displayName}</span>
        </button>
    );
}

const ThemeSwitcher: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const renderGroup = (group: 'dark' | 'light') => (
        <div>
            <h4 className="text-sm font-bold text-header mb-2">{group === 'dark' ? 'Темні теми' : 'Світлі теми'}</h4>
            <div className="flex flex-wrap gap-2">
                {themes.filter(t => t.group === group).map(t => (
                    <ThemeSwatch 
                        key={t.name}
                        themeInfo={t}
                        isSelected={theme === t.name}
                        onClick={() => setTheme(t.name)}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {renderGroup('dark')}
            {renderGroup('light')}
        </div>
    );
};

export default ThemeSwitcher;