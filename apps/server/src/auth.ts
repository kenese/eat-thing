import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index.js';
import { user, session, account, verification, households, memberships } from './db/schema/index.js';

export const auth = betterAuth({
  baseURL: process.env.SERVER_BASE_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET!,

  trustedOrigins: [process.env.WEB_BASE_URL || 'http://localhost:5173'],

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // Create a household (as owner) for every new user on first sign-in.
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          const [household] = await db
            .insert(households)
            .values({ name: `${newUser.name || newUser.email}'s household` })
            .returning();
          await db.insert(memberships).values({
            householdId: household.id,
            userId: newUser.id,
            role: 'owner',
          });
        },
      },
    },
  },
});

export type Auth = typeof auth;
