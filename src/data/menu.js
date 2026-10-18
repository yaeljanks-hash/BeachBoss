// The restaurant menu. Add, remove or rebalance items here; gameplay code only
// reads from this list.
//
// Fields:
//   id          unique key, used in code and (later) analytics
//   name        shown to the player
//   category    'drink' or 'food' (controls how long guests take to consume it)
//   price       coins paid by the guest
//   prepTimeMs  how long the bar takes to prepare it
//   icon        how to draw it; `shape` picks a renderer in src/ui/icons.js and
//               the remaining keys are options for that renderer

export const MenuCategory = {
  DRINK: 'drink',
  FOOD: 'food'
};

export const MENU = [
  {
    id: 'lemonade',
    name: 'Lemonade',
    category: MenuCategory.DRINK,
    price: 8,
    prepTimeMs: 3000,
    icon: { shape: 'glass', liquid: 0xfff176, garnish: 'lemon' }
  },
  {
    id: 'coconut_water',
    name: 'Coconut Water',
    category: MenuCategory.DRINK,
    price: 10,
    prepTimeMs: 3500,
    icon: { shape: 'coconut' }
  },
  {
    id: 'mango_smoothie',
    name: 'Mango Smoothie',
    category: MenuCategory.DRINK,
    price: 14,
    prepTimeMs: 5000,
    icon: { shape: 'glass', liquid: 0xffa726, garnish: 'mango' }
  },
  {
    id: 'iced_coffee',
    name: 'Iced Coffee',
    category: MenuCategory.DRINK,
    price: 12,
    prepTimeMs: 4000,
    icon: { shape: 'glass', liquid: 0x8d5524, garnish: 'ice' }
  },
  {
    id: 'strawberry_smoothie',
    name: 'Strawberry Smoothie',
    category: MenuCategory.DRINK,
    price: 14,
    prepTimeMs: 5000,
    icon: { shape: 'glass', liquid: 0xf48fb1, garnish: 'strawberry' }
  },
  {
    id: 'watermelon_slices',
    name: 'Watermelon Slices',
    category: MenuCategory.FOOD,
    price: 12,
    prepTimeMs: 4500,
    icon: { shape: 'watermelon' }
  },
  {
    id: 'french_fries',
    name: 'French Fries',
    category: MenuCategory.FOOD,
    price: 15,
    prepTimeMs: 6000,
    icon: { shape: 'fries', box: 0x29b6f6 }
  },
  {
    id: 'fruit_salad',
    name: 'Fruit Salad',
    category: MenuCategory.FOOD,
    price: 18,
    prepTimeMs: 6500,
    icon: { shape: 'fruitBowl', fruits: [0xef5350, 0xffca28, 0x66bb6a, 0xab47bc, 0xffa726] }
  }
];

/**
 * Check the menu for mistakes that would break gameplay (duplicate ids,
 * missing fields, bad numbers). Returns a list of problems; empty means OK.
 */
export function validateMenu(menu = MENU) {
  const problems = [];
  const seen = new Set();
  const categories = Object.values(MenuCategory);

  menu.forEach((item, i) => {
    const label = item.id ?? `item #${i}`;
    if (!item.id) problems.push(`${label}: missing id`);
    if (seen.has(item.id)) problems.push(`${label}: duplicate id`);
    seen.add(item.id);
    if (!item.name) problems.push(`${label}: missing name`);
    if (!categories.includes(item.category)) problems.push(`${label}: unknown category "${item.category}"`);
    if (!(item.price > 0)) problems.push(`${label}: price must be a positive number`);
    if (!(item.prepTimeMs > 0)) problems.push(`${label}: prepTimeMs must be a positive number`);
    if (!item.icon?.shape) problems.push(`${label}: missing icon.shape`);
  });

  if (menu.length === 0) problems.push('menu is empty');
  return problems;
}

export function pickRandomMenuItem(rnd) {
  return rnd.pick(MENU);
}
