
import React from 'react';
import { useTheme, Theme } from '../context/ThemeContext';

const themes: { name: Theme, displayName: string, group: 'basic' | 'vibrant' | 'atmospheric', colors: string[], isNew?: boolean }[] = [
    // Basic
    { name: 'dark', displayName: 'Classic Dark', group: 'basic', colors: ['#0f172a', '#1e293b', '#6366f1']},
    { name: 'white', displayName: 'Classic Light', group: 'basic', colors: ['#ffffff', '#f3f4f6', '#0ea5e9']},
    { name: 'strong', displayName: 'Mono Strong', group: 'basic', colors: ['#000000', '#111111', '#ffffff']},
    { name: 'paper', displayName: 'Blueprint', group: 'basic', colors: ['#f0f0f0', '#ffffff', '#2962ff']},

    // Vibrant
    { name: 'cyberpunk', displayName: 'Cyberpunk', group: 'vibrant', colors: ['#050510', '#0d0d25', '#f0f'], isNew: true},
    { name: 'candy', displayName: 'Sugar Rush', group: 'vibrant', colors: ['#fff0f5', '#ff4081', '#f8bbd0']},
    { name: 'ocean', displayName: 'Deep Sea', group: 'vibrant', colors: ['#001e3c', '#00bcd4', '#004d61']},
    { name: 'matrix', displayName: 'The Code', group: 'vibrant', colors: ['#000000', '#00ff41', '#003b00']},

    // Atmospheric
    { name: 'wood', displayName: 'Deep Forest', group: 'atmospheric', colors: ['#261a12', '#7cb342', '#3e2723']},
    { name: 'military', displayName: 'Tactical', group: 'atmospheric', colors: ['#4b5320', '#8f9e6d', '#3b3f2a']},
    { name: 'halloween', displayName: 'Spooky', group: 'atmospheric', colors: ['#1a0505', '#ff6600', '#2d0a0a']},
    { name: 'harry-potter', displayName: 'Magic', group: 'atmospheric', colors: ['#2c241b', '#ffb300', '#3e3226']},
    { name: 'christmas', displayName: 'Holiday', group: 'atmospheric', colors: ['#0f3d2e', '#d32f2f', '#1b5e47']},
];

const ThemeSwatch: React.FC<{ themeInfo: typeof themes[0], isSelected: boolean, onClick: () => void }> = ({ themeInfo, isSelected, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all duration-300 w-32 h-32 justify-center border-2 group relative overflow-hidden ${isSelected ? 'border-accent scale-105 bg-secondary' : 'border-border-color hover:border-accent/50 hover:bg-secondary/50'}`}
            aria-label={`Switch to ${themeInfo.displayName} theme`}
        >
            <div className={`w-20 h-14 rounded-lg overflow-hidden flex shadow-lg transition-all duration-300 relative ${isSelected ? 'ring-4 ring-accent/30' : ''}`} style={{ backgroundColor: themeInfo.colors[0] }}>
                {/* Background Swatch */}
                <div className="absolute inset-0 opacity-80" style={{background: `linear-gradient(135deg, ${themeInfo.colors[0]} 0%, ${themeInfo.colors[1]} 100%)`}}></div>
                
                {/* Mini UI Representation */}
                <div className="absolute top-2 left-2 right-2 bottom-2 bg-white/10 backdrop-blur-sm rounded border border-white/20 flex flex-col gap-1 p-1">
                    <div className="w-1/2 h-1.5 rounded-full" style={{ backgroundColor: themeInfo.colors[2] }}></div>
                    <div className="w-3/4 h-1.5 rounded-full bg-white/20"></div>
                </div>

                {themeInfo.isNew && (
                    <span className="absolute top-0 right-0 text-[8px] font-bold text-white bg-red-600 px-1 rounded-bl">NEW</span>
                )}
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-accent' : 'text-secondary-text group-hover:text-primary-text'}`}>{themeInfo.displayName}</span>
        </button>
    );
}

const ThemeSwitcher: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const renderGroup = (group: 'basic' | 'vibrant' | 'atmospheric', title: string) => (
        <div className="bg-secondary/30 p-4 rounded-xl border border-border-color">
            <h4 className="text-sm font-bold text-header mb-4 uppercase tracking-widest opacity-70">{title}</h4>
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
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
        <div className="space-y-6">
            {renderGroup('vibrant', 'Яскраві & Ефектні')}
            {renderGroup('atmospheric', 'Атмосферні')}
            {renderGroup('basic', 'Базові & Професійні')}
        </div>
    );
};

export default ThemeSwitcher;