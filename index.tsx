import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider, ToastProvider, ActionLogProvider, ModalProvider } from './context/ThemeContext';
import { SearchProvider } from './context/SearchContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Не вдалося знайти кореневий елемент для монтування");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <ToastProvider>
            <ActionLogProvider>
              <ModalProvider>
                <SearchProvider>
                  <App />
                </SearchProvider>
              </ModalProvider>
            </ActionLogProvider>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);