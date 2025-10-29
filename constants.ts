export enum DutyStatus {
  AVAILABLE = 'Доступний',
  ON_DUTY = 'В наряді',
  SICK = 'Хворіє',
  TRIP = 'У відрядженні',
  HOSPITAL = 'В госпіталі',
  LEAVE = 'У відпустці',
  OTHER = 'Інше',
}

export const RANK_CATEGORIES = ['Оф', 'Серж', 'Солд'];

export const RANKS: { [key: string]: string[] } = {
    'Офіцер': ['молодший лейтенант', 'лейтенант', 'старший лейтенант', 'капітан', 'майор', 'підполковник', 'полковник'],
    'Сержант': ['молодший сержант', 'сержант', 'старший сержант', 'головний сержант', 'штаб-сержант', 'майстер-сержант'],
    'Солдат': ['рядовий', 'солдат', 'старший солдат'],
};

export const RANK_SYNONYMS: { [key: string]: string } = {
    'ст.': 'старший',
    'ст': 'старший',
    'мол.': 'молодший',
    'мол': 'молодший',
    'гол.': 'головний',
    'гол': 'головний',
};

export const RANK_FULL_SYNONYMS: { [key: string]: string } = {
    'ст.солдат': 'старший солдат',
    'мол.сержант': 'молодший сержант',
    'ст.сержант': 'старший сержант',
    'гол.сержант': 'головний сержант',
    'мол.лейтенант': 'молодший лейтенант',
    'ст.лейтенант': 'старший лейтенант',
};

export const RANK_CATEGORY_SHORT_MAP: { [key: string]: string } = {
    'Офіцер': 'Оф',
    'Сержант': 'Серж',
    'Солдат': 'Солд',
};

export const WEAPON_ASSIGNMENT_TYPES: Array<'громадська' | 'резервна' | 'іменна'> = ['громадська', 'резервна', 'іменна'];


export const DUTY_STATUS_ABBREVIATIONS: { [key in DutyStatus]?: string } = {
    [DutyStatus.ON_DUTY]: 'Н',
    [DutyStatus.SICK]: 'Л',
    [DutyStatus.HOSPITAL]: 'Ш',
    [DutyStatus.LEAVE]: 'В',
    [DutyStatus.TRIP]: 'ВВ',
    [DutyStatus.OTHER]: 'Ін',
};

export const DUTY_STATUS_BG_COLORS: { [key in DutyStatus]: string } = {
  [DutyStatus.AVAILABLE]: 'bg-transparent',
  [DutyStatus.ON_DUTY]: 'bg-[var(--color-duty-onduty-bg)]',
  [DutyStatus.SICK]: 'bg-[var(--color-duty-sick-bg)]',
  [DutyStatus.TRIP]: 'bg-[var(--color-duty-trip-bg)]',
  [DutyStatus.HOSPITAL]: 'bg-[var(--color-duty-hospital-bg)]',
  [DutyStatus.LEAVE]: 'bg-[var(--color-duty-leave-bg)]',
  [DutyStatus.OTHER]: 'bg-slate-500',
};

export const DUTY_STATUS_TEXT_COLORS: { [key in DutyStatus]: string } = {
  [DutyStatus.AVAILABLE]: 'text-transparent',
  [DutyStatus.ON_DUTY]: 'text-[var(--color-duty-onduty-text)]',
  [DutyStatus.SICK]: 'text-[var(--color-duty-sick-text)]',
  [DutyStatus.TRIP]: 'text-[var(--color-duty-trip-text)]',
  [DutyStatus.HOSPITAL]: 'text-[var(--color-duty-hospital-text)]',
  [DutyStatus.LEAVE]: 'text-[var(--color-duty-leave-text)]',
  [DutyStatus.OTHER]: 'text-white',
};

export const DUTY_STATUS_FULL_TEXT: { [key in DutyStatus]?: string } = {
    [DutyStatus.ON_DUTY]: 'Н - наряд',
    [DutyStatus.SICK]: 'Л - лікарняний',
    [DutyStatus.TRIP]: 'ВВ - відрядження',
    [DutyStatus.HOSPITAL]: 'Ш - шпиталь',
    [DutyStatus.LEAVE]: 'В - відпустка',
    [DutyStatus.OTHER]: 'Ін - Інше',
}

export const UKRAINIAN_MONTHS = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

export const UKRAINIAN_MONTHS_GENITIVE = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
];

export const UKRAINIAN_WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export const PRESET_COLORS = [
    'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-purple-500', 
    'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-sky-500', 
    'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-green-500', 
    'bg-lime-500', 'bg-yellow-500', 'bg-amber-500', 'bg-orange-500', 
    'bg-red-500', 'bg-slate-500'
];