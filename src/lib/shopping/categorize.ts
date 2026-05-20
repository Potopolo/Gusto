/**
 * Rule-based shopping category resolver.
 *
 * The CIQUAL `ingredients.category` column is empty for all rows (it's a
 * nutrition database, not a grocery one), so we infer the supermarket
 * department from keywords in the item name. Used both server-side
 * (when persisting a generated list) and client-side (for manual edits).
 *
 * Categories follow the typical French supermarket layout:
 *   - fruits-legumes      : fresh produce
 *   - viandes-poissons    : butcher + fishmonger
 *   - produits-laitiers   : dairy + eggs
 *   - frais               : refrigerated ready-meals, sauces, charcuterie
 *   - epicerie            : dry goods, canned, oils, spices, baking
 *   - boissons            : drinks, alcohol
 *   - surgeles            : frozen
 *   - autre               : catch-all
 */

export type ShoppingCategory =
  | 'fruits-legumes'
  | 'viandes-poissons'
  | 'produits-laitiers'
  | 'frais'
  | 'epicerie'
  | 'boissons'
  | 'surgeles'
  | 'autre';

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  'fruits-legumes': 'Fruits & légumes',
  'viandes-poissons': 'Viandes & poissons',
  'produits-laitiers': 'Produits laitiers & œufs',
  frais: 'Frais',
  epicerie: 'Épicerie',
  boissons: 'Boissons',
  surgeles: 'Surgelés',
  autre: 'Autre'
};

/** Display order in the shopping list view (supermarket-walk order). */
export const CATEGORY_ORDER: ShoppingCategory[] = [
  'fruits-legumes',
  'viandes-poissons',
  'produits-laitiers',
  'frais',
  'epicerie',
  'boissons',
  'surgeles',
  'autre'
];

// Keywords matched against the lowercased, accents-stripped item name.
// Each entry is a substring or word-bounded pattern. Order of categories
// in CATEGORY_KEYWORDS matters: first match wins.
const CATEGORY_KEYWORDS: Array<[ShoppingCategory, string[]]> = [
  [
    'fruits-legumes',
    [
      // legumes
      'tomate', 'oignon', 'ail', 'echalote', 'echalotte', 'carotte', 'pomme de terre',
      'patate', 'courgette', 'aubergine', 'poivron', 'concombre', 'salade', 'laitue',
      'roquette', 'mache', 'epinard', 'epinards', 'champignon', 'brocoli', 'chou',
      'chou-fleur', 'haricot', 'petit-pois', 'petits-pois', 'petits pois', 'poireau',
      'mais', 'maïs', 'celeri', 'celeri-rave', 'fenouil', 'navet', 'panais', 'radis',
      'betterave', 'asperge', 'artichaut', 'endive', 'potiron', 'butternut', 'courge',
      'avocat', 'gingembre', 'menthe', 'persil', 'basilic', 'coriandre', 'aneth',
      'ciboulette', 'thym', 'romarin', 'estragon', 'sauge', 'laurier', 'piment',
      // fruits
      'pomme', 'poire', 'banane', 'orange', 'citron', 'lime', 'pamplemousse',
      'fraise', 'framboise', 'mure', 'myrtille', 'cassis', 'groseille', 'cerise',
      'peche', 'nectarine', 'abricot', 'prune', 'mirabelle', 'kiwi', 'mangue',
      'ananas', 'papaye', 'pasteque', 'melon', 'raisin', 'figue', 'rhubarbe',
      'datte', 'grenade', 'litchi'
    ]
  ],
  [
    'viandes-poissons',
    [
      'poulet', 'poularde', 'dinde', 'canard', 'pintade', 'lapin',
      'boeuf', 'bœuf', 'veau', 'agneau', 'mouton', 'porc', 'jambon', 'lardon',
      'saucisse', 'merguez', 'chipolata', 'chorizo', 'bacon', 'rosette',
      'cote', 'cuisse', 'escalope', 'filet', 'rumsteak', 'entrecote', 'tournedos',
      'steak', 'hache', 'rosbif', 'roti', 'tournedos', 'magret', 'foie',
      'gigot', 'epaule',
      // poissons
      'saumon', 'cabillaud', 'colin', 'thon', 'sardine', 'maquereau', 'truite',
      'lieu', 'bar', 'merlu', 'sole', 'lotte', 'crevette', 'gambas', 'langoustine',
      'moules', 'huitre', 'huitres', 'coquille saint-jacques', 'saint-jacques',
      'calamar', 'poulpe', 'seiche', 'anchois', 'hareng', 'eglefin', 'dorade',
      'rouget', 'turbot'
    ]
  ],
  [
    'produits-laitiers',
    [
      'lait', 'creme', 'crème', 'creme fraiche', 'beurre', 'yaourt', 'yoghourt',
      'fromage blanc', 'faisselle', 'ricotta', 'mascarpone', 'philadelphia',
      'mozzarella', 'parmesan', 'gruyere', 'emmental', 'comte', 'comté',
      'cheddar', 'feta', 'chevre', 'chèvre', 'roquefort', 'bleu', 'camembert',
      'brie', 'reblochon', 'raclette', 'munster', 'maroilles', 'tomme',
      'oeuf', 'œuf', 'oeufs', 'œufs',
      'kefir', 'skyr', 'fromage rape', 'fromage râpé', 'boursin', 'kiri',
      'vache qui rit', 'babybel'
    ]
  ],
  [
    'frais',
    [
      'saumon fume', 'jambon cru', 'jambon blanc', 'pate', 'pâte', 'rillettes',
      'terrine', 'taramasalata', 'tarama', 'tzatziki', 'houmous', 'pesto',
      'tartinade', 'sauce tomate fraiche', 'pate fraiche', 'pâte fraîche',
      'gnocchi', 'raviole', 'ravioli', 'tortellini', 'tofu', 'seitan', 'tempeh'
    ]
  ],
  [
    'epicerie',
    [
      'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'moutarde',
      'mayonnaise', 'ketchup', 'sauce soja', 'soja', 'tabasco', 'sriracha',
      'riz', 'pates', 'pâtes', 'spaghetti', 'tagliatelle', 'penne', 'fusilli',
      'macaroni', 'lasagne', 'nouille', 'vermicelle', 'semoule', 'couscous',
      'boulgour', 'quinoa', 'lentille', 'pois chiche', 'haricot sec',
      'flocon avoine', 'avoine', 'muesli', 'granola', 'cereale', 'céréale',
      'levure', 'bicarbonate', 'maizena', 'maïzena', 'fecule', 'fécule',
      'chocolat', 'cacao', 'praline', 'praliné', 'speculoos', 'biscuit',
      'amande', 'noix', 'noisette', 'pistache', 'pignon', 'cacahuete',
      'graine', 'sesame', 'sésame', 'tournesol', 'lin', 'chia', 'pavot',
      'miel', 'sirop', 'confiture', 'compote', 'gelee', 'gélée',
      'cumin', 'curry', 'paprika', 'curcuma', 'cannelle', 'muscade',
      'vanille', 'safran', 'gingembre en poudre', 'noix de muscade',
      'fond de veau', 'bouillon', 'cube',
      'concentre de tomate', 'concentré de tomate', 'tomate pelee', 'tomate pelée',
      'coulis', 'pulpe', 'olive', 'cornichon', 'capre', 'câpre',
      'lait de coco', 'lait de soja', 'lait d\'amande', 'lait d’amande',
      'gelatine', 'gélatine', 'agar-agar', 'agar agar',
      'pain', 'baguette', 'biscotte', 'tortilla', 'wrap', 'pita'
    ]
  ],
  [
    'boissons',
    [
      'vin', 'bière', 'biere', 'cidre', 'champagne', 'rose', 'rosé',
      'jus', 'soda', 'limonade', 'sirop a diluer', 'eau gazeuse', 'eau plate',
      'cola', 'tonic', 'cafe', 'café', 'the', 'thé', 'infusion', 'tisane',
      'whisky', 'rhum', 'gin', 'vodka', 'liqueur', 'amaretto', 'porto',
      'cognac', 'martini'
    ]
  ],
  [
    'surgeles',
    ['surgele', 'surgelé', 'congele', 'congelé', 'glace', 'sorbet']
  ]
];

/** Strip diacritics and lowercase. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function categorize(name: string): ShoppingCategory {
  const n = normalize(name);
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      // Word-bounded match: simple substring works for our keyword set
      // since none are very short and likely to false-positive.
      if (n.includes(kw)) return cat;
    }
  }
  return 'autre';
}
