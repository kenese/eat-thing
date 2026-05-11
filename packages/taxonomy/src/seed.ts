import type { CanonicalUnit } from './convert.js';
import type { Category } from './index.js';

export interface SeedFood {
  name: string;
  defaultUnit: CanonicalUnit;
  category: Category;
  aliases: string[];
  /** g per ml — enables g↔ml conversion for this food. */
  densityGPerMl?: number;
  /** Grams per one count unit (e.g. 1 egg ≈ 60g). */
  countToGrams?: number;
}

export const SEED_FOODS: SeedFood[] = [
  // ── Flours & grains ──────────────────────────────────────────────
  { name: 'plain flour', defaultUnit: 'g', category: 'pantry', aliases: ['all-purpose flour', 'flour'], densityGPerMl: 0.53 },
  { name: 'self-raising flour', defaultUnit: 'g', category: 'pantry', aliases: ['self-rising flour', 'SR flour'], densityGPerMl: 0.53 },
  { name: 'bread flour', defaultUnit: 'g', category: 'pantry', aliases: ['strong flour'], densityGPerMl: 0.53 },
  { name: 'wholemeal flour', defaultUnit: 'g', category: 'pantry', aliases: ['whole wheat flour'], densityGPerMl: 0.56 },
  { name: 'cornflour', defaultUnit: 'g', category: 'pantry', aliases: ['cornstarch', 'corn starch'], densityGPerMl: 0.6 },
  { name: 'white rice', defaultUnit: 'g', category: 'pantry', aliases: ['rice', 'long-grain rice'], densityGPerMl: 0.75 },
  { name: 'brown rice', defaultUnit: 'g', category: 'pantry', aliases: [], densityGPerMl: 0.77 },
  { name: 'rolled oats', defaultUnit: 'g', category: 'pantry', aliases: ['oats', 'porridge oats'], densityGPerMl: 0.34 },
  { name: 'pasta', defaultUnit: 'g', category: 'pantry', aliases: ['spaghetti', 'penne', 'fettuccine'] },
  { name: 'breadcrumbs', defaultUnit: 'g', category: 'pantry', aliases: ['panko breadcrumbs'], densityGPerMl: 0.37 },

  // ── Sugars & sweeteners ──────────────────────────────────────────
  { name: 'white sugar', defaultUnit: 'g', category: 'pantry', aliases: ['sugar', 'granulated sugar', 'caster sugar'], densityGPerMl: 0.85 },
  { name: 'brown sugar', defaultUnit: 'g', category: 'pantry', aliases: ['raw sugar', 'demerara sugar'], densityGPerMl: 0.72 },
  { name: 'icing sugar', defaultUnit: 'g', category: 'pantry', aliases: ['powdered sugar', 'confectioners sugar'], densityGPerMl: 0.56 },
  { name: 'honey', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 1.4 },
  { name: 'maple syrup', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 1.32 },
  { name: 'golden syrup', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 1.45 },

  // ── Baking & raising ─────────────────────────────────────────────
  { name: 'baking powder', defaultUnit: 'g', category: 'pantry', aliases: [], densityGPerMl: 0.9 },
  { name: 'baking soda', defaultUnit: 'g', category: 'pantry', aliases: ['bicarbonate of soda', 'bicarb soda'], densityGPerMl: 1.0 },
  { name: 'dried yeast', defaultUnit: 'g', category: 'pantry', aliases: ['instant yeast', 'active dry yeast'] },
  { name: 'cocoa powder', defaultUnit: 'g', category: 'pantry', aliases: ['unsweetened cocoa'], densityGPerMl: 0.5 },
  { name: 'desiccated coconut', defaultUnit: 'g', category: 'pantry', aliases: ['shredded coconut'], densityGPerMl: 0.28 },

  // ── Salt & seasonings ────────────────────────────────────────────
  { name: 'salt', defaultUnit: 'g', category: 'pantry', aliases: ['table salt', 'sea salt', 'kosher salt'], densityGPerMl: 1.2 },
  { name: 'black pepper', defaultUnit: 'g', category: 'pantry', aliases: ['ground black pepper', 'pepper'], densityGPerMl: 0.53 },

  // ── Spices ───────────────────────────────────────────────────────
  { name: 'cumin', defaultUnit: 'g', category: 'pantry', aliases: ['ground cumin', 'cumin powder'], densityGPerMl: 0.47 },
  { name: 'coriander', defaultUnit: 'g', category: 'pantry', aliases: ['ground coriander', 'coriander powder'], densityGPerMl: 0.47 },
  { name: 'turmeric', defaultUnit: 'g', category: 'pantry', aliases: ['ground turmeric', 'turmeric powder'], densityGPerMl: 0.7 },
  { name: 'smoked paprika', defaultUnit: 'g', category: 'pantry', aliases: ['paprika', 'sweet paprika'], densityGPerMl: 0.47 },
  { name: 'chili powder', defaultUnit: 'g', category: 'pantry', aliases: ['chilli powder'], densityGPerMl: 0.47 },
  { name: 'chili flakes', defaultUnit: 'g', category: 'pantry', aliases: ['chilli flakes', 'red pepper flakes'], densityGPerMl: 0.35 },
  { name: 'cinnamon', defaultUnit: 'g', category: 'pantry', aliases: ['ground cinnamon'], densityGPerMl: 0.56 },
  { name: 'oregano', defaultUnit: 'g', category: 'pantry', aliases: ['dried oregano'], densityGPerMl: 0.26 },
  { name: 'thyme', defaultUnit: 'g', category: 'pantry', aliases: ['dried thyme'], densityGPerMl: 0.28 },
  { name: 'rosemary', defaultUnit: 'g', category: 'pantry', aliases: ['dried rosemary'], densityGPerMl: 0.33 },
  { name: 'mixed spice', defaultUnit: 'g', category: 'pantry', aliases: ['allspice'], densityGPerMl: 0.47 },

  // ── Oils & fats ──────────────────────────────────────────────────
  { name: 'olive oil', defaultUnit: 'ml', category: 'pantry', aliases: ['extra virgin olive oil', 'EVOO'], densityGPerMl: 0.91 },
  { name: 'vegetable oil', defaultUnit: 'ml', category: 'pantry', aliases: ['canola oil', 'sunflower oil'], densityGPerMl: 0.92 },
  { name: 'sesame oil', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 0.92 },
  { name: 'coconut oil', defaultUnit: 'g', category: 'pantry', aliases: [], densityGPerMl: 0.92 },
  { name: 'butter', defaultUnit: 'g', category: 'dairy', aliases: ['unsalted butter', 'salted butter'], densityGPerMl: 0.91 },

  // ── Sauces & condiments ──────────────────────────────────────────
  { name: 'soy sauce', defaultUnit: 'ml', category: 'pantry', aliases: ['tamari', 'light soy sauce'], densityGPerMl: 1.09 },
  { name: 'fish sauce', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 1.11 },
  { name: 'oyster sauce', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 1.3 },
  { name: 'tomato paste', defaultUnit: 'g', category: 'pantry', aliases: ['tomato puree'], densityGPerMl: 1.07 },
  { name: 'worcestershire sauce', defaultUnit: 'ml', category: 'pantry', aliases: ['Worcestershire'], densityGPerMl: 1.07 },
  { name: 'white vinegar', defaultUnit: 'ml', category: 'pantry', aliases: ['distilled vinegar'], densityGPerMl: 1.0 },
  { name: 'apple cider vinegar', defaultUnit: 'ml', category: 'pantry', aliases: ['ACV'], densityGPerMl: 1.0 },
  { name: 'balsamic vinegar', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 1.11 },
  { name: 'rice wine vinegar', defaultUnit: 'ml', category: 'pantry', aliases: ['rice vinegar'], densityGPerMl: 1.0 },

  // ── Dairy ────────────────────────────────────────────────────────
  { name: 'milk', defaultUnit: 'ml', category: 'dairy', aliases: ['full-fat milk', 'whole milk'], densityGPerMl: 1.03 },
  { name: 'cream', defaultUnit: 'ml', category: 'dairy', aliases: ['heavy cream', 'thickened cream', 'double cream'], densityGPerMl: 1.0 },
  { name: 'yoghurt', defaultUnit: 'g', category: 'dairy', aliases: ['yogurt', 'Greek yoghurt'] },
  { name: 'cheddar cheese', defaultUnit: 'g', category: 'dairy', aliases: ['cheddar', 'tasty cheese'] },
  { name: 'parmesan', defaultUnit: 'g', category: 'dairy', aliases: ['parmigiano', 'parmesan cheese'] },
  { name: 'feta cheese', defaultUnit: 'g', category: 'dairy', aliases: ['feta'] },
  { name: 'mozzarella', defaultUnit: 'g', category: 'dairy', aliases: ['mozzarella cheese'] },
  { name: 'sour cream', defaultUnit: 'g', category: 'dairy', aliases: [] },

  // ── Canned & packaged ────────────────────────────────────────────
  { name: 'diced tomatoes', defaultUnit: 'g', category: 'pantry', aliases: ['canned tomatoes', 'tinned tomatoes', 'crushed tomatoes'] },
  { name: 'coconut milk', defaultUnit: 'ml', category: 'pantry', aliases: ['canned coconut milk'], densityGPerMl: 1.0 },
  { name: 'coconut cream', defaultUnit: 'ml', category: 'pantry', aliases: [], densityGPerMl: 1.06 },
  { name: 'chickpeas', defaultUnit: 'g', category: 'pantry', aliases: ['garbanzo beans', 'canned chickpeas'] },
  { name: 'kidney beans', defaultUnit: 'g', category: 'pantry', aliases: ['red kidney beans', 'canned kidney beans'] },
  { name: 'black beans', defaultUnit: 'g', category: 'pantry', aliases: ['canned black beans'] },
  { name: 'red lentils', defaultUnit: 'g', category: 'pantry', aliases: ['lentils'] },
  { name: 'vegetable stock', defaultUnit: 'ml', category: 'pantry', aliases: ['vegetable broth'], densityGPerMl: 1.0 },
  { name: 'chicken stock', defaultUnit: 'ml', category: 'pantry', aliases: ['chicken broth'], densityGPerMl: 1.0 },
  { name: 'beef stock', defaultUnit: 'ml', category: 'pantry', aliases: ['beef broth'], densityGPerMl: 1.0 },

  // ── Produce — aromatics ──────────────────────────────────────────
  { name: 'garlic', defaultUnit: 'count', category: 'produce', aliases: ['garlic clove', 'garlic cloves'], countToGrams: 5 },
  { name: 'onion', defaultUnit: 'count', category: 'produce', aliases: ['brown onion', 'yellow onion'], countToGrams: 150 },
  { name: 'red onion', defaultUnit: 'count', category: 'produce', aliases: [], countToGrams: 130 },
  { name: 'spring onion', defaultUnit: 'count', category: 'produce', aliases: ['scallion', 'green onion'], countToGrams: 15 },
  { name: 'ginger', defaultUnit: 'g', category: 'produce', aliases: ['fresh ginger', 'ginger root'] },
  { name: 'chili', defaultUnit: 'count', category: 'produce', aliases: ['chilli', 'fresh chili', 'red chili'], countToGrams: 15 },
  { name: 'lemon', defaultUnit: 'count', category: 'produce', aliases: [], countToGrams: 120 },
  { name: 'lime', defaultUnit: 'count', category: 'produce', aliases: [], countToGrams: 70 },
  { name: 'lemon juice', defaultUnit: 'ml', category: 'produce', aliases: [], densityGPerMl: 1.0 },

  // ── Produce — vegetables ─────────────────────────────────────────
  { name: 'potato', defaultUnit: 'g', category: 'produce', aliases: ['potatoes', 'white potato'] },
  { name: 'kumara', defaultUnit: 'g', category: 'produce', aliases: ['sweet potato', 'kūmara'] },
  { name: 'carrot', defaultUnit: 'g', category: 'produce', aliases: ['carrots'] },
  { name: 'celery', defaultUnit: 'g', category: 'produce', aliases: ['celery stalk'] },
  { name: 'capsicum', defaultUnit: 'count', category: 'produce', aliases: ['bell pepper', 'red capsicum', 'green capsicum'], countToGrams: 160 },
  { name: 'tomato', defaultUnit: 'count', category: 'produce', aliases: ['tomatoes', 'roma tomato'], countToGrams: 130 },
  { name: 'zucchini', defaultUnit: 'g', category: 'produce', aliases: ['courgette'] },
  { name: 'eggplant', defaultUnit: 'g', category: 'produce', aliases: ['aubergine', 'brinjal'] },
  { name: 'spinach', defaultUnit: 'g', category: 'produce', aliases: ['baby spinach', 'silverbeet'] },
  { name: 'broccoli', defaultUnit: 'g', category: 'produce', aliases: [] },
  { name: 'cauliflower', defaultUnit: 'g', category: 'produce', aliases: [] },
  { name: 'mushrooms', defaultUnit: 'g', category: 'produce', aliases: ['button mushrooms', 'cremini mushrooms'] },
  { name: 'pumpkin', defaultUnit: 'g', category: 'produce', aliases: ['butternut squash', 'butternut pumpkin'] },
  { name: 'corn', defaultUnit: 'count', category: 'produce', aliases: ['corn cob', 'sweetcorn'], countToGrams: 250 },
  { name: 'frozen peas', defaultUnit: 'g', category: 'frozen', aliases: ['peas'] },
  { name: 'cucumber', defaultUnit: 'count', category: 'produce', aliases: [], countToGrams: 300 },
  { name: 'avocado', defaultUnit: 'count', category: 'produce', aliases: [], countToGrams: 200 },
  { name: 'kale', defaultUnit: 'g', category: 'produce', aliases: [] },

  // ── Proteins ─────────────────────────────────────────────────────
  { name: 'eggs', defaultUnit: 'count', category: 'dairy', aliases: ['egg', 'large eggs'], countToGrams: 60 },
  { name: 'chicken breast', defaultUnit: 'g', category: 'meat', aliases: ['chicken breasts'] },
  { name: 'chicken thighs', defaultUnit: 'g', category: 'meat', aliases: ['chicken thigh fillets'] },
  { name: 'beef mince', defaultUnit: 'g', category: 'meat', aliases: ['ground beef', 'minced beef'] },
  { name: 'lamb mince', defaultUnit: 'g', category: 'meat', aliases: ['ground lamb', 'minced lamb'] },
  { name: 'pork mince', defaultUnit: 'g', category: 'meat', aliases: ['ground pork'] },
  { name: 'bacon', defaultUnit: 'g', category: 'meat', aliases: ['streaky bacon', 'rasher'] },
  { name: 'firm tofu', defaultUnit: 'g', category: 'other', aliases: ['tofu'] },
  { name: 'silken tofu', defaultUnit: 'g', category: 'other', aliases: [] },
  { name: 'salmon', defaultUnit: 'g', category: 'meat', aliases: ['salmon fillet', 'Atlantic salmon'] },
  { name: 'prawns', defaultUnit: 'g', category: 'meat', aliases: ['shrimp', 'tiger prawns', 'king prawns'] },

  // ── Nuts & seeds ─────────────────────────────────────────────────
  { name: 'almonds', defaultUnit: 'g', category: 'pantry', aliases: ['whole almonds', 'slivered almonds'], densityGPerMl: 0.61 },
  { name: 'cashews', defaultUnit: 'g', category: 'pantry', aliases: ['raw cashews', 'roasted cashews'], densityGPerMl: 0.58 },
  { name: 'peanuts', defaultUnit: 'g', category: 'pantry', aliases: ['roasted peanuts'], densityGPerMl: 0.53 },
  { name: 'walnuts', defaultUnit: 'g', category: 'pantry', aliases: [], densityGPerMl: 0.46 },
  { name: 'peanut butter', defaultUnit: 'g', category: 'pantry', aliases: ['peanut butter smooth', 'peanut butter crunchy'], densityGPerMl: 1.08 },
  { name: 'sesame seeds', defaultUnit: 'g', category: 'pantry', aliases: [], densityGPerMl: 0.56 },
  { name: 'chia seeds', defaultUnit: 'g', category: 'pantry', aliases: [], densityGPerMl: 0.5 },
  { name: 'pumpkin seeds', defaultUnit: 'g', category: 'pantry', aliases: ['pepitas'], densityGPerMl: 0.54 },
  { name: 'sunflower seeds', defaultUnit: 'g', category: 'pantry', aliases: [], densityGPerMl: 0.53 },

  // ── Bread & bakery ───────────────────────────────────────────────
  { name: 'bread', defaultUnit: 'count', category: 'pantry', aliases: ['slice of bread', 'sandwich bread'], countToGrams: 35 },
  { name: 'tortilla', defaultUnit: 'count', category: 'pantry', aliases: ['flour tortilla', 'wrap'], countToGrams: 40 },
  { name: 'pita bread', defaultUnit: 'count', category: 'pantry', aliases: ['pita', 'pitta'], countToGrams: 60 },

  // ── Fruit ────────────────────────────────────────────────────────
  { name: 'banana', defaultUnit: 'count', category: 'produce', aliases: ['bananas'], countToGrams: 120 },
  { name: 'apple', defaultUnit: 'count', category: 'produce', aliases: ['apples'], countToGrams: 180 },
  { name: 'mango', defaultUnit: 'count', category: 'produce', aliases: [], countToGrams: 300 },
];
