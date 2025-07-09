
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import * as z from 'zod';
import type { User } from '@/types/user'; 
import bcrypt from 'bcryptjs'; 

const loginSchema = z.object({
  identifier: z.string().min(1, { message: "Email or Admission Number is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export interface LoginResult {
  success: boolean;
  error?: string;
  message?: string;
  user?: Pick<User, 'email' | 'name' | 'role' | '_id' | 'schoolId' | 'classId' | 'admissionId' | 'avatarUrl'>;
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
    let user: User | null = null;

    if (identifier.includes('@')) { // Treat as email
      // MongoDB findOne with a string query is case-sensitive by default.
      user = await usersCollection.findOne({ email: identifier });
    } else { // Treat as admission number (only for students)
      // MongoDB findOne with a string query is case-sensitive by default.
      user = await usersCollection.findOne({ admissionId: identifier, role: 'student' });
    }

    if (!user) {
      return { error: 'User not found. Please check your credentials.', success: false };
    }

    if (!user.password) {
      return { error: 'Password not set for this user. Please contact support.', success: false };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Fallback for plain text password (e.g., initial superadmin)
      if (user.password === password) {
        // Plain text password matches
      } else {
        return { error: 'Invalid password. Please try again.', success: false };
      }
    }
    
    return {
      success: true,
      message: 'Login successful! Redirecting...',
      user: { 
        _id: user._id.toString(),
        email: user.email, 
        name: user.name, 
        role: user.role,
        schoolId: user.schoolId?.toString(),
        classId: user.classId || undefined,
        admissionId: user.admissionId || undefined,
        avatarUrl: user.avatarUrl || undefined,
      }
    };

  } catch (error) {
    console.error('Login server action error:', error);
    return { error: 'An unexpected error occurred during login. Please try again later.', success: false };
  }
}
