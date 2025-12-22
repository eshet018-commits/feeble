import { database, isConfigured } from "./firebase";
import { Database } from "firebase/database";
import { TRPCError } from "@trpc/server";

export function getDb(): Database {
  if (!database || !isConfigured) {
    console.error('Database not configured. Firebase setup status:', { 
      hasDatabase: !!database, 
      isConfigured 
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database is not configured. Please check your Firebase environment variables.',
    });
  }
  return database;
}
