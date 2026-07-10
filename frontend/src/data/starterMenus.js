// Ready-made starter menus. Hotels import one, then delete/edit items and fix
// prices — much faster than typing a full menu by hand. Item shape matches the
// /hotel/food/bulk-json endpoint: { name, price, category, isVeg, emoji, description }.

const v = (name, price, category, emoji, description = '') => ({ name, price, category, isVeg: true,  emoji, description });
const n = (name, price, category, emoji, description = '') => ({ name, price, category, isVeg: false, emoji, description });

export const STARTER_MENUS = [
  {
    id: 'indian-standard',
    name: 'Indian Hotel Standard',
    icon: '🏨',
    description: 'Full multi-cuisine hotel menu — breakfast, Indian mains, Chinese, beverages & desserts',
    items: [
      // Breakfast
      v('Idli Sambar (2 pcs)', 60, 'Breakfast', '🍚', 'Steamed rice cakes with sambar & chutney'),
      v('Masala Dosa', 90, 'Breakfast', '🥞', 'Crispy dosa with potato masala'),
      v('Plain Dosa', 70, 'Breakfast', '🥞'),
      v('Poha', 50, 'Breakfast', '🍚'),
      v('Upma', 50, 'Breakfast', '🍚'),
      v('Aloo Paratha (2 pcs)', 80, 'Breakfast', '🫓', 'Served with curd & pickle'),
      v('Puri Bhaji', 70, 'Breakfast', '🫓'),
      n('Omelette (2 eggs)', 60, 'Breakfast', '🍳'),
      n('Bread Omelette', 80, 'Breakfast', '🍳'),
      v('Bread Butter Toast', 40, 'Breakfast', '🍞'),
      // Starters
      v('Paneer Tikka', 220, 'Starters', '🧀', 'Char-grilled cottage cheese'),
      v('Veg Pakora', 120, 'Starters', '🧆'),
      v('Crispy Corn', 160, 'Starters', '🌽'),
      n('Chicken Tikka', 260, 'Starters', '🍗'),
      n('Chicken 65', 240, 'Starters', '🍗'),
      n('Fish Fingers', 280, 'Starters', '🍤'),
      v('Masala Papad (2 pcs)', 50, 'Starters', '🫓'),
      // Main Course
      v('Paneer Butter Masala', 240, 'Main Course', '🥘'),
      v('Kadai Paneer', 230, 'Main Course', '🥘'),
      v('Dal Tadka', 160, 'Main Course', '🥘'),
      v('Dal Makhani', 190, 'Main Course', '🥘'),
      v('Mix Veg Curry', 180, 'Main Course', '🥗'),
      v('Chana Masala', 170, 'Main Course', '🥘'),
      n('Butter Chicken', 300, 'Main Course', '🍗'),
      n('Chicken Curry', 260, 'Main Course', '🍛'),
      n('Mutton Rogan Josh', 350, 'Main Course', '🥩'),
      n('Egg Curry (2 eggs)', 160, 'Main Course', '🥚'),
      // Breads
      v('Tawa Roti', 15, 'Breads', '🫓'),
      v('Butter Roti', 20, 'Breads', '🫓'),
      v('Butter Naan', 45, 'Breads', '🫓'),
      v('Garlic Naan', 60, 'Breads', '🫓'),
      v('Laccha Paratha', 50, 'Breads', '🫓'),
      // Rice & Biryani
      v('Steamed Rice', 100, 'Rice & Biryani', '🍚'),
      v('Jeera Rice', 130, 'Rice & Biryani', '🍚'),
      v('Veg Biryani', 200, 'Rice & Biryani', '🍛'),
      v('Veg Pulao', 170, 'Rice & Biryani', '🍚'),
      n('Chicken Biryani', 280, 'Rice & Biryani', '🍛'),
      n('Egg Biryani', 220, 'Rice & Biryani', '🍛'),
      // Chinese
      v('Veg Fried Rice', 160, 'Chinese', '🍚'),
      v('Veg Hakka Noodles', 160, 'Chinese', '🍜'),
      v('Gobi Manchurian', 180, 'Chinese', '🥦'),
      n('Chicken Fried Rice', 200, 'Chinese', '🍚'),
      n('Chicken Noodles', 200, 'Chinese', '🍜'),
      n('Chilli Chicken', 250, 'Chinese', '🍗'),
      // Beverages
      v('Tea', 25, 'Beverages', '☕'),
      v('Coffee', 35, 'Beverages', '☕'),
      v('Fresh Lime Soda', 60, 'Beverages', '🥤'),
      v('Sweet Lassi', 80, 'Beverages', '🧋'),
      v('Buttermilk', 40, 'Beverages', '🥛'),
      v('Mineral Water (1L)', 25, 'Beverages', '💧'),
      v('Soft Drink (300ml)', 40, 'Beverages', '🥤'),
      // Desserts
      v('Gulab Jamun (2 pcs)', 80, 'Desserts', '🍮'),
      v('Ice Cream (Vanilla)', 90, 'Desserts', '🍦'),
      v('Fruit Salad', 120, 'Desserts', '🍨'),
    ],
  },
  {
    id: 'south-indian-veg',
    name: 'South Indian Pure Veg',
    icon: '🌿',
    description: 'Tiffin, dosa varieties, meals & filter coffee — 100% vegetarian',
    items: [
      // Tiffin
      v('Idli (2 pcs)', 50, 'Tiffin', '🍚'),
      v('Vada (2 pcs)', 55, 'Tiffin', '🍩'),
      v('Idli Vada Combo', 75, 'Tiffin', '🍚'),
      v('Pongal', 70, 'Tiffin', '🍚'),
      v('Upma', 55, 'Tiffin', '🍚'),
      v('Kesari Bath', 60, 'Tiffin', '🍮'),
      v('Rava Idli (2 pcs)', 65, 'Tiffin', '🍚'),
      // Dosa Corner
      v('Plain Dosa', 70, 'Dosa Corner', '🥞'),
      v('Masala Dosa', 95, 'Dosa Corner', '🥞'),
      v('Ghee Roast Dosa', 120, 'Dosa Corner', '🥞'),
      v('Mysore Masala Dosa', 120, 'Dosa Corner', '🥞', 'With spicy red chutney spread'),
      v('Rava Dosa', 100, 'Dosa Corner', '🥞'),
      v('Onion Dosa', 90, 'Dosa Corner', '🥞'),
      v('Set Dosa (3 pcs)', 90, 'Dosa Corner', '🥞'),
      v('Paneer Dosa', 130, 'Dosa Corner', '🥞'),
      // Meals & Rice
      v('South Indian Thali', 180, 'Meals & Rice', '🍱', 'Rice, sambar, rasam, poriyal, curd, papad & sweet'),
      v('Curd Rice', 90, 'Meals & Rice', '🍚'),
      v('Lemon Rice', 100, 'Meals & Rice', '🍋'),
      v('Tamarind Rice', 100, 'Meals & Rice', '🍚'),
      v('Bisi Bele Bath', 120, 'Meals & Rice', '🍲'),
      v('Sambar Rice', 110, 'Meals & Rice', '🍲'),
      v('Veg Pulao', 150, 'Meals & Rice', '🍚'),
      // North Indian
      v('Chapati (2 pcs) with Kurma', 90, 'North Indian', '🫓'),
      v('Paneer Butter Masala', 220, 'North Indian', '🥘'),
      v('Dal Fry', 150, 'North Indian', '🥘'),
      v('Veg Kadai', 190, 'North Indian', '🥘'),
      // Beverages
      v('Filter Coffee', 35, 'Beverages', '☕'),
      v('Tea', 25, 'Beverages', '☕'),
      v('Badam Milk', 60, 'Beverages', '🥛'),
      v('Fresh Juice (Seasonal)', 80, 'Beverages', '🧃'),
      v('Buttermilk', 35, 'Beverages', '🥛'),
      // Desserts
      v('Mysore Pak', 70, 'Desserts', '🍮'),
      v('Payasam', 80, 'Desserts', '🍮'),
    ],
  },
  {
    id: 'cafe-fastfood',
    name: 'Cafe & Fast Food',
    icon: '🍔',
    description: 'Burgers, sandwiches, pizza, momos, shakes — quick bites for a modern stay',
    items: [
      // Quick Bites
      v('Veg Burger', 110, 'Quick Bites', '🍔'),
      n('Chicken Burger', 150, 'Quick Bites', '🍔'),
      v('French Fries', 100, 'Quick Bites', '🍟'),
      v('Peri Peri Fries', 120, 'Quick Bites', '🍟'),
      v('Veg Momos (6 pcs)', 100, 'Quick Bites', '🥟'),
      n('Chicken Momos (6 pcs)', 130, 'Quick Bites', '🥟'),
      v('Spring Rolls (4 pcs)', 120, 'Quick Bites', '🌯'),
      // Sandwiches
      v('Veg Grilled Sandwich', 100, 'Sandwiches', '🥪'),
      v('Cheese Sandwich', 120, 'Sandwiches', '🥪'),
      v('Paneer Tikka Sandwich', 140, 'Sandwiches', '🥪'),
      n('Chicken Club Sandwich', 170, 'Sandwiches', '🥪'),
      n('Egg Sandwich', 110, 'Sandwiches', '🥪'),
      // Pizza & Pasta
      v('Margherita Pizza (8")', 200, 'Pizza & Pasta', '🍕'),
      v('Veggie Supreme Pizza (8")', 250, 'Pizza & Pasta', '🍕'),
      n('Chicken Tikka Pizza (8")', 290, 'Pizza & Pasta', '🍕'),
      v('White Sauce Pasta', 180, 'Pizza & Pasta', '🍝'),
      v('Red Sauce Pasta', 170, 'Pizza & Pasta', '🍝'),
      n('Chicken Alfredo Pasta', 230, 'Pizza & Pasta', '🍝'),
      // Maggi & More
      v('Classic Maggi', 60, 'Maggi & More', '🍜'),
      v('Cheese Maggi', 80, 'Maggi & More', '🍜'),
      v('Veg Maggi', 75, 'Maggi & More', '🍜'),
      n('Egg Maggi', 85, 'Maggi & More', '🍜'),
      // Beverages
      v('Cold Coffee', 90, 'Beverages', '🧋'),
      v('Chocolate Shake', 120, 'Beverages', '🧋'),
      v('Oreo Shake', 130, 'Beverages', '🧋'),
      v('Iced Tea (Lemon)', 80, 'Beverages', '🥤'),
      v('Hot Chocolate', 100, 'Beverages', '☕'),
      v('Espresso', 60, 'Beverages', '☕'),
      v('Cappuccino', 90, 'Beverages', '☕'),
      // Desserts
      v('Chocolate Brownie', 110, 'Desserts', '🍫'),
      v('Brownie with Ice Cream', 150, 'Desserts', '🍨'),
      v('Waffle (Chocolate)', 140, 'Desserts', '🧇'),
    ],
  },
];
