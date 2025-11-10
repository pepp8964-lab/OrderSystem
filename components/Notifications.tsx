import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ChevronRightIcon } from './icons/Icons';
import Card from './Card';
import { CHANGELOG_DATA } from '../pages/Updates';
import useNotifications from '../hooks/useNotifications';
import { useModal } from '../context/ThemeContext';

interface Notification {
    text: string;
    link: string;
    type: 'person' | 'schedule' | 'weapon' | 'update';
}

const NotificationGroup: React.FC<{ title: string; notifications: Notification[]; onClick: (link: string) => void }> = ({ title, notifications, onClick }) => {
    const [isGroupOpen, setIsGroupOpen] = React.useState(true);

    if (notifications.length === 0) return null;

    return (
        <div>
            <button onClick={() => setIsGroupOpen(!isGroupOpen)} className="w-full flex items-center justify-between text-left p-2 bg-secondary/50 rounded-md">
                <span className="font-bold text-header">{title} ({notifications.length})</span>
                {isGroupOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </button>
            {isGroupOpen && (
                <ul className="space-y-2 mt-2 pl-2 border-l-2 border-border-color">
                    {notifications.map((notif, i) => (
                        <li
                            key={i}
                            onClick={() => onClick(notif.link)}
                            className="cursor-pointer text-sm text-primary-text bg-secondary p-2 rounded-md border border-border-color hover:bg-primary transition-colors"
                        >
                            {notif.text}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const Notifications: React.FC = () => {
    const { isNotificationsOpen, closeNotifications } = useModal();
    const { groupedNotifications, totalNotifications, setLastVersionSeen } = useNotifications();
    const navigate = useNavigate();

    const handleNotificationClick = (link: string) => {
        if (link === '/updates') {
            const currentVersion = CHANGELOG_DATA[0]?.version;
            if (currentVersion) {
                setLastVersionSeen(currentVersion);
            }
        }
        navigate(link);
        closeNotifications();
    };
    
    return (
        <aside className={`fixed top-0 right-0 h-full bg-sidebar w-80 p-4 transform transition-transform duration-300 ease-in-out z-30 ${isNotificationsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <Card className="h-full flex flex-col">
                <h3 className="text-lg font-bold text-header mb-2 border-b border-border-color pb-2">Сповіщення</h3>
                <div className="space-y-3 flex-grow overflow-y-auto">
                    {totalNotifications > 0 ? (
                        <>
                            <NotificationGroup title="Оновлення" notifications={groupedNotifications.update} onClick={handleNotificationClick} />
                            <NotificationGroup title="Особовий склад" notifications={groupedNotifications.person} onClick={handleNotificationClick} />
                            <NotificationGroup title="Графік" notifications={groupedNotifications.schedule} onClick={handleNotificationClick} />
                            <NotificationGroup title="Зброя" notifications={groupedNotifications.weapon} onClick={handleNotificationClick} />
                        </>
                    ) : (
                        <div className="text-sm text-secondary-text p-2 text-center h-full flex items-center justify-center">
                            Немає нових сповіщень.
                        </div>
                    )}
                </div>
            </Card>
        </aside>
    );
};

export default Notifications;