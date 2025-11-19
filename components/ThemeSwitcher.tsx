import React from 'react';
import { useTheme, Theme } from '../context/ThemeContext';

const themes: { name: Theme, displayName: string, group: 'dark' | 'light' | 'complex', colors: string[], isTop?: boolean }[] = [
    { name: 'white', displayName: 'Classic Light', group: 'light', colors: ['#ffffff', '#f9fafb', '#06b6d4']},
    
    { name: 'dark', displayName: 'Deep Space', group: 'dark', colors: ['#0f172a', '#1e293b', '#818cf8']},
    { name: 'strong', displayName: 'Strong B&W', group: 'dark', colors: ['#000000', '#000000', '#ffffff']},

    { name: 'ocean', displayName: 'Ocean', group: 'complex', colors: ['#0c4a6e', '#0f172a', '#38bdf8']},
    { name: 'wood', displayName: 'Forest', group: 'complex', colors: ['#2e2418', '#3e3021', '#65a30d']},
    { name: 'candy', displayName: 'Candy', group: 'complex', colors: ['#fdf2f8', '#fbcfe8', '#db2777']},
    { name: 'christmas', displayName: 'Christmas', group: 'complex', colors: ['#022c22', '#064e3b', '#dc2626']},
    { name: 'harry-potter', displayName: 'Magic', group: 'complex', colors: ['#1c1917', '#292524', '#d97706']},
    { name: 'paper', displayName: 'Paper', group: 'complex', colors: ['#f5f5f5', '#ffffff', '#2563eb']},
    { name: 'military', displayName: 'Military', group: 'complex', colors: ['#3f4d38', '#4b5c42', '#a3b18a']},
    { name: 'matrix', displayName: 'Matrix', group: 'complex', colors: ['#000000', '#022c02', '#00ff00']},
    { name: 'halloween', displayName: 'Halloween', group: 'complex', colors: ['#271300', '#451a03', '#f97316']},
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

    const renderGroup = (group: 'dark' | 'light' | 'complex', title: string) => (
        <div>
            <h4 className="text-sm font-bold text-header mb-2">{title}</h4>
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
            {renderGroup('light', 'Світлі теми')}
            {renderGroup('dark', 'Темні теми')}
            {renderGroup('complex', 'Інтерактивні теми')}
        </div>
    );
};

export default ThemeSwitcher;