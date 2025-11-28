

'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { ReportCardData, GetStudentReportCardResult } from '@/types/report';
import { reportCardDataSchemaForSave } from '@/types/report'; // Import the new schema from types/report
import { ObjectId } from 'mongodb';
import type { User } from '@/types/user'; 
import { revalidatePath } from 'next/cache';
import { getStudentDetailsForReportCard } from './schoolUsers';
import { getClassDetailsById } from './classes';
import { getStudentMarksForReportCard } from './marks';
import { getStudentMonthlyAttendance } from './attendance';
import { getAssessmentSchemeForClass } from './assessmentConfigurations';

export async function getStudentReportCard(
  studentId: string, 
  schoolId: string, 
  academicYear: string,
  term?: string
): Promise<GetStudentReportCardResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(studentId)) { 
      return { success: false, message: 'Invalid school or student ID format.' };
    }

    const { db } = await connectToDatabase();
    
    // Always fetch live data instead of looking for a saved report
    const [studentRes, marksRes, attendanceRes] = await Promise.all([
      getStudentDetailsForReportCard(studentId, schoolId, academicYear), // Assuming this fetches by studentId now
      getStudentMarksForReportCard(studentId, schoolId, academicYear),
      getStudentMonthlyAttendance(studentId)
    ]);
    
    if (!studentRes.success || !studentRes.student) {
      return { success: false, message: 'Could not retrieve student details for the report.' };
    }
    
    const student = studentRes.student;
    
    if (!student.classId) {
      return { success: false, message: `Student ${student.name} is not assigned to a class for this academic year.` };
    }
    
    const [classRes, schoolDoc] = await Promise.all([
      getClassDetailsById(student.classId, schoolId),
      db.collection('schools').findOne({ _id: new ObjectId(schoolId) })
    ]);

    if (!classRes.success || !classRes.classDetails) {
      return { success: false, message: 'Could not load class details for the student.' };
    }
    
    const schemeRes = await getAssessmentSchemeForClass(classRes.classDetails.name, schoolId, academicYear);
    if (!schemeRes.success || !schemeRes.scheme) {
      return { success: false, message: 'Could not load the assessment scheme for this class.' };
    }
    
    // Construct the live ReportCardData object on the fly
    const liveReportCard: ReportCardData = {
      studentId: student._id,
      schoolId: new ObjectId(schoolId),
      academicYear: academicYear,
      reportCardTemplateKey: schoolDoc?.reportCardTemplate || 'cbse_state',
      studentInfo: {
        udiseCodeSchoolName: schoolDoc?.schoolName || '',
        studentName: student.name || '',
        fatherName: student.fatherName || '',
        motherName: student.motherName || '',
        class: classRes.classDetails?.name || '', 
        section: student.section || '',
        studentIdNo: student._id || '', 
        rollNo: student.rollNo || '',
        medium: 'English',
        dob: student.dob || '',
        admissionNo: student.admissionId || '',
        examNo: student.examNo || '',
        aadharNo: student.aadharNo || '',
      },
      formativeAssessments: [], // This will be populated client-side
      summativeAssessments: [], // This will be populated client-side
      coCurricularAssessments: [],
      attendance: attendanceRes.success ? attendanceRes.records || [] : [],
      finalOverallGrade: null, // To be calculated client-side
      // We can add the raw marks here to be processed by the client
      _rawMarksData: marksRes.success ? marksRes.marks : [],
      _rawSchemeData: schemeRes.scheme,
      _rawClassData: classRes.classDetails,
    };

    return { success: true, reportCard: liveReportCard };

  } catch (error)
{
    console.error('Get student report card error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch student report card data.' };
  }
}

    
