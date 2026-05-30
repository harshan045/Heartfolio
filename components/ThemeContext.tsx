import React, { createContext, useContext, useState } from 'react';
import { Colors } from '../constants/theme';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeType;
    colors: typeof Colors.light;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    // Force global app theme to light. Dark mode is provided only inside the Gallery.
    const [theme] = useState<ThemeType>('light');
    const toggleTheme = () => {
        // no-op for global provider to ensure other tabs remain light-only
        return;
    };

    const colors = Colors.light;

    return (
        <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
