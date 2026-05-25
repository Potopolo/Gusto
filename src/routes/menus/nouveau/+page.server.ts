import { fail, redirect, type Actions } from '@sveltejs/kit';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { db } from '$lib/server/db';
import { menus, menuSlots } from '$lib/server/db/schema';
import { generateMenu } from '$lib/server/menus/generate';
import type { PageServerLoad } from './$types';

const DEFAULT_HOUSEHOLD_ID = 1;

/** Next Monday at midnight local time. */
function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const daysToAdd = ((1 - day + 7) % 7) || 7;
  d.setDate(d.getDate() + daysToAdd);
  return d;
}

export const load: PageServerLoad = async () => {
  return { defaultStartDate: format(nextMonday(), 'yyyy-MM-dd') };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });

    const data = await request.formData();
    const startDateStr = (data.get('startDate') ?? '').toString();
    const peopleCount = Math.max(1, parseInt((data.get('peopleCount') ?? '2').toString(), 10) || 2);
    const wantBreakfast = data.get('breakfast') === 'on';
    const wantLunch = data.get('lunch') === 'on';
    const wantSnack = data.get('snack') === 'on';
    const wantDinner = data.get('dinner') === 'on';

    const mealsPerDay: string[] = [];
    if (wantBreakfast) mealsPerDay.push('petit-déj');
    if (wantLunch) mealsPerDay.push('déjeuner');
    if (wantSnack) mealsPerDay.push('goûter');
    if (wantDinner) mealsPerDay.push('dîner');
    if (mealsPerDay.length === 0) {
      return fail(400, { error: 'Choisis au moins un repas à générer.' });
    }

    const startDate = new Date(startDateStr + 'T00:00:00');
    if (!Number.isFinite(startDate.getTime())) {
      return fail(400, { error: 'Date invalide.' });
    }

    const days = 7;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);

    const slots = await generateMenu({
      startDate,
      days,
      mealsPerDay,
      peopleCount,
      userId: locals.currentUser.id,
      householdId: DEFAULT_HOUSEHOLD_ID
    });

    const menuName = `Semaine du ${format(startDate, 'd MMMM yyyy', { locale: fr })}`;

    const [created] = await db
      .insert(menus)
      .values({
        householdId: DEFAULT_HOUSEHOLD_ID,
        name: menuName,
        startDate,
        endDate,
        generationParams: { peopleCount, mealsPerDay, days }
      })
      .returning();

    if (!created) return fail(500, { error: 'Création du menu impossible.' });

    if (slots.length) {
      await db.insert(menuSlots).values(
        slots.map((s) => ({
          menuId: created.id,
          date: s.date,
          mealType: s.mealType,
          recipeId: s.recipeId,
          servings: s.servings,
          position: s.position
        }))
      );
    }

    throw redirect(303, `/menus/${created.id}`);
  }
};
