import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(() => {
		try {
			return localStorage.getItem('fv-theme') || 'dark';
		} catch {
			return 'dark';
		}
	});

	useEffect(() => {
		const root = document.documentElement;
		if (theme === 'light') {
			root.classList.add('light');
			root.classList.remove('dark');
			root.style.colorScheme = 'light';
		} else {
			root.classList.remove('light');
			root.classList.add('dark');
			root.style.colorScheme = 'dark';
		}
		try {
			localStorage.setItem('fv-theme', theme);
		} catch {
			/* ignore */
		}
	}, [theme]);

	const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};
