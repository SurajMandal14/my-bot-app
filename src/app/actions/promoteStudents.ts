'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { User } from '@/types/user';

const promotionPayloadSchema = z.object({
    schoolId: z.string().min(1),
    toClassId: z.string().min(1),
    studentIds: z.array(z.string().min(1)).min(1, "At least one student must be selected."),
    academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Invalid academic year format."),
});

interface PromotionResult {
    success: boolean;
    message: string;
    error?: string;
    updatedCount?: number;
}

export async function promoteStudents(payload: z.infer<typeof promotionPayloadSchema>): Promise<PromotionResult> {
    const validatedPayload = promotionPayloadSchema.safeParse(payload);
    if (!validatedPayload.success) {
        const errors = validatedPayload.error.errors.map(e => e.message).join('; ');
        return { success: false, message: 'Validation failed.', error: errors };
    }

    const { schoolId, toClassId, studentIds, academicYear } = validatedPayload.data;
    
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(toClassId) || !studentIds.every(id => ObjectId.isValid(id))) {
        return { success: false, message: 'Invalid ID format provided.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection<User>('users');

        const studentObjectIds = studentIds.map(id => new ObjectId(id));

        const result = await usersCollection.updateMany(
            { 
                _id: { $in: studentObjectIds },
                schoolId: new ObjectId(schoolId),
                role: 'student'
            },
            { 
                $set: { 
                    classId: toClassId, 
                    academicYear: academicYear, // Update academic year
                    updatedAt: new Date() 
                } 
            }
        );
        
        if (result.matchedCount === 0) {
            return { success: false, message: 'No matching students found to promote.' };
        }

        revalidatePath('/dashboard/admin/students');
        revalidatePath('/dashboard/admin/classes');

        return { success: true, message: `${result.modifiedCount} student(s) promoted successfully to the new class and academic year.`, updatedCount: result.modifiedCount };

    } catch (error) {
        console.error("Promote students server action error:", error);
        return { success: false, message: 'An unexpected error occurred during promotion.' };
    }
}


const discontinuationPayloadSchema = z.object({
    schoolId: z.string().min(1),
    studentIds: z.array(z.string().min(1)).min(1, "At least one student must be selected."),
});

export async function discontinueStudents(payload: z.infer<typeof discontinuationPayloadSchema>): Promise<PromotionResult> {
     const validatedPayload = discontinuationPayloadSchema.safeParse(payload);
    if (!validatedPayload.success) {
        const errors = validatedPayload.error.errors.map(e => e.message).join('; ');
        return { success: false, message: 'Validation failed.', error: errors };
    }

    const { schoolId, studentIds } = validatedPayload.data;
    
    if (!ObjectId.isValid(schoolId) || !studentIds.every(id => ObjectId.isValid(id))) {
        return { success: false, message: 'Invalid ID format provided.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const studentObjectIds = studentIds.map(id => new ObjectId(id));

        const result = await db.collection<User>('users').updateMany(
            {
                _id: { $in: studentObjectIds },
                schoolId: new ObjectId(schoolId),
                role: 'student'
            },
            {
                $set: {
                    status: 'discontinued',
                    updatedAt: new Date()
                }
            }
        );

         if (result.matchedCount === 0) {
            return { success: false, message: 'No matching students found to discontinue.' };
        }
        
        revalidatePath('/dashboard/admin/students');
        
        return { success: true, message: `${result.modifiedCount} student(s) marked as discontinued.`, updatedCount: result.modifiedCount };

    } catch (error) {
         console.error("Discontinue students server action error:", error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
