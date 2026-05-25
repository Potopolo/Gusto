/**
 * Fill data/database-WW.xlsx with the ZeroPoints food items OCR'd from
 * Paul's 19 WW screenshots. Every item in the WW ZeroPoints lists counts
 * for 0 points (the WW "eat freely" foods). The screenshots covered two
 * of the 11 categories: "Viandes maigres" and "Poissons et fruits de mer".
 * Both feed the existing "Viande & Poisson" sheet in the master file.
 *
 * Run once: `npx tsx scripts/ww-fill.ts`
 */
import { readFile, writeFile } from 'fs/promises';
import * as XLSX from 'xlsx';

// --- Master list ----------------------------------------------------------

/** Viandes maigres — WW ZeroPoints. OCR'd from screenshots 1, 2, 3, 4, 5, 6. */
const VIANDES_MAIGRES = [
  'Araignée de porc',
  'Bavette de boeuf',
  'Boeuf pour tartare 5% MG',
  'Brochette d’agneau',
  'Brochette de porc',
  'Carré d’agneau',
  'Carré de porc',
  'Coeur de boeuf',
  'Collier de boeuf',
  'Côte d’agneau',
  'Émincé de porc',
  'Entrecôte de boeuf dégraissée',
  'Entrecôte de cheval',
  'Epaule de boeuf',
  'Epaule de veau',
  'Escalope de porc',
  'Escalope ou noix de veau',
  'Faux-filet de boeuf',
  'Faux-filet de cheval',
  'Filet de boeuf',
  'Filet de mouton',
  'Filet mignon de porc',
  'Foie de génisse',
  'Foie de lapin',
  'Foie de porc',
  'Foie de veau',
  'Gésiers',
  'Gigot d’agneau',
  'Gîte à la noix de boeuf',
  'Hampe de boeuf',
  'Jarret de boeuf',
  'Jumeau de boeuf',
  'Onglet de boeuf',
  'Paleron de veau',
  'Poitrine de veau',
  'Ris de veau',
  'Rognons',
  'Rosbif',
  'Rôti de porc dans le filet',
  'Rôti de veau',
  'Rumsteck de boeuf',
  'Selle d’agneau',
  'Steak de boeuf',
  'Steak haché de boeuf 5% MG',
  'Steak haché de boeuf 10% MG',
  'Tende de tranche de cheval',
  'Tripes nature',
  'Veau pour blanquette',
  'Viande d’autruche',
  'Viande de biche',
  'Viande de bison',
  'Viande de cerf',
  'Viande de chèvre',
  'Viande de chevreau',
  'Viande de chevreuil',
  'Viande de lapin',
  'Viande de sanglier'
];

/** Poissons & fruits de mer — WW ZeroPoints. OCR'd from screenshots 8-19. */
const POISSONS_FRUITS_DE_MER = [
  'Aiguillat',
  'Alose',
  'Anchois',
  'Anguille',
  'Bar',
  'Barbue',
  'Baudroie',
  'Bigorneaux',
  'Bonite',
  'Brochet',
  'Brosme',
  'Bulots',
  'Cabillaud',
  'Calamar',
  'Carangue',
  'Cardine',
  'Carpe',
  'Carrelet',
  'Caviar',
  'Chatrou',
  'Chinchard',
  'Clam',
  'Cocktail de fruits de mer',
  'Colin',
  'Congre',
  'Coques',
  'Couteaux',
  'Crabe',
  'Crevettes',
  'Cuisses de grenouille',
  'Dorade',
  'Ecrevisses',
  'Eglefin',
  'Empereur',
  'Encornet',
  'Eperlan',
  'Escargots',
  'Espadon',
  'Esturgeon',
  'Flétan',
  'Foie de lotte',
  'Foie de morue',
  'Fruits de mer',
  'Gambas',
  'Grand sébaste',
  'Grenadier',
  'Grondin',
  'Haddock',
  'Hareng',
  'Hareng fumé',
  'Hoki',
  'Homard',
  'Huîtres',
  'Joëls',
  'Julienne',
  'Lambi',
  'Langouste',
  'Langoustine',
  'Lidl Bulots cuits pasteurisés',
  'Lieu',
  'Limande',
  'Lingue bleue',
  'Lompe',
  'Lotte',
  'Loup',
  'Maquereau',
  'Maquereau au naturel en conserve',
  'Merlan',
  'Merlu',
  'Mérou',
  'Miettes de crabe',
  'Morue',
  'Moules',
  'Muge',
  'Mulet',
  'Noix de pétoncles',
  'Noix de Saint-Jacques',
  'Omble chevalier',
  'Ormeau',
  'Orphie commune',
  'Ouassou',
  'Oursin',
  'Palourde',
  'Panga',
  'Perche',
  'Plie',
  'Poisson blanc',
  'Poisson chat, pangasius',
  'Poulpe',
  'Praire',
  'Raie',
  'Rascasse',
  'Requin',
  'Rouget',
  'Roussette',
  'Sabre',
  'Saint-Pierre',
  'Sandre',
  'Sardine',
  'Saumon',
  'Saumon fumé',
  'Saumonette',
  'Sébaste',
  'Seiche',
  'Silure',
  'Sole',
  'Sprat',
  'Tacaud',
  'Tanche',
  'Thon',
  'Thon au naturel en conserve',
  'Thon rouge',
  'Tilapia',
  'Truite',
  'Truite arc en ciel',
  'Truite fumée',
  'Truite saumonée',
  'Turbot',
  'Vivaneau'
];

/** Œufs — WW ZeroPoints. The existing rows in the file already track these,
 *  we keep them under the same sheet for consistency. */
const OEUFS = ['Oeuf', "Blanc d'oeuf"];

/** Fruits — WW ZeroPoints. OCR'd from n07..n12. Frais ET conserves sans
 *  sucre ajouté. Compote sans sucre ajouté incluse, jus de fruits EXCLU
 *  (jus = points). */
const FRUITS = [
  'Abricot',
  'Airelles',
  'Ananas',
  'Anone',
  'Baies de sureau',
  'Banane',
  'Brugnon',
  'Canneberge fraîche',
  'Carambole',
  'Cassis',
  'Cerise',
  'Chérimole',
  'Citron',
  'Citron vert',
  'Clémentine',
  'Coing',
  'Compote sans sucre ajouté',
  'Figue de barbarie',
  'Figue fraîche',
  'Fraise',
  'Framboise',
  'Fruit de la passion',
  'Fruit du jaquier',
  'Fruit à pain',
  'Goyave',
  'Grenade',
  'Groseilles',
  'Kaki',
  'Kiwi',
  'Kumquat',
  'Litchi',
  'Mandarine',
  'Mangoustan',
  'Mangue',
  'Maracuja',
  'Melon',
  'Mirabelle',
  'Mûres',
  'Myrtilles',
  'Nectarine',
  'Nèfle',
  'Orange',
  'Pamplemousse',
  'Papaye',
  'Pastèque',
  'Pêche',
  'Poire',
  'Pomme',
  'Pomélo',
  'Prune',
  'Raisin',
  'Raisin blanc',
  'Raisin noir',
  'Ramboutan',
  'Rhubarbe',
  'Salade de fruits frais nature sans sucres ajoutés',
  'Tangerine'
];

/** Légumineuses — WW ZeroPoints. OCR'd from n05, n06, n13, n14. */
const LEGUMINEUSES = [
  'Flageolets',
  'Fèves',
  'Graines de soja crues',
  'Haricots azuki',
  'Haricots blancs',
  'Haricots coco cuits',
  'Haricots de Lima',
  'Haricots lingots',
  'Haricots mungo',
  'Haricots noirs',
  'Haricots pinto',
  'Haricots rouges',
  'Lentilles blondes',
  'Lentilles corail',
  'Lentilles germées',
  'Lentilles vertes',
  'Mogettes',
  'Petits pois',
  'Pois cassés',
  'Pois chiches'
];

/** Flocons de céréales — WW ZeroPoints. OCR'd from n04. */
const FLOCONS_CEREALES = [
  "Flocons d'avoine",
  'Flocons de quinoa',
  'Flocons de riz complet',
  'Flocons de sarrasin',
  "Gruau d'avoine"
];

/** Tofu et tempeh — WW ZeroPoints (nature uniquement, pas frit ni mariné).
 *  OCR'd from n03. */
const TOFU_TEMPEH = [
  'Protéines de soja déshydratées',
  'Quorn',
  'Tempeh',
  'Tofu',
  'Tofu fumé',
  'Tofu soyeux'
];

/** Poulet & dinde — WW ZeroPoints (sans peau, sans préparation grasse).
 *  OCR'd from n28, n29. */
const POULET_DINDE = [
  'Coeur de poulet',
  'Coquelet sans peau',
  'Cuisse de dinde sans peau',
  'Cuisse de poulet sans peau',
  'Dinde sans peau',
  'Escalope ou filet de dinde',
  'Escalope ou filet de poulet',
  'Foie de poulet',
  'Foie de volaille',
  'Gésier de poulet',
  'Haché de volaille moins de 10% MG',
  'Jambon de dinde ou blanc de dinde',
  'Jambon de poulet ou blanc de poulet',
  'Poulet rôti sans peau',
  'Rôti de dinde dans le filet sans barde',
  "Sot-l'y-laisse de dinde"
];

/** Maïs — WW ZeroPoints. WW lists corn separately because it's still
 *  starchy but counted as 0. Items not screenshot-OCR'd (no dedicated
 *  category screen in Paul's batch); added by hand from the WW catalog. */
const MAIS = [
  'Maïs en épi',
  'Maïs en grains',
  'Maïs doux en conserve'
];

/** Légumes — WW ZeroPoints. OCR'd from n16..n24. The list is intentionally
 *  generous (mushrooms, herbs, regional veggies) — WW counts almost any
 *  fresh vegetable as 0pts including pommes de terre & patate douce. */
const LEGUMES = [
  'Agaric champêtre',
  'Artichaut',
  'Asperge',
  'Aubergine',
  'Banane plantain',
  'Batavia',
  'Betterave rouge',
  'Blette',
  'Bolets',
  'Brocoli',
  'Butternut',
  'Cardon',
  'Carotte',
  'Champignons',
  'Chayotte',
  'Chicon',
  'Chicorée',
  'Chou',
  'Chou kale',
  'Chou pak-choi',
  'Chou romanesco',
  'Chou-fleur',
  'Choux de Bruxelles',
  'Christophine',
  'Châtaignes',
  'Citrouille',
  'Cive',
  'Concombre',
  'Cornichon',
  'Cornichon aigre-doux',
  'Cornichon au vinaigre',
  'Courge spaghetti',
  'Courgette',
  'Cresson',
  'Crosne',
  'Céleri',
  'Cœur d’artichaut',
  'Cœur de palmier',
  'Echalote',
  'Endive',
  'Epinard',
  'Fenouil',
  'Feuille de chêne',
  'Feuille de vigne',
  'Fond d’artichaut',
  'Germe de soja',
  'Gombos',
  'Haricot beurre',
  'Haricot vert',
  'Igname cuite',
  'Manioc',
  'Manioc cuit',
  'Marrons',
  'Mini épi de maïs',
  'Mâcre',
  'Navet',
  'Oignon',
  'Oignon jaune',
  'Panais',
  'Patate douce',
  'Pissenlit',
  'Pois gourmand',
  'Poireau',
  'Poivron',
  'Pomme de terre',
  'Potimarron',
  'Potiron',
  'Pousse d’épinard',
  'Pousse de bambou',
  'Pâtisson',
  'Radis',
  'Radis noir',
  'Rutabaga',
  'Salade',
  'Salicorne',
  'Salsifis',
  'Scarole',
  'Soupe de légumes sans MG sans féculents',
  'Sucrine',
  'Taro',
  'Tomate',
  'Tomate cerise',
  'Tomate côtelée',
  'Topinambour',
  'Topinambour cuit',
  'Tétragone cornue'
];

/** Laitages 0% — WW ZeroPoints (nature uniquement, sans sucre ajouté).
 *  OCR'd from n01, n02. */
const LAITAGES_0 = [
  'Cottage cheese nature 0%',
  'Entremets au soja nature',
  'Faisselle nature 0%',
  'Fromage blanc 0% nature',
  'Fromage frais type yaourt nature 0% MG',
  'Petit suisse nature 0%',
  'Skyr 0% nature',
  'Yaourt 0% nature',
  'Yaourt au lait de brebis 0% nature',
  'Yaourt au lait de chèvre 0% nature',
  'Yaourt brassé nature 0%',
  'Yaourt Grec nature 0%'
];

// --- Apply ---------------------------------------------------------------

const path = './data/database-WW.xlsx';

// Load existing file if any; otherwise start with an empty workbook so the
// script is idempotent — running it once is enough to bootstrap the file.
let wb: XLSX.WorkBook;
try {
  const buf = await readFile(path);
  wb = XLSX.read(buf, { type: 'buffer' });
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    console.log(`ℹ ${path} not found — creating it from scratch.`);
    wb = XLSX.utils.book_new();
  } else {
    throw err;
  }
}

type Row = (string | number)[];

/** Replace (or append) a sheet at `name` with the given rows + col widths. */
function setSheet(name: string, rows: Row[]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 8 }];
  if (wb.SheetNames.includes(name)) {
    wb.Sheets[name] = sheet;
  } else {
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }
}

// 1. Légende — WW point ranges by recipe.
setSheet('Légende', [
  ['Légende WW SmartPoints'],
  ['Points par portion', 'Lecture'],
  ['0 – 5', 'Très léger'],
  ['6 – 12', 'Léger / normal'],
  ['12 – 18', 'Copieux'],
  ['18+', 'Gourmand / occasionnel']
]);

// 2. Viande & Poisson — populated from OCR'd screenshots.
const vpHeader: Row[] = [
  ['Aliments WW ZeroPoints — viandes, œufs, poissons'],
  ['Aliments', 'Quantité', 'Points']
];
const vpBody: Row[] = [];
const section = (title: string) => vpBody.push([title, '', '']);
const item = (name: string) => vpBody.push([name, 'à volonté', 0]);

section('— Viandes maigres (0 pts) —');
for (const v of VIANDES_MAIGRES) item(v);
section('');
section('— Poulet & dinde (0 pts) —');
for (const v of POULET_DINDE) item(v);
section('');
section('— Œufs (0 pts) —');
for (const o of OEUFS) item(o);
section('');
section('— Poissons & fruits de mer (0 pts) —');
for (const p of POISSONS_FRUITS_DE_MER) item(p);

setSheet('Viande & Poisson', [...vpHeader, ...vpBody]);

// Generic helper to write a populated sheet from a flat array of names.
function writePopulatedSheet(name: string, title: string, items: string[]) {
  const header: Row[] = [[title], ['Aliments', 'Quantité', 'Points']];
  const body: Row[] = items.map((n) => [n, 'à volonté', 0]);
  setSheet(name, [...header, ...body]);
}

// 3. Fruit & Légume — fruits + légumes.
const flRows: Row[] = [
  ['Aliments WW ZeroPoints — fruits & légumes'],
  ['Aliments', 'Quantité', 'Points']
];
const pushFl = (s: string) => flRows.push([s, '', '']);
const pushFlItem = (s: string) => flRows.push([s, 'à volonté', 0]);
pushFl('— Fruits (0 pts) —');
for (const v of FRUITS) pushFlItem(v);
pushFl('');
pushFl('— Légumes (0 pts) —');
for (const v of LEGUMES) pushFlItem(v);
pushFl('');
pushFl('— Maïs (0 pts) —');
for (const v of MAIS) pushFlItem(v);
setSheet('Fruit & Légume', flRows);

// 4. Féculent — légumineuses + flocons de céréales.
const feculentRows: Row[] = [
  ['Aliments WW ZeroPoints — féculents (légumineuses, flocons)'],
  ['Aliments', 'Quantité', 'Points']
];
const pushFec = (s: string) => feculentRows.push([s, '', '']);
const pushFecItem = (s: string) => feculentRows.push([s, 'à volonté', 0]);
pushFec('— Légumineuses (0 pts) —');
for (const v of LEGUMINEUSES) pushFecItem(v);
pushFec('');
pushFec('— Flocons de céréales (0 pts) —');
for (const v of FLOCONS_CEREALES) pushFecItem(v);
setSheet('Féculent', feculentRows);

// 5. Fromage & Produit Laitier — Laitages 0% + Tofu/tempeh.
const fromageRows: Row[] = [
  ['Aliments WW ZeroPoints — laitages 0%, tofu, tempeh'],
  ['Aliments', 'Quantité', 'Points']
];
const pushFr = (s: string) => fromageRows.push([s, '', '']);
const pushFrItem = (s: string) => fromageRows.push([s, 'à volonté', 0]);
pushFr('— Laitages 0% (0 pts) —');
for (const v of LAITAGES_0) pushFrItem(v);
pushFr('');
pushFr('— Tofu & tempeh, nature (0 pts) —');
for (const v of TOFU_TEMPEH) pushFrItem(v);
setSheet('Fromage & Produit Laitier', fromageRows);

// 6. Empty templates for the categories still to be filled.
const emptyHeader: Row[] = [['Aliments', 'Quantité', 'Points']];
for (const name of ['Epicerie & Condiment', 'Epicerie sucré & Goûter']) {
  if (!wb.SheetNames.includes(name)) setSheet(name, emptyHeader);
}

const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
await writeFile(path, out);

const totalNew =
  FRUITS.length +
  LEGUMES.length +
  MAIS.length +
  LEGUMINEUSES.length +
  FLOCONS_CEREALES.length +
  LAITAGES_0.length +
  TOFU_TEMPEH.length +
  POULET_DINDE.length;

console.log(`✅ wrote ${path}`);
console.log(`   Viande & Poisson sheet:`);
console.log(`     ${VIANDES_MAIGRES.length} viandes maigres`);
console.log(`     ${POULET_DINDE.length} poulet & dinde`);
console.log(`     ${OEUFS.length} œufs`);
console.log(`     ${POISSONS_FRUITS_DE_MER.length} poissons & fruits de mer`);
console.log(`   Fruit & Légume sheet:`);
console.log(`     ${FRUITS.length} fruits`);
console.log(`     ${LEGUMES.length} légumes`);
console.log(`     ${MAIS.length} maïs`);
console.log(`   Féculent sheet:`);
console.log(`     ${LEGUMINEUSES.length} légumineuses`);
console.log(`     ${FLOCONS_CEREALES.length} flocons de céréales`);
console.log(`   Fromage & Produit Laitier sheet:`);
console.log(`     ${LAITAGES_0.length} laitages 0%`);
console.log(`     ${TOFU_TEMPEH.length} tofu & tempeh`);
console.log(
  `   total ZeroPoints: ${
    VIANDES_MAIGRES.length + OEUFS.length + POISSONS_FRUITS_DE_MER.length + totalNew
  }`
);
console.log(
  `   = 11/11 WW categories covered ✅`
);
