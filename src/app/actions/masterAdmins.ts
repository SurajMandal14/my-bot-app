
'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import type { User, MasterAdminFormData } from '@/types/user';
import { masterAdminFormSchema } from '@/types/user';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import type { School } from '@/types/school';

export interface MasterAdminResult {
  success: boolean;
  message: string;
  error?: string;
  user?: Partial<User>;
}

export async function createMasterAdmin(values: MasterAdminFormData): Promise<MasterAdminResult> {
  try {
    const validatedFields = masterAdminFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join(' ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    const { name, email, password, schoolId } = validatedFields.data;
    
    if (!password || password.length < 6) {
      return { success: false, message: 'Validation failed', error: 'Password is required and must be at least 6 characters for new master admins.' };
    }

    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID provided.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<Omit<User, '_id'>>('users');

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return { success: false, message: 'User with this email already exists.', error: 'Email already in use.' };
    }
    
    const school = await db.collection<School>('schools').findOne({ _id: new ObjectId(schoolId) as any });
    if (!school) {
      return { success: false, message: 'Selected school not found.' };
    }
    
    const hashedPassword = await bcrypt.hash(password, 10); 

    const newUser: Omit<User, '_id'> = {
      name,
      email,
      password: hashedPassword,
      role: 'masteradmin',
      schoolId: new ObjectId(schoolId), // Assign schoolId
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    if (!result.insertedId) {
      return { success: false, message: 'Failed to create master admin.', error: 'Database insertion failed.' };
    }

    revalidatePath('/dashboard/super-admin/master-admins');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = newUser;
    return {
      success: true,
      message: 'Master Admin created successfully!',
      user: { 
        ...userWithoutPassword, 
        _id: result.insertedId.toString(),
        schoolId: newUser.schoolId.toString(),
      },
    };

  } catch (error) {
    console.error('Create master admin server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during admin creation.', error: errorMessage };
  }
}


export async function updateMasterAdmin(userId: string, values: MasterAdminFormData): Promise<MasterAdminResult> {
  try {
    if (!ObjectId.isValid(userId)) {
      return { success: false, message: 'Invalid User ID format.', error: 'Invalid User ID.' };
    }

    const validatedFields = masterAdminFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join(' ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    const { name, email, password, schoolId } = validatedFields.data;

    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID provided.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const existingUserByEmail = await usersCollection.findOne({ email });
    if (existingUserByEmail && existingUserByEmail._id.toString() !== userId) {
      return { success: false, message: 'This email is already in use by another account.', error: 'Email already in use.' };
    }
    
    const school = await db.collection<School>('schools').findOne({ _id: new ObjectId(schoolId) as any });
    if (!school) {
      return { success: false, message: 'Selected school not found.' };
    }

    const updateData: Partial<Omit<User, '_id'>> = {
      name,
      email,
      schoolId: new ObjectId(schoolId),
      updatedAt: new Date(),
    };

    if (password && password.trim() !== "") {
      if (password.length < 6) {
         return { success: false, message: 'Validation failed', error: 'New password must be at least 6 characters.' };
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) as any, role: 'masteradmin' },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'Master admin user not found for update.', error: 'User not found.' };
    }
    
    revalidatePath('/dashboard/super-admin/master-admins');
    
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) as any });
    if (!updatedUser) {
      return { success: false, message: 'Failed to retrieve admin after update.', error: 'Could not fetch updated user.' };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      message: 'Master Admin updated successfully!',
      user: {
        ...userWithoutPassword,
        _id: updatedUser._id.toString(),
      }
    };

  } catch (error) {
    console.error('Update master admin server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during admin update.', error: errorMessage };
  }
}

export interface GetMasterAdminsResult {
  success: boolean;
  admins?: (Partial<User> & { schoolName?: string })[]; 
  error?: string;
  message?: string;
}

export async function getMasterAdmins(): Promise<GetMasterAdminsResult> {
  try {
    const { db } = await connectToDatabase();
    const adminsList = await db.collection<User>('users').aggregate([
        { $match: { role: 'masteradmin' } },
        {
            $lookup: {
                from: 'schools',
                localField: 'schoolId',
                foreignField: '_id',
                as: 'schoolInfo'
            }
        },
        { $unwind: { path: '$schoolInfo', preserveNullAndEmptyArrays: true } },
        { 
            $addFields: {
                schoolName: '$schoolInfo.schoolName'
            }
        },
        {
            $project: {
                password: 0,
                schoolInfo: 0,
            }
        },
        { $sort: { createdAt: -1 } }
    ]).toArray();
    
    const admins = adminsList.map(admin => ({
      ...admin,
      _id: admin._id.toString(),
      schoolId: admin.schoolId?.toString(),
    }));

    return { success: true, admins: admins as (Partial<User> & { schoolName?: string })[] };
  } catch (error) {
    console.error('Get master admins server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch master admins.' };
  }
}

export interface DeleteMasterAdminResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function deleteMasterAdmin(userId: string): Promise<DeleteMasterAdminResult> {
  try {
    if (!ObjectId.isValid(userId)) {
      return { success: false, message: 'Invalid User ID format.', error: 'Invalid User ID.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const schoolAdminsCount = await usersCollection.countDocuments({ role: 'admin', "masterAdminId": new ObjectId(userId) }); // This check might need adjustment based on how you link admins
    if(schoolAdminsCount > 0) {
        return { success: false, message: "Cannot delete Master Admin.", error: "This Master Admin still manages school administrators. Please reassign them first."};
    }

    const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) as any, role: 'masteradmin' });

    if (result.deletedCount === 0) {
      return { success: false, message: 'Master admin user not found or already deleted.', error: 'User not found.' };
    }

    revalidatePath('/dashboard/super-admin/master-admins');
    return { success: true, message: 'Master Admin deleted successfully!' };

  } catch (error) {
    console.error('Delete master admin server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during admin deletion.', error: errorMessage };
  }
}

export interface GetMasterAdminsCountResult {
  success: boolean;
  count?: number;
  error?: string;
  message?: string;
}

export async function getMasterAdminsCount(): Promise<GetMasterAdminsCountResult> {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');
    const count = await usersCollection.countDocuments({ role: 'masteradmin' });
    return { success: true, count };
  } catch (error) {
    console.error('Get master admins count server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch master admins count.' };
  }
}
