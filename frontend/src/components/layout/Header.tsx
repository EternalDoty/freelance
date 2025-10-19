import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Search, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  MessageCircle,
  Shield,
  AlertTriangle
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { useQuery } from 'react-query';
import { api, endpoints } from '../../services/api';

interface HeaderProps {
  onNotificationClick: () => void;
  onProfileClick: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onNotificationClick,
  onProfileClick,
  onLogout
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { user } = useAuthStore();

  // Fetch notifications count
  const { data: notificationsData } = useQuery(
    ['notifications', 'count'],
    () => api.get(endpoints.notifications.list, { params: { limit: 1, is_read: false } }),
    {
      select: (response) => response.data.data,
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const unreadCount = notificationsData?.total || 0;

  const profileMenuItems = [
    {
      name: 'Профиль',
      href: '/profile',
      icon: User,
    },
    {
      name: 'Настройки',
      href: '/profile/edit',
      icon: Settings,
    },
    {
      name: 'Escrow',
      href: '/escrow',
      icon: Shield,
    },
    {
      name: 'Апелляции',
      href: '/appeals',
      icon: AlertTriangle,
    },
    {
      name: 'Поддержка',
      href: '/support',
      icon: MessageCircle,
    },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">FP</span>
              </div>
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                Freelance Platform
              </span>
            </Link>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-lg mx-8 hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Поиск задач..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button
              onClick={onNotificationClick}
              className="relative p-2 text-gray-400 hover:text-gray-500 transition-colors duration-200"
            >
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.profile_data?.name || user?.username}
                  </div>
                  <div className="text-xs text-gray-500">
                    {user?.role === 'admin' ? 'Администратор' : 
                     user?.role === 'moderator' ? 'Модератор' : 'Пользователь'}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {/* Dropdown menu */}
              {profileDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                >
                  {profileMenuItems.map((item, index) => (
                    <Link
                      key={index}
                      to={item.href}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <item.icon className="h-4 w-4 mr-3" />
                      {item.name}
                    </Link>
                  ))}
                  <hr className="my-1" />
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Выйти
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden px-4 pb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Поиск задач..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
