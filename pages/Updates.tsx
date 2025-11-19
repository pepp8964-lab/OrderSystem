import React, { useState } from 'react';
import Card from '../components/Card';
import { GoogleGenAI } from '@google/genai';

export const CHANGELOG_DATA = [
    {
        version: "1.4",
        date: "2025-10-15",
        changes: [
            "Покращені теми.",
            "Реалізована функція формування наказу з можливістю підключення інших підрозділів.",
            "Покращені функції копіювання при доведенні наряду."
        ]
    },
    {
        version: "1.3",
        date: "2025-10-01",
        changes: [
            "Покращений дизайн та ще більше соковитих тем.",
            "Інформативна головна сторінка.",
            "Можливість приховати недоступних людей в графіку.",
            "Більш нативні проблемні зони.",
            "Можливість закрити день з недостатньою кількістю особового складу.",
            "Додано аналіз можливих оновлень.",
            "Більш зручна робота з картками особового складу."
        ]
    },
    {
        version: "1.2",
        date: "2025-09-26",
        changes: [
            "Покращено експерементальні функції.",
            "Покращена робота структури підрозділів та визначення посади згідно до штатного розпису",
            "Покращений імпорт із файлу.",
            "Виправлено деякі проблеми інтерфейсу"
        ]
    },
    
    {
        version: "1.1",
        date: "2025-09-24",
        changes: [
            "Додано експерементальні функції.",
            "Покращена робота аторозстановки наряду.",
            "Покращено AI-аналіз проблем в графіку.",
            "Додано більше інтерактивних тем"
        ]
    },
    {
        version: "1.0",
        date: "2025-09-01",
        changes: [
            "Програму запущено"
        ]
    }
];

const Updates: React.FC = () => {
    const [aiSuggestions, setAiSuggestions] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAiAnalysis = async () => {
        setIsLoading(true);
        setAiSuggestions('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are a senior UI/UX designer and frontend engineer. Analyze the following application description and suggest 10 specific improvements. The application is a 'Personnel and Duty Roster Management System' (Система Обліку Нарядів) for military units. Key features include: managing personnel lists, defining duty categories, creating monthly schedules with various duty statuses (on-duty, sick, leave), managing weapons, viewing changelogs, and customizing settings. The UI has a sidebar for navigation and a main content area. For each suggestion, specify the component/page to change and describe the improvement in detail. Format your response as a numbered markdown list in Ukrainian.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            
            setAiSuggestions(response.text);

        } catch (error) {
            console.error("AI analysis failed:", error);
            setAiSuggestions('Не вдалося отримати пропозиції від ШІ. Перевірте консоль для отримання докладної інформації про помилку.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-header">Історія оновлень</h1>
                 <button 
                    onClick={handleAiAnalysis} 
                    disabled={isLoading}
                    className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md disabled:bg-gray-500"
                >
                    {isLoading ? 'Аналіз...' : 'Аналіз ШІ'}
                </button>
            </div>

            {aiSuggestions && (
                <Card title="Пропозиції від ШІ">
                    <div className="prose prose-invert max-w-none text-primary-text whitespace-pre-wrap">
                        {aiSuggestions.split('\n').map((line, index) => {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('* ')) {
                                return <li key={index} className="ml-4">{trimmedLine.substring(2)}</li>;
                            }
                            if (/^\d+\./.test(trimmedLine)) {
                                return <p key={index} className="font-bold mt-2">{trimmedLine}</p>;
                            }
                            return <p key={index}>{line}</p>;
                        })}
                    </div>
                </Card>
            )}

            <Card>
                <div className="space-y-8 max-h-[75vh] overflow-y-auto p-2">
                    {CHANGELOG_DATA.map(entry => (
                        <div key={entry.version} className="border-b border-border-color pb-6 last:border-b-0 last:pb-0">
                            <h3 className="text-xl font-semibold text-header flex items-center gap-3">
                                Версія {entry.version}
                                <span className="text-sm font-normal text-secondary-text">{entry.date}</span>
                            </h3>
                            <ul className="list-disc list-inside mt-3 space-y-2 text-primary-text pl-2">
                                {entry.changes.map((change, index) => (
                                    <li key={index}>{change}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default Updates;