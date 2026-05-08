import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import { auth } from '../auth.js';
import { db } from '../db/index.js';
import { memberships } from '../db/schema/index.js';

// Extend Express Request so every downstream handler is typed.
declare global {
  namespace Express {
    interface Request {
      userId: string;
      householdId: string;
    }
  }
}

/**
 * Authenticate the request via Better-Auth session cookie, then resolve the
 * caller's household. Attaches req.userId and req.householdId.
 *
 * Every domain route must be wrapped with this middleware — it is the sole
 * enforcement point for the household_id scoping rule (see CLAUDE.md).
 */
export const withHousehold: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const [membership] = await db
    .select({ householdId: memberships.householdId })
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: 'No household found for this user' });
    return;
  }

  req.userId = session.user.id;
  req.householdId = membership.householdId;

  next();
};
