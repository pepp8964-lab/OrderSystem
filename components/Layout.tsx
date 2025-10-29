import React from 'react';
import Sidebar from './Sidebar';
import Notifications from './Notifications';
import { useModal } from '../context/ThemeContext';
import useLocalStorage from '../hooks/useLocalStorage';
import { Person, Category, ScheduleData, Subdivision } from '../types';
import DutyRosterModal from '../pages/DutyRosterModal';
import { useSearch } from '../context/SearchContext';
import GlobalSearch from './GlobalSearch';

interface LayoutProps {
  children: React.ReactNode;
  openExitModal: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, openExitModal }) => {
  const { isRosterModalOpen, closeRosterModal } = useModal();
  const [people] = useLocalStorage<Person[]>('people', []);
  const [categories] = useLocalStorage<Category[]>('categories', []);
  const [schedules] = useLocalStorage<ScheduleData>('schedules', {});
  const [subdivisions] = useLocalStorage<Subdivision[]>('subdivisions', []);
  const { isSearchOpen } = useSearch();

  return (
    <div className="flex h-screen text-primary-text">
      <Sidebar openExitModal={openExitModal} />
      <main className="flex-1 p-6 sm:p-8 md:p-10 overflow-y-auto">
        {children}
      </main>
      <Notifications />
       {isRosterModalOpen && (
          <DutyRosterModal
              onClose={closeRosterModal}
              people={people}
              categories={categories}
              schedules={schedules}
              subdivisions={subdivisions}
          />
      )}
      {isSearchOpen && <GlobalSearch />}
    </div>
  );
};

export default Layout;
