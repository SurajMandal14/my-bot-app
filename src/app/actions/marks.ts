
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { MarkEntry, MarksSubmissionPayload, SubmitMarksResult, GetMarksResult } from '@/types/marks';
import { marksSubmissionPayloadSchema } from '@/types/marks';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { SchoolClass, SchoolClassSubject } from '@/types/classes';

export async function submitMarks(payload: MarksSubmissionPayload): Promise<SubmitMarksResult> {
  try {
    const validatedPayloadStructure = marksSubmissionPayloadSchema.safeParse(payload);
    if (!validatedPayloadStructure.success) {
      const errors = validatedPayloadStructure.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed for payload structure.', error: errors };
    }

    const {
      classId, className, subjectId, subjectName,
      academicYear, markedByTeacherId, schoolId, studentMarks
    } = validatedPayloadStructure.data;

    const { db } = await connectToDatabase();
    const marksCollection = db.collection<Omit<MarkEntry, '_id'>>('marks');

    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId) || !ObjectId.isValid(markedByTeacherId)) {
        return { success: false, message: 'Invalid ID format for class, school, or teacher.', error: 'Invalid ID format.' };
    }
    for (const sm of studentMarks) {
        if(!ObjectId.isValid(sm.studentId)) {
            return { success: false, message: `Invalid Student ID format: ${sm.studentId}`, error: 'Invalid Student ID.'}
        }
         if (!sm.assessmentName || sm.assessmentName.trim() === "") {
            return { success: false, message: `Assessment name missing for student ${sm.studentName}.`, error: 'Missing assessment name in student marks.'}
        }
    }

    const operations = studentMarks.map(sm => {
      const fieldsOnInsert = {
        studentId: new ObjectId(sm.studentId),
        studentName: sm.studentName,
        classId: new ObjectId(classId),
        className: className,
        subjectId: subjectId, 
        subjectName: subjectName,
        academicYear: academicYear,
        schoolId: new ObjectId(schoolId),
        createdAt: new Date(),
      };
      
      const fieldsToUpdate = {
        marksObtained: sm.marksObtained,
        maxMarks: sm.maxMarks,
        markedByTeacherId: new ObjectId(markedByTeacherId),
        updatedAt: new Date(),
      };

      return {
        updateOne: {
          filter: {
            studentId: fieldsOnInsert.studentId,
            classId: fieldsOnInsert.classId,
            subjectId: fieldsOnInsert.subjectId, 
            assessmentName: sm.assessmentName,
            academicYear: fieldsOnInsert.academicYear,
            schoolId: fieldsOnInsert.schoolId,
          },
          update: {
            $set: fieldsToUpdate,
            $setOnInsert: { ...fieldsOnInsert, assessmentName: sm.assessmentName },
          },
          upsert: true,
        },
      };
    });

    if (operations.length === 0) {
        return { success: true, message: "No marks data provided to submit.", count: 0};
    }

    const result = await marksCollection.bulkWrite(operations);
    let processedCount = result.upsertedCount + result.modifiedCount;

    revalidatePath('/dashboard/teacher/marks');
    revalidatePath('/dashboard/admin/reports/generate-cbse-state');

    return {
      success: true,
      message: `Successfully saved marks for ${processedCount} assessment entries.`,
      count: processedCount,
    };

  } catch (error) {
    console.error('Submit marks server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during marks submission.', error: errorMessage };
  }
}

export async function getMarksForAssessment(
  schoolId: string,
  classId: string,
  subjectNameParam: string,
  assessmentNameBase: string, // e.g., "FA1", "SA1"
  academicYear: string,
  paper?: 'Paper1' | 'Paper2' // New optional parameter for SA papers
): Promise<GetMarksResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID format.', error: 'Invalid ID format.' };
    }

    const { db } = await connectToDatabase();
    const marksCollection = db.collection<MarkEntry>('marks');

    // More robust regex to handle custom test names (e.g., "FA1-My Custom Test")
    const queryAssessmentFilter = { $regex: `^${assessmentNameBase}-` };
    
    let paperFilter = {};
    if (assessmentNameBase.startsWith("SA") && paper) {
        paperFilter = { assessmentName: { $regex: `^${assessmentNameBase}-${paper}-` }};
    } else if (assessmentNameBase.startsWith("SA") && !paper) {
        // If it's SA but no paper, we need to decide what to do. 
        // For now, let's assume we fetch all for that SA.
        paperFilter = { assessmentName: { $regex: `^${assessmentNameBase}-` }};
    }

    // Handle both new format (subjectId is string name) and old format (subjectId might be ObjectId)
    // Use $or to query for both string match and ObjectId match for backward compatibility with old schools
    const subjectIdFilter = {
      $or: [
        { subjectId: subjectNameParam }, // New format: subjectId is the subject name string
        ...(ObjectId.isValid(subjectNameParam) ? [{ subjectId: new ObjectId(subjectNameParam) }] : []) // Old format: subjectId might be ObjectId
      ]
    };

    const marks = await marksCollection.find({
      schoolId: new ObjectId(schoolId),
      classId: new ObjectId(classId),
      ...subjectIdFilter,
      assessmentName: queryAssessmentFilter,
      academicYear: academicYear,
      ...paperFilter
    }).toArray();

    const marksWithStrId = marks.map(mark => ({
        ...mark,
        _id: mark._id!.toString(),
        studentId: mark.studentId.toString(),
        markedByTeacherId: mark.markedByTeacherId.toString(),
        schoolId: mark.schoolId.toString(),
        classId: mark.classId.toString(),
    }));

    return { success: true, marks: marksWithStrId };

  } catch (error) {
    console.error('Get marks server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch marks.' };
  }
}


export interface SubjectForTeacher {
  value: string;
  label: string;
  classId: string;
  className: string;
  subjectName: string;
}

export async function getSubjectsForTeacher(teacherId: string, schoolId: string, academicYear: string): Promise<SubjectForTeacher[]> {
    if (!ObjectId.isValid(teacherId) || !ObjectId.isValid(schoolId)) {
        console.warn("getSubjectsForTeacher: Invalid teacherId or schoolId format provided.");
        return [];
    }
     if (!academicYear) {
        console.warn("getSubjectsForTeacher: Academic Year is required.");
        return [];
    }
    try {
        const { db } = await connectToDatabase();
        const schoolClassesCollection = db.collection<Omit<SchoolClass, '_id' | 'schoolId'> & { _id: ObjectId; schoolId: ObjectId }>('school_classes');

        const teacherObjectId = new ObjectId(teacherId);
        const schoolObjectId = new ObjectId(schoolId);

        const classesInSchool = await schoolClassesCollection.find({ 
            schoolId: schoolObjectId,
            academicYear: academicYear // Filter by academic year
        }).toArray();

        const taughtSubjects: SubjectForTeacher[] = [];

        classesInSchool.forEach(cls => {
            const classSubjects = (cls.subjects || []) as SchoolClassSubject[];

            classSubjects.forEach(subject => {
                let isMatch = false;
                if (subject.teacherId) {
                    const subjectTeacherIdStr = typeof subject.teacherId === 'string' ? subject.teacherId : subject.teacherId?.toString();
                    isMatch = subjectTeacherIdStr === teacherId;
                }

                if (isMatch) {
                    const uniqueValue = `${cls._id.toString()}_${subject.name}`;
                    if (!taughtSubjects.some(ts => ts.value === uniqueValue)) {
                        taughtSubjects.push({
                            value: uniqueValue,
                            label: `${subject.name} (${cls.name}${cls.section ? ` - ${cls.section}` : ''})`, // Include section in label
                            classId: cls._id.toString(),
                            className: cls.name,
                            subjectName: subject.name
                        });
                    }
                }
            });
        });

        return taughtSubjects.sort((a, b) => a.label.localeCompare(b.label));

    } catch (error) {
        console.error("Error fetching subjects for teacher:", error);
        return [];
    }
}

export async function getStudentMarksForReportCard(studentId: string, schoolId: string, academicYear: string): Promise<GetMarksResult> {
  try {
    if (!ObjectId.isValid(studentId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid Student or School ID format.', error: 'Invalid ID format.' };
    }
    if (!academicYear) {
      return { success: false, message: 'Academic Year is required to fetch marks.' };
    }

    const { db } = await connectToDatabase();
    const marksCollection = db.collection<MarkEntry>('marks');

    // Handle both string subjectId (new format) and any other format (old schools)
    // Simply fetch all marks for the student across all subjects
    const marks = await marksCollection.find({
      studentId: new ObjectId(studentId),
      schoolId: new ObjectId(schoolId),
      academicYear: academicYear,
    }).toArray();

    const marksWithStrId = marks.map(mark => ({
        ...mark,
        _id: mark._id!.toString(),
        studentId: mark.studentId.toString(),
        markedByTeacherId: mark.markedByTeacherId.toString(),
        schoolId: mark.schoolId.toString(),
        classId: mark.classId.toString(),
    }));

    return { success: true, marks: marksWithStrId };

  } catch (error) {
    console.error('Get student marks for report card error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch marks for report card.' };
  }
}

/**
 * Migration function to fix marks data in old schools.
 * Standardizes subjectId field to be consistent string format instead of ObjectId or mixed formats.
 * This is called automatically when fetching marks to ensure backward compatibility.
 * @param schoolId - School ID to migrate
 * @param dryRun - If true, only report what would be fixed without making changes
 */
export async function migrateOldSchoolMarksData(schoolId: string, dryRun: boolean = false): Promise<{ success: boolean; message: string; fixedCount?: number; error?: string }> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID format.', error: 'Invalid ID format.' };
    }

    const { db } = await connectToDatabase();
    const marksCollection = db.collection<MarkEntry>('marks');
    const schoolClassesCollection = db.collection('school_classes');

    // Build a map of classId -> subjects with subject names
    const classesMap = new Map<string, string[]>();
    const classesResult = await schoolClassesCollection.find({ schoolId: new ObjectId(schoolId) }).toArray();
    classesResult.forEach((cls: any) => {
      const subjectNames = (cls.subjects || []).map((s: SchoolClassSubject) => s.name);
      classesMap.set(cls._id.toString(), subjectNames);
    });

    // Find all marks where subjectId is an ObjectId (old format) or doesn't match any known subject name
    const allMarks = await marksCollection.find({ schoolId: new ObjectId(schoolId) }).toArray();
    
    const marksToFix: any[] = [];
    allMarks.forEach(mark => {
      const classSubjects = classesMap.get(mark.classId.toString()) || [];
      const subjectIdIsObjectId = ObjectId.isValid(mark.subjectId as string) && typeof mark.subjectId === 'object';
      const subjectIdIsInvalidString = typeof mark.subjectId === 'string' && !classSubjects.includes(mark.subjectId) && mark.subjectName;
      
      if (subjectIdIsObjectId || subjectIdIsInvalidString) {
        marksToFix.push({
          _id: mark._id,
          classId: mark.classId,
          currentSubjectId: mark.subjectId,
          correctSubjectId: mark.subjectName, // Use subjectName as the correct subjectId
        });
      }
    });

    if (marksToFix.length === 0) {
      return { success: true, message: 'No marks data needs migration for this school.', fixedCount: 0 };
    }

    if (dryRun) {
      return { 
        success: true, 
        message: `Found ${marksToFix.length} marks records that need migration (dry run only).`,
        fixedCount: marksToFix.length
      };
    }

    // Fix the marks by updating subjectId to be the subject name string
    const updateOperations = marksToFix.map(mark => ({
      updateOne: {
        filter: { _id: mark._id },
        update: { $set: { subjectId: mark.correctSubjectId } },
      },
    }));

    const result = await marksCollection.bulkWrite(updateOperations);
    const totalFixed = result.modifiedCount + result.upsertedCount;

    return { 
      success: true, 
      message: `Successfully migrated ${totalFixed} marks records. SubjectId standardized to string format.`,
      fixedCount: totalFixed
    };
  } catch (error) {
    console.error('Migrate old school marks data error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'Failed to migrate marks data.', error: errorMessage };
  }
}
