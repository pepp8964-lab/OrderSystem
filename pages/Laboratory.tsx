import React from 'react';
import Card from '../components/Card';
import useLocalStorage from '../hooks/useLocalStorage';
import { useToast } from '../context/ThemeContext';
import { AppSettings, ExperimentalFeatures } from '../types';
import { defaultSettings } from '../utils/defaults';

const Laboratory: React.FC = () => {
    const [settings, setSettings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
    const { showToast } = useToast();

    const handleExperimentalToggle = (key: keyof ExperimentalFeatures) => {
        setSettings(prev => ({
            ...prev,
            experimentalFeatures: {
                ...prev.experimentalFeatures,
                [key]: !prev.experimentalFeatures[key]
            }
        }));
         showToast("Налаштування збережено.");
    };
    
    const FeatureToggle: React.FC<{ label: string; featureKey: keyof ExperimentalFeatures }> = ({ label, featureKey }) => (
        <div className="flex items-center justify-between">
            <label className="text-primary-text">{label}</label>
            <button type="button" onClick={() => handleExperimentalToggle(featureKey)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${settings.experimentalFeatures[featureKey] ? 'bg-accent' : 'bg-primary'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.experimentalFeatures[featureKey] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-header animate-gradient-text">Лабораторія</h1>

            <Card title="Експериментальні функції">
                <div className="max-w-xl mx-auto space-y-4">
                    <p className="text-sm text-yellow-400 text-center bg-yellow-900/50 p-3 rounded-lg border border-yellow-700">Увага: ці функції можуть працювати нестабільно або бути змінені в майбутньому.</p>
                    <div className="flex items-center justify-between">
                        <label className="font-medium text-primary-text">Увімкнути експериментальні функції</label>
                        <button type="button" onClick={() => handleExperimentalToggle('enabled')} className={`relative inline-flex h-6 w-11 items-center rounded-full ${settings.experimentalFeatures.enabled ? 'bg-accent' : 'bg-secondary'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.experimentalFeatures.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                     {settings.experimentalFeatures.enabled && (
                        <div className="space-y-6 pt-4 border-t border-border-color">
                           <div className="bg-secondary p-4 rounded-lg border border-border-color">
                                <h3 className="font-semibold text-header mb-3">Графік</h3>
                                <div className="space-y-3">
                                    <FeatureToggle label="Автозаповнення графіка" featureKey="autofillEnabled" />
                                    <FeatureToggle label="Детальний аналіз графіка" featureKey="quickAnalysisEnabled" />
                                    <FeatureToggle label="Аналіз тенденцій" featureKey="trendAnalysisEnabled" />
                                    <FeatureToggle label="Покращений прогноз наряду (AI)" featureKey="improvedDutyForecastEnabled" />
                                </div>
                            </div>
                            <div className="bg-secondary p-4 rounded-lg border border-border-color">
                                <h3 className="font-semibold text-header mb-3">Структура</h3>
                                <div className="space-y-3">
                                    <FeatureToggle label="Відмінювання назв підрозділів (AI)" featureKey="aiStructureDeclensionEnabled" />
                                </div>
                            </div>
                            <div className="bg-secondary p-4 rounded-lg border border-border-color">
                                <h3 className="font-semibold text-header mb-3">Імпорт та дані</h3>
                                <div className="space-y-3">
                                    <FeatureToggle label="Авто-завантаження бази при імпорті" featureKey="quickDbLoadEnabled" />
                                </div>
                            </div>
                             <div className="bg-secondary p-4 rounded-lg border border-border-color">
                                <h3 className="font-semibold text-header mb-3">Інтерфейс</h3>
                                <div className="space-y-3">
                                    <FeatureToggle label="Ефект скла (Glassmorphism)" featureKey="glassmorphismEnabled" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default Laboratory;
