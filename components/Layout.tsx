
import React from 'react';
import Sidebar from './Sidebar';
import Notifications from './Notifications';
import { useModal } from '../context/ThemeContext';
import { useSearch } from '../context/SearchContext';
import GlobalSearch from './GlobalSearch';
import HotkeyHelpModal from './HotkeyHelpModal';
import ContextMenu from './ContextMenu';
import ImportExportModal from './ImportExportModal';
import ThemeSecrets from './ThemeSecrets';

interface LayoutProps {
  children: React.ReactNode;
  openExitModal: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, openExitModal }) => {
  const { isHotkeyHelpOpen, closeHotkeyHelp, isNotificationsOpen, isImportExportModalOpen, closeImportExportModal, importExportModalMode } = useModal();
  const { isSearchOpen } = useSearch();

  return (
    <div className="flex h-screen text-primary-text bg-primary">
      <ThemeSecrets />
      <Sidebar openExitModal={openExitModal} />
      <main className={`flex-1 p-6 sm:p-8 md:p-10 overflow-y-auto transition-all duration-300 ${isNotificationsOpen ? 'mr-80' : ''} relative z-10`}>
        {children}
      </main>
      <Notifications />
       {isImportExportModalOpen && <ImportExportModal initialMode={importExportModalMode} onClose={closeImportExportModal} />}
      {isHotkeyHelpOpen && <HotkeyHelpModal onClose={closeHotkeyHelp} />}
      {isSearchOpen && <GlobalSearch />}
      <ContextMenu />
    </div>
  );
};

export default Layout;