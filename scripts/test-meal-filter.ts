/** Smoke-test the meal-type filter against representative recipe names. */
import { isRecipeForMealType } from '../src/lib/menus/sweet';

type Case = { name: string; cats: string[]; mealType: string; expected: boolean };

const cases: Case[] = [
  // Vrais déjeuners — devraient passer
  { name: 'Pâtes au pesto', cats: [], mealType: 'déjeuner', expected: true },
  { name: 'Quiche aux poireaux', cats: ['plat'], mealType: 'déjeuner', expected: true },
  { name: 'Salade de yaourt grec et concombre', cats: ['salade'], mealType: 'déjeuner', expected: true },
  // À exclure
  { name: 'Ketchup maison', cats: [], mealType: 'déjeuner', expected: false },
  { name: 'Sauce ketchup pour frites', cats: [], mealType: 'déjeuner', expected: false },
  { name: 'Yaourt grec maison', cats: [], mealType: 'déjeuner', expected: false },
  { name: 'Smoothie banane fraise', cats: [], mealType: 'déjeuner', expected: false },
  { name: 'Confiture de pêches', cats: [], mealType: 'déjeuner', expected: false },
  { name: 'Tiramisu', cats: ['dessert'], mealType: 'déjeuner', expected: false },
  { name: 'Petits gâteaux apéro', cats: ['apero'], mealType: 'déjeuner', expected: false },
  { name: 'Pancakes à la banane', cats: ['petit-dej'], mealType: 'déjeuner', expected: false },
  { name: 'Pancakes', cats: [], mealType: 'déjeuner', expected: false },
  { name: 'Mousse au chocolat', cats: [], mealType: 'déjeuner', expected: false },
  { name: 'Frites de courgette sans huile au Airfryer', cats: ['accompagnement'], mealType: 'déjeuner', expected: false },
  { name: 'Tea time', cats: [], mealType: 'déjeuner', expected: true } // not in our regex
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const isSweet = c.cats.includes('dessert') || c.cats.includes('gourmand');
  const got = isRecipeForMealType(
    { categories: c.cats.map((s) => ({ slug: s })), isSweet, name: c.name },
    c.mealType
  );
  const ok = got === c.expected;
  console.log(
    `  ${ok ? '✓' : '✗'} ${c.name.padEnd(50)} → ${got}` +
      (ok ? '' : ` (expected ${c.expected})`)
  );
  if (ok) pass++;
  else fail++;
}
console.log(`\n${pass}/${pass + fail} passing`);
process.exit(fail > 0 ? 1 : 0);
