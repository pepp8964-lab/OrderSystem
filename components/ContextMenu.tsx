import React, { useEffect, useRef } from 'react';
import { useModal } from '../context/ThemeContext';

const ContextMenu: React.FC = () => {
    const { contextMenu, hideContextMenu } = useModal();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contextMenu) {
            const handleClickOutside = (event: MouseEvent) => {
                if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                    hideContextMenu();
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [contextMenu, hideContextMenu]);

    if (!contextMenu) return null;

    const { x, y, items } = contextMenu;

    // Adjust position to stay within viewport
    const menuStyle: React.CSSProperties = {
        top: y,
        left: x,
        transform: 'none',
    };
    if (menuRef.current) {
        const menuWidth = menuRef.current.offsetWidth;
        const menuHeight = menuRef.current.offsetHeight;
        if (x + menuWidth > window.innerWidth) {
            menuStyle.left = window.innerWidth - menuWidth - 10;
        }
        if (y + menuHeight > window.innerHeight) {
            menuStyle.top = window.innerHeight - menuHeight - 10;
        }
    }


    return (
        <div
            ref={menuRef}
            style={menuStyle}
            className="fixed bg-card border border-border-color rounded-lg shadow-2xl z-[100] py-2 w-48 animate-fade-in-out"
            onClick={hideContextMenu}
        >
            <ul className="space-y-1">
                {items.map((item, index) => (
                    <li key={index}>
                        <button
                            onClick={item.onClick}
                            disabled={item.disabled}
                            className={`w-full text-left px-4 py-2 text-sm text-primary-text hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${item.className || ''}`}
                        >
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ContextMenu;