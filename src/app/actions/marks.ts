
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

    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ');
    const {
      classId, className, subjectId, subjectName,
      academicYear, markedByTeacherId, schoolId, studentMarks
    } = validatedPayloadStructure.data;

    const { db } = await connectToDatabase();
    const marksCollection = db.collection<Omit<MarkEntry, '_id'>>('marks');
    const schoolsCollection = db.collection('schools');

    // Check if marks entry is locked for this assessment
    if (studentMarks.length > 0) {
      const school = await schoolsCollection.findOne({ _id: new ObjectId(schoolId) });
      if (school) {
        const marksEntryLocks = school.marksEntryLocks as Record<string, Record<string, boolean>> | undefined;
        const yearLocks = marksEntryLocks?.[academicYear];
        
        if (yearLocks) {
          // Extract assessment prefix from the first student's marks (should all be the same)
          const firstAssessmentName = studentMarks[0]?.assessmentName || '';
          const assessmentPrefix = firstAssessmentName.split('-')[0]?.toUpperCase() || '';
          
          // Check if this assessment is locked
          if (yearLocks[assessmentPrefix]) {
            return {
              success: false,
              message: `Marks entry for ${assessmentPrefix} is currently locked for academic year ${academicYear}.`,
              error: `${assessmentPrefix} entry is locked.`
            };
          }
        }
      }
    }

    // Ensure the unique index matches our upsert filter and includes subjectId
    try {
      const indexes = await marksCollection.indexes();
      for (const idx of indexes) {
        const keys = Object.keys(idx.key || {});
        const hasSubject = keys.includes('subjectId');
        const hasAllWithoutSubject = ['studentId','classId','assessmentName','academicYear','schoolId']
          .every(k => keys.includes(k));
        if (idx.unique && hasAllWithoutSubject && !hasSubject) {
          // Drop outdated unique index that omits subjectId (causes conflicts across multiple subjects)
          try { await marksCollection.dropIndex(idx.name!); } catch {}
        }
      }
      await marksCollection.createIndex(
        { studentId: 1, classId: 1, subjectId: 1, assessmentName: 1, academicYear: 1, schoolId: 1 },
        { unique: true, name: 'marks_unique_composite' }
      ).catch(() => {});
    } catch {}

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

    const normalizedSubjectId = normalize(subjectId);
    const normalizedSubjectName = normalize(subjectName);

    const operations = studentMarks.map(sm => {
      // Normalize assessment name as <group>-<test> with trimmed single-space components
      const parts = (sm.assessmentName || '').split('-');
      const groupPart = normalize(parts[0] || '');
      const testPart = normalize(parts.slice(1).join('-'));
      // const normalizedAssessmentName = `${groupPart}-${testPart}`;
      const normalizedAssessmentName = sm.assessmentName;
      console.log(normalizedAssessmentName)

      const fieldsOnInsert = {
        studentId: new ObjectId(sm.studentId),
        studentName: sm.studentName,
        classId: new ObjectId(classId),
        className: className,
        subjectId: normalizedSubjectId,
        subjectName: normalizedSubjectName,
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
            assessmentName: normalizedAssessmentName,
            academicYear: fieldsOnInsert.academicYear,
            schoolId: fieldsOnInsert.schoolId,
          },
          update: {
            $set: fieldsToUpdate,
            $setOnInsert: { ...fieldsOnInsert, assessmentName: normalizedAssessmentName },
          },
          upsert: true,
        },
      };
    });

    if (operations.length === 0) {
        return { success: true, message: "No marks data provided to submit.", count: 0};
    }

    let processedCount = 0;
    try {
      const result = await marksCollection.bulkWrite(operations, { ordered: false });
      processedCount = result.upsertedCount + result.modifiedCount;
    } catch (bulkErr: any) {
      // If a duplicate key error occurs, return a clear message
      if (bulkErr?.code === 11000) {
        return {
          success: false,
          message: 'Duplicate key error while saving marks. Likely due to an outdated unique index not including subjectId.',
          error: bulkErr?.message || 'Duplicate key',
        };
      }
      // Fallback: try sequential upserts so we can salvage valid entries
      let successCount = 0;
      for (const op of operations) {
        try {
          const r = await marksCollection.updateOne(op.updateOne.filter, op.updateOne.update as any, { upsert: true });
          if (r.upsertedCount || r.modifiedCount || r.matchedCount) successCount++;
        } catch {}
      }
      if (successCount === 0) {
        const errorMessage = bulkErr instanceof Error ? bulkErr.message : 'Bulk write failed';
        return { success: false, message: 'Bulk write failed during marks submission.', error: errorMessage };
      }
      processedCount = successCount;
    }

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
    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ');
    const base = normalize(assessmentNameBase);
    const queryAssessmentFilter = { $regex: `^${base}-` };
    
    let paperFilter = {};
    if (assessmentNameBase.startsWith("SA") && paper) {
        paperFilter = { assessmentName: { $regex: `^${assessmentNameBase}-${paper}-` }};
    } else if (assessmentNameBase.startsWith("SA") && !paper) {
        // If it's SA but no paper, we need to decide what to do. 
        // For now, let's assume we fetch all for that SA.
        paperFilter = { assessmentName: { $regex: `^${assessmentNameBase}-` }};
    }
    console.log(assessmentNameBase, queryAssessmentFilter, paperFilter);

    const marks = await marksCollection.find({
      schoolId: new ObjectId(schoolId),
      classId: new ObjectId(classId),
      subjectId: normalize(subjectNameParam),
      assessmentName: queryAssessmentFilter, 
      academicYear: academicYear,
      ...paperFilter
    })
    .sort({ updatedAt: -1 as 1 | -1, createdAt: -1 as 1 | -1 })
    .toArray();

    const marksWithStrId = marks.map(mark => ({
        ...mark,
        _id: mark._id!.toString(),
        studentId: mark.studentId.toString(),
        markedByTeacherId: mark.markedByTeacherId.toString(),
        schoolId: mark.schoolId.toString(),
        classId: mark.classId.toString(),
    }));


    console.log(`Fetched ${marksWithStrId.length} marks for assessment ${assessmentNameBase} in classId ${classId}, subject ${subjectNameParam}.`);    return { success: true, marks: marksWithStrId };

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
