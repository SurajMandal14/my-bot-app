
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import type { CourseMaterial, CourseMaterialFormData, CourseMaterialResult, CourseMaterialsResult } from '@/types/course';
import { courseMaterialSchema } from '@/types/course';


export async function createCourseMaterial(values: CourseMaterialFormData): Promise<CourseMaterialResult> {
    try {
        const validatedFields = courseMaterialSchema.safeParse(values);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed', error: 'Invalid fields!' };
        }

        const { schoolId, classId, subjectName, title, pdfUrl } = validatedFields.data;

        const { db } = await connectToDatabase();
        const materialsCollection = db.collection('course_materials');

        const newMaterial = {
            schoolId: new ObjectId(schoolId),
            classId: new ObjectId(classId),
            subjectName,
            title,
            pdfUrl,
            createdAt: new Date(),
        };

        const result = await materialsCollection.insertOne(newMaterial);
        if (!result.insertedId) {
            return { success: false, message: 'Failed to create course material.' };
        }

        revalidatePath('/dashboard/master-admin/courses');
        revalidatePath('/dashboard/student/courses');

        return {
            success: true,
            message: 'Course material added successfully!',
            material: {
                ...newMaterial,
                _id: result.insertedId.toString(),
                schoolId: newMaterial.schoolId.toString(),
                classId: newMaterial.classId.toString(),
                createdAt: newMaterial.createdAt.toISOString(),
            },
        };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}


export async function getCourseMaterialsForClass(classId: string, schoolId: string): Promise<CourseMaterialsResult> {
  try {
    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid Class or School ID.' };
    }
    const { db } = await connectToDatabase();
    const materialsCollection = db.collection('course_materials');
    const materialsDocs = await materialsCollection.find({ 
        classId: new ObjectId(classId),
        schoolId: new ObjectId(schoolId) 
    }).sort({ subjectName: 1, title: 1 }).toArray();

    const materials: CourseMaterial[] = materialsDocs.map(doc => ({
      _id: doc._id.toString(),
      schoolId: doc.schoolId.toString(),
      classId: doc.classId.toString(),
      subjectName: doc.subjectName,
      title: doc.title,
      pdfUrl: doc.pdfUrl,
      createdAt: new Date(doc.createdAt).toISOString(),
    }));

    return { success: true, materials };
  } catch (error) {
    return { success: false, message: 'Failed to fetch course materials.' };
  }
}

export async function deleteCourseMaterial(id: string, schoolId: string): Promise<CourseMaterialResult> {
    try {
        if (!ObjectId.isValid(id) || !ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid Material or School ID.' };
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('course_materials').deleteOne({ 
            _id: new ObjectId(id),
            schoolId: new ObjectId(schoolId)
        });

        if (result.deletedCount === 0) {
            return { success: false, message: 'Material not found or already deleted.' };
        }

        revalidatePath('/dashboard/master-admin/courses');
        revalidatePath('/dashboard/student/courses');
        return { success: true, message: 'Course material deleted successfully!' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
