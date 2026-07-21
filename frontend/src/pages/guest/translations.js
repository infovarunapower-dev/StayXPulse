// Guest-page translations. English is canonical: service request types and
// order statuses are stored in English in the DB (the hotel admin reads them),
// so we only translate what the guest sees.

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', short: 'RU', flag: '🇷🇺' },
];

export const LANG_KEY = 'gl_lang';

const en = {
  loading: 'Loading…',
  invalidTitle: 'Invalid QR Code',
  invalidBody: 'This QR code is inactive or invalid. Please ask the hotel staff for assistance.',
  language: 'Language',

  room: 'Room',

  tabService: 'Room Service',
  tabMenu: 'Food Menu',
  tabOrders: 'My Orders',

  helpTitle: 'How can we help you?',

  menuUnavailable: 'Menu not available yet',
  searchPlaceholder: 'Search dishes…',
  filterAll: 'All',
  filterVeg: '🟢 Veg',
  filterNonVeg: '🔴 Non-Veg',
  noMatchFilter: 'Nothing matches this filter',
  noMatchQuery: (q) => `Nothing matches “${q}”`,
  clearFilters: 'Clear filters',
  add: 'Add',

  live: 'Live · updates automatically',
  refresh: '↻ Refresh',
  foodOrders: 'Food Orders',
  serviceRequests: 'Service Requests',
  noOrders: 'No food orders yet',
  browseMenu: 'Browse the menu →',
  noRequests: 'No service requests yet',
  requestService: 'Request room service →',
  total: 'Total',

  viewCart: '🛒 View Cart',
  item: 'item',
  items: 'items',
  yourCart: 'Your Cart',
  clear: 'Clear',
  each: 'each',
  instructionsLabel: 'Special instructions (optional)',
  instructionsPlaceholder: 'e.g. less spicy, no onions…',
  placing: 'Placing Order…',
  placeOrder: 'Place Order',

  orderPlaced: 'Your order has been placed! We\'ll bring it to your room shortly. 🍽',
  orderFailed: 'Failed to place order',
  requestSent: (type) => `✅ "${type}" request submitted! Our team will assist you shortly.`,
  requestFailed: 'Failed',

  steps: { Placed: 'Placed', Preparing: 'Preparing', Delivered: 'Delivered' },
  cancelledNote: '✕ This order was cancelled',
  status: {
    pending: 'Pending', preparing: 'Preparing', delivered: 'Delivered',
    cancelled: 'Cancelled', 'in-progress': 'In Progress', completed: 'Completed',
  },
  services: {
    'Extra Towels / Toiletries': 'Extra Towels / Toiletries',
    'Room Cleaning': 'Room Cleaning',
    'AC / Heating Issue': 'AC / Heating Issue',
    'Extra Pillow / Blanket': 'Extra Pillow / Blanket',
    'Electrical Issue': 'Electrical Issue',
    'Wake-up Call': 'Wake-up Call',
    'Room Key Issue': 'Room Key Issue',
    'Hot Water Issue': 'Hot Water Issue',
    'Dining Table Setup': 'Dining Table Setup',
    'Laundry Service': 'Laundry Service',
    'Noise Complaint': 'Noise Complaint',
    'TV / WiFi Issue': 'TV / WiFi Issue',
  },
};

const ru = {
  loading: 'Загрузка…',
  invalidTitle: 'Недействительный QR-код',
  invalidBody: 'Этот QR-код неактивен или недействителен. Пожалуйста, обратитесь к персоналу отеля.',
  language: 'Язык',

  room: 'Номер',

  tabService: 'Обслуживание',
  tabMenu: 'Меню',
  tabOrders: 'Мои заказы',

  helpTitle: 'Чем мы можем помочь?',

  menuUnavailable: 'Меню пока недоступно',
  searchPlaceholder: 'Поиск блюд…',
  filterAll: 'Все',
  filterVeg: '🟢 Вегет.',
  filterNonVeg: '🔴 Мясные',
  noMatchFilter: 'Ничего не найдено по этому фильтру',
  noMatchQuery: (q) => `Ничего не найдено по запросу «${q}»`,
  clearFilters: 'Сбросить фильтры',
  add: 'Добавить',

  live: 'Онлайн · обновляется автоматически',
  refresh: '↻ Обновить',
  foodOrders: 'Заказы еды',
  serviceRequests: 'Заявки на обслуживание',
  noOrders: 'Заказов пока нет',
  browseMenu: 'Открыть меню →',
  noRequests: 'Заявок пока нет',
  requestService: 'Заказать обслуживание →',
  total: 'Итого',

  viewCart: '🛒 Корзина',
  item: 'товар',
  items: 'товаров',
  yourCart: 'Ваша корзина',
  clear: 'Очистить',
  each: 'за шт.',
  instructionsLabel: 'Особые пожелания (необязательно)',
  instructionsPlaceholder: 'например, менее острое, без лука…',
  placing: 'Оформляем заказ…',
  placeOrder: 'Оформить заказ',

  orderPlaced: 'Ваш заказ принят! Мы скоро доставим его в номер. 🍽',
  orderFailed: 'Не удалось оформить заказ',
  requestSent: (type) => `✅ Заявка «${type}» принята! Наша команда скоро вам поможет.`,
  requestFailed: 'Ошибка',

  steps: { Placed: 'Принят', Preparing: 'Готовится', Delivered: 'Доставлен' },
  cancelledNote: '✕ Этот заказ был отменён',
  status: {
    pending: 'В ожидании', preparing: 'Готовится', delivered: 'Доставлен',
    cancelled: 'Отменён', 'in-progress': 'В работе', completed: 'Выполнено',
  },
  services: {
    'Extra Towels / Toiletries': 'Полотенца / туалетные принадлежности',
    'Room Cleaning': 'Уборка номера',
    'AC / Heating Issue': 'Кондиционер / отопление',
    'Extra Pillow / Blanket': 'Дополнительная подушка / одеяло',
    'Electrical Issue': 'Проблема с электричеством',
    'Wake-up Call': 'Звонок-будильник',
    'Room Key Issue': 'Проблема с ключом от номера',
    'Hot Water Issue': 'Нет горячей воды',
    'Dining Table Setup': 'Сервировка стола',
    'Laundry Service': 'Прачечная',
    'Noise Complaint': 'Жалоба на шум',
    'TV / WiFi Issue': 'Проблема с ТВ / Wi-Fi',
  },
};

const DICT = { en, ru };

export const getDict = (code) => DICT[code] || en;
