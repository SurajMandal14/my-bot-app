

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
    // Sanitize data for client components: only plain JSON values
    const liveReportCard: ReportCardData = {
      studentId: student._id?.toString?.() || String(student._id),
      schoolId: schoolId,
      academicYear: academicYear,
      reportCardTemplateKey: schoolDoc?.reportCardTemplate || 'cbse_state',
      studentInfo: {
        udiseCodeSchoolName: schoolDoc?.schoolName || '',
        studentName: student.name || '',
        fatherName: student.fatherName || '',
        motherName: student.motherName || '',
        class: classRes.classDetails?.name || '', 
        section: student.section || '',
        studentIdNo: student._id?.toString?.() || String(student._id) || '', 
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
      attendance: attendanceRes.success
        ? (attendanceRes.records || []).map((r: any) => ({
            month: r.month || r.monthName || '',
            workingDays: r.workingDays ?? r.totalWorkingDays ?? 0,
            presentDays: r.presentDays ?? r.presentCount ?? 0,
          }))
        : [],
      finalOverallGrade: null, // To be calculated client-side
      // Include raw marks but ensure all fields are serializable
      _rawMarksData: (marksRes.success && marksRes.marks)
        ? marksRes.marks.map((m: any) => ({
            ...m,
            createdAt: m?.createdAt ? new Date(m.createdAt).toISOString() : undefined,
            updatedAt: m?.updatedAt ? new Date(m.updatedAt).toISOString() : undefined,
          }))
        : [],
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

    
