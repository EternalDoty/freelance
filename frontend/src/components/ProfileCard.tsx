import React from 'react';
import { Star, MapPin, Calendar, Award, CheckCircle, MessageCircle } from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  rating: number;
  totalTasks: number;
  totalEarnings: number;
  isVerified: boolean;
  profileData: {
    name?: string;
    bio?: string;
    location?: string;
    skills?: string[];
    experience?: string;
    portfolio?: string[];
  };
  createdAt: string;
}

interface ProfileCardProps {
  user: User;
  isOwnProfile?: boolean;
  onEdit?: () => void;
  onContact?: () => void;
  onViewPortfolio?: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  user,
  isOwnProfile = false,
  onEdit,
  onContact,
  onViewPortfolio
}) => {
  const formatEarnings = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} дн. назад`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес. назад`;
    return `${Math.floor(diffDays / 365)} г. назад`;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-blue-600';
    if (rating >= 3.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {user.profileData.name?.charAt(0) || user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            {user.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user.profileData.name || user.username}
            </h2>
            <p className="text-gray-600">@{user.username}</p>
            {user.profileData.bio && (
              <p className="text-gray-700 mt-2 max-w-md">{user.profileData.bio}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isOwnProfile ? (
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
            >
              Редактировать
            </button>
          ) : (
            <button
              onClick={onContact}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Связаться
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Star className="w-5 h-5 text-yellow-400 mr-1" />
            <span className={`text-2xl font-bold ${getRatingColor(user.rating)}`}>
              {user.rating.toFixed(1)}
            </span>
          </div>
          <p className="text-sm text-gray-600">Рейтинг</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {user.totalTasks}
          </div>
          <p className="text-sm text-gray-600">Завершенных задач</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {formatEarnings(user.totalEarnings)}
          </div>
          <p className="text-sm text-gray-600">Заработано</p>
        </div>
      </div>

      {/* Location and Experience */}
      <div className="flex items-center space-x-6 mb-6">
        {user.profileData.location && (
          <div className="flex items-center text-gray-600">
            <MapPin className="w-4 h-4 mr-2" />
            <span className="text-sm">{user.profileData.location}</span>
          </div>
        )}
        <div className="flex items-center text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          <span className="text-sm">На платформе {formatDate(user.createdAt)}</span>
        </div>
        {user.profileData.experience && (
          <div className="flex items-center text-gray-600">
            <Award className="w-4 h-4 mr-2" />
            <span className="text-sm">{user.profileData.experience}</span>
          </div>
        )}
      </div>

      {/* Skills */}
      {user.profileData.skills && user.profileData.skills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Навыки</h3>
          <div className="flex flex-wrap gap-2">
            {user.profileData.skills.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Preview */}
      {user.profileData.portfolio && user.profileData.portfolio.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Портфолио</h3>
            {onViewPortfolio && (
              <button
                onClick={onViewPortfolio}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Посмотреть все
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {user.profileData.portfolio.slice(0, 3).map((item, index) => (
              <div
                key={index}
                className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors duration-200"
              >
                <span className="text-gray-500 text-sm">Работа {index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Status */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {user.isVerified ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-green-700">
                  Профиль верифицирован
                </span>
              </>
            ) : (
              <>
                <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                <span className="text-sm text-gray-600">
                  Профиль не верифицирован
                </span>
              </>
            )}
          </div>
          <span className="text-xs text-gray-500">
            ID: {user.id}
          </span>
        </div>
      </div>
    </div>
  );
};
