import React from 'react';
import { Star, Clock, Users, Tag } from 'lucide-react';

interface User {
  id: number;
  username: string;
  rating: number;
  totalTasks: number;
}

interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description: string;
    budget: number;
    deadline: string;
    category: string;
    status: 'open' | 'in_progress' | 'completed' | 'cancelled';
    customer: User;
    proposalsCount: number;
    skills: string[];
    createdAt: string;
  };
  onView: (id: number) => void;
  onPropose: (id: number) => void;
  userRole: 'customer' | 'executor' | 'guest';
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onView,
  onPropose,
  userRole
}) => {
  const formatBudget = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Просрочено';
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Завтра';
    if (diffDays < 7) return `Через ${diffDays} дн.`;
    return date.toLocaleDateString('ru-RU');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-gray-600 bg-gray-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Открыта';
      case 'in_progress': return 'В работе';
      case 'completed': return 'Завершена';
      case 'cancelled': return 'Отменена';
      default: return 'Неизвестно';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 mb-2">
            {task.title}
          </h3>
          <p className="text-gray-600 text-sm line-clamp-2 mb-3">
            {task.description}
          </p>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
          {getStatusText(task.status)}
        </div>
      </div>

      {/* Budget and Deadline */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-green-600">
            <span className="text-2xl font-bold">{formatBudget(task.budget)}</span>
          </div>
          <div className="flex items-center text-gray-500 text-sm">
            <Clock className="w-4 h-4 mr-1" />
            <span>{formatDeadline(task.deadline)}</span>
          </div>
        </div>
      </div>

      {/* Skills */}
      {task.skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {task.skills.slice(0, 3).map((skill, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700"
            >
              <Tag className="w-3 h-3 mr-1" />
              {skill}
            </span>
          ))}
          {task.skills.length > 3 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-600">
              +{task.skills.length - 3} еще
            </span>
          )}
        </div>
      )}

      {/* Customer Info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {task.customer.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{task.customer.username}</p>
            <div className="flex items-center space-x-1">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${
                      i < Math.floor(task.customer.rating)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {task.customer.rating.toFixed(1)} ({task.customer.totalTasks} задач)
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center text-gray-500 text-sm">
          <Users className="w-4 h-4 mr-1" />
          <span>{task.proposalsCount} предложений</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {new Date(task.createdAt).toLocaleDateString('ru-RU')}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onView(task.id)}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
          >
            Подробнее
          </button>
          {userRole === 'executor' && task.status === 'open' && (
            <button
              onClick={() => onPropose(task.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Подать предложение
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
