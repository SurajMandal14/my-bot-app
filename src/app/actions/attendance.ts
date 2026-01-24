
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { MonthlyAttendanceRecord, MonthlyAttendanceSubmissionPayload, DailyAttendanceOverview, AttendanceRecord } from '@/types/attendance';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

// New schema for submitting monthly attendance
const monthlyAttendanceSubmissionPayloadSchema = z.object({
  classId: z.string().min(1, "Class ID is required."),
  schoolId: z.string().min(1, "School ID is required."),
  month: z.number().min(0).max(11), // 0 for Jan, 11 for Dec
  year: z.number().min(2000),
  totalWorkingDays: z.coerce.number().min(0).max(31, "Working days cannot exceed 31."),
  entries: z.array(z.object({
    studentId: z.string().min(1),
    studentName: z.string().min(1),
    daysPresent: z.coerce.number().min(0, "Days present must be a positive number.").nullable(),
  })).min(1, "At least one student entry is required."),
  markedByTeacherId: z.string().min(1),
});

export interface SubmitMonthlyAttendanceResult {
  success: boolean;
  message: string;
  error?: string;
  count?: number;
}

export async function submitMonthlyAttendance(payload: MonthlyAttendanceSubmissionPayload): Promise<SubmitMonthlyAttendanceResult> {
  try {
    const validatedPayload = monthlyAttendanceSubmissionPayloadSchema.safeParse(payload);
    if (!validatedPayload.success) {
      const errors = validatedPayload.error.errors.map(e => e.message).join(' ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid payload!' };
    }

    const { classId, schoolId, month, year, totalWorkingDays, entries, markedByTeacherId } = validatedPayload.data;

    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId) || !ObjectId.isValid(markedByTeacherId)) {
      return { success: false, message: 'Invalid ID format for class, school, or teacher.', error: 'Invalid ID format.' };
    }

    const { db } = await connectToDatabase();
    const collection = db.collection<Omit<MonthlyAttendanceRecord, '_id'>>('monthly_attendances');

    const bulkOps = entries.map(entry => {
      if (entry.daysPresent === null || entry.daysPresent > totalWorkingDays) {
        throw new Error(`Invalid days present for ${entry.studentName}. Value must be between 0 and ${totalWorkingDays}.`);
      }

      return {
        updateOne: {
          filter: {
            studentId: new ObjectId(entry.studentId),
            classId: new ObjectId(classId),
            schoolId: new ObjectId(schoolId),
            month,
            year,
          },
          update: {
            $set: {
              daysPresent: entry.daysPresent,
              totalWorkingDays: totalWorkingDays,
              markedByTeacherId: new ObjectId(markedByTeacherId),
              studentName: entry.studentName,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            }
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length === 0) {
      return { success: true, message: "No attendance data provided to submit.", count: 0 };
    }

    const result = await collection.bulkWrite(bulkOps as any);

    const processedCount = result.upsertedCount + result.modifiedCount;
    
    revalidatePath('/dashboard/teacher/attendance');
    revalidatePath('/dashboard/admin/attendance');
    revalidatePath('/dashboard/student/attendance');

    return {
      success: true,
      message: `Successfully saved monthly attendance for ${processedCount} students.`,
      count: processedCount,
    };

  } catch (error) {
    console.error('Submit monthly attendance server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during attendance submission.', error: errorMessage };
  }
}

export interface GetMonthlyAttendanceResult {
  success: boolean;
  records?: MonthlyAttendanceRecord[];
  error?: string;
  message?: string;
}

export async function getMonthlyAttendanceForClass(
  schoolId: string,
  classId: string,
  month: number,
  year: number
): Promise<GetMonthlyAttendanceResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid ID format.', error: 'Invalid ID format.' };
    }

    const { db } = await connectToDatabase();
    const records = await db.collection<MonthlyAttendanceRecord>('monthly_attendances').find({
      schoolId: new ObjectId(schoolId) as any,
      classId: new ObjectId(classId) as any,
      month,
      year,
    }).toArray();
    
    const recordsWithStrId = records.map(record => ({
      ...record,
      _id: record._id.toString(),
      schoolId: record.schoolId.toString(),
      classId: record.classId.toString(),
      studentId: record.studentId.toString(),
      markedByTeacherId: record.markedByTeacherId?.toString(),
    }));

    return { success: true, records: recordsWithStrId };
  } catch (error) {
    console.error('Get monthly attendance server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch attendance records.' };
  }
}

export async function getMonthlyAttendanceForAdmin(
  schoolId: string,
  month: number,
  year: number
): Promise<GetMonthlyAttendanceResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID format.', error: 'Invalid School ID.'};
    }

    const { db } = await connectToDatabase();
    const recordsWithDetails = await db.collection('monthly_attendances').aggregate([
      { $match: { schoolId: new ObjectId(schoolId), month, year } },
      {
        $lookup: {
          from: 'users',
          localField: 'markedByTeacherId',
          foreignField: '_id',
          as: 'teacherInfo'
        }
      },
      { $unwind: { path: '$teacherInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'school_classes',
          localField: 'classId',
          foreignField: '_id',
          as: 'classInfo'
        }
      },
      { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1, studentId: 1, studentName: 1, classId: 1, schoolId: 1,
          month: 1, year: 1, daysPresent: 1, totalWorkingDays: 1,
          markedByTeacherName: '$teacherInfo.name',
          className: { $concat: ["$classInfo.name", " - ", "$classInfo.section"] },
        }
      },
      { $sort: { className: 1, studentName: 1 } }
    ]).toArray();
    
    const clientRecords: MonthlyAttendanceRecord[] = recordsWithDetails.map(doc => ({
      _id: (doc._id as ObjectId).toString(),
      studentId: (doc.studentId as ObjectId).toString(),
      schoolId: (doc.schoolId as ObjectId).toString(),
      classId: (doc.classId as ObjectId).toString(),
      studentName: doc.studentName || 'N/A',
      className: doc.className || 'N/A',
      month: doc.month,
      year: doc.year,
      daysPresent: doc.daysPresent,
      totalWorkingDays: doc.totalWorkingDays,
      markedByTeacherName: doc.markedByTeacherName || 'N/A',
    }));

    return { success: true, records: clientRecords };
  } catch (error) {
    console.error('Get monthly admin attendance error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch monthly attendance.' };
  }
}


export async function getStudentMonthlyAttendance(studentId: string, academicYear?: string): Promise<GetMonthlyAttendanceResult> {
  try {
    if (!ObjectId.isValid(studentId)) {
      return { success: false, message: 'Invalid Student ID format.', error: 'Invalid ID format.' };
    }

    const { db } = await connectToDatabase();
    
    // Build filter query
    const filter: any = {
      studentId: new ObjectId(studentId) as any,
    };

    // If academic year is provided (e.g., "2024-2025"), extract both years
    if (academicYear) {
      const parts = academicYear.split('-');
      if (parts.length === 2) {
        const startYear = parseInt(parts[0], 10);
        const endYear = parseInt(parts[1], 10);
        // Match records from both years in the academic year range
        filter.year = { $in: [startYear, endYear] };
      }
    }

    const records = await db.collection<MonthlyAttendanceRecord>('monthly_attendances').find(filter).sort({ year: -1, month: -1 }).toArray();
    
    const recordsWithStrId = records.map(record => ({
      ...record,
      _id: record._id.toString(),
      schoolId: record.schoolId.toString(),
      classId: record.classId.toString(),
      studentId: record.studentId.toString(),
      markedByTeacherId: record.markedByTeacherId?.toString(),
    }));

    return { success: true, records: recordsWithStrId };
  } catch (error) {
    console.error('Get student monthly attendance error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch student attendance records.' };
  }
}
