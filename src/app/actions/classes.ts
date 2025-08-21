
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { SchoolClass, CreateClassFormData, SchoolClassResult, SchoolClassesResult, SchoolClassSubject } from '@/types/classes';
import { createClassFormSchema, updateClassFormSchema } from '@/types/classes';
import type { User } from '@/types/user';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getStudentCountByClass } from './schoolUsers'; // Import the new action

// Helper function to update teacher's User.classId field.
// This field indicates the class for which the teacher is the primary attendance marker.
async function updateTeacherPrimaryClassAssignment(db: any, teacherId: string | ObjectId | null | undefined, newPrimaryClassIdForTeacher: string | null, schoolId: string | ObjectId) {
  if (!teacherId) return; 

  const teacherObjectId = new ObjectId(teacherId);
  const usersCollection = db.collection<User>('users');

  const teacher = await usersCollection.findOne({ _id: teacherObjectId, schoolId: new ObjectId(schoolId), role: 'teacher' });
  if (!teacher) {
    console.warn(`updateTeacherPrimaryClassAssignment: Teacher with ID ${teacherId} not found in school ${schoolId}.`);
    return;
  }
  
  await usersCollection.updateOne(
    { _id: teacherObjectId, schoolId: new ObjectId(schoolId), role: 'teacher' },
    { $set: { classId: newPrimaryClassIdForTeacher ? newPrimaryClassIdForTeacher.toString() : undefined, updatedAt: new Date() } } 
  );
  console.log(`Teacher ${teacherId} User.classId updated to ${newPrimaryClassIdForTeacher}`);
}


export async function createSchoolClass(schoolId: string, values: CreateClassFormData): Promise<SchoolClassResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID format.' };
    }

    const validatedFields = createClassFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join('; ');
      return { success: false, message: 'Validation failed', error: errors };
    }

    const { name, section, classTeacherId, subjects, secondLanguageSubjectName, academicYear } = validatedFields.data;

    const { db } = await connectToDatabase();
    const classesCollection = db.collection('school_classes'); 
    const usersCollection = db.collection<User>('users');

    const existingClass = await classesCollection.findOne({ name, section, schoolId: new ObjectId(schoolId), academicYear });
    if (existingClass) {
      return { success: false, message: `Class with name "${name}" and section "${section}" already exists for the academic year ${academicYear}.` };
    }

    let validTeacherObjectId: ObjectId | undefined = undefined;
    if (classTeacherId && classTeacherId.trim() !== "" && classTeacherId !== "__NONE_TEACHER_OPTION__") {
      if (!ObjectId.isValid(classTeacherId)) {
        return { success: false, message: 'Invalid Class Teacher ID format.' };
      }
      validTeacherObjectId = new ObjectId(classTeacherId);
      const teacherExists = await usersCollection.findOne({ _id: validTeacherObjectId, schoolId: new ObjectId(schoolId), role: 'teacher' });
      if (!teacherExists) {
        return { success: false, message: 'Selected class teacher not found or is not a teacher in this school.' };
      }

      const otherClassWithThisTeacher = await classesCollection.findOne({
        schoolId: new ObjectId(schoolId),
        classTeacherId: validTeacherObjectId,
        academicYear: academicYear,
      });
      if (otherClassWithThisTeacher) {
        const teacherDoc = await usersCollection.findOne({ _id: validTeacherObjectId });
        return { 
          success: false, 
          message: `Teacher "${teacherDoc?.name || 'Selected Teacher'}" is already assigned as class teacher to class "${otherClassWithThisTeacher.name}" for this academic year.` 
        };
      }
    }
    
    const processedSubjects: SchoolClassSubject[] = [];
    for (const s of subjects) {
        let subjectTeacherObjectId: ObjectId | undefined | null = null;
        if (s.teacherId && s.teacherId.trim() !== "" && s.teacherId !== "__NONE_TEACHER_OPTION__") {
            if (!ObjectId.isValid(s.teacherId)) {
                return { success: false, message: `Invalid Teacher ID format for subject "${s.name}".` };
            }
            subjectTeacherObjectId = new ObjectId(s.teacherId);
            const subjectTeacherExists = await usersCollection.findOne({ _id: subjectTeacherObjectId, schoolId: new ObjectId(schoolId), role: 'teacher' });
            if (!subjectTeacherExists) {
                 return { success: false, message: `Teacher assigned to subject "${s.name}" not found or is not a teacher in this school.` };
            }
        }
        processedSubjects.push({ name: s.name.trim(), teacherId: subjectTeacherObjectId });
    }
    
    if (secondLanguageSubjectName && !subjects.find(s => s.name === secondLanguageSubjectName)) {
        return { success: false, message: "Designated second language subject must be one of the offered subjects." };
    }


    const newClassDataForDb = {
      schoolId: new ObjectId(schoolId),
      name,
      section,
      academicYear,
      classTeacherId: validTeacherObjectId, 
      subjects: processedSubjects, 
      secondLanguageSubjectName: secondLanguageSubjectName || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await classesCollection.insertOne(newClassDataForDb);
    if (!result.insertedId) {
      return { success: false, message: 'Failed to create class.', error: 'Database insertion failed.' };
    }

    const createdClassId = result.insertedId;

    if (validTeacherObjectId) {
      await updateTeacherPrimaryClassAssignment(db, validTeacherObjectId, createdClassId.toString(), schoolId);
    }
    
    revalidatePath('/dashboard/admin/classes');
    
    const clientCreatedClass: SchoolClass = {
        _id: createdClassId.toString(),
        name: newClassDataForDb.name,
        section: newClassDataForDb.section,
        schoolId: newClassDataForDb.schoolId.toString(),
        academicYear: newClassDataForDb.academicYear,
        subjects: newClassDataForDb.subjects.map(s => ({
            name: s.name,
            teacherId: s.teacherId ? s.teacherId.toString() : undefined,
        })),
        secondLanguageSubjectName: newClassDataForDb.secondLanguageSubjectName,
        createdAt: newClassDataForDb.createdAt.toISOString(),
        updatedAt: newClassDataForDb.updatedAt.toISOString(),
        classTeacherId: newClassDataForDb.classTeacherId ? newClassDataForDb.classTeacherId.toString() : undefined,
        studentCount: 0,
    };

    return {
      success: true,
      message: `Class "${name} - ${section}" for ${academicYear} created successfully!`,
      class: clientCreatedClass,
    };

  } catch (error) {
    console.error('Create school class server action error:', error);
    return { success: false, message: 'An unexpected error occurred during class creation.' };
  }
}

export async function getSchoolClasses(schoolId: string): Promise<SchoolClassesResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID format.' };
    }
    const { db } = await connectToDatabase();
    
    const classesWithDetails = await db.collection('school_classes').aggregate([
      { $match: { schoolId: new ObjectId(schoolId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'classTeacherId',
          foreignField: '_id',
          as: 'classTeacherInfo',
        },
      },
      {
        $unwind: {
          path: '$classTeacherInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { class_id_str: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$role', 'student'] },
                    { $eq: ['$classId', '$$class_id_str'] },
                    { $eq: ['$schoolId', new ObjectId(schoolId)] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'studentCountArr',
        },
      },
      {
        $addFields: {
          studentCount: { $ifNull: [{ $arrayElemAt: ['$studentCountArr.count', 0] }, 0] },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          section: 1,
          schoolId: 1,
          academicYear: 1,
          classTeacherId: 1,
          classTeacherName: '$classTeacherInfo.name',
          secondLanguageSubjectName: 1,
          createdAt: 1,
          updatedAt: 1,
          subjects: 1,
          studentCount: 1,
        },
      },
      { $sort: { academicYear: -1, name: 1, section: 1 } },
    ]).toArray();


    const classIds = classesWithDetails.map(c => c._id);
    const allSubjectsInfo = await db.collection('school_classes').aggregate([
        { $match: { _id: { $in: classIds } } },
        { $unwind: '$subjects' },
        {
            $lookup: {
                from: 'users',
                localField: 'subjects.teacherId',
                foreignField: '_id',
                as: 'subjectTeacherInfo'
            }
        },
        { $unwind: { path: '$subjectTeacherInfo', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                subjects: {
                    $push: {
                        name: '$subjects.name',
                        teacherId: '$subjects.teacherId',
                        teacherName: '$subjectTeacherInfo.name'
                    }
                }
            }
        }
    ]).toArray();
    
    const subjectsMap = new Map(allSubjectsInfo.map(item => [item._id.toString(), item.subjects]));

    const classes: SchoolClass[] = classesWithDetails.map(cls => ({
      _id: (cls._id as ObjectId).toString(),
      name: cls.name || '',
      section: cls.section || '',
      schoolId: (cls.schoolId as ObjectId).toString(),
      academicYear: cls.academicYear || '',
      subjects: (subjectsMap.get(cls._id.toString()) || []).map((s: any) => ({
        name: s.name,
        teacherId: s.teacherId ? s.teacherId.toString() : undefined,
        teacherName: s.teacherName || undefined,
      })),
      secondLanguageSubjectName: cls.secondLanguageSubjectName || undefined,
      createdAt: cls.createdAt ? new Date(cls.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: cls.updatedAt ? new Date(cls.updatedAt).toISOString() : new Date().toISOString(),
      classTeacherId: cls.classTeacherId ? (cls.classTeacherId as ObjectId).toString() : undefined,
      classTeacherName: (cls as any).classTeacherName || undefined,
      studentCount: (cls as any).studentCount || 0,
    }));

    return { success: true, classes };
  } catch (error) {
    console.error('Get school classes server action error:', error);
    return { success: false, error: 'Failed to fetch classes.', message: 'An unexpected error occurred.' };
  }
}


export async function updateSchoolClass(classId: string, schoolId: string, values: CreateClassFormData): Promise<SchoolClassResult> {
  try {
    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid Class or School ID format.' };
    }

    const validatedFields = updateClassFormSchema.safeParse(values); 
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => e.message).join('; ');
      return { success: false, message: 'Validation failed', error: errors };
    }

    const { name, section, classTeacherId, subjects, secondLanguageSubjectName, academicYear } = validatedFields.data;

    const { db } = await connectToDatabase();
    const classesCollection = db.collection('school_classes'); 
    const usersCollection = db.collection<User>('users');

    const existingClassDoc = await classesCollection.findOne({ _id: new ObjectId(classId), schoolId: new ObjectId(schoolId) });
    if (!existingClassDoc) {
      return { success: false, message: 'Class not found or does not belong to this school.' };
    }

    const conflictingClass = await classesCollection.findOne({ 
      name, 
      section, 
      schoolId: new ObjectId(schoolId), 
      academicYear,
      _id: { $ne: new ObjectId(classId) } 
    });
    if (conflictingClass) {
      return { success: false, message: `Another class with name "${name}" and section "${section}" already exists for the academic year ${academicYear}.` };
    }

    let newTeacherObjectIdForClass: ObjectId | null = null; 
    if (classTeacherId && classTeacherId.trim() !== "" && classTeacherId !== "__NONE_TEACHER_OPTION__") {
        if (!ObjectId.isValid(classTeacherId)) {
             return { success: false, message: 'Invalid New Class Teacher ID format.'};
        }
        newTeacherObjectIdForClass = new ObjectId(classTeacherId);
        const teacherExists = await usersCollection.findOne({ _id: newTeacherObjectIdForClass, schoolId: new ObjectId(schoolId), role: 'teacher' });
        if (!teacherExists) {
            return { success: false, message: 'Selected new class teacher not found or is not a teacher in this school.' };
        }
        const otherClassWithThisTeacher = await classesCollection.findOne({
            schoolId: new ObjectId(schoolId),
            classTeacherId: newTeacherObjectIdForClass,
            academicYear: academicYear,
            _id: { $ne: new ObjectId(classId) } 
        });
        if (otherClassWithThisTeacher) {
            const teacherDoc = await usersCollection.findOne({ _id: newTeacherObjectIdForClass });
            return { 
                success: false, 
                message: `Teacher "${teacherDoc?.name || 'Selected Teacher'}" is already assigned as class teacher to class "${otherClassWithThisTeacher.name}" for this academic year.` 
            };
        }
    } 
    
    const oldTeacherObjectIdFromDb = existingClassDoc.classTeacherId as ObjectId | null;

    const processedSubjectsForUpdate: SchoolClassSubject[] = [];
    for (const s of subjects) {
        let subjectTeacherObjectId: ObjectId | undefined | null = null;
        if (s.teacherId && s.teacherId.trim() !== "" && s.teacherId !== "__NONE_TEACHER_OPTION__") {
             if (!ObjectId.isValid(s.teacherId)) {
                return { success: false, message: `Invalid Teacher ID format for subject "${s.name}" during update.` };
            }
            subjectTeacherObjectId = new ObjectId(s.teacherId);
             const subjectTeacherExists = await usersCollection.findOne({ _id: subjectTeacherObjectId, schoolId: new ObjectId(schoolId), role: 'teacher' });
            if (!subjectTeacherExists) {
                 return { success: false, message: `Teacher assigned to subject "${s.name}" not found during update.` };
            }
        }
        processedSubjectsForUpdate.push({ name: s.name.trim(), teacherId: subjectTeacherObjectId });
    }
    
    if (secondLanguageSubjectName && !subjects.find(s => s.name === secondLanguageSubjectName)) {
        return { success: false, message: "Designated second language subject must be one of the offered subjects." };
    }

    const updateDataForDb: Partial<any> = {
      name,
      section,
      academicYear,
      subjects: processedSubjectsForUpdate,
      classTeacherId: newTeacherObjectIdForClass, 
      secondLanguageSubjectName: secondLanguageSubjectName || undefined,
      updatedAt: new Date(),
    };

    const result = await classesCollection.updateOne(
      { _id: new ObjectId(classId) },
      { $set: updateDataForDb }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'Class not found for update.' };
    }

    if (oldTeacherObjectIdFromDb?.toString() !== newTeacherObjectIdForClass?.toString()) {
        if (oldTeacherObjectIdFromDb) {
            const oldTeacherUserDoc = await usersCollection.findOne({_id: oldTeacherObjectIdFromDb, role: 'teacher'});
            if (oldTeacherUserDoc && oldTeacherUserDoc.classId === classId.toString()) { 
                await updateTeacherPrimaryClassAssignment(db, oldTeacherObjectIdFromDb, null, schoolId); 
            }
        }
        if (newTeacherObjectIdForClass) { 
            await updateTeacherPrimaryClassAssignment(db, newTeacherObjectIdForClass, classId.toString(), schoolId); 
        }
    }
    
    revalidatePath('/dashboard/admin/classes');
    
    const updatedClassDocAfterDb = await classesCollection.findOne({ _id: new ObjectId(classId) });
     if (!updatedClassDocAfterDb) {
        return { success: false, message: "Failed to retrieve class after update." };
    }

    const clientUpdatedClass: SchoolClass = {
        _id: updatedClassDocAfterDb._id.toString(),
        name: updatedClassDocAfterDb.name,
        section: updatedClassDocAfterDb.section,
        schoolId: (updatedClassDocAfterDb.schoolId as ObjectId).toString(),
        academicYear: updatedClassDocAfterDb.academicYear,
        subjects: (updatedClassDocAfterDb.subjects as any[]).map(s => ({
            name: s.name,
            teacherId: s.teacherId ? s.teacherId.toString() : undefined,
        })),
        secondLanguageSubjectName: updatedClassDocAfterDb.secondLanguageSubjectName,
        createdAt: new Date(updatedClassDocAfterDb.createdAt).toISOString(),
        updatedAt: new Date(updatedClassDocAfterDb.updatedAt).toISOString(),
        classTeacherId: updatedClassDocAfterDb.classTeacherId ? (updatedClassDocAfterDb.classTeacherId as ObjectId).toString() : undefined,
        classTeacherName: undefined, 
        studentCount: 0,
    };
    return { success: true, message: 'Class updated successfully!', class: clientUpdatedClass };

  } catch (error) {
    console.error('Update school class server action error:', error);
    return { success: false, message: 'An unexpected error occurred during class update.' };
  }
}

export async function deleteSchoolClass(classId: string, schoolId: string): Promise<SchoolClassResult> {
  try {
    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid Class or School ID format.' };
    }

    const { db } = await connectToDatabase();
    const classesCollection = db.collection('school_classes'); 
    const usersCollection = db.collection<User>('users');

    const classToDelete = await classesCollection.findOne({ _id: new ObjectId(classId), schoolId: new ObjectId(schoolId) });
    if (!classToDelete) {
      return { success: false, message: 'Class not found or does not belong to this school.' };
    }

    // When deleting a class, we should update students assigned to this class's _id.
    // The student's classId field stores the SchoolClass _id string.
    await usersCollection.updateMany(
      { schoolId: new ObjectId(schoolId), role: 'student', classId: classToDelete._id.toString() },
      { $set: { classId: undefined, section: undefined, updatedAt: new Date() } } // Also clear section
    );
    
    if (classToDelete.classTeacherId) {
        const teacher = await usersCollection.findOne({_id: classToDelete.classTeacherId as ObjectId, role: 'teacher'});
        if(teacher && teacher.classId === classToDelete._id.toString()){ 
            await updateTeacherPrimaryClassAssignment(db, classToDelete.classTeacherId as ObjectId, null, schoolId); 
        }
    }

    const result = await classesCollection.deleteOne({ _id: new ObjectId(classId) });

    if (result.deletedCount === 0) {
      return { success: false, message: 'Failed to delete class or class not found.' };
    }
    
    revalidatePath('/dashboard/admin/classes');
    revalidatePath('/dashboard/admin/users'); 
    revalidatePath('/dashboard/admin/students');
    revalidatePath('/dashboard/teacher/attendance'); 

    return { success: true, message: `Class "${classToDelete.name} - ${classToDelete.section}" deleted successfully.` };

  } catch (error) {
    console.error('Delete school class server action error:', error);
    return { success: false, message: 'An unexpected error occurred during class deletion.' };
  }
}

export async function getClassesForSchoolAsOptions(schoolId: string): Promise<{ value: string; label: string; section?: string; name?: string; }[]> {
  if (!ObjectId.isValid(schoolId)) {
    return [];
  }
  try {
    const { db } = await connectToDatabase();
    const classes = await db.collection('school_classes') 
      .find({ schoolId: new ObjectId(schoolId) })
      .project({ _id: 1, name: 1, section: 1, academicYear: 1 })
      .sort({ academicYear: -1, name: 1, section: 1 })
      .toArray();
    
    return classes.map(cls => ({ 
        value: (cls._id as ObjectId).toString(), 
        label: `${cls.name}${cls.section ? ` - ${cls.section}` : ''} (${cls.academicYear})`,
        name: cls.name as string, // Store original name
        section: cls.section as string | undefined // Store section
    }));
  } catch (error) {
    console.error("Error fetching classes for options:", error);
    return [];
  }
}

export interface GetClassDetailsByIdResult {
  success: boolean;
  classDetails?: SchoolClass;
  error?: string;
  message?: string;
}

export async function getClassDetailsById(classId: string, schoolId: string): Promise<GetClassDetailsByIdResult> {
  try {
    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid Class or School ID format.' };
    }
    const { db } = await connectToDatabase();
    
    const classDetailsArray = await db.collection('school_classes').aggregate([
      { $match: { _id: new ObjectId(classId), schoolId: new ObjectId(schoolId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'classTeacherId',
          foreignField: '_id',
          as: 'classTeacherInfo'
        }
      },
      { $unwind: { path: '$classTeacherInfo', preserveNullAndEmptyArrays: true } },
      {
        $unwind: {
          path: '$subjects',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'subjects.teacherId',
          foreignField: '_id',
          as: 'subjectTeacherInfo'
        }
      },
      { $unwind: { path: '$subjectTeacherInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          section: { $first: '$section' },
          schoolId: { $first: '$schoolId' },
          academicYear: { $first: '$academicYear' },
          classTeacherId: { $first: '$classTeacherId' },
          classTeacherName: { $first: '$classTeacherInfo.name' },
          secondLanguageSubjectName: { $first: '$secondLanguageSubjectName' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          subjects: { 
            $push: {
              name: '$subjects.name',
              teacherId: '$subjects.teacherId',
              teacherName: '$subjectTeacherInfo.name'
            }
          }
        }
      },
      {
        $project: {
          _id: 1, name: 1, section: 1, schoolId: 1, academicYear: 1, classTeacherId: 1, classTeacherName: 1, secondLanguageSubjectName: 1, createdAt: 1, updatedAt: 1,
          subjects: {
            $filter: {
                 input: "$subjects",
                 as: "subject",
                 cond: { $ne: [ "$$subject.name", null ] }
            }
          }
        }
      }
    ]).toArray();

    if (!classDetailsArray || classDetailsArray.length === 0) {
      return { success: false, message: 'Class not found.' };
    }
    
    const studentCountResult = await getStudentCountByClass(schoolId, classId);

    const cls = classDetailsArray[0];
    const classDetails: SchoolClass = {
      _id: (cls._id as ObjectId).toString(),
      name: cls.name || '',
      section: cls.section || '',
      schoolId: (cls.schoolId as ObjectId).toString(),
      academicYear: cls.academicYear || '',
      subjects: (cls.subjects || []).map((s: any) => ({
        name: s.name,
        teacherId: s.teacherId ? s.teacherId.toString() : undefined,
        teacherName: s.teacherName || undefined,
      })),
      secondLanguageSubjectName: cls.secondLanguageSubjectName || undefined,
      createdAt: cls.createdAt ? new Date(cls.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: cls.updatedAt ? new Date(cls.updatedAt).toISOString() : new Date().toISOString(),
      classTeacherId: cls.classTeacherId ? (cls.classTeacherId as ObjectId).toString() : undefined,
      classTeacherName: cls.classTeacherName || undefined,
      studentCount: studentCountResult.success ? studentCountResult.count : 0,
    };

    return { success: true, classDetails };
  } catch (error) {
    console.error('Get class details by ID error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch class details.' };
  }
}
