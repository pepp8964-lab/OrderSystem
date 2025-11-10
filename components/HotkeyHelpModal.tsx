import React from 'react';

interface HotkeyHelpModalProps {
  onClose: () => void;
}

const hotkeys = [
    { keys: 'Ctrl + K', description: 'Відкрити глобальний пошук' },
    { keys: 'Ctrl + S', description: 'Відкрити вікно "Довести наряд"' },
    { keys: 'N', description: 'Створити новий запис (на відповідній сторінці)' },
    { keys: 'Esc', description: 'Закрити будь-яке модальне вікно' },
    { keys: 'Shift + ?', description: 'Відкрити це вікно допомоги' },
];

const HotkeyHelpModal: React.FC<HotkeyHelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[150] p-4" onClick={onClose}>
        <div className="bg-card rounded-xl border border-border-color shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border-color">
                <h2 className="text-xl font-bold text-header">Гарячі клавіші</h2>
            </div>
            <div className="p-6">
                <ul className="space-y-3">
                    {hotkeys.map((hotkey, index) => (
                        <li key={index} className="flex justify-between items-center">
                            <span className="text-primary-text">{hotkey.description}</span>
                            <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
                                {hotkey.keys}
                            </kbd>
                        </li>
                    ))}
                </ul>
            </div>
             <div className="flex justify-end p-4 border-t border-border-color">
                <button onClick={onClose} className="bg-secondary px-4 py-2 rounded-md hover:bg-primary transition-colors border border-border-color">Закрити</button>
            </div>
        </div>
    </div>
  );
};

export default HotkeyHelpModal;