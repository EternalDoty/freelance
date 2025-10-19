import React, { useState } from 'react';
import { Upload, AlertTriangle, FileText, Image, X } from 'lucide-react';

interface AppealFormProps {
  appealType: 'rating' | 'transaction' | 'block' | 'other';
  relatedId?: number;
  onSubmit: (data: AppealData) => void;
  onCancel: () => void;
}

interface AppealData {
  type: string;
  reason: string;
  evidence: File[];
  additionalComments: string;
}

export const AppealForm: React.FC<AppealFormProps> = ({
  appealType,
  relatedId,
  onSubmit,
  onCancel
}) => {
  const [reason, setReason] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [evidence, setEvidence] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
      
      if (file.size > maxSize) {
        alert(`Файл ${file.name} слишком большой. Максимальный размер: 10MB`);
        return false;
      }
      
      if (!allowedTypes.includes(file.type)) {
        alert(`Файл ${file.name} имеет неподдерживаемый формат`);
        return false;
      }
      
      return true;
    });
    
    setEvidence(prev => [...prev, ...validFiles].slice(0, 5)); // Максимум 5 файлов
  };

  const removeFile = (index: number) => {
    setEvidence(prev => prev.filter((_, i) => i !== index));
  };

  const getAppealTypeText = (type: string) => {
    switch (type) {
      case 'rating': return 'Апелляция рейтинга';
      case 'transaction': return 'Апелляция транзакции';
      case 'block': return 'Апелляция блокировки';
      case 'other': return 'Другая апелляция';
      default: return 'Апелляция';
    }
  };

  const getAppealTypeDescription = (type: string) => {
    switch (type) {
      case 'rating':
        return 'Если вы считаете, что полученный рейтинг несправедлив, приложите доказательства качества выполненной работы.';
      case 'transaction':
        return 'При спорных ситуациях с платежами приложите скриншоты переписки и документы, подтверждающие вашу позицию.';
      case 'block':
        return 'Если ваш аккаунт был заблокирован по ошибке, объясните ситуацию и приложите доказательства.';
      case 'other':
        return 'Опишите вашу проблему и приложите все необходимые доказательства.';
      default:
        return 'Опишите вашу проблему и приложите доказательства.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      alert('Пожалуйста, укажите причину апелляции');
      return;
    }

    setIsSubmitting(true);

    try {
      const appealData: AppealData = {
        type: appealType,
        reason: reason.trim(),
        evidence,
        additionalComments: additionalComments.trim()
      };

      await onSubmit(appealData);
    } catch (error) {
      console.error('Error submitting appeal:', error);
      alert('Произошла ошибка при отправке апелляции');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {getAppealTypeText(appealType)}
          </h2>
          <p className="text-sm text-gray-600">
            {getAppealTypeDescription(appealType)}
          </p>
        </div>
      </div>

      {/* Related ID */}
      {relatedId && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Связанный объект:</strong> #{relatedId}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Причина апелляции *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Подробно опишите, почему вы подаете апелляцию..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            required
          />
        </div>

        {/* Evidence Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Доказательства
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors duration-200">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              accept="image/*,.pdf,.txt"
              className="hidden"
              id="evidence-upload"
            />
            <label
              htmlFor="evidence-upload"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-600">
                Нажмите для загрузки файлов или перетащите их сюда
              </span>
              <span className="text-xs text-gray-500">
                Поддерживаемые форматы: JPG, PNG, GIF, PDF, TXT (макс. 10MB)
              </span>
            </label>
          </div>

          {/* Uploaded Files */}
          {evidence.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Загруженные файлы:</p>
              {evidence.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    {getFileIcon(file)}
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Additional Comments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Дополнительные комментарии
          </label>
          <textarea
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            placeholder="Любая дополнительная информация, которая может помочь в рассмотрении апелляции..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        {/* Important Notice */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800 mb-1">
                Важная информация
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Апелляции рассматриваются в течение 24-48 часов</li>
                <li>• Приложите все необходимые доказательства</li>
                <li>• Ложные апелляции могут привести к блокировке аккаунта</li>
                <li>• Решение модератора является окончательным</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !reason.trim()}
            className="px-6 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isSubmitting ? 'Отправка...' : 'Подать апелляцию'}
          </button>
        </div>
      </form>
    </div>
  );
};
