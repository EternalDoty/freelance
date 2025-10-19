import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai' | 'operator';
  content: string;
  timestamp: string;
  confidence?: number;
  isTyping?: boolean;
}

interface AISupportChatProps {
  context?: {
    taskId?: number;
    transactionId?: number;
    userId: number;
  };
  onEscalate?: () => void;
  onClose?: () => void;
}

export const AISupportChat: React.FC<AISupportChatProps> = ({
  context,
  onEscalate,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Привет! Я AI-помощник платформы. Чем могу помочь?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const confidence = Math.random() * 0.4 + 0.6; // 0.6-1.0
      setAiConfidence(confidence);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: generateAIResponse(inputValue, confidence),
        timestamp: new Date().toISOString(),
        confidence
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);

      // Check if escalation is needed
      if (confidence < 0.7) {
        setTimeout(() => {
          const escalationMessage: Message = {
            id: (Date.now() + 2).toString(),
            type: 'ai',
            content: 'Я передаю ваш вопрос оператору для более детального рассмотрения.',
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, escalationMessage]);
          onEscalate?.();
        }, 2000);
      }
    }, 1500);
  };

  const generateAIResponse = (userInput: string, confidence: number): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('платеж') || input.includes('деньги') || input.includes('выплата')) {
      return confidence > 0.8 
        ? 'Для получения выплаты исполнитель должен завершить задачу и запросить выплату. Заказчик может подтвердить выполнение и перевести средства.'
        : 'По вопросам платежей рекомендую обратиться к оператору для детального разбора ситуации.';
    }
    
    if (input.includes('задача') || input.includes('проект')) {
      return confidence > 0.8
        ? 'Вы можете создать новую задачу, указав описание, бюджет и сроки. Исполнители смогут подать предложения.'
        : 'Для решения вопросов по задачам лучше обратиться к оператору.';
    }
    
    if (input.includes('рейтинг') || input.includes('отзыв')) {
      return confidence > 0.8
        ? 'Рейтинг формируется на основе отзывов после завершения задач. Если считаете оценку несправедливой, можете подать апелляцию.'
        : 'По вопросам рейтингов и отзывов рекомендую связаться с оператором.';
    }
    
    if (input.includes('блокировка') || input.includes('заблокирован')) {
      return 'Если ваш аккаунт заблокирован, обратитесь к оператору с объяснением ситуации. Мы рассмотрим каждый случай индивидуально.';
    }
    
    if (input.includes('спор') || input.includes('конфликт')) {
      return 'Для разрешения споров создайте апелляцию с приложением доказательств. Модераторы рассмотрят ситуацию в течение 24 часов.';
    }
    
    return confidence > 0.8
      ? 'Я понимаю ваш вопрос, но для более точного ответа рекомендую обратиться к оператору.'
      : 'К сожалению, я не могу дать точный ответ на ваш вопрос. Передаю его оператору.';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'Высокая';
    if (confidence >= 0.6) return 'Средняя';
    return 'Низкая';
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Support</h3>
            <p className="text-sm text-gray-600">Помощь и поддержка</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.type === 'ai'
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-green-100 text-green-900'
              }`}
            >
              <div className="flex items-start space-x-2">
                {message.type !== 'user' && (
                  <div className="flex-shrink-0 mt-1">
                    {message.type === 'ai' ? (
                      <Bot className="w-4 h-4 text-gray-500" />
                    ) : (
                      <User className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm">{message.content}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-70">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.confidence && message.type === 'ai' && (
                      <span className={`text-xs font-medium ${getConfidenceColor(message.confidence)}`}>
                        {getConfidenceText(message.confidence)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-gray-500" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Опишите вашу проблему..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        {/* Context Info */}
        {context && (
          <div className="mt-2 text-xs text-gray-500">
            Контекст: {context.taskId && `Задача #${context.taskId}`} {context.transactionId && `Транзакция #${context.transactionId}`}
          </div>
        )}
        
        {/* Escalation Button */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onEscalate}
            className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Связаться с оператором</span>
          </button>
          
          {aiConfidence !== null && (
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>Уверенность AI:</span>
              <span className={getConfidenceColor(aiConfidence)}>
                {Math.round(aiConfidence * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
