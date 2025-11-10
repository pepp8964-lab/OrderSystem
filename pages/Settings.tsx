import React from 'react';
import Card from '../components/Card';
import ThemeSwitcher from '../components/ThemeSwitcher';
import useLocalStorage from '../hooks/useLocalStorage';
// FIX: Import `useToast` to correctly access the `showToast` function.
import { useTheme, useToast } from '../context/ThemeContext';
import { AppSettings } from '../types';
import { defaultSettings } from '../utils/defaults';

const Settings: React.FC = () => {
    const [settings, setSettings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
    // FIX: The `showToast` function comes from the `useToast` hook, not `useTheme`.
    const { theme } = useTheme();
    const { showToast } = useToast();

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        setSettings(prev => {
            const keys = name.split('.');
            if (keys.length > 1) {
                return {
                    ...prev,
                    [keys[0]]: {
                        ...(prev as any)[keys[0]],
                        [keys[1]]: (e.target as HTMLInputElement).type === 'number' ? parseFloat(value) : value
                    }
                };
            }
            return {
                ...prev,
                [name]: type === 'number' ? parseInt(value, 10) : value,
            };
        });
        showToast("Налаштування збережено.");
    };
    
    const handleToggleChange = (key: keyof AppSettings) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key as keyof typeof prev]
        }));
        showToast("Налаштування збережено.");
    }
    
    const handleExperimentalToggle = (key: keyof AppSettings['experimentalFeatures']) => {
        setSettings(prev => ({
            ...prev,
            experimentalFeatures: {
                ...prev.experimentalFeatures,
                [key]: !prev.experimentalFeatures[key]
            }
        }));
        showToast("Налаштування збережено.");
    };

    const handleSaveDefaultTheme = () => {
        setSettings(prev => ({
            ...prev,
            defaultTheme: theme
        }));
        showToast(`Тема "${theme}" встановлена як стандартна.`);
    };
    
    const fontFamilies = [
        { name: 'System Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
        { name: 'Arial', value: 'Arial, sans-serif' },
        { name: 'Verdana', value: 'Verdana, sans-serif' },
        { name: 'Georgia', value: 'Georgia, serif' },
        { name: 'Courier New', value: '"Courier New", monospace' },
        { name: 'Times New Roman', value: '"Times New Roman", serif' },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-header">Налаштування</h1>

            <Card title="Зовнішній вигляд та інтерфейс">
                <div className="space-y-6">
                    <div>
                        <p className="text-primary-text mb-4 text-center">Виберіть тему оформлення. Зміни застосовуються миттєво.</p>
                        <ThemeSwitcher />
                        <div className="text-center mt-4">
                            <button onClick={handleSaveDefaultTheme} className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md">
                                Зберегти поточну тему як стандартну
                            </button>
                        </div>
                    </div>
                     <div className="border-t border-border-color pt-6">
                        <div className="flex items-center justify-between max-w-md mx-auto">
                            <label htmlFor="highlightOnHover" className="block font-medium text-primary-text">
                                Підсвічувати рядок/стовпець в графіку
                            </label>
                            <button
                                type="button"
                                onClick={() => handleToggleChange('highlightOnHover')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.highlightOnHover ? 'bg-accent' : 'bg-secondary'}`}
                                id="highlightOnHover"
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.highlightOnHover ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Налаштування шрифту та тексту">
                <div className="space-y-4 max-w-md mx-auto">
                    <div>
                        <label htmlFor="fontFamily" className="block text-sm font-medium text-primary-text mb-2">Шрифт</label>
                        <select id="fontFamily" name="fontSettings.fontFamily" value={settings.fontSettings.fontFamily} onChange={handleSettingsChange} className="w-full bg-secondary p-2 rounded-md border border-border-color">
                            {fontFamilies.map(font => <option key={font.value} value={font.value}>{font.name}</option>)}
                        </select>
                    </div>
                    <div>
                         <label htmlFor="fontSize" className="block text-sm font-medium text-primary-text mb-2">Розмір шрифту: {settings.fontSettings.fontSize}px</label>
                         <input type="range" id="fontSize" name="fontSettings.fontSize" min="12" max="20" value={settings.fontSettings.fontSize} onChange={handleSettingsChange} className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label htmlFor="textColor" className="block text-sm font-medium text-primary-text mb-2">Колір основного тексту</label>
                         <div className="flex items-center gap-2">
                            <input type="color" id="textColor" name="fontSettings.textColor" value={settings.fontSettings.textColor || '#000000'} onChange={handleSettingsChange} className="p-1 h-10 w-10 block bg-secondary border border-border-color cursor-pointer rounded-lg disabled:opacity-50 disabled:pointer-events-none" />
                            <button onClick={() => handleSettingsChange({ target: { name: 'fontSettings.textColor', value: '' } } as any)} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary border border-border-color">Скинути</button>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Автозбереження та резервні копії">
                <div className="space-y-4 max-w-md mx-auto">
                    <div>
                        <label htmlFor="autoSaveInterval" className="block text-sm font-medium text-primary-text mb-2">
                            Інтервал автозбереження (0 - вимкнено)
                        </label>
                        <select
                            id="autoSaveInterval"
                            name="autoSaveInterval"
                            value={settings.autoSaveInterval}
                            onChange={handleSettingsChange}
                            className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                            <option value={0}>Вимкнено</option>
                            <option value={1}>1 хвилина</option>
                            <option value={5}>5 хвилин</option>
                            <option value={10}>10 хвилин</option>
                            <option value={30}>30 хвилин</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="backupPath" className="block text-sm font-medium text-primary-text mb-2">
                            Шлях для резервних копій
                        </label>
                        <input
                            type="text"
                            id="backupPath"
                            name="backupPath"
                            value={settings.backupPath}
                            onChange={handleSettingsChange}
                            className="w-full bg-secondary p-2 rounded-md border border-border-color focus:outline-none focus:ring-2 focus:ring-accent"
                            disabled
                        />
                         <p className="text-xs text-secondary-text mt-1">Браузер автоматично зберігатиме файли у вашу папку для завантажень.</p>
                    </div>
                </div>
            </Card>
            
            <Card title="Автоматизація">
                <div className="space-y-4 max-w-md mx-auto">
                     <div className="flex items-center justify-between">
                        <div>
                            <label htmlFor="quickDbLoadEnabled" className="block font-medium text-primary-text">
                                Автозавантаження бази даних при імпорті
                            </label>
                             <p className="text-xs text-secondary-text mt-1">Автоматично завантажує кешований файл Excel та застосовує збережені налаштування стовпців на сторінці імпорту. (Експериментально)</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleExperimentalToggle('quickDbLoadEnabled')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.experimentalFeatures.quickDbLoadEnabled ? 'bg-accent' : 'bg-secondary'}`}
                            id="quickDbLoadEnabled"
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.experimentalFeatures.quickDbLoadEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Settings;