
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { School, SchoolFormData, ReportCardTemplateKey, ClassTuitionFeeConfig, TermFee, BusFeeLocationCategory, AssessmentLocks } from '@/types/school';
import { schoolFormSchema } from '@/types/school';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { isEqual } from 'lodash';

export interface CreateSchoolResult {
  success: boolean;
  message: string;
  error?: string;
  school?: School;
}

export async function createSchool(values: SchoolFormData): Promise<CreateSchoolResult> {
  try {
    const validatedFields = schoolFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    const { 
        schoolName, tuitionFees, schoolLogoUrl, reportCardTemplate, 
        busFeeStructures, allowStudentsToViewPublishedReports, attendanceType,
        activeAcademicYear, marksEntryLocks
    } = validatedFields.data;

    const { db } = await connectToDatabase();
    const schoolsCollection = db.collection<Omit<School, '_id'>>('schools');

    const newSchoolData: Omit<School, '_id' | 'createdAt' | 'updatedAt'> = {
      schoolName,
      tuitionFees: (tuitionFees || []).map(tf => ({
        className: tf.className,
        terms: tf.terms.map(termFee => ({
          term: termFee.term,
          amount: termFee.amount,
        })),
      })),
      busFeeStructures: busFeeStructures ? busFeeStructures.map(bfs => ({
        location: bfs.location,
        classCategory: bfs.classCategory,
        terms: bfs.terms.map(termFee => ({
          term: termFee.term,
          amount: termFee.amount,
        })),
      })) : [],
      schoolLogoUrl: schoolLogoUrl || undefined,
      reportCardTemplate: reportCardTemplate || 'none',
      allowStudentsToViewPublishedReports: allowStudentsToViewPublishedReports || false,
      attendanceType: attendanceType || 'monthly',
      activeAcademicYear: activeAcademicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      marksEntryLocks: marksEntryLocks || {},
    };

    const schoolToInsert = {
      ...newSchoolData,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await schoolsCollection.insertOne(schoolToInsert);

    if (!result.insertedId) {
      return { success: false, message: 'Failed to create school profile.', error: 'Database insertion failed.' };
    }
    
    revalidatePath('/dashboard/super-admin/schools');

    return {
      success: true,
      message: 'School profile created successfully!',
      school: { 
        ...schoolToInsert, 
        _id: result.insertedId.toString(),
        createdAt: schoolToInsert.createdAt.toISOString(), 
        updatedAt: schoolToInsert.updatedAt.toISOString(),
      } as School,
    };

  } catch (error) {
    console.error('Create school server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during school creation.', error: errorMessage };
  }
}

export interface UpdateSchoolResult {
  success: boolean;
  message: string;
  error?: string;
  school?: School;
}

export async function updateSchool(schoolId: string, values: SchoolFormData): Promise<UpdateSchoolResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid school ID format.' };
    }

    const validatedFields = schoolFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    const { 
        schoolName, tuitionFees, reportCardTemplate, schoolLogoUrl, 
        busFeeStructures, allowStudentsToViewPublishedReports, attendanceType,
        activeAcademicYear, marksEntryLocks
    } = validatedFields.data;

    const { db } = await connectToDatabase();
    const schoolsCollection = db.collection<School>('schools');
    
    const existingSchool = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) as any });
    if (!existingSchool) {
      return { success: false, message: 'School not found for update.', error: 'No school matched the provided ID.' };
    }

    // Merge marksEntryLocks correctly
    const mergedMarksEntryLocks = {
        ...existingSchool.marksEntryLocks,
        ...marksEntryLocks,
    };

    const updateData: Partial<Omit<School, '_id' | 'createdAt'>> = {
      schoolName,
      tuitionFees: (tuitionFees || []).map(tf => ({
        className: tf.className,
        terms: tf.terms.map(termFee => ({
          term: termFee.term,
          amount: termFee.amount,
        })),
      })),
      busFeeStructures: busFeeStructures ? busFeeStructures.map(bfs => ({
        location: bfs.location,
        classCategory: bfs.classCategory,
        terms: bfs.terms.map(termFee => ({
          term: termFee.term,
          amount: termFee.amount,
        })),
      })) : [],
      reportCardTemplate: reportCardTemplate || 'none',
      allowStudentsToViewPublishedReports: allowStudentsToViewPublishedReports || false,
      attendanceType: attendanceType || 'monthly',
      activeAcademicYear: activeAcademicYear,
      marksEntryLocks: mergedMarksEntryLocks,
      updatedAt: new Date(),
    };
    
    if (typeof schoolLogoUrl === 'string') {
      updateData.schoolLogoUrl = schoolLogoUrl || undefined; 
    }
    
    // Check if there are actual changes before updating
    const relevantExistingData = {
        schoolName: existingSchool.schoolName,
        tuitionFees: (existingSchool.tuitionFees || []).map(tf => ({ className: tf.className, terms: tf.terms.map(t => ({...t})) })),
        busFeeStructures: (existingSchool.busFeeStructures || []).map(bfs => ({ location: bfs.location, classCategory: bfs.classCategory, terms: bfs.terms.map(t => ({...t})) })),
        reportCardTemplate: existingSchool.reportCardTemplate || 'none',
        allowStudentsToViewPublishedReports: existingSchool.allowStudentsToViewPublishedReports || false,
        attendanceType: existingSchool.attendanceType || 'monthly',
        activeAcademicYear: existingSchool.activeAcademicYear,
        marksEntryLocks: existingSchool.marksEntryLocks || {},
        schoolLogoUrl: existingSchool.schoolLogoUrl || undefined,
    };

    const relevantUpdateData = {
        schoolName: updateData.schoolName,
        tuitionFees: updateData.tuitionFees,
        busFeeStructures: updateData.busFeeStructures,
        reportCardTemplate: updateData.reportCardTemplate,
        allowStudentsToViewPublishedReports: updateData.allowStudentsToViewPublishedReports,
        attendanceType: updateData.attendanceType,
        activeAcademicYear: updateData.activeAcademicYear,
        marksEntryLocks: updateData.marksEntryLocks,
        schoolLogoUrl: updateData.schoolLogoUrl,
    };

    if (isEqual(relevantExistingData, relevantUpdateData)) {
      return { success: true, message: 'No changes detected to update.' };
    }

    const result = await schoolsCollection.updateOne(
      { _id: new ObjectId(schoolId) as any },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'School not found.', error: 'No school matched the provided ID.' };
    }
    
    revalidatePath('/dashboard/super-admin/schools');
    revalidatePath(`/dashboard/admin/settings`); 
    revalidatePath('/dashboard/master-admin/settings');
    
    const updatedSchoolDoc = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) as any });
     if (!updatedSchoolDoc) return { success: false, message: 'Failed to retrieve school after update.'};
     
     const clientSchool: School = {
        ...updatedSchoolDoc,
        _id: updatedSchoolDoc._id.toString(),
        createdAt: new Date(updatedSchoolDoc.createdAt).toISOString(), 
        updatedAt: new Date(updatedSchoolDoc.updatedAt).toISOString(),
     };

    return {
      success: true,
      message: 'School profile updated successfully!',
      school: clientSchool
    };

  } catch (error) {
    console.error('Update school server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during school update.', error: errorMessage };
  }
}


export async function getSchools(): Promise<GetSchoolsResult> {
  try {
    const { db } = await connectToDatabase();
    const schoolsCollection = db.collection('schools'); 
    
    const schoolsDocs = await schoolsCollection.find({}).sort({ createdAt: -1 }).toArray();
    
    const schools: School[] = schoolsDocs.map(doc => ({
      _id: doc._id.toString(),
      schoolName: doc.schoolName,
      schoolLogoUrl: doc.schoolLogoUrl,
      tuitionFees: (doc.tuitionFees || []).map((tf: any) => ({ 
        className: tf.className,
        terms: (tf.terms || []).map((t: any) => ({ term: t.term, amount: t.amount }))
      })),
      busFeeStructures: (doc.busFeeStructures || []).map((bfs: any) => ({
        location: bfs.location,
        classCategory: bfs.classCategory,
        terms: (bfs.terms || []).map((t: any) => ({ term: t.term, amount: t.amount }))
      })),
      reportCardTemplate: doc.reportCardTemplate,
      allowStudentsToViewPublishedReports: doc.allowStudentsToViewPublishedReports === undefined ? false : doc.allowStudentsToViewPublishedReports,
      attendanceType: doc.attendanceType || 'monthly',
      activeAcademicYear: doc.activeAcademicYear,
      marksEntryLocks: doc.marksEntryLocks || {},
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
    }));

    return { success: true, schools };
  } catch (error) {
    console.error('Get schools server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch schools.' };
  }
}

export interface GetSchoolsResult {
  success: boolean;
  schools?: School[];
  error?: string;
  message?: string;
}

export async function getSchoolById(schoolId: string): Promise<GetSchoolByIdResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid school ID format.' };
    }

    const { db } = await connectToDatabase();
    const schoolsCollection = db.collection('schools'); 
    
    const schoolDoc = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) as any });

    if (!schoolDoc) {
      return { success: false, message: 'School not found.' };
    }
    
    const school: School = {
      _id: schoolDoc._id.toString(),
      schoolName: schoolDoc.schoolName,
      schoolLogoUrl: schoolDoc.schoolLogoUrl,
      tuitionFees: (schoolDoc.tuitionFees || []).map((tf: any) => ({
        className: tf.className,
        terms: (tf.terms || []).map((t: any) => ({ term: t.term, amount: t.amount }))
      })),
      busFeeStructures: (schoolDoc.busFeeStructures || []).map((bfs: any) => ({
        location: bfs.location,
        classCategory: bfs.classCategory,
        terms: (bfs.terms || []).map((t: any) => ({ term: t.term, amount: t.amount }))
      })),
      reportCardTemplate: schoolDoc.reportCardTemplate,
      allowStudentsToViewPublishedReports: schoolDoc.allowStudentsToViewPublishedReports === undefined ? false : schoolDoc.allowStudentsToViewPublishedReports, // Default to false if missing
      attendanceType: schoolDoc.attendanceType || 'monthly',
      activeAcademicYear: schoolDoc.activeAcademicYear,
      marksEntryLocks: schoolDoc.marksEntryLocks || {},
      createdAt: new Date(schoolDoc.createdAt).toISOString(),
      updatedAt: new Date(schoolDoc.updatedAt).toISOString(),
    };
    
    return { success: true, school };
  } catch (error) {
    console.error('Get school by ID server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch school details.' };
  }
}

export interface GetSchoolByIdResult {
  success: boolean;
  school?: School;
  error?: string;
  message?: string;
}

export async function getSchoolsCount(): Promise<GetSchoolsCountResult> {
  try {
    const { db } = await connectToDatabase();
    const schoolsCollection = db.collection('schools');
    const count = await schoolsCollection.countDocuments();
    return { success: true, count };
  } catch (error) {
    console.error('Get schools count server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch schools count.' };
  }
}

export interface GetSchoolsCountResult {
  success: boolean;
  count?: number;
  error?: string;
  message?: string;
}

// New action for School Admin to toggle visibility
export async function setSchoolReportVisibility(schoolId: string, allowVisibility: boolean): Promise<UpdateSchoolResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid school ID format.' };
    }

    const { db } = await connectToDatabase();
    const schoolsCollection = db.collection<School>('schools');

    const result = await schoolsCollection.updateOne(
      { _id: new ObjectId(schoolId) as any },
      { $set: { allowStudentsToViewPublishedReports: allowVisibility, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'School not found.', error: 'No school matched the provided ID.' };
    }
    
    revalidatePath(`/dashboard/admin/settings`); // Revalidate admin settings page
    revalidatePath('/dashboard/student/results', 'layout'); 


    const updatedSchoolDoc = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) as any });
    if (!updatedSchoolDoc) return { success: false, message: 'Failed to retrieve school after update.' };

    const clientSchool: School = {
      ...updatedSchoolDoc,
      _id: updatedSchoolDoc._id.toString(),
      createdAt: new Date(updatedSchoolDoc.createdAt).toISOString(),
      updatedAt: new Date(updatedSchoolDoc.updatedAt).toISOString(),
    };

    return {
      success: true,
      message: `Student report card visibility ${allowVisibility ? 'enabled' : 'disabled'} successfully.`,
      school: clientSchool,
    };

  } catch (error) {
    console.error('Set school report visibility error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred.', error: errorMessage };
  }
}


export async function deleteSchool(schoolId: string): Promise<DeleteSchoolResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid school ID format.' };
    }
    
    const schoolObjectId = new ObjectId(schoolId);
    const { db } = await connectToDatabase();
    
    const usersCount = await db.collection('users').countDocuments({ schoolId: schoolObjectId });
    if (usersCount > 0) {
      return { success: false, message: 'Cannot delete school. Please remove all assigned users (Admins, Teachers, Students) first.' };
    }

    const result = await db.collection('schools').deleteOne({ _id: schoolObjectId as any });
    if (result.deletedCount === 0) {
      return { success: false, message: 'School not found or already deleted.' };
    }

    revalidatePath('/dashboard/super-admin/schools');

    return { success: true, message: 'School deleted successfully!' };
    
  } catch (error) {
    console.error('Delete school server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during school deletion.', error: errorMessage };
  }
}

export interface DeleteSchoolResult {
  success: boolean;
  message: string;
  error?: string;
}
