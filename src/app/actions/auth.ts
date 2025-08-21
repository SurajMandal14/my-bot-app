
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import * as z from 'zod';
import type { User } from '@/types/user'; 
import type { School } from '@/types/school';
import bcrypt from 'bcryptjs'; 

const loginSchema = z.object({
  identifier: z.string().min(1, { message: "Email or Admission Number is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export interface LoginResult {
  success: boolean;
  error?: string;
  message?: string;
  user?: Partial<User>;
}

export async function loginUser(values: z.infer<typeof loginSchema>): Promise<LoginResult> {
  try {
    const validatedFields = loginSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join(' ');
      return { error: errors || 'Invalid fields!', success: false };
    }

    const { identifier, password } = validatedFields.data;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');
    let userDoc: User | null = null;

    if (identifier.includes('@')) { // Treat as email
      userDoc = await usersCollection.findOne({ email: identifier });
    } else { // Treat as admission number (only for students)
      userDoc = await usersCollection.findOne({ admissionId: identifier, role: 'student' });
    }

    if (!userDoc) {
      return { error: 'User not found. Please check your credentials.', success: false };
    }
    
    // Check if school is active for non-superadmins
    if (userDoc.role !== 'superadmin' && userDoc.schoolId) {
      const school = await db.collection<School>('schools').findOne({ _id: userDoc.schoolId });
      if (!school || school.status === 'inactive') {
        return { error: 'This school account is currently inactive. Please contact support.', success: false };
      }
    }


    if (!userDoc.password) {
      return { error: 'Password not set for this user. Please contact support.', success: false };
    }

    const isPasswordValid = await bcrypt.compare(password, userDoc.password);

    if (!isPasswordValid) {
      if (userDoc.password === password) {
        // Plain text password matches (legacy)
      } else {
        return { error: 'Invalid password. Please try again.', success: false };
      }
    }
    
    // Convert to client-safe object, ensuring all necessary fields for localStorage are present
    const { password: _, ...user } = userDoc;
    const clientUser: Partial<User> = {
        ...user,
        _id: user._id.toString(),
        schoolId: user.schoolId?.toString(),
    };


    return {
      success: true,
      message: 'Login successful! Redirecting...',
      user: clientUser,
    };

  } catch (error) {
    console.error('Login server action error:', error);
    return { error: 'An unexpected error occurred during login. Please try again later.', success: false };
  }
}
