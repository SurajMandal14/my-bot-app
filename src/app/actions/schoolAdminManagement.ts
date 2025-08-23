

'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import type { User, SchoolAdminFormData } from '@/types/user';
import { schoolAdminFormSchema } from '@/types/user'; // Import shared schema
import type { School } from '@/types/school';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

export interface CreateSchoolAdminResult {
  success: boolean;
  message: string;
  error?: string;
  user?: Partial<User>;
}

export async function createSchoolAdmin(values: SchoolAdminFormData): Promise<CreateSchoolAdminResult> {
  try {
    // For creation, password is required
    if (!values.password || values.password.length < 6) {
      return { success: false, message: 'Validation failed', error: 'Password is required and must be at least 6 characters for new admins.' };
    }
    const validatedFields = schoolAdminFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join(' ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    const { name, email, password, schoolId, designation, phone } = validatedFields.data;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<Omit<User, '_id'>>('users');
    const schoolsCollection = db.collection<School>('schools');

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return { success: false, message: 'User with this email already exists.', error: 'Email already in use.' };
    }

    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID format.', error: 'Invalid School ID.'};
    }
    const school = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) as any });
    if (!school) {
      return { success: false, message: 'Selected school not found.', error: 'School not found.' };
    }

    // Password must exist for creation due to check above
    const hashedPassword = await bcrypt.hash(password!, 10); 

    const newUserObjectIdForSchool = new ObjectId(schoolId);

    const newUser: Omit<User, '_id'> = {
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      schoolId: newUserObjectIdForSchool,
      designation,
      phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    if (!result.insertedId) {
      return { success: false, message: 'Failed to create school admin.', error: 'Database insertion failed.' };
    }

    revalidatePath('/dashboard/master-admin/admins');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = newUser;
    return {
      success: true,
      message: 'School Admin created successfully!',
      user: { 
        ...userWithoutPassword, 
        _id: result.insertedId.toString(),
        schoolId: newUserObjectIdForSchool.toString() 
      },
    };

  } catch (error) {
    console.error('Create school admin server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during admin creation.', error: errorMessage };
  }
}


export interface UpdateSchoolAdminResult {
  success: boolean;
  message: string;
  error?: string;
  user?: Partial<User>;
}

export async function updateSchoolAdmin(userId: string, values: SchoolAdminFormData): Promise<UpdateSchoolAdminResult> {
  try {
    if (!ObjectId.isValid(userId)) {
      return { success: false, message: 'Invalid User ID format.', error: 'Invalid User ID.' };
    }

    const validatedFields = schoolAdminFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join(' ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    const { name, email, password, schoolId, designation, phone } = validatedFields.data;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');
    const schoolsCollection = db.collection<School>('schools');

    // Check if email is being changed to one that already exists (and isn't the current user's)
    const existingUserByEmail = await usersCollection.findOne({ email });
    if (existingUserByEmail && existingUserByEmail._id.toString() !== userId) {
      return { success: false, message: 'This email is already in use by another account.', error: 'Email already in use.' };
    }

    // Validate schoolId if provided
    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID format for update.', error: 'Invalid School ID.'};
    }
    const school = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) as any });
    if (!school) {
      return { success: false, message: 'Selected school not found for update.', error: 'School not found.' };
    }
    
    const updateData: Partial<Omit<User, '_id'>> = {
      name,
      email,
      schoolId: new ObjectId(schoolId),
      designation,
      phone,
      updatedAt: new Date(),
    };

    if (password && password.trim() !== "") {
      if (password.length < 6) {
         return { success: false, message: 'Validation failed', error: 'New password must be at least 6 characters.' };
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) as any },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'Admin user not found for update.', error: 'User not found.' };
    }
    
    revalidatePath('/dashboard/master-admin/admins');
    
    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) as any });
    if (!updatedUser) {
      return { success: false, message: 'Failed to retrieve admin after update.', error: 'Could not fetch updated user.' };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      message: 'School Admin updated successfully!',
      user: {
        ...userWithoutPassword,
        _id: updatedUser._id.toString(),
        schoolId: updatedUser.schoolId?.toString(),
      }
    };

  } catch (error) {
    console.error('Update school admin server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during admin update.', error: errorMessage };
  }
}


export interface GetSchoolAdminsResult {
  success: boolean;
  admins?: (Partial<User> & { schoolName?: string })[]; 
  error?: string;
  message?: string;
}

export async function getSchoolAdmins(schoolId: string): Promise<GetSchoolAdminsResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: "Invalid School ID provided." };
    }

    const { db } = await connectToDatabase();
    const adminsWithSchool = await db.collection<User>('users').aggregate([
      {
        $match: { 
            role: 'admin',
            schoolId: new ObjectId(schoolId) 
        } 
      },
      {
        $lookup: {
          from: 'schools', 
          localField: 'schoolId', 
          foreignField: '_id',
          as: 'schoolInfo' 
        }
      },
      {
        $unwind: { 
          path: '$schoolInfo',
          preserveNullAndEmptyArrays: true 
        }
      },
      {
        $project: { 
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          schoolId: 1, 
          schoolName: '$schoolInfo.schoolName',
          designation: 1,
          phone: 1,
          createdAt: 1,
          updatedAt: 1,
        }
      },
      { $sort: { createdAt: -1 } }
    ]).toArray();
    
    const admins = adminsWithSchool.map(admin => ({
      ...admin,
      _id: admin._id.toString(),
      schoolId: admin.schoolId?.toString(), 
    }));

    return { success: true, admins: admins as (Partial<User> & { schoolName?: string })[] };
  } catch (error) {
    console.error('Get school admins server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch school admins.' };
  }
}

export interface DeleteSchoolAdminResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function deleteSchoolAdmin(userId: string): Promise<DeleteSchoolAdminResult> {
  try {
    if (!ObjectId.isValid(userId)) {
      return { success: false, message: 'Invalid User ID format.', error: 'Invalid User ID.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) as any, role: 'admin' });

    if (result.deletedCount === 0) {
      return { success: false, message: 'Admin user not found or already deleted.', error: 'User not found.' };
    }

    revalidatePath('/dashboard/master-admin/admins');
    return { success: true, message: 'School Admin deleted successfully!' };

  } catch (error) {
    console.error('Delete school admin server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during admin deletion.', error: errorMessage };
  }
}
