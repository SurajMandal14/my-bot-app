
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { User } from '@/types/user';
import { updateProfileFormSchema } from '@/types/user'; // Using a more general profile update schema
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

export interface UpdateProfileResult {
  success: boolean;
  message: string;
  error?: string;
  user?: Partial<User>; 
}

export async function updateUserProfile(userId: string, values: z.infer<typeof updateProfileFormSchema>): Promise<UpdateProfileResult> {
  try {
    if (!ObjectId.isValid(userId)) {
      return { success: false, message: 'Invalid User ID format.', error: 'Invalid User ID.' };
    }

    const validatedFields = updateProfileFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join('; ');
      return { success: false, message: 'Validation failed.', error: errors || 'Invalid fields.' };
    }

    const { name, phone, avatarUrl } = validatedFields.data;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const updateData: Partial<Pick<User, 'name' | 'phone' | 'avatarUrl' | 'updatedAt'>> = {
      name,
      updatedAt: new Date(),
    };

    if (phone !== undefined) {
      updateData.phone = phone;
    }
    if (avatarUrl !== undefined) {
        // Allow empty string to clear avatar, otherwise it must be a valid URL (checked by Zod)
        updateData.avatarUrl = avatarUrl === "" ? undefined : avatarUrl;
    }


    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) as any },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'User not found.', error: 'User not found.' };
    }
    
    // Revalidate relevant paths if needed, e.g., the profile page itself
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/student/profile');
    revalidatePath('/dashboard/teacher/profile');


    const updatedUserDoc = await usersCollection.findOne({ _id: new ObjectId(userId) as any });
    if (!updatedUserDoc) {
        return { success: false, message: 'Failed to retrieve updated user information.', error: 'Could not fetch user after update.' };
    }
    
    // Return the full user object so localStorage can be updated
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = updatedUserDoc;

    return {
      success: true,
      message: 'Profile updated successfully!',
      user: {
          ...userWithoutPassword,
          _id: userWithoutPassword._id.toString(),
          schoolId: userWithoutPassword.schoolId?.toString(),
      },
    };

  } catch (error) {
    console.error('Update user profile server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during profile update.', error: errorMessage };
  }
}
