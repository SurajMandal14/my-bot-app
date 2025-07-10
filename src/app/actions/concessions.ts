
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { FeeConcession, FeeConcessionFormData, ApplyFeeConcessionResult, GetFeeConcessionsResult, RevokeFeeConcessionResult, FeeConcessionType } from '@/types/concessions';
import { feeConcessionFormSchema } from '@/types/concessions';
import type { User } from '@/types/user';
import type { School } from '@/types/school';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

export async function applyFeeConcession(payload: FeeConcessionFormData, masterAdminId: string): Promise<ApplyFeeConcessionResult> {
  try {
    const validatedPayload = feeConcessionFormSchema.safeParse(payload);
    if (!validatedPayload.success) {
      const errors = validatedPayload.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed.', error: errors };
    }

    const { studentId, schoolId, academicYear, concessionType, amount, reason } = validatedPayload.data;

    if (!ObjectId.isValid(studentId) || !ObjectId.isValid(schoolId) || !ObjectId.isValid(masterAdminId)) {
      return { success: false, message: 'Invalid ID format for student, school, or admin.' };
    }

    const { db } = await connectToDatabase();
    const concessionsCollection = db.collection('fee_concessions');
    const usersCollection = db.collection<User>('users');
    const schoolsCollection = db.collection<School>('schools');

    // Validate student and school existence
    const student = await usersCollection.findOne({ _id: new ObjectId(studentId), schoolId: new ObjectId(schoolId), role: 'student' });
    if (!student) {
      return { success: false, message: 'Student not found in the specified school.' };
    }
    const school = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) });
    if (!school) {
      return { success: false, message: 'School not found.' };
    }
    const masterAdmin = await usersCollection.findOne({ _id: new ObjectId(masterAdminId), role: 'masteradmin' });
     if (!masterAdmin) {
      return { success: false, message: 'Master admin not found or invalid ID.' };
    }


    const newConcessionDoc = {
      studentId: new ObjectId(studentId),
      schoolId: new ObjectId(schoolId),
      academicYear,
      concessionType,
      amount,
      reason,
      appliedByMasterAdminId: new ObjectId(masterAdminId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await concessionsCollection.insertOne(newConcessionDoc);
    if (!result.insertedId) {
      return { success: false, message: 'Failed to apply fee concession.', error: 'Database insertion failed.' };
    }

    revalidatePath('/dashboard/master-admin/concessions');
    // Potentially revalidate student/admin fee pages if they show net amounts
    revalidatePath(`/dashboard/student/fees`); 
    revalidatePath(`/dashboard/admin/fees`);
    revalidatePath(`/dashboard/admin/reports`);


    const clientConcession: FeeConcession = {
      ...newConcessionDoc,
      _id: result.insertedId.toString(),
      studentId: newConcessionDoc.studentId.toString(),
      schoolId: newConcessionDoc.schoolId.toString(),
      appliedByMasterAdminId: newConcessionDoc.appliedByMasterAdminId.toString(),
      createdAt: newConcessionDoc.createdAt.toISOString(),
      updatedAt: newConcessionDoc.updatedAt.toISOString(),
      studentName: student.name, // Add for immediate display if needed
      schoolName: school.schoolName,
      appliedByMasterAdminName: masterAdmin.name,
    };

    return {
      success: true,
      message: `Fee concession of amount ${amount} applied successfully for ${student.name}.`,
      concession: clientConcession,
    };

  } catch (error) {
    console.error('Apply fee concession server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during concession application.', error: errorMessage };
  }
}

export async function getFeeConcessionsForSchool(schoolId: string, academicYear?: string): Promise<GetFeeConcessionsResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID format.' };
    }

    const { db } = await connectToDatabase();
    const filter: any = { schoolId: new ObjectId(schoolId) };
    if (academicYear && /^\d{4}-\d{4}$/.test(academicYear)) {
      filter.academicYear = academicYear;
    }

    const concessions = await db.collection('fee_concessions').aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'studentInfo',
        },
      },
      { $unwind: { path: '$studentInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'schools',
          localField: 'schoolId',
          foreignField: '_id',
          as: 'schoolInfo',
        },
      },
      { $unwind: { path: '$schoolInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'appliedByMasterAdminId',
          foreignField: '_id',
          as: 'adminInfo',
        },
      },
      { $unwind: { path: '$adminInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1, studentId: 1, schoolId: 1, academicYear: 1, concessionType: 1, amount: 1, reason: 1,
          appliedByMasterAdminId: 1, createdAt: 1, updatedAt: 1,
          studentName: '$studentInfo.name',
          schoolName: '$schoolInfo.schoolName',
          admissionId: '$studentInfo.admissionId',
          appliedByMasterAdminName: '$adminInfo.name',
        },
      },
      { $sort: { createdAt: -1 } },
    ]).toArray();
    
    const clientConcessions: FeeConcession[] = concessions.map(doc => ({
      _id: (doc._id as ObjectId).toString(),
      studentId: (doc.studentId as ObjectId).toString(),
      schoolId: (doc.schoolId as ObjectId).toString(),
      academicYear: doc.academicYear,
      concessionType: doc.concessionType,
      amount: doc.amount,
      reason: doc.reason,
      appliedByMasterAdminId: (doc.appliedByMasterAdminId as ObjectId).toString(),
      studentName: doc.studentName || 'N/A',
      schoolName: doc.schoolName || 'N/A',
      admissionId: doc.admissionId || 'N/A',
      appliedByMasterAdminName: doc.appliedByMasterAdminName || 'N/A',
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
    }));

    return { success: true, concessions: clientConcessions };
  } catch (error) {
    console.error('Get fee concessions for school error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch fee concessions.' };
  }
}

export async function getFeeConcessionsForStudent(studentId: string, schoolId: string, academicYear: string): Promise<GetFeeConcessionsResult> {
   try {
    if (!ObjectId.isValid(studentId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid Student or School ID format.' };
    }
     if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
        return { success: false, message: 'Valid Academic Year is required.' };
    }

    const { db } = await connectToDatabase();
    
    const concessions = await db.collection('fee_concessions').find({
        studentId: new ObjectId(studentId),
        schoolId: new ObjectId(schoolId),
        academicYear: academicYear,
    }).sort({ createdAt: -1 }).toArray();

     const clientConcessions: FeeConcession[] = concessions.map(doc => ({
      _id: (doc._id as ObjectId).toString(),
      studentId: (doc.studentId as ObjectId).toString(),
      schoolId: (doc.schoolId as ObjectId).toString(),
      academicYear: doc.academicYear,
      concessionType: doc.concessionType as FeeConcessionType,
      amount: doc.amount,
      reason: doc.reason,
      appliedByMasterAdminId: (doc.appliedByMasterAdminId as ObjectId).toString(),
      createdAt: new Date(doc.createdAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
    }));

    return { success: true, concessions: clientConcessions };

   } catch (error) {
    console.error('Get fee concessions for student error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch student fee concessions.' };
  }
}


export async function revokeFeeConcession(concessionId: string): Promise<RevokeFeeConcessionResult> {
  try {
    if (!ObjectId.isValid(concessionId)) {
      return { success: false, message: 'Invalid Concession ID format.' };
    }

    const { db } = await connectToDatabase();
    const concessionsCollection = db.collection('fee_concessions');

    const result = await concessionsCollection.deleteOne({ _id: new ObjectId(concessionId) });

    if (result.deletedCount === 0) {
      return { success: false, message: 'Concession not found or already revoked.', error: 'Concession not found.' };
    }

    revalidatePath('/dashboard/master-admin/concessions');
    // Potentially revalidate student/admin fee pages
    revalidatePath(`/dashboard/student/fees`); 
    revalidatePath(`/dashboard/admin/fees`);
    revalidatePath(`/dashboard/admin/reports`);

    return { success: true, message: 'Fee concession revoked successfully!' };

  } catch (error) {
    console.error('Revoke fee concession server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during concession revocation.', error: errorMessage };
  }
}
