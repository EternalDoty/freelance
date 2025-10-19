import React from 'react';
import { Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, Pause } from 'lucide-react';

interface EscrowTransaction {
  id: number;
  taskId: number;
  taskTitle: string;
  amount: number;
  commission: number;
  status: 'INIT' | 'FUNDED' | 'IN_PROGRESS' | 'PENDING_RELEASE' | 'RELEASED' | 'REFUNDED' | 'DISPUTE';
  counterparty: {
    id: number;
    username: string;
    rating: number;
  };
  createdAt: string;
  updatedAt: string;
  disputeReason?: string;
}

interface EscrowCardProps {
  transaction: EscrowTransaction;
  userRole: 'customer' | 'executor';
  onRelease?: (id: number) => void;
  onRefund?: (id: number) => void;
  onDispute?: (id: number) => void;
  onViewDetails?: (id: number) => void;
}

export const EscrowCard: React.FC<EscrowCardProps> = ({
  transaction,
  userRole,
  onRelease,
  onRefund,
  onDispute,
  onViewDetails
}) => {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'INIT':
        return {
          color: 'text-gray-600 bg-gray-100',
          icon: Clock,
          text: 'Инициализация',
          description: 'Ожидание пополнения escrow'
        };
      case 'FUNDED':
        return {
          color: 'text-blue-600 bg-blue-100',
          icon: DollarSign,
          text: 'Средства зачислены',
          description: 'Средства заблокированы в escrow'
        };
      case 'IN_PROGRESS':
        return {
          color: 'text-yellow-600 bg-yellow-100',
          icon: Clock,
          text: 'В работе',
          description: 'Исполнитель выполняет задачу'
        };
      case 'PENDING_RELEASE':
        return {
          color: 'text-green-600 bg-green-100',
          icon: CheckCircle,
          text: 'Готово к выплате',
          description: 'Ожидание подтверждения заказчика'
        };
      case 'RELEASED':
        return {
          color: 'text-green-600 bg-green-100',
          icon: CheckCircle,
          text: 'Выплачено',
          description: 'Средства переведены исполнителю'
        };
      case 'REFUNDED':
        return {
          color: 'text-red-600 bg-red-100',
          icon: XCircle,
          text: 'Возвращено',
          description: 'Средства возвращены заказчику'
        };
      case 'DISPUTE':
        return {
          color: 'text-red-600 bg-red-100',
          icon: AlertTriangle,
          text: 'Спор',
          description: 'Требуется модерация'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-100',
          icon: Clock,
          text: 'Неизвестно',
          description: 'Статус не определен'
        };
    }
  };

  const statusInfo = getStatusInfo(transaction.status);
  const StatusIcon = statusInfo.icon;

  const canRelease = userRole === 'customer' && transaction.status === 'PENDING_RELEASE';
  const canRefund = userRole === 'customer' && ['FUNDED', 'IN_PROGRESS'].includes(transaction.status);
  const canDispute = ['FUNDED', 'IN_PROGRESS', 'PENDING_RELEASE'].includes(transaction.status);
  const canRequestRelease = userRole === 'executor' && transaction.status === 'IN_PROGRESS';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {transaction.taskTitle}
          </h3>
          <p className="text-sm text-gray-600">ID транзакции: #{transaction.id}</p>
        </div>
        <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
          <StatusIcon className="w-4 h-4 mr-2" />
          {statusInfo.text}
        </div>
      </div>

      {/* Amount and Commission */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Сумма</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatAmount(transaction.amount)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Комиссия</p>
          <p className="text-lg font-semibold text-gray-700">
            {formatAmount(transaction.commission)}
          </p>
        </div>
      </div>

      {/* Counterparty */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {transaction.counterparty.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{transaction.counterparty.username}</p>
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-600">
                Рейтинг: {transaction.counterparty.rating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">
            {userRole === 'customer' ? 'Исполнитель' : 'Заказчик'}
          </p>
        </div>
      </div>

      {/* Status Description */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">{statusInfo.description}</p>
        {transaction.disputeReason && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>Причина спора:</strong> {transaction.disputeReason}
            </p>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span>Создано: {formatDate(transaction.createdAt)}</span>
        <span>Обновлено: {formatDate(transaction.updatedAt)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onViewDetails?.(transaction.id)}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
        >
          Подробнее
        </button>
        
        <div className="flex items-center space-x-2">
          {canRelease && (
            <button
              onClick={() => onRelease?.(transaction.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Выплатить
            </button>
          )}
          
          {canRequestRelease && (
            <button
              onClick={() => onRelease?.(transaction.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Запросить выплату
            </button>
          )}
          
          {canRefund && (
            <button
              onClick={() => onRefund?.(transaction.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Возврат
            </button>
          )}
          
          {canDispute && (
            <button
              onClick={() => onDispute?.(transaction.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors duration-200"
            >
              Спор
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {['FUNDED', 'IN_PROGRESS', 'PENDING_RELEASE'].includes(transaction.status) && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
            <span>Прогресс</span>
            <span>
              {transaction.status === 'FUNDED' && '0%'}
              {transaction.status === 'IN_PROGRESS' && '50%'}
              {transaction.status === 'PENDING_RELEASE' && '90%'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                transaction.status === 'FUNDED' ? 'bg-blue-500 w-0' :
                transaction.status === 'IN_PROGRESS' ? 'bg-yellow-500 w-1/2' :
                transaction.status === 'PENDING_RELEASE' ? 'bg-green-500 w-11/12' : 'bg-gray-500 w-0'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
