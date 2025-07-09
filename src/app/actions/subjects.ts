
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import type { Subject, SubjectFormData, SubjectResult, SubjectsResult } from '@/types/subject';
import { subjectSchema } from '@/types/subject';


export async function createSubject(values: SubjectFormData): Promise<SubjectResult> {
    try {
        const validatedFields = subjectSchema.safeParse(values);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed', error: 'Invalid fields!' };
        }

        const { name, schoolId } = validatedFields.data;
        if (!ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid School ID.' };
        }

        const { db } = await connectToDatabase();
        const subjectsCollection = db.collection('subjects');

        const existingSubject = await subjectsCollection.findOne({ name: new RegExp(`^${name}$`, 'i'), schoolId: new ObjectId(schoolId) });
        if (existingSubject) {
            return { success: false, message: `A subject with the name "${name}" already exists in this school.` };
        }

        const newSubject = {
            name,
            schoolId: new ObjectId(schoolId),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await subjectsCollection.insertOne(newSubject);
        if (!result.insertedId) {
            return { success: false, message: 'Failed to create subject.' };
        }

        revalidatePath('/dashboard/master-admin/subjects');

        return {
            success: true,
            message: 'Subject created successfully!',
            subject: {
                _id: result.insertedId.toString(),
                name: newSubject.name,
                schoolId: newSubject.schoolId.toString(),
                createdAt: newSubject.createdAt.toISOString(),
                updatedAt: newSubject.updatedAt.toISOString(),
            },
        };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}


export async function getSubjects(schoolId: string): Promise<SubjectsResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID provided.' };
    }
    const { db } = await connectToDatabase();
    const subjectsCollection = db.collection('subjects');
    const subjectsDocs = await subjectsCollection.find({ schoolId: new ObjectId(schoolId) }).sort({ name: 1 }).toArray();

    const subjects: Subject[] = subjectsDocs.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      schoolId: doc.schoolId.toString(),
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
    }));

    return { success: true, subjects };
  } catch (error) {
    return { success: false, message: 'Failed to fetch subjects.' };
  }
}

export async function updateSubject(id: string, values: SubjectFormData): Promise<SubjectResult> {
    try {
        if (!ObjectId.isValid(id)) {
            return { success: false, message: 'Invalid Subject ID.' };
        }
        const validatedFields = subjectSchema.safeParse(values);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed', error: 'Invalid fields!' };
        }

        const { name, schoolId } = validatedFields.data;
        if (!ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid School ID.' };
        }

        const { db } = await connectToDatabase();
        const subjectsCollection = db.collection('subjects');

        const existingSubject = await subjectsCollection.findOne({ 
            name: new RegExp(`^${name}$`, 'i'), 
            schoolId: new ObjectId(schoolId), 
            _id: { $ne: new ObjectId(id) } 
        });
        if (existingSubject) {
            return { success: false, message: `Another subject with the name "${name}" already exists in this school.` };
        }

        const result = await subjectsCollection.updateOne(
            { _id: new ObjectId(id), schoolId: new ObjectId(schoolId) },
            { $set: { name, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return { success: false, message: 'Subject not found in this school.' };
        }
        
        revalidatePath('/dashboard/master-admin/subjects');

        const updatedDoc = await subjectsCollection.findOne({ _id: new ObjectId(id) });
        
        return { 
            success: true, 
            message: 'Subject updated successfully!', 
            subject: {
                _id: updatedDoc!._id.toString(),
                name: updatedDoc!.name,
                schoolId: updatedDoc!.schoolId.toString(),
                createdAt: new Date(updatedDoc!.createdAt).toISOString(),
                updatedAt: new Date(updatedDoc!.updatedAt).toISOString(),
            }
        };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}


export async function deleteSubject(id: string, schoolId: string): Promise<SubjectResult> {
    try {
        if (!ObjectId.isValid(id) || !ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid Subject or School ID.' };
        }

        const { db } = await connectToDatabase();
        
        const schoolObjectId = new ObjectId(schoolId);

        const subjectDoc = await db.collection('subjects').findOne({ _id: new ObjectId(id), schoolId: schoolObjectId });
        if (!subjectDoc) {
            return { success: false, message: 'Subject not found in this school.' };
        }

        const classesUsingSubject = await db.collection('school_classes').countDocuments({ "subjects.name": subjectDoc.name, schoolId: schoolObjectId });
        if (classesUsingSubject > 0) {
            return { success: false, message: `Cannot delete subject. It is currently assigned to ${classesUsingSubject} class(es). Please remove it from all classes first.` };
        }
        
        const result = await db.collection('subjects').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return { success: false, message: 'Subject not found or already deleted.' };
        }

        revalidatePath('/dashboard/master-admin/subjects');
        return { success: true, message: 'Subject deleted successfully!' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
