

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
    // Normalize incoming payload to ensure each student mark has `assessmentName`.
    // Accept two shapes from clients: { assessmentName } or { assessmentKey, testKey }.
    const payloadForValidation = JSON.parse(JSON.stringify(payload));
    if (Array.isArray(payloadForValidation.studentMarks)) {
      payloadForValidation.studentMarks = payloadForValidation.studentMarks.map((sm: any) => {
        const copy = { ...sm };
        if (!copy.assessmentName && copy.assessmentKey && copy.testKey) {
          copy.assessmentName = `${copy.assessmentKey}-${copy.testKey}`;
          // Keep original keys for backward compatibility but ensure schema required field exists
        }
        return copy;
      });
    }

    const validatedPayloadStructure = marksSubmissionPayloadSchema.safeParse(payloadForValidation);
    if (!validatedPayloadStructure.success) {
      const errors = validatedPayloadStructure.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed for payload structure.', error: errors };
    }

    const {
      classId, className, subjectName,
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
    }

    const operations = studentMarks.map(sm => {
      // Add assessmentName for easier report mapping
      const assessmentName = `${sm.assessmentKey}-${sm.testKey}`;
      const fieldsOnInsert = {
        studentId: new ObjectId(sm.studentId),
        studentName: sm.studentName,
        classId: new ObjectId(classId),
        className: className,
        subjectId: subjectName, // Standardize on subjectName
        subjectName: subjectName,
        assessmentKey: sm.assessmentKey,
        testKey: sm.testKey,
        assessmentName, // NEW FIELD
        academicYear: academicYear,
        schoolId: new ObjectId(schoolId),
        createdAt: new Date(),
      };
      
      const fieldsToUpdate = {
        marksObtained: sm.marksObtained,
        maxMarks: sm.maxMarks,
        markedByTeacherId: new ObjectId(markedByTeacherId),
        updatedAt: new Date(),
        assessmentName, // Ensure always present on update
      };

      return {
        updateOne: {
          filter: {
            studentId: fieldsOnInsert.studentId,
            classId: fieldsOnInsert.classId,
            subjectName: fieldsOnInsert.subjectName, 
            assessmentKey: fieldsOnInsert.assessmentKey,
            testKey: fieldsOnInsert.testKey,
            academicYear: fieldsOnInsert.academicYear,
            schoolId: fieldsOnInsert.schoolId,
            // DO NOT include assessmentName in filter
          },
          update: {
            $set: fieldsToUpdate,
            $setOnInsert: { ...fieldsOnInsert },
          },
          upsert: true,
        },
      };
    });

    if (operations.length === 0) {
        return { success: true, message: "No marks data provided to submit.", count: 0};
    }

    const result = await marksCollection.bulkWrite(operations as any);
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
  assessmentKey: string,
  academicYear: string,
): Promise<GetMarksResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID format.', error: 'Invalid ID format.' };
    }

    const { db } = await connectToDatabase();
    const marksCollection = db.collection<MarkEntry>('marks');
    
    // The query should filter by subjectName (which is passed in subjectNameParam)
    // and the assessmentKey.
    const query = {
      schoolId: new ObjectId(schoolId),
      classId: new ObjectId(classId),
      subjectName: subjectNameParam, // Use subjectNameParam which is the subject's name
      assessmentKey: assessmentKey,
      academicYear: academicYear,
    };
    
    const marks = await marksCollection.find(query).toArray();

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
  subjectId: string; // Standardized to be the subject name
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
                            subjectId: subject.name, // Use name as the consistent ID
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

