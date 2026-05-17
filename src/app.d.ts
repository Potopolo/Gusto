import type { User, Household } from '$lib/server/db/schema';

declare global {
  namespace App {
    interface Locals {
      authed: boolean;
      currentUser: User | null;
      household: Household | null;
    }
    interface PageData {
      authed: boolean;
      currentUser: User | null;
      householdUsers: User[];
    }
  }
}

export {};
