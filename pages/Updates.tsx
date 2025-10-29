import React from 'react';
import Card from '../components/Card';

export const CHANGELOG_DATA = [
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
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-header">Історія оновлень</h1>
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