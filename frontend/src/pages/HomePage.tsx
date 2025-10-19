import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Найди идеальную работу
              <span className="block text-blue-200">или исполнителя</span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Платформа для фрилансеров с защищенными платежами, AI поддержкой 
              и справедливой системой рейтингов
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors duration-200">
                🔍 Найти работу
              </button>
              <button className="inline-flex items-center px-8 py-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors duration-200">
                ➕ Создать задачу
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Почему выбирают нас
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Современная платформа с передовыми технологиями для безопасной работы
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: '🛡️',
                title: 'Защищенные платежи',
                description: 'Escrow система гарантирует безопасность ваших средств',
                color: 'text-green-600',
                bgColor: 'bg-green-100',
              },
              {
                icon: '🤖',
                title: 'AI поддержка',
                description: 'Умный помощник решает ваши вопросы 24/7',
                color: 'text-purple-600',
                bgColor: 'bg-purple-100',
              },
              {
                icon: '⭐',
                title: 'Справедливые рейтинги',
                description: 'Система защиты от необоснованных оценок',
                color: 'text-yellow-600',
                bgColor: 'bg-yellow-100',
              },
              {
                icon: '⚡',
                title: 'Быстрая регистрация',
                description: 'Вход через GitHub за секунды',
                color: 'text-blue-600',
                bgColor: 'bg-blue-100',
              },
              {
                icon: '📈',
                title: 'Низкие комиссии',
                description: 'От 0.5% в зависимости от суммы',
                color: 'text-orange-600',
                bgColor: 'bg-orange-100',
              },
              {
                icon: '👥',
                title: 'Сообщество',
                description: 'Тысячи проверенных фрилансеров',
                color: 'text-indigo-600',
                bgColor: 'bg-indigo-100',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors duration-200"
              >
                <div className={`w-12 h-12 ${feature.bgColor} rounded-lg flex items-center justify-center mb-4 text-2xl`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Готовы начать?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Присоединяйтесь к тысячам фрилансеров, которые уже работают на нашей платформе
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors duration-200">
              ➕ Создать первую задачу
            </button>
            <button className="inline-flex items-center px-8 py-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors duration-200">
              🔍 Найти работу
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
