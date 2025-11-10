import { DutyStatus } from './constants';
import { Theme } from './context/ThemeContext';

export { DutyStatus };

export interface Person {
  id: string;
  type: 'person' | 'subdivision';
  rank: string;
  rankCategory: string | undefined;
  fullName: string; // Derived: "LastName F.P."
  lastName: string;
  firstName: string;
  patronymic: string;
  phone?: string;
  position: string;
  tin: string;
  categoryIds: string[];
  deletedTimestamp: number | null;
  isNew?: boolean;
  createdTimestamp: number;
  source?: 'manual' | 'import';
  dateOfBirth?: string;
  hasPhoto?: boolean;
  subdivision?: string;
  subdivisionRowIndex?: number;
  customFullPosition?: string;
  linkedPersonId?: string | null;
  linkedCategoryId?: string | null;
}

export interface Subdivision {
  id: string;
  name: string;
  parentId: string | null;
  rowIndex: number;
  isCollapsed?: boolean;
  genitiveCaseName?: string;
}

export interface WeaponGroup {
    weapons: string[]; // Array of weapon IDs
}

export interface WeaponAssignment {
    type: 'none' | 'personal' | 'public' | 'reserve';
    groups?: [WeaponGroup, WeaponGroup, WeaponGroup]; // 3 groups for public/reserve
    rotationType?: 'daily' | 'every_other_day' | 'static'; // How groups rotate
    requiredWeaponType?: string;
    takeFree?: boolean; // For public/reserve: take any available weapon of the correct type
    useReserve?: boolean; // For public: also allow using reserve weapons
    ammoCount?: number;
    ammoType?: string;
}

export interface Category {
  id:string;
  name: string;
  shortName: string;
  color: string;
  dutySize: number;
  rankCategories: string[];
  allowConsecutiveDuties: boolean;
  weaponAssignment?: WeaponAssignment;
  deletedTimestamp: number | null;
  parentId?: string | null;
  order: number;
  isCollapsed?: boolean;
  groupName?: string;
  isGroup?: boolean;
  children?: Category[];
  requiredDutyDays?: number[];
}

export interface Weapon {
    id: string;
    type: string;
    serialNumber: string;
    assignmentType: 'громадська' | 'резервна' | 'іменна';
    personId: string | null;
    categoryId: string | null;
    deletedTimestamp: number | null;
}

export interface CustomWeaponType {
    name: string;
    ammoType: string;
}

export interface DailyStatus {
  [day: number]: import('./constants').DutyStatus;
}

export interface MonthlySchedule {
  [personId: string]: DailyStatus;
}

export interface YearMonthSchedule {
  [yearMonth: string]: MonthlySchedule;
}

export interface ScheduleData {
  [categoryId: string]: YearMonthSchedule;
}

export interface ExperimentalFeatures {
    enabled: boolean;
    autofillEnabled: boolean;
    quickAnalysisEnabled: boolean;
    dutySwapEnabled: boolean;
    trendAnalysisEnabled: boolean;
    glassmorphismEnabled: boolean;
    improvedDutyForecastEnabled: boolean;
    aiStructureDeclensionEnabled: boolean;
    quickDbLoadEnabled: boolean;
}

export interface FontSettings {
    fontFamily: string;
    fontSize: number;
    textColor: string;
}

export interface AppSettings {
    autoSaveInterval: number;
    backupPath: string;
    highlightOnHover: boolean;
    experimentalFeatures: ExperimentalFeatures;
    dbFilePath: string;
    fontSettings: FontSettings;
    defaultTheme: Theme;
}

export type AllData = {
    people?: Person[];
    categories?: Category[];
    schedules?: ScheduleData;
    weapons?: Weapon[];
    settings?: AppSettings;
    subdivisions?: Subdivision[];
    customWeaponTypes?: CustomWeaponType[];
};