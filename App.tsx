import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import People from './pages/People';
import Categories from './pages/Categories';
import Schedule from './pages/Schedule';
import Weapons from './pages/Weapons';
import Settings from './pages/Settings';
import Updates, { CHANGELOG_DATA } from './pages/Updates';
import Structure from './pages/Structure';
import Laboratory from './pages/Laboratory';
import { useTheme, useToast, useActionLog } from './context/ThemeContext';
import Card from './components/Card';
import { AllData, AppSettings } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { defaultSettings } from './utils/defaults';
import ConfirmationModal from './components/ConfirmationModal';

const ToastContainer: React.FC = () => {
    const { toast, hideToast } = useToast();

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                hideToast();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [toast, hideToast]);

    if (!toast) {
        return null;
    }

    return (
        <div 
            className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-card text-primary-text px-6 py-3 rounded-xl shadow-lg z-[100] animate-fade-in-out border border-border-color"
        >
            {toast.message}
        </div>
    );
};

const HistoryPage: React.FC = () => {
    const { logs, clearLogs } = useActionLog();
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-header">Історія дій за сьогодні</h1>
                <button 
                    onClick={clearLogs} 
                    className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors shadow-md disabled:bg-gray-500"
                    disabled={logs.length === 0}
                >
                    Очистити
                </button>
            </div>
            <Card>
                {logs.length > 0 ? (
                    <div className="space-y-2 max-h-[75vh] overflow-y-auto">
                        {logs.map(log => (
                             <div key={log.id} className="font-mono text-sm bg-secondary p-2 rounded-md border border-border-color">
                                <span className="text-secondary-text">{log.timestamp} -- </span>
                                <span className="text-primary-text">{log.message}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-secondary-text text-center py-4">Сьогодні ще не було жодних дій.</p>
                )}
            </Card>
        </div>
    );
};

const StartupScreen: React.FC<{
    onCreateNew: () => void;
    onOpenProject: (data: AllData) => void;
}> = ({ onCreateNew, onOpenProject }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    onOpenProject(data);
                } catch (error) {
                    showToast("Некоректний формат файлу JSON.");
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="w-full h-screen flex flex-col justify-center items-center bg-primary text-primary-text">
            <img src="/assets/logo.png" alt="Логотип" className="w-32 h-32" />
            <h1 className="text-4xl font-bold text-header mt-4 mb-12">Система Обліку Нарядів</h1>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="bg-accent text-white px-8 py-4 rounded-lg hover:bg-accent-hover transition-colors shadow-lg text-lg font-semibold"
                >
                    Відкрити розклад
                </button>
                <button 
                    onClick={onCreateNew} 
                    className="bg-secondary text-primary-text px-8 py-4 rounded-lg hover:bg-primary transition-colors shadow-lg border border-border-color text-lg font-semibold"
                >
                    Створити новий
                </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
        </div>
    );
};

const UpdatesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[150] p-4" onClick={onClose}>
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-header mb-4">Історія оновлень</h2>
                <div className="space-y-8 overflow-y-auto p-2 flex-grow">
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
                <div className="pt-4 mt-4 border-t border-border-color text-right">
                    <button
                        onClick={onClose}
                        className="bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent-hover transition-colors"
                    >
                        Зрозуміло
                    </button>
                </div>
            </Card>
        </div>
    );
};


const App: React.FC = () => {
  const { theme } = useTheme();
  const [isInitialized, setIsInitialized] = useState(!!localStorage.getItem('people'));
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const { showToast } = useToast();
  const [settings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(`theme-${theme}`);
    if (['vibrant-dark', 'dark', 'bw', 'br', 'bb', 'by'].includes(theme)) {
      // These themes manage their own complex backgrounds via body.theme-xyz selectors in CSS
    } else {
      document.body.classList.add('bg-gradient-to-br', 'from-primary', 'to-secondary', 'transition-colors', 'duration-500');
    }

    if (settings.experimentalFeatures?.enabled && settings.experimentalFeatures?.glassmorphismEnabled) {
        document.body.classList.add('glass-ui-enabled');
    } else {
        document.body.classList.remove('glass-ui-enabled');
    }
  }, [theme, settings.experimentalFeatures?.enabled, settings.experimentalFeatures?.glassmorphismEnabled]);

  useEffect(() => {
    if (settings.autoSaveInterval > 0) {
        const intervalId = setInterval(() => {
            try {
                const dataToExport: AllData = {
                    people: JSON.parse(localStorage.getItem('people') || '[]'),
                    categories: JSON.parse(localStorage.getItem('categories') || '[]'),
                    schedules: JSON.parse(localStorage.getItem('schedules') || '{}'),
                    weapons: JSON.parse(localStorage.getItem('weapons') || '[]'),
                    settings: JSON.parse(localStorage.getItem('app-settings') || '{}'),
                    subdivisions: JSON.parse(localStorage.getItem('subdivisions') || '[]'),
                    customWeaponTypes: JSON.parse(localStorage.getItem('custom-weapon-types') || '[]'),
                };

                const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
                const link = document.createElement("a");
                link.href = jsonString;
                
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');

                link.download = `naryady-autosave-${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log(`Autosave complete at ${now.toLocaleTimeString()}`);

            } catch (error) {
                console.error("Autosave failed:", error);
            }
        }, settings.autoSaveInterval * 60 * 1000); // convert minutes to ms

        return () => clearInterval(intervalId);
    }
  }, [settings.autoSaveInterval]);
  
  const handleCreateNew = () => {
    const projectKeys = ['people', 'categories', 'schedules', 'weapons', 'app-settings', 'subdivisions', 'custom-weapon-types', 'action-logs'];
    projectKeys.forEach(key => localStorage.removeItem(key));

    localStorage.setItem('people', '[]');
    localStorage.setItem('categories', '[]');
    localStorage.setItem('schedules', '{}');
    localStorage.setItem('weapons', '[]');
    localStorage.setItem('subdivisions', '[]');
    localStorage.setItem('custom-weapon-types', '[]');
    
    setIsInitialized(true);
    setShowUpdatesModal(true);
    showToast("Створено новий порожній розклад.");
  };

  const handleOpenProject = (data: AllData) => {
    const projectKeys = ['people', 'categories', 'schedules', 'weapons', 'app-settings', 'subdivisions', 'custom-weapon-types', 'action-logs'];
    projectKeys.forEach(key => localStorage.removeItem(key));

    if (data.people) localStorage.setItem('people', JSON.stringify(data.people));
    if (data.categories) localStorage.setItem('categories', JSON.stringify(data.categories));
    if (data.schedules) localStorage.setItem('schedules', JSON.stringify(data.schedules));
    if (data.weapons) localStorage.setItem('weapons', JSON.stringify(data.weapons));
    if (data.settings) localStorage.setItem('app-settings', JSON.stringify(data.settings));
    if (data.subdivisions) localStorage.setItem('subdivisions', JSON.stringify(data.subdivisions));
    if (data.customWeaponTypes) localStorage.setItem('custom-weapon-types', JSON.stringify(data.customWeaponTypes));
    
    setIsInitialized(true);
    setShowUpdatesModal(true);
    showToast("Проект успішно завантажено.");
  };
  
  const handleExitProject = () => {
      setIsExitModalOpen(true);
  };
  
  const confirmExitProject = () => {
      const projectKeys = ['people', 'categories', 'schedules', 'weapons', 'app-settings', 'subdivisions', 'custom-weapon-types', 'action-logs'];
      projectKeys.forEach(key => localStorage.removeItem(key));
      setIsInitialized(false);
      setIsExitModalOpen(false);
      showToast("Проект закрито.");
      // Using reload to ensure all state in all components is fully reset
      window.location.reload(); 
  };


  if (!isInitialized) {
    return <StartupScreen onCreateNew={handleCreateNew} onOpenProject={handleOpenProject} />;
  }

  return (
    <>
      {showUpdatesModal && <UpdatesModal onClose={() => setShowUpdatesModal(false)} />}
      <Layout openExitModal={handleExitProject}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/people" element={<People />} />
          <Route path="/structure" element={<Structure />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/weapons" element={<Weapons />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/laboratory" element={<Laboratory />} />
        </Routes>
      </Layout>
      <ToastContainer />
      <ConfirmationModal
          isOpen={isExitModalOpen}
          onClose={() => setIsExitModalOpen(false)}
          onConfirm={confirmExitProject}
          title="Закрити проект"
          message="Ви впевнені, що хочете закрити поточний проект? Всі незбережені зміни буде втрачено."
          confirmButtonText="Так, закрити"
          confirmButtonClassName="bg-red-600 hover:bg-red-700"
      />
    </>
  );
};

export default App;
