import type { CanonicalUnit } from './convert.js';

export interface SeedFood {
  name: string;
  defaultUnit: CanonicalUnit;
  aliases: string[];
  /** g per ml — enables g↔ml conversion for this food. */
  densityGPerMl?: number;
  /** Grams per one count unit (e.g. 1 egg ≈ 60g). */
  countToGrams?: number;
}

export const SEED_FOODS: SeedFood[] = [
  // ── Flours & grains ──────────────────────────────────────────────
  { name: 'plain flour', defaultUnit: 'g', aliases: ['all-purpose flour', 'flour'], densityGPerMl: 0.53 },
  { name: 'self-raising flour', defaultUnit: 'g', aliases: ['self-rising flour', 'SR flour'], densityGPerMl: 0.53 },
  { name: 'bread flour', defaultUnit: 'g', aliases: ['strong flour'], densityGPerMl: 0.53 },
  { name: 'wholemeal flour', defaultUnit: 'g', aliases: ['whole wheat flour'], densityGPerMl: 0.56 },
  { name: 'cornflour', defaultUnit: 'g', aliases: ['cornstarch', 'corn starch'], densityGPerMl: 0.6 },
  { name: 'white rice', defaultUnit: 'g', aliases: ['rice', 'long-grain rice'], densityGPerMl: 0.75 },
  { name: 'brown rice', defaultUnit: 'g', aliases: [], densityGPerMl: 0.77 },
  { name: 'rolled oats', defaultUnit: 'g', aliases: ['oats', 'porridge oats'], densityGPerMl: 0.34 },
  { name: 'pasta', defaultUnit: 'g', aliases: ['spaghetti', 'penne', 'fettuccine'] },
  { name: 'breadcrumbs', defaultUnit: 'g', aliases: ['panko breadcrumbs'], densityGPerMl: 0.37 },

  // ── Sugars & sweeteners ──────────────────────────────────────────
  { name: 'white sugar', defaultUnit: 'g', aliases: ['sugar', 'granulated sugar', 'caster sugar'], densityGPerMl: 0.85 },
  { name: 'brown sugar', defaultUnit: 'g', aliases: ['raw sugar', 'demerara sugar'], densityGPerMl: 0.72 },
  { name: 'icing sugar', defaultUnit: 'g', aliases: ['powdered sugar', 'confectioners sugar'], densityGPerMl: 0.56 },
  { name: 'honey', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.4 },
  { name: 'maple syrup', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.32 },
  { name: 'golden syrup', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.45 },

  // ── Baking & raising ─────────────────────────────────────────────
  { name: 'baking powder', defaultUnit: 'g', aliases: [], densityGPerMl: 0.9 },
  { name: 'baking soda', defaultUnit: 'g', aliases: ['bicarbonate of soda', 'bicarb soda'], densityGPerMl: 1.0 },
  { name: 'dried yeast', defaultUnit: 'g', aliases: ['instant yeast', 'active dry yeast'] },
  { name: 'cocoa powder', defaultUnit: 'g', aliases: ['unsweetened cocoa'], densityGPerMl: 0.5 },
  { name: 'desiccated coconut', defaultUnit: 'g', aliases: ['shredded coconut'], densityGPerMl: 0.28 },

  // ── Salt & seasonings ────────────────────────────────────────────
  { name: 'salt', defaultUnit: 'g', aliases: ['table salt', 'sea salt', 'kosher salt'], densityGPerMl: 1.2 },
  { name: 'black pepper', defaultUnit: 'g', aliases: ['ground black pepper', 'pepper'], densityGPerMl: 0.53 },

  // ── Spices ───────────────────────────────────────────────────────
  { name: 'cumin', defaultUnit: 'g', aliases: ['ground cumin', 'cumin powder'], densityGPerMl: 0.47 },
  { name: 'coriander', defaultUnit: 'g', aliases: ['ground coriander', 'coriander powder'], densityGPerMl: 0.47 },
  { name: 'turmeric', defaultUnit: 'g', aliases: ['ground turmeric', 'turmeric powder'], densityGPerMl: 0.7 },
  { name: 'smoked paprika', defaultUnit: 'g', aliases: ['paprika', 'sweet paprika'], densityGPerMl: 0.47 },
  { name: 'chili powder', defaultUnit: 'g', aliases: ['chilli powder'], densityGPerMl: 0.47 },
  { name: 'chili flakes', defaultUnit: 'g', aliases: ['chilli flakes', 'red pepper flakes'], densityGPerMl: 0.35 },
  { name: 'cinnamon', defaultUnit: 'g', aliases: ['ground cinnamon'], densityGPerMl: 0.56 },
  { name: 'oregano', defaultUnit: 'g', aliases: ['dried oregano'], densityGPerMl: 0.26 },
  { name: 'thyme', defaultUnit: 'g', aliases: ['dried thyme'], densityGPerMl: 0.28 },
  { name: 'rosemary', defaultUnit: 'g', aliases: ['dried rosemary'], densityGPerMl: 0.33 },
  { name: 'mixed spice', defaultUnit: 'g', aliases: ['allspice'], densityGPerMl: 0.47 },

  // ── Oils & fats ──────────────────────────────────────────────────
  { name: 'olive oil', defaultUnit: 'ml', aliases: ['extra virgin olive oil', 'EVOO'], densityGPerMl: 0.91 },
  { name: 'vegetable oil', defaultUnit: 'ml', aliases: ['canola oil', 'sunflower oil'], densityGPerMl: 0.92 },
  { name: 'sesame oil', defaultUnit: 'ml', aliases: [], densityGPerMl: 0.92 },
  { name: 'coconut oil', defaultUnit: 'g', aliases: [], densityGPerMl: 0.92 },
  { name: 'butter', defaultUnit: 'g', aliases: ['unsalted butter', 'salted butter'], densityGPerMl: 0.91 },

  // ── Sauces & condiments ──────────────────────────────────────────
  { name: 'soy sauce', defaultUnit: 'ml', aliases: ['tamari', 'light soy sauce'], densityGPerMl: 1.09 },
  { name: 'fish sauce', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.11 },
  { name: 'oyster sauce', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.3 },
  { name: 'tomato paste', defaultUnit: 'g', aliases: ['tomato puree'], densityGPerMl: 1.07 },
  { name: 'worcestershire sauce', defaultUnit: 'ml', aliases: ['Worcestershire'], densityGPerMl: 1.07 },
  { name: 'white vinegar', defaultUnit: 'ml', aliases: ['distilled vinegar'], densityGPerMl: 1.0 },
  { name: 'apple cider vinegar', defaultUnit: 'ml', aliases: ['ACV'], densityGPerMl: 1.0 },
  { name: 'balsamic vinegar', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.11 },
  { name: 'rice wine vinegar', defaultUnit: 'ml', aliases: ['rice vinegar'], densityGPerMl: 1.0 },

  // ── Dairy ────────────────────────────────────────────────────────
  { name: 'milk', defaultUnit: 'ml', aliases: ['full-fat milk', 'whole milk'], densityGPerMl: 1.03 },
  { name: 'cream', defaultUnit: 'ml', aliases: ['heavy cream', 'thickened cream', 'double cream'], densityGPerMl: 1.0 },
  { name: 'yoghurt', defaultUnit: 'g', aliases: ['yogurt', 'Greek yoghurt'] },
  { name: 'cheddar cheese', defaultUnit: 'g', aliases: ['cheddar', 'tasty cheese'] },
  { name: 'parmesan', defaultUnit: 'g', aliases: ['parmigiano', 'parmesan cheese'] },
  { name: 'feta cheese', defaultUnit: 'g', aliases: ['feta'] },
  { name: 'mozzarella', defaultUnit: 'g', aliases: ['mozzarella cheese'] },
  { name: 'sour cream', defaultUnit: 'g', aliases: [] },

  // ── Canned & packaged ────────────────────────────────────────────
  { name: 'diced tomatoes', defaultUnit: 'g', aliases: ['canned tomatoes', 'tinned tomatoes', 'crushed tomatoes'] },
  { name: 'coconut milk', defaultUnit: 'ml', aliases: ['canned coconut milk'], densityGPerMl: 1.0 },
  { name: 'coconut cream', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.06 },
  { name: 'chickpeas', defaultUnit: 'g', aliases: ['garbanzo beans', 'canned chickpeas'] },
  { name: 'kidney beans', defaultUnit: 'g', aliases: ['red kidney beans', 'canned kidney beans'] },
  { name: 'black beans', defaultUnit: 'g', aliases: ['canned black beans'] },
  { name: 'red lentils', defaultUnit: 'g', aliases: ['lentils'] },
  { name: 'vegetable stock', defaultUnit: 'ml', aliases: ['vegetable broth'], densityGPerMl: 1.0 },
  { name: 'chicken stock', defaultUnit: 'ml', aliases: ['chicken broth'], densityGPerMl: 1.0 },
  { name: 'beef stock', defaultUnit: 'ml', aliases: ['beef broth'], densityGPerMl: 1.0 },

  // ── Produce — aromatics ──────────────────────────────────────────
  { name: 'garlic', defaultUnit: 'count', aliases: ['garlic clove', 'garlic cloves'], countToGrams: 5 },
  { name: 'onion', defaultUnit: 'count', aliases: ['brown onion', 'yellow onion'], countToGrams: 150 },
  { name: 'red onion', defaultUnit: 'count', aliases: [], countToGrams: 130 },
  { name: 'spring onion', defaultUnit: 'count', aliases: ['scallion', 'green onion'], countToGrams: 15 },
  { name: 'ginger', defaultUnit: 'g', aliases: ['fresh ginger', 'ginger root'] },
  { name: 'chili', defaultUnit: 'count', aliases: ['chilli', 'fresh chili', 'red chili'], countToGrams: 15 },
  { name: 'lemon', defaultUnit: 'count', aliases: [], countToGrams: 120 },
  { name: 'lime', defaultUnit: 'count', aliases: [], countToGrams: 70 },
  { name: 'lemon juice', defaultUnit: 'ml', aliases: [], densityGPerMl: 1.0 },

  // ── Produce — vegetables ─────────────────────────────────────────
  { name: 'potato', defaultUnit: 'g', aliases: ['potatoes', 'white potato'] },
  { name: 'kumara', defaultUnit: 'g', aliases: ['sweet potato', 'kūmara'] },
  { name: 'carrot', defaultUnit: 'g', aliases: ['carrots'] },
  { name: 'celery', defaultUnit: 'g', aliases: ['celery stalk'] },
  { name: 'capsicum', defaultUnit: 'count', aliases: ['bell pepper', 'red capsicum', 'green capsicum'], countToGrams: 160 },
  { name: 'tomato', defaultUnit: 'count', aliases: ['tomatoes', 'roma tomato'], countToGrams: 130 },
  { name: 'zucchini', defaultUnit: 'g', aliases: ['courgette'] },
  { name: 'eggplant', defaultUnit: 'g', aliases: ['aubergine', 'brinjal'] },
  { name: 'spinach', defaultUnit: 'g', aliases: ['baby spinach', 'silverbeet'] },
  { name: 'broccoli', defaultUnit: 'g', aliases: [] },
  { name: 'cauliflower', defaultUnit: 'g', aliases: [] },
  { name: 'mushrooms', defaultUnit: 'g', aliases: ['button mushrooms', 'cremini mushrooms'] },
  { name: 'pumpkin', defaultUnit: 'g', aliases: ['butternut squash', 'butternut pumpkin'] },
  { name: 'corn', defaultUnit: 'count', aliases: ['corn cob', 'sweetcorn'], countToGrams: 250 },
  { name: 'frozen peas', defaultUnit: 'g', aliases: ['peas'] },
  { name: 'cucumber', defaultUnit: 'count', aliases: [], countToGrams: 300 },
  { name: 'avocado', defaultUnit: 'count', aliases: [], countToGrams: 200 },
  { name: 'kale', defaultUnit: 'g', aliases: [] },

  // ── Proteins ─────────────────────────────────────────────────────
  { name: 'eggs', defaultUnit: 'count', aliases: ['egg', 'large eggs'], countToGrams: 60 },
  { name: 'chicken breast', defaultUnit: 'g', aliases: ['chicken breasts'] },
  { name: 'chicken thighs', defaultUnit: 'g', aliases: ['chicken thigh fillets'] },
  { name: 'beef mince', defaultUnit: 'g', aliases: ['ground beef', 'minced beef'] },
  { name: 'lamb mince', defaultUnit: 'g', aliases: ['ground lamb', 'minced lamb'] },
  { name: 'pork mince', defaultUnit: 'g', aliases: ['ground pork'] },
  { name: 'bacon', defaultUnit: 'g', aliases: ['streaky bacon', 'rasher'] },
  { name: 'firm tofu', defaultUnit: 'g', aliases: ['tofu'] },
  { name: 'silken tofu', defaultUnit: 'g', aliases: [] },
  { name: 'salmon', defaultUnit: 'g', aliases: ['salmon fillet', 'Atlantic salmon'] },
  { name: 'prawns', defaultUnit: 'g', aliases: ['shrimp', 'tiger prawns', 'king prawns'] },

  // ── Nuts & seeds ─────────────────────────────────────────────────
  { name: 'almonds', defaultUnit: 'g', aliases: ['whole almonds', 'slivered almonds'], densityGPerMl: 0.61 },
  { name: 'cashews', defaultUnit: 'g', aliases: ['raw cashews', 'roasted cashews'], densityGPerMl: 0.58 },
  { name: 'peanuts', defaultUnit: 'g', aliases: ['roasted peanuts'], densityGPerMl: 0.53 },
  { name: 'walnuts', defaultUnit: 'g', aliases: [], densityGPerMl: 0.46 },
  { name: 'peanut butter', defaultUnit: 'g', aliases: ['peanut butter smooth', 'peanut butter crunchy'], densityGPerMl: 1.08 },
  { name: 'sesame seeds', defaultUnit: 'g', aliases: [], densityGPerMl: 0.56 },
  { name: 'chia seeds', defaultUnit: 'g', aliases: [], densityGPerMl: 0.5 },
  { name: 'pumpkin seeds', defaultUnit: 'g', aliases: ['pepitas'], densityGPerMl: 0.54 },
  { name: 'sunflower seeds', defaultUnit: 'g', aliases: [], densityGPerMl: 0.53 },

  // ── Bread & bakery ───────────────────────────────────────────────
  { name: 'bread', defaultUnit: 'count', aliases: ['slice of bread', 'sandwich bread'], countToGrams: 35 },
  { name: 'tortilla', defaultUnit: 'count', aliases: ['flour tortilla', 'wrap'], countToGrams: 40 },
  { name: 'pita bread', defaultUnit: 'count', aliases: ['pita', 'pitta'], countToGrams: 60 },

  // ── Fruit ────────────────────────────────────────────────────────
  { name: 'banana', defaultUnit: 'count', aliases: ['bananas'], countToGrams: 120 },
  { name: 'apple', defaultUnit: 'count', aliases: ['apples'], countToGrams: 180 },
  { name: 'mango', defaultUnit: 'count', aliases: [], countToGrams: 300 },
];
