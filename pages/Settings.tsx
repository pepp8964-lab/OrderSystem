import React from 'react';
import Card from '../components/Card';
import ThemeSwitcher from '../components/ThemeSwitcher';
import useLocalStorage from '../hooks/useLocalStorage';
import { useToast } from '../context/ThemeContext';
import { AppSettings } from '../types';
import { defaultSettings } from '../utils/defaults';

const Settings: React.FC = () => {
    const [settings, setSettings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
    const { showToast } = useToast();

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: name === 'autoSaveInterval' ? parseInt(value, 10) : value,
        }));
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

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-header">Налаштування</h1>

            <Card title="Зовнішній вигляд та інтерфейс">
                <div className="space-y-6">
                    <div>
                        <p className="text-primary-text mb-4 text-center">Виберіть тему оформлення. Зміни застосовуються миттєво.</p>
                        <ThemeSwitcher />
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
