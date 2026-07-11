import { database, isConfigured } from './firebase';
import { TRPCError } from '@trpc/server';

/**
 * Returns the Admin SDK database instance. The admin database uses
 * `db.ref('path')` style API (methods on the database/reference objects)
 * rather than standalone `ref()` / `set()` functions.
 */
export function getDb(): any {
  if (!database || !isConfigured) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database is not configured. Please check your Firebase environment variables.',
    });
  }
  return database;
}
