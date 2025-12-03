import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
import Formation from './pages/Formation';
import { useTheme, useToast, useActionLog, useModal } from './context/ThemeContext';
import Card from './components/Card';
import { AllData, AppSettings } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { defaultSettings } from './utils/defaults';
import ConfirmationModal from './components/ConfirmationModal';
import { saveFileToDB } from './utils/db';

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
    onInitialize: (unitName: string, data?: AllData) => void;
}> = ({ onInitialize }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();
    const [unitName, setUnitName] = useState('');
    const [isSettingUnit, setIsSettingUnit] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const text = event.target?.result as string;
                    let data;
                    try {
                        data = JSON.parse(text) as AllData & {unitName?: string, cachedDbFile?: {name: string, data: string}, excelMapping?: any};
                    } catch (e) {
                        throw new Error("INVALID_FORMAT");
                    }
                    
                    if (data.cachedDbFile) {
                        const fileBlob = await (await fetch(data.cachedDbFile.data)).blob();
                        const dbFile = new File([fileBlob], data.cachedDbFile.name, { type: fileBlob.type });
                        await saveFileToDB(dbFile);
                    }
                    if (data.excelMapping) {
                         localStorage.setItem('excel-import-settings', JSON.stringify(data.excelMapping));
                    }
                    
                    onInitialize(data.unitName || 'Невідомий підрозділ', data);
                } catch (error) {
                    if (error instanceof Error && error.message === "INVALID_FORMAT") {
                        showToast("Некоректний формат файлу. Будь ласка, виберіть .json файл.");
                    } else {
                        showToast("Помилка при зчитуванні файлу.");
                        console.error("File import error:", error);
                    }
                }
            };
            reader.readAsText(file);
        }
    };
    
    const handleStartNew = () => {
        if (!unitName.trim()) {
            showToast("Будь ласка, введіть назву підрозділу.");
            return;
        }
        onInitialize(unitName.trim());
    };

    if (isSettingUnit) {
        return (
            <div className="w-full h-screen flex flex-col justify-center items-center bg-primary text-primary-text p-8">
                 <h1 className="text-4xl lg:text-5xl font-bold text-header mb-8">Назва вашого підрозділу</h1>
                 <p className="text-secondary-text mb-12 max-w-lg text-center">Ця назва буде відображатися в програмі та може бути включена в експортовані файли.</p>
                 <div className="w-full max-w-md">
                     <input
                        type="text"
                        value={unitName}
                        onChange={(e) => setUnitName(e.target.value)}
                        placeholder="Напр. 1-й батальйон"
                        className="w-full bg-secondary p-4 rounded-lg border border-border-color text-center text-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <div className="flex justify-center gap-4 mt-8">
                         <button onClick={() => setIsSettingUnit(false)} className="bg-secondary text-primary-text px-8 py-3 rounded-lg hover:bg-primary border border-border-color">Назад</button>
                         <button onClick={handleStartNew} className="bg-accent text-white px-8 py-3 rounded-lg hover:bg-accent-hover">Створити</button>
                    </div>
                 </div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen flex flex-col md:flex-row justify-center items-center bg-primary text-primary-text p-8">
            <div className="w-full md:w-1/2 flex justify-center items-center p-8">
                <div className="logo-image w-full max-w-md max-h-[80vh]" style={{ aspectRatio: '100 / 120' }}></div>
            </div>
             <div className="w-full md:w-1/2 flex flex-col justify-center items-center md:items-start text-center md:text-left p-8">
                <h1 className="text-4xl lg:text-5xl font-bold text-header mb-12">Система Обліку Нарядів</h1>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="bg-accent text-white px-8 py-4 rounded-lg hover:bg-accent-hover transition-colors shadow-lg text-lg font-semibold"
                    >
                        Відкрити розклад
                    </button>
                    <button 
                        onClick={() => setIsSettingUnit(true)}
                        className="bg-secondary text-primary-text px-8 py-4 rounded-lg hover:bg-primary transition-colors shadow-lg border border-border-color text-lg font-semibold"
                    >
                        Створити новий
                    </button>
                </div>
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const { showToast } = useToast();
  const { openRosterModal, openHotkeyHelp, closeRosterModal, closeHotkeyHelp } = useModal();
  const [settings] = useLocalStorage<AppSettings>('app-settings', defaultSettings);
  const [isDirty, setIsDirty] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Fix for JSON parsing error on initial load
  useEffect(() => {
      const unitName = localStorage.getItem('unitName');
      if (unitName) {
          // Check if it looks like a raw string (not JSON)
          if (!unitName.startsWith('"') && !unitName.startsWith('{')) {
              localStorage.setItem('unitName', JSON.stringify(unitName));
          }
          setIsInitialized(true);
      }
  }, []);

  useEffect(() => {
    const markAsDirty = () => setIsDirty(true);
    window.addEventListener('datachanged', markAsDirty);
    return () => window.removeEventListener('datachanged', markAsDirty);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'У вас є незбережені зміни. Ви впевнені, що хочете закрити сторінку?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(`theme-${theme}`);
    if (['vibrant-dark', 'dark', 'bw', 'br', 'bb', 'by', 'military', 'matrica', 'stalker', 'prime', 'robot', 'cowboy', 'fall', 'christmas', 'valentine', 'halloween', 'grass', 'candy', 'potter', 'spotlight', 'cyberpunk', 'paper', 'ocean', 'sunset', 'terminal'].includes(theme)) {
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
    const root = document.documentElement;
    if (settings.fontSettings) {
        root.style.setProperty('--font-family', settings.fontSettings.fontFamily);
        root.style.setProperty('--base-font-size', `${settings.fontSettings.fontSize}px`);
        if (settings.fontSettings.textColor) {
            root.style.setProperty('--user-text-primary-override', settings.fontSettings.textColor);
        } else {
            root.style.removeProperty('--user-text-primary-override');
        }
    }
  }, [settings.fontSettings]);
  
  useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Hotkey for "New"
            if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
                
                e.preventDefault();
                if (location.pathname.startsWith('/people')) navigate('/people?action=create');
                if (location.pathname.startsWith('/categories')) navigate('/categories?action=create');
                if (location.pathname.startsWith('/weapons')) navigate('/weapons?action=create');
            }
            
            // Hotkey for help modal
            if (e.key === '?' && e.shiftKey) {
                e.preventDefault();
                openHotkeyHelp();
            }

            // Hotkey for saving (exporting)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                navigate('/formation');
            }
            
            // Hotkey for closing modals
            if (e.key === 'Escape') {
                // This will close the topmost modal
                closeRosterModal(); 
                closeHotkeyHelp();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [location, navigate, openRosterModal, openHotkeyHelp, closeRosterModal, closeHotkeyHelp]);

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
                    commander: JSON.parse(localStorage.getItem('commander') || 'null'),
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
                setIsDirty(false);

            } catch (error) {
                console.error("Autosave failed:", error);
            }
        }, settings.autoSaveInterval * 60 * 1000); // convert minutes to ms

        return () => clearInterval(intervalId);
    }
  }, [settings.autoSaveInterval]);
  
  const handleInitialize = (unitName: string, data?: AllData) => {
    const projectKeys = ['people', 'categories', 'schedules', 'weapons', 'app-settings', 'subdivisions', 'custom-weapon-types', 'action-logs', 'unitName', 'commander'];
    projectKeys.forEach(key => localStorage.removeItem(key));

    if (data) {
        if (data.people) localStorage.setItem('people', JSON.stringify(data.people));
        if (data.categories) localStorage.setItem('categories', JSON.stringify(data.categories));
        if (data.schedules) localStorage.setItem('schedules', JSON.stringify(data.schedules));
        if (data.weapons) localStorage.setItem('weapons', JSON.stringify(data.weapons));
        if (data.settings) localStorage.setItem('app-settings', JSON.stringify(data.settings));
        if (data.subdivisions) localStorage.setItem('subdivisions', JSON.stringify(data.subdivisions));
        if (data.customWeaponTypes) localStorage.setItem('custom-weapon-types', JSON.stringify(data.customWeaponTypes));
        if (data.commander) localStorage.setItem('commander', JSON.stringify(data.commander));
        showToast("Проект успішно завантажено.");
    } else {
        localStorage.setItem('people', '[]');
        localStorage.setItem('categories', '[]');
        localStorage.setItem('schedules', '{}');
        localStorage.setItem('weapons', '[]');
        localStorage.setItem('subdivisions', '[]');
        localStorage.setItem('custom-weapon-types', '[]');
        showToast("Створено новий порожній розклад.");
    }
    
    localStorage.setItem('unitName', JSON.stringify(unitName));
    setIsInitialized(true);
    setShowUpdatesModal(true);
    setIsDirty(false);
  };

  const handleExitProject = () => {
      setIsExitModalOpen(true);
  };
  
  const confirmExitProject = () => {
      const projectKeys = ['people', 'categories', 'schedules', 'weapons', 'app-settings', 'subdivisions', 'custom-weapon-types', 'action-logs', 'unitName', 'commander'];
      projectKeys.forEach(key => localStorage.removeItem(key));
      setIsInitialized(false);
      setIsExitModalOpen(false);
      showToast("Проект закрито.");
      setIsDirty(false);
      window.location.reload(); 
  };


  if (!isInitialized) {
    return <StartupScreen onInitialize={handleInitialize} />;
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
          <Route path="/formation" element={<Formation />} />
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