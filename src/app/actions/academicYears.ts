
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import type { AcademicYear, AcademicYearResult, AcademicYearsResult } from '@/types/academicYear';
import { academicYearSchema } from '@/types/academicYear';

export async function createAcademicYear(values: { year: string; isDefault?: boolean }): Promise<AcademicYearResult> {
    try {
        const validatedFields = academicYearSchema.safeParse(values);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed', error: 'Invalid year format.' };
        }
        const { year, isDefault } = validatedFields.data;

        const { db } = await connectToDatabase();
        const collection = db.collection('academic_years');

        const existingYear = await collection.findOne({ year });
        if (existingYear) {
            return { success: false, message: `Academic year "${year}" already exists.` };
        }

        if (isDefault) {
            await collection.updateMany({}, { $set: { isDefault: false } });
        }

        const newYearData = {
            year,
            isDefault: isDefault || false,
            createdAt: new Date(),
        };

        const result = await collection.insertOne(newYearData);
        if (!result.insertedId) {
            return { success: false, message: 'Failed to create academic year.' };
        }

        revalidatePath('/dashboard/super-admin/academic-years');

        const createdYear: AcademicYear = {
            _id: result.insertedId.toString(),
            year: newYearData.year,
            isDefault: newYearData.isDefault,
            createdAt: newYearData.createdAt.toISOString(),
        };

        return {
            success: true,
            message: 'Academic year created successfully!',
            academicYear: createdYear,
        };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function getAcademicYears(): Promise<AcademicYearsResult> {
    try {
        const { db } = await connectToDatabase();
        const yearsDocs = await db.collection('academic_years').find({}).sort({ year: -1 }).toArray();

        const academicYears: AcademicYear[] = yearsDocs.map(doc => ({
            _id: doc._id.toString(),
            year: doc.year,
            isDefault: doc.isDefault || false,
            createdAt: new Date(doc.createdAt).toISOString(),
        }));

        return { success: true, academicYears };
    } catch (error) {
        return { success: false, message: 'Failed to fetch academic years.' };
    }
}

export async function updateAcademicYear(id: string, values: { year: string, isDefault?: boolean }): Promise<AcademicYearResult> {
    try {
        if (!ObjectId.isValid(id)) {
            return { success: false, message: 'Invalid ID.' };
        }
        const validatedFields = academicYearSchema.safeParse(values);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed' };
        }
        const { year, isDefault } = validatedFields.data;
        const { db } = await connectToDatabase();
        const collection = db.collection('academic_years');

        const existingYear = await collection.findOne({ year, _id: { $ne: new ObjectId(id) } });
        if (existingYear) {
            return { success: false, message: `Academic year "${year}" already exists.` };
        }
        
        if (isDefault) {
            await collection.updateMany({ _id: { $ne: new ObjectId(id) } }, { $set: { isDefault: false } });
        }

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { year, isDefault: isDefault || false } }
        );

        if (result.matchedCount === 0) {
            return { success: false, message: 'Academic year not found.' };
        }
        
        revalidatePath('/dashboard/super-admin/academic-years');
        const updatedDoc = await collection.findOne({ _id: new ObjectId(id) });
        
        return { 
            success: true, 
            message: 'Academic year updated successfully!',
            academicYear: {
                _id: updatedDoc!._id.toString(),
                year: updatedDoc!.year,
                isDefault: updatedDoc!.isDefault,
                createdAt: new Date(updatedDoc!.createdAt).toISOString(),
            }
        };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function deleteAcademicYear(id: string): Promise<AcademicYearResult> {
    try {
        if (!ObjectId.isValid(id)) {
            return { success: false, message: 'Invalid ID.' };
        }
        const { db } = await connectToDatabase();
        const result = await db.collection('academic_years').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return { success: false, message: 'Academic year not found or already deleted.' };
        }

        revalidatePath('/dashboard/super-admin/academic-years');
        return { success: true, message: 'Academic year deleted successfully!' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function setDefaultAcademicYear(id: string): Promise<AcademicYearResult> {
    try {
        if (!ObjectId.isValid(id)) {
            return { success: false, message: 'Invalid ID.' };
        }
        const { db } = await connectToDatabase();
        const collection = db.collection('academic_years');

        await collection.updateMany({}, { $set: { isDefault: false } });
        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { isDefault: true } });

        if (result.matchedCount === 0) {
             return { success: false, message: 'Academic year not found.' };
        }
        
        revalidatePath('/dashboard/super-admin/academic-years');
        return { success: true, message: 'Default academic year updated.' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
