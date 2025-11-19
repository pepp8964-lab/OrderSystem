import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

// Theme Context
export type Theme = 'dark' | 'white' | 'ocean' | 'wood' | 'candy' | 'christmas' | 'harry-potter' | 'paper' | 'military' | 'matrix' | 'halloween' | 'strong';


interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const getDefaultTheme = (): Theme => {
        try {
            const settingsItem = localStorage.getItem('app-settings');
            if (settingsItem) {
                const settings = JSON.parse(settingsItem);
                // Basic validation to ensure it's a valid string, though not strict enum check here
                if (settings.defaultTheme && typeof settings.defaultTheme === 'string') {
                    return settings.defaultTheme;
                }
            }
        } catch (e) { 
            console.error("Could not parse settings to get default theme", e);
        }
        return 'dark';
    };

    const [theme, setTheme] = useLocalStorage<'black' | Theme>('app-theme', getDefaultTheme());

    // Fallback for legacy 'black' theme or invalid themes
    const effectiveTheme = (theme === 'black') ? 'dark' : theme;
    
    const contextValue = useMemo(() => ({
        theme: effectiveTheme as Theme,
        setTheme: setTheme as (theme: Theme) => void,
    }), [effectiveTheme, setTheme]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// Toast Context
interface Toast {
    message: string;
    id: number;
}

interface ToastContextType {
    toast: Toast | null;
    showToast: (message: string) => void;
    hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<Toast | null>(null);

    const showToast = useCallback((message: string) => {
        setToast({ message, id: Date.now() });
    }, []);

    const hideToast = useCallback(() => {
        setToast(null);
    }, []);

    return (
        <ToastContext.Provider value={{ toast, showToast, hideToast }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};


// Action Log Context
interface ActionLog {
    id: number;
    timestamp: string;
    message: string;
}

interface ActionLogContextType {
    logs: ActionLog[];
    logAction: (message: string) => void;
    clearLogs: () => void;
}

const ActionLogContext = createContext<ActionLogContextType | undefined>(undefined);

export const ActionLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [logs, setLogs] = useLocalStorage<ActionLog[]>('action-logs', []);

    useEffect(() => {
        const today = new Date().toLocaleDateString('uk-UA');
        const lastLogDate = logs.length > 0 ? new Date(logs[0].id).toLocaleDateString('uk-UA') : null;
        
        if(lastLogDate && lastLogDate !== today) {
            setLogs([]);
        }
    }, []); // Run only once on app start

    const logAction = useCallback((message: string) => {
        const now = new Date();
        const newLog: ActionLog = {
            id: now.getTime(),
            timestamp: now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            message: message,
        };
        setLogs(prev => [newLog, ...prev]);
    }, [setLogs]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, [setLogs]);

    return (
        <ActionLogContext.Provider value={{ logs, logAction, clearLogs }}>
            {children}
        </ActionLogContext.Provider>
    );
};

export const useActionLog = () => {
    const context = useContext(ActionLogContext);
    if (!context) {
        throw new Error('useActionLog must be used within an ActionLogProvider');
    }
    return context;
};

// Modal Context
export interface ContextMenuItem {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}

interface ModalContextType {
    isRosterModalOpen: boolean;
    openRosterModal: () => void;
    closeRosterModal: () => void;
    isImportExportModalOpen: boolean;
    importExportModalMode: 'import' | 'export';
    openImportExportModal: (mode: 'import' | 'export') => void;
    closeImportExportModal: () => void;
    isHotkeyHelpOpen: boolean;
    openHotkeyHelp: () => void;
    closeHotkeyHelp: () => void;
    isNotificationsOpen: boolean;
    openNotifications: () => void;
    closeNotifications: () => void;
    toggleNotifications: () => void;
    contextMenu: { x: number; y: number; items: ContextMenuItem[] } | null;
    showContextMenu: (event: React.MouseEvent, items: ContextMenuItem[]) => void;
    hideContextMenu: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
    const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
    const [importExportModalMode, setImportExportModalMode] = useState<'import' | 'export'>('import');
    const [isHotkeyHelpOpen, setIsHotkeyHelpOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

    const openRosterModal = useCallback(() => setIsRosterModalOpen(true), []);
    const closeRosterModal = useCallback(() => setIsRosterModalOpen(false), []);

    const openImportExportModal = useCallback((mode: 'import' | 'export') => {
        setImportExportModalMode(mode);
        setIsImportExportModalOpen(true);
    }, []);
    const closeImportExportModal = useCallback(() => setIsImportExportModalOpen(false), []);

    const openHotkeyHelp = useCallback(() => setIsHotkeyHelpOpen(true), []);
    const closeHotkeyHelp = useCallback(() => setIsHotkeyHelpOpen(false), []);
    
    const openNotifications = useCallback(() => setIsNotificationsOpen(true), []);
    const closeNotifications = useCallback(() => setIsNotificationsOpen(false), []);
    const toggleNotifications = useCallback(() => setIsNotificationsOpen(prev => !prev), []);

    const showContextMenu = useCallback((event: React.MouseEvent, items: ContextMenuItem[]) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, items });
    }, []);

    const hideContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const contextValue = useMemo(() => ({
        isRosterModalOpen, openRosterModal, closeRosterModal,
        isImportExportModalOpen, importExportModalMode, openImportExportModal, closeImportExportModal,
        isHotkeyHelpOpen, openHotkeyHelp, closeHotkeyHelp,
        isNotificationsOpen, openNotifications, closeNotifications, toggleNotifications,
        contextMenu, showContextMenu, hideContextMenu,
    }), [
        isRosterModalOpen, openRosterModal, closeRosterModal,
        isImportExportModalOpen, importExportModalMode, openImportExportModal, closeImportExportModal,
        isHotkeyHelpOpen, openHotkeyHelp, closeHotkeyHelp,
        isNotificationsOpen, openNotifications, closeNotifications, toggleNotifications,
        contextMenu, showContextMenu, hideContextMenu,
    ]);


    return (
        <ModalContext.Provider value={contextValue}>
            {children}
        </ModalContext.Provider>
    );
}

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};