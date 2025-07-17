

'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import type { User, UserRole, Address } from '@/types/user';
import { createSchoolUserFormSchema, type CreateSchoolUserFormData, updateSchoolUserFormSchema, type UpdateSchoolUserFormData } from '@/types/user';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import type { SchoolClass } from '@/types/classes';


export interface CreateSchoolUserResult {
  success: boolean;
  message: string;
  error?: string;
  user?: Partial<User>;
}

export async function createSchoolUser(values: CreateSchoolUserFormData, schoolId: string): Promise<CreateSchoolUserResult> {
  try {
    const validatedFields = createSchoolUserFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID provided for user creation.', error: 'Invalid School ID.'};
    }

    const { 
        name, email, password, role, classId, admissionId, 
        busRouteLocation, busClassCategory,
        fatherName, motherName, dob, section, rollNo, examNo, aadharNo, dateOfJoining, academicYear,
        // New detailed fields
        gender, bloodGroup, nationality, religion, caste, subcaste, pwd, identificationMarks,
        presentAddress, permanentAddress, fatherMobile, motherMobile, fatherAadhar, motherAadhar,
        fatherQualification, motherQualification, fatherOccupation, motherOccupation,
        rationCardNumber, isTcAttached, previousSchool, childIdNumber, motherTongue, qualification
    } = validatedFields.data;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<Omit<User, '_id'>>('users');

    const existingUserByEmail = await usersCollection.findOne({ email });
    if (existingUserByEmail) {
      return { success: false, message: 'User with this email already exists.', error: 'Email already in use.' };
    }

    if (role === 'student' && admissionId && admissionId.trim() !== "") {
        const trimmedAdmissionId = admissionId.trim();
        const existingUserByAdmissionId = await usersCollection.findOne({ 
            admissionId: trimmedAdmissionId, 
            schoolId: new ObjectId(schoolId), 
            role: 'student' 
        });
        if (existingUserByAdmissionId) {
            return { 
                success: false, 
                message: `Admission ID '${trimmedAdmissionId}' is already in use for another student in this school.`, 
                error: 'Admission ID already taken.' 
            };
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userSchoolId = new ObjectId(schoolId);

    const newUser: Omit<User, '_id' | 'createdAt' | 'updatedAt'> & { createdAt: Date, updatedAt: Date } = {
      name,
      email,
      password: hashedPassword,
      role: role as UserRole,
      status: 'active',
      schoolId: userSchoolId,
      classId: (classId && classId.trim() !== "" && ObjectId.isValid(classId)) ? classId.trim() : undefined,
      admissionId: role === 'student' ? (admissionId && admissionId.trim() !== "" ? admissionId.trim() : undefined) : undefined,
      busRouteLocation: role === 'student' ? (busRouteLocation && busRouteLocation.trim() !== "" ? busRouteLocation.trim() : undefined) : undefined,
      busClassCategory: role === 'student' ? (busClassCategory && busClassCategory.trim() !== "" ? busClassCategory.trim() : undefined) : undefined,
      fatherName: fatherName,
      motherName: motherName,
      dob: dob,
      section: role === 'student' ? section : undefined,
      rollNo: role === 'student' ? rollNo : undefined,
      examNo: role === 'student' ? examNo : undefined,
      aadharNo: aadharNo,
      dateOfJoining: dateOfJoining || undefined,
      academicYear: academicYear,
      qualification: role === 'teacher' ? qualification : undefined,
      // New fields
      gender, bloodGroup, nationality, religion, caste, subcaste, pwd, identificationMarks,
      presentAddress, permanentAddress, fatherMobile, motherMobile, fatherAadhar, motherAadhar,
      fatherQualification, motherQualification, fatherOccupation, motherOccupation,
      rationCardNumber, isTcAttached, previousSchool, childIdNumber, motherTongue,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    if (!result.insertedId) {
      return { success: false, message: 'Failed to create user.', error: 'Database insertion failed.' };
    }

    revalidatePath('/dashboard/admin/students');
    revalidatePath('/dashboard/admin/teachers');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = newUser;
    return {
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully!`,
      user: {
        ...userWithoutPassword,
        _id: result.insertedId.toString(),
        schoolId: userSchoolId.toString(),
        createdAt: newUser.createdAt.toISOString(),
        updatedAt: newUser.updatedAt.toISOString(),
      },
    };

  } catch (error) {
    console.error('Create school user server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during user creation.', error: errorMessage };
  }
}

export interface GetSchoolUsersResult {
  success: boolean;
  users?: Partial<User>[];
  error?: string;
  message?: string;
}

export async function getSchoolUsers(schoolId: string): Promise<GetSchoolUsersResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID format for fetching users.', error: 'Invalid School ID.'};
    }
    const { db } = await connectToDatabase();

    const usersFromDb = await db.collection('users').find({
      schoolId: new ObjectId(schoolId) as any,
      role: { $in: ['teacher', 'student'] }
    }).sort({ createdAt: -1 }).toArray();

    const users = usersFromDb.map(userDoc => {
      const user = userDoc as unknown as User; 
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        _id: user._id.toString(),
        schoolId: user.schoolId?.toString(),
      };
    });

    return { success: true, users: users as Partial<User>[] };
  } catch (error) {
    console.error('Get school users server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch school users.' };
  }
}


export interface UpdateSchoolUserResult {
  success: boolean;
  message: string;
  error?: string;
  user?: Partial<User>;
}

export async function updateSchoolUser(userId: string, schoolId: string, values: UpdateSchoolUserFormData): Promise<UpdateSchoolUserResult> {
  try {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid User or School ID format.', error: 'Invalid ID.' };
    }

    const validatedFields = updateSchoolUserFormSchema.safeParse(values);
    if (!validatedFields.success) {
      const errors = validatedFields.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid fields!' };
    }

    const { 
        name, email, password, role, classId, admissionId, 
        enableBusTransport, busRouteLocation, busClassCategory,
        fatherName, motherName, dob, section, rollNo, examNo, aadharNo, dateOfJoining, dateOfLeaving, academicYear,
        // New detailed fields
        gender, bloodGroup, nationality, religion, caste, subcaste, pwd, identificationMarks,
        presentAddress, permanentAddress, fatherMobile, motherMobile, fatherAadhar, motherAadhar,
        fatherQualification, motherQualification, fatherOccupation, motherOccupation,
        rationCardNumber, isTcAttached, previousSchool, childIdNumber, motherTongue, qualification
    } = validatedFields.data;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const existingUser = await usersCollection.findOne({ _id: new ObjectId(userId) as any });
    if (!existingUser || existingUser.schoolId?.toString() !== schoolId) {
      return { success: false, message: 'User not found or does not belong to this school.', error: 'User mismatch.' };
    }

    const existingUserByEmail = await usersCollection.findOne({ email });
    if (existingUserByEmail && existingUserByEmail._id.toString() !== userId) {
      return { success: false, message: 'This email is already in use by another account.', error: 'Email already in use.' };
    }

    if (role === 'student' && admissionId && admissionId.trim() !== "") {
        const trimmedAdmissionId = admissionId.trim();
        const existingUserByAdmissionId = await usersCollection.findOne({
            admissionId: trimmedAdmissionId,
            schoolId: new ObjectId(schoolId),
            role: 'student',
            _id: { $ne: new ObjectId(userId) }
        });
        if (existingUserByAdmissionId) {
            return { 
                success: false, 
                message: `Admission ID '${trimmedAdmissionId}' is already in use for another student in this school.`, 
                error: 'Admission ID already taken.' 
            };
        }
    }

    const updateData: Partial<Omit<User, '_id' | 'createdAt'>> & { updatedAt: Date } = {
      name,
      email,
      classId: (role === 'student' && classId && classId.trim() !== "" && ObjectId.isValid(classId)) ? classId.trim() : undefined,
      updatedAt: new Date(),
      dateOfJoining: dateOfJoining || undefined,
      dateOfLeaving: dateOfLeaving || undefined,
      academicYear: academicYear,
      role: role as UserRole,
      admissionId: (role === 'student' && admissionId && admissionId.trim() !== "") ? admissionId.trim() : undefined,
      busRouteLocation: (role === 'student' && enableBusTransport && busRouteLocation && busRouteLocation.trim() !== "") ? busRouteLocation.trim() : undefined,
      busClassCategory: (role === 'student' && enableBusTransport && busClassCategory && busClassCategory.trim() !== "") ? busClassCategory.trim() : undefined,
      fatherName, motherName, dob, section, rollNo, examNo, aadharNo,
      gender, bloodGroup, nationality, religion, caste, subcaste, pwd, identificationMarks,
      presentAddress, permanentAddress, fatherMobile, motherMobile, fatherAadhar, motherAadhar,
      fatherQualification, motherQualification, fatherOccupation, motherOccupation,
      rationCardNumber, isTcAttached, previousSchool, childIdNumber, motherTongue,
      qualification: role === 'teacher' ? qualification : undefined,
    };
    
    if (role === 'student' && !enableBusTransport) {
      updateData.busRouteLocation = undefined;
      updateData.busClassCategory = undefined;
    }


    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) as any, schoolId: new ObjectId(schoolId) as any },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'User not found for update.', error: 'User not found.' };
    }

    revalidatePath('/dashboard/admin/students');
    revalidatePath('/dashboard/admin/teachers');

    const updatedUserDoc = await usersCollection.findOne({ _id: new ObjectId(userId) as any });
    if (!updatedUserDoc) {
      return { success: false, message: 'Failed to retrieve user after update.', error: 'Could not fetch updated user.' };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...userWithoutPassword } = updatedUserDoc;

    return {
      success: true,
      message: 'User updated successfully!',
      user: {
        ...userWithoutPassword,
        _id: updatedUserDoc._id.toString(),
        schoolId: updatedUserDoc.schoolId?.toString(),
      }
    };

  } catch (error) {
    console.error('Update school user server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during user update.', error: errorMessage };
  }
}

export interface DeleteSchoolUserResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function deleteSchoolUser(userId: string, schoolId: string): Promise<DeleteSchoolUserResult> {
  try {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid User or School ID format.', error: 'Invalid ID.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const result = await usersCollection.deleteOne({
      _id: new ObjectId(userId) as any,
      schoolId: new ObjectId(schoolId) as any,
      role: { $in: ['teacher', 'student'] }
    });

    if (result.deletedCount === 0) {
      return { success: false, message: 'User not found or already deleted.', error: 'User not found.' };
    }

    revalidatePath('/dashboard/admin/users');
    return { success: true, message: 'User permanently deleted successfully!' };

  } catch (error) {
    console.error('Delete school user server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during user deletion.', error: errorMessage };
  }
}

export interface UpdateUserStatusResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function updateUserStatus(userId: string, schoolId: string, status: 'active' | 'discontinued'): Promise<UpdateUserStatusResult> {
  try {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid User or School ID format.', error: 'Invalid ID.' };
    }
    if (status !== 'active' && status !== 'discontinued') {
      return { success: false, message: 'Invalid status provided.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) as any, schoolId: new ObjectId(schoolId) as any },
      { $set: { status: status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'User not found.', error: 'User not found.' };
    }

    revalidatePath('/dashboard/admin/students');
    revalidatePath('/dashboard/admin/teachers');

    return { success: true, message: `User status successfully updated to ${status}.` };

  } catch (error) {
    console.error('Update user status server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during status update.', error: errorMessage };
  }
}


export async function getStudentsByClass(schoolId: string, classId: string, academicYear: string): Promise<GetSchoolUsersResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID format.', error: 'Invalid ID format.' };
    }
     if (!academicYear) {
      return { success: false, message: 'Academic Year is required.', error: 'Invalid Academic Year.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const studentsFromDb = await usersCollection.find({
      schoolId: new ObjectId(schoolId) as any,
      classId: classId, 
      role: 'student',
      academicYear: academicYear, // Filter by academic year
    }).project({ password: 0 }).sort({ name: 1 }).toArray();

    const users = studentsFromDb.map(studentDoc => {
      const student = studentDoc as unknown as User;
      return {
        ...student,
        _id: student._id.toString(),
        schoolId: student.schoolId?.toString(),
      };
    });

    return { success: true, users: users as Partial<User>[] };
  } catch (error) {
    console.error('Get students by class server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch students for the class.' };
  }
}

export interface SchoolUserRoleCounts {
  students: number;
  teachers: number;
}
export interface GetSchoolUserRoleCountsResult {
  success: boolean;
  counts?: SchoolUserRoleCounts;
  error?: string;
  message?: string;
}

export async function getSchoolUserRoleCounts(schoolId: string): Promise<GetSchoolUserRoleCountsResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID format.', error: 'Invalid School ID.' };
    }
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const studentCount = await usersCollection.countDocuments({ schoolId: new ObjectId(schoolId) as any, role: 'student' });
    const teacherCount = await usersCollection.countDocuments({ schoolId: new ObjectId(schoolId) as any, role: 'teacher' });

    return { success: true, counts: { students: studentCount, teachers: teacherCount } };
  } catch (error) {
    console.error('Get school user role counts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch user role counts.' };
  }
}

export interface GetStudentCountByClassResult {
  success: boolean;
  count?: number;
  error?: string;
  message?: string;
}

export async function getStudentCountByClass(schoolId: string, classId: string): Promise<GetStudentCountByClassResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID format.', error: 'Invalid ID.' };
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const count = await usersCollection.countDocuments({
      schoolId: new ObjectId(schoolId) as any,
      classId: classId, // classId is the _id (string)
      role: 'student'
    });

    return { success: true, count };
  } catch (error) {
    console.error('Get student count by class server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch student count for the class.' };
  }
}

export interface StudentDetailsForReportCard {
    _id: string; 
    name: string;
    admissionId?: string;
    classId?: string; 
    schoolId?: string; 
    // New fields
    fatherName?: string;
    motherName?: string;
    dob?: string;
    section?: string;
    rollNo?: string;
    examNo?: string;
    aadharNo?: string;
    udiseCodeSchoolName?: string; // Placeholder for school name
}
export interface GetStudentDetailsForReportCardResult {
  success: boolean;
  student?: StudentDetailsForReportCard;
  error?: string;
  message?: string;
}

export async function getStudentDetailsForReportCard(admissionIdQuery: string, schoolIdQuery: string, academicYear: string): Promise<GetStudentDetailsForReportCardResult> {
  try {
    if (!admissionIdQuery || admissionIdQuery.trim() === "") {
      return { success: false, message: 'Admission ID cannot be empty.', error: 'Invalid Admission ID.' };
    }
    if (!ObjectId.isValid(schoolIdQuery)) {
      return { success: false, message: 'Invalid School ID format.', error: 'Invalid School ID.' };
    }
    if (!academicYear) {
      return { success: false, message: 'Academic Year is required.', error: 'Invalid Academic Year.' };
    }


    const { db } = await connectToDatabase();
    const usersCollection = db.collection<User>('users');

    const studentDoc = await usersCollection.findOne({ 
        admissionId: admissionIdQuery, 
        schoolId: new ObjectId(schoolIdQuery) as any,
        role: 'student',
        academicYear: academicYear,
    });

    if (!studentDoc) {
      return { success: false, message: `Student with Admission ID '${admissionIdQuery}' not found in this school for the academic year ${academicYear}.`, error: 'Student not found.' };
    }
    
    const student = studentDoc as User; // Type assertion

    const studentDetails: StudentDetailsForReportCard = {
      _id: student._id.toString(), 
      name: student.name,
      admissionId: student.admissionId,
      classId: student.classId, 
      schoolId: student.schoolId?.toString(),
      fatherName: student.fatherName,
      motherName: student.motherName,
      dob: student.dob,
      section: student.section,
      rollNo: student.rollNo,
      examNo: student.examNo,
      aadharNo: student.aadharNo,
    };

    return { success: true, student: studentDetails };
  } catch (error) {
    console.error('Get student details for report card by admission ID error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch student details for report card.' };
  }
}

// New action for bulk creating students from import
export interface BulkCreateSchoolUsersResult {
  success: boolean;
  message: string;
  error?: string;
  importedCount?: number;
  skippedCount?: number;
}

export async function bulkCreateSchoolUsers(
  users: Partial<User>[], 
  schoolId: string
): Promise<BulkCreateSchoolUsersResult> {
  if (!ObjectId.isValid(schoolId)) {
    return { success: false, message: 'Invalid School ID.' };
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const schoolObjectId = new ObjectId(schoolId);
    
    // Fetch all classes for the school once to avoid repeated DB calls
    const existingClasses = await db.collection<SchoolClass>('school_classes')
        .find({ schoolId: schoolObjectId })
        .toArray();
    
    const classNameToIdMap = new Map<string, string>();
    existingClasses.forEach(cls => {
        classNameToIdMap.set(cls.name, cls._id.toString());
    });
    
    const usersToInsert: Omit<User, '_id'>[] = [];
    let skippedCount = 0;
    
    for (const user of users) {
      // Basic validation for each user
      if (!user.name || !user.admissionId || !user.classId || !user.academicYear) {
        skippedCount++;
        continue;
      }
      
      // Class validation
      const targetClassId = classNameToIdMap.get(user.classId);
      if (!targetClassId) {
        skippedCount++; // Skip if class does not exist
        continue;
      }


      // Check for existing users by admission ID (for the given school) or by email (globally)
      const orConditions = [{ admissionId: user.admissionId, schoolId: schoolObjectId }];
      if (user.email) {
        orConditions.push({ email: user.email } as any);
      }
      
      const existingUser = await usersCollection.findOne({ $or: orConditions });
      if (existingUser) {
        skippedCount++;
        continue;
      }
      
      // Use provided email or generate one
      const userEmail = user.email || `${user.admissionId}@gmail.com`;
      
      // Use provided password or generate one from DOB
      let passwordSource = 'password123'; // Default password
      if (user.password) {
        passwordSource = String(user.password);
      } else if (user.dob) {
        // Date can come as MM/DD/YYYY from our import processing
        const dobAsPassword = user.dob.replace(/[\/\-]/g, '');
        if (dobAsPassword.length >= 6) { // Basic check
          passwordSource = dobAsPassword;
        }
      }
      const hashedPassword = await bcrypt.hash(passwordSource, 10);
      
      // Reconstruct nested address objects
      const presentAddress: Address = {
        houseNo: (user as any).presentAddress_houseNo,
        street: (user as any).presentAddress_street,
        village: (user as any).presentAddress_village,
        mandal: (user as any).presentAddress_mandal,
        district: (user as any).presentAddress_district,
        state: (user as any).presentAddress_state,
      };

      const permanentAddress: Address = {
        houseNo: (user as any).permanentAddress_houseNo,
        street: (user as any).permanentAddress_street,
        village: (user as any).permanentAddress_village,
        mandal: (user as any).permanentAddress_mandal,
        district: (user as any).permanentAddress_district,
        state: (user as any).permanentAddress_state,
      };
      
      const newUser: Omit<User, '_id'> = {
        name: user.name,
        email: userEmail,
        password: hashedPassword,
        role: 'student',
        status: 'active',
        schoolId: schoolObjectId,
        classId: targetClassId,
        admissionId: user.admissionId,
        fatherName: user.fatherName,
        motherName: user.motherName,
        dob: user.dob,
        gender: user.gender,
        phone: user.phone,
        academicYear: user.academicYear,
        dateOfJoining: user.dateOfJoining,
        bloodGroup: user.bloodGroup,
        nationality: user.nationality,
        religion: user.religion,
        caste: user.caste,
        pwd: user.pwd,
        subcaste: user.subcaste,
        aadharNo: user.aadharNo,
        identificationMarks: user.identificationMarks,
        presentAddress: presentAddress,
        permanentAddress: permanentAddress,
        fatherMobile: user.fatherMobile,
        motherMobile: user.motherMobile,
        fatherAadhar: user.fatherAadhar,
        motherAadhar: user.motherAadhar,
        fatherQualification: user.fatherQualification,
        motherQualification: user.motherQualification,
        fatherOccupation: user.fatherOccupation,
        motherOccupation: user.motherOccupation,
        rationCardNumber: user.rationCardNumber,
        isTcAttached: user.isTcAttached,
        previousSchool: user.previousSchool,
        childIdNumber: user.childIdNumber,
        motherTongue: user.motherTongue,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersToInsert.push(newUser);
    }

    if (usersToInsert.length > 0) {
      await usersCollection.insertMany(usersToInsert as any[]);
    }
    
    revalidatePath('/dashboard/admin/students');

    return {
      success: true,
      message: `Import complete. ${usersToInsert.length} students were successfully imported. ${skippedCount} students were skipped due to missing data, existing accounts, or non-existent classes.`,
      importedCount: usersToInsert.length,
      skippedCount: skippedCount,
    };

  } catch (error) {
    console.error('Bulk create school users error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during bulk import.', error: errorMessage };
  }
}
