import { Person, Subdivision } from '../types';

export const declinePhraseToGenitive = (phrase: string): string => {
    const lowerPhrase = phrase.toLowerCase().trim();
    const STOP_WORDS = new Set(['і', 'та', 'в', 'у', 'на', 'з', 'до', 'під', 'при', 'про', 'без', 'для', 'від', 'над', 'по', 'через']);

    const overrides: { [key: string]: string } = {
        // Full phrases
        'технічне обслуговування': 'технічного обслуговування',
        'матеріальне забезпечення': 'матеріального забезпечення',
        'інформаційно-телекомунікаційний вузол': 'інформаційно-телекомунікаційного вузла',
        'роди військ': 'родів військ',
        'логістичне забезпечення': 'логістичного забезпечення',
        'колективна підготовка': 'колективної підготовки',
        'головний сержант': 'головного сержанта',
        
        // Single words - Nouns
        'вузол': 'вузла', 'наглядач': 'наглядача', 'механік': 'механіка', 'начальник': 'начальника',
        'електростанція': 'електростанції', 'штаб': 'штабу', 'взвод': 'взводу', 'батальйон': 'батальйону',
        'полк': 'полку', 'центр': 'центру', 'відділ': 'відділу', 'відділок': 'відділку',
        'частина': 'частини', 'рота': 'роти', 'служба': 'служби', 'група': 'групи',
        'школа': 'школи', 'сержант': 'сержанта', 'інструктор': 'інструктора',
        'підрозділ': 'підрозділу', 'рід': 'роду', 'військо': 'війська',
        
        // Plural Nouns (Nominative -> Genitive)
        'телекомунікації': 'телекомунікацій', 'підрозділи': 'підрозділів', 'війська': 'військ',
        'роди': 'родів', 'школи': 'шкіл',

        // Adjectives
        'технічний': 'технічного', 'технічна': 'технічної', 'технічне': 'технічного',
        'матеріальний': 'матеріального', 'матеріальна': 'матеріальної', 'матеріальне': 'матеріального',
        'автомобільний': 'автомобільного', 'інформаційно-телекомунікаційний': 'інформаційно-телекомунікаційного',
        'лінійний': 'лінійного', 'старший': 'старшого', 'логістичний': 'логістичного',
        'колективний': 'колективного', 'логістична': 'логістичної', 'колективна': 'колективної',
        'логістичне': 'логістичного', 'колективне': 'колективного',

        // Nouns that don't change or are already genitive
        'управління': 'управління', 'відділення': 'відділення', 'забезпечення': 'забезпечення',
        'підготовки': 'підготовки', 'зв\'язку': 'зв\'язку', 'озброєння': 'озброєння',
        'військ': 'військ', 'родів': 'родів', 'підрозділів': 'підрозділів',
        'обслуговування': 'обслуговування'
    };

    if (overrides[lowerPhrase]) {
        return overrides[lowerPhrase];
    }
    
    const words = lowerPhrase.split(' ').filter(Boolean);
    const declinedWords = words.map(word => {
        if (STOP_WORDS.has(word)) return word;
        if (overrides[word]) return overrides[word];
        if (!isNaN(parseInt(word))) return word;

        // --- Minimal fallback rules for common patterns ---
        
        // Adjectives
        if (word.endsWith('ий') || word.endsWith('ій')) return word.slice(0, -2) + 'ого';
        
        // Nouns
        if (word.endsWith('ція')) return word.slice(0, -2) + 'ції';
        if (word.endsWith('ія')) return word.slice(0, -2) + 'ії';
        if (word.endsWith('а')) return word.slice(0, -1) + 'и';
        if (word.endsWith('я')) return word.slice(0, -1) + 'і';
        if (word.endsWith('о')) return word.slice(0, -1) + 'а';
        if (/[бвгґджзклмнпрстфхцчшщ]$/.test(word) && !word.endsWith('ів') && !word.endsWith('ськ')) {
            return word + 'у';
        }
        
        return word;
    });
    
    return declinedWords.join(' ');
};

export const getNounFromPhrase = (phrase: string): string => {
    const words = phrase.split(' ');
    return words[words.length - 1];
};

export const areSameRoot = (word1: string, word2: string): boolean => {
    const shorter = word1.length < word2.length ? word1 : word2;
    const longer = word1.length < word2.length ? word2 : word1;
    return longer.startsWith(shorter) && shorter.length > 3;
};

export const removeLogicalDuplicates = (phrase: string): string => {
    const words = phrase.split(' ');
    if (words.length < 2) {
        return phrase;
    }
    const uniqueWords = words.reduce<string[]>((acc, word) => {
        if (acc.length === 0 || acc[acc.length - 1].toLowerCase() !== word.toLowerCase()) {
            acc.push(word);
        }
        return acc;
    }, []);
    return uniqueWords.join(' ');
};

export const getHierarchicalPath = (person: Person, subdivisions: Subdivision[]): (Subdivision | { name: string, id: string })[] => {
    if (!person || !person.position) return [];
  
    const path: (Subdivision | { name: string, id: string })[] = [{ name: person.position, id: 'person_position' }];
    if (!person.subdivisionRowIndex || subdivisions.length === 0) return path;

    const subMap = new Map(subdivisions.map(s => [s.id, s]));
    
    const directSub = subdivisions
      .filter(s => s.rowIndex <= person.subdivisionRowIndex!)
      .sort((a, b) => b.rowIndex - a.rowIndex)[0];
  
    if (!directSub) return path;
  
    let currentSub: Subdivision | undefined = directSub;
    while (currentSub) {
      path.push(currentSub);
      currentSub = currentSub.parentId ? subMap.get(currentSub.parentId) : undefined;
    }
    
    return path;
};

export const formatHierarchicalPositionForRoster = (person: Person, subdivisions: Subdivision[]): string => {
    if (person.customFullPosition) return person.customFullPosition.toLowerCase();
    
    const path = getHierarchicalPath(person, subdivisions);
    if (path.length === 0) return '';
    
    let basePosition = path[0].name.toLowerCase();
    const subs = path.slice(1).filter((item): item is Subdivision => 'rowIndex' in item);

    let usedFirstSub = false;

    if (subs.length > 0) {
        const firstSub = subs[0];
        const firstSubNoun = getNounFromPhrase(firstSub.name);
        
        const baseWords = basePosition.split(/(\s|-)/);
        let matchFound = false;
        
        const newBaseWords = baseWords.map(word => {
            const cleanWord = word.replace(/[^а-яА-Яїієґ-]/g, '');
            if (!matchFound && areSameRoot(cleanWord, firstSubNoun)) {
                matchFound = true;
                usedFirstSub = true;
                return firstSub.genitiveCaseName || declinePhraseToGenitive(firstSub.name);
            }
            return word;
        });
        
        if (matchFound) {
            basePosition = newBaseWords.join('');
        }
    }

    const remainingSubs = usedFirstSub ? subs.slice(1) : subs;
    const allParts = [basePosition, ...remainingSubs.map(s => s.genitiveCaseName || declinePhraseToGenitive(s.name))];
    
    const combined = allParts.join(' ').replace(/\s+/g, ' ');
    const finalString = removeLogicalDuplicates(combined);
    
    return finalString;
};

export const generateFullPosition = (person: Person, subdivisions: Subdivision[]): string => {
    if (!person || !person.position) return '';
    if (person.customFullPosition) return person.customFullPosition.toLowerCase();
  
    const path = getHierarchicalPath(person, subdivisions);
    return path.map(p => `(${p.name.trim().toLowerCase()})`).join(' ');
};