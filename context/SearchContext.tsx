import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';

interface SearchContextType {
    searchQuery: string;
    setSearchQuery: Dispatch<SetStateAction<string>>;
    isSearchOpen: boolean;
    setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    return (
        <SearchContext.Provider value={{ searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen }}>
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = () => {
    const context = useContext(SearchContext);
    if (context === undefined) {
        throw new Error('useSearch must be used within a SearchProvider');
    }
    return context;
};
