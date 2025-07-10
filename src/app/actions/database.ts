'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';

export interface ResetDatabaseResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function resetDatabase(): Promise<ResetDatabaseResult> {
  try {
    const { db } = await connectToDatabase();

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((col) => col.name);

    for (const name of collectionNames) {
      if (name === 'users') {
        // For the 'users' collection, delete all non-superadmin users
        await db.collection('users').deleteMany({ role: { $ne: 'superadmin' } });
      } else {
        // Drop all other collections
        await db.collection(name).drop();
      }
    }

    // Revalidate all major paths after reset
    revalidatePath('/', 'layout');

    return { success: true, message: 'Database has been reset successfully. All data except superadmin accounts has been cleared.' };
  } catch (error) {
    console.error('Database reset error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during database reset.', error: errorMessage };
  }
}
