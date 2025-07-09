
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { ReportCardData, SaveReportCardResult, SetReportCardPublicationStatusResult, GetStudentReportCardResult, BulkPublishReportInfo } from '@/types/report';
import { reportCardDataSchemaForSave } from '@/types/report'; // Import the new schema from types/report
import { ObjectId } from 'mongodb';
import type { User } from '@/types/user'; 
import { getSchoolById } from './schools'; 
import { revalidatePath } from 'next/cache';

export async function saveReportCard(data: Omit<ReportCardData, '_id' | 'createdAt' | 'updatedAt' | 'isPublished'>): Promise<SaveReportCardResult> {
  try {
    const validatedData = reportCardDataSchemaForSave.safeParse(data);
    if (!validatedData.success) {
      const errors = validatedData.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join('; ');
      return { success: false, message: 'Validation failed', error: errors };
    }

    const { db } = await connectToDatabase();
    const reportCardsCollection = db.collection('report_cards');

    const { studentId, schoolId: schoolIdStr, academicYear, reportCardTemplateKey, studentInfo, formativeAssessments, coCurricularAssessments, secondLanguage, summativeAssessments, attendance, finalOverallGrade, generatedByAdminId: adminIdStr, term } = validatedData.data;
    
    const reportBaseData = {
        studentId, 
        schoolId: new ObjectId(schoolIdStr),
        academicYear,
        reportCardTemplateKey,
        studentInfo,
        formativeAssessments,
        coCurricularAssessments,
        secondLanguage,
        summativeAssessments, 
        attendance,
        finalOverallGrade,
        generatedByAdminId: adminIdStr ? new ObjectId(adminIdStr) : undefined,
        term,
        updatedAt: new Date(),
    };


    const existingReport = await reportCardsCollection.findOne({
        studentId: reportBaseData.studentId,
        schoolId: reportBaseData.schoolId,
        academicYear: reportBaseData.academicYear,
        reportCardTemplateKey: reportBaseData.reportCardTemplateKey,
        term: reportBaseData.term 
    });

    if (existingReport) {
        const result = await reportCardsCollection.updateOne(
            { _id: existingReport._id as ObjectId },
            { $set: reportBaseData } 
        );
        if (result.modifiedCount === 0 && result.matchedCount === 0) {
             return { success: false, message: 'Failed to update report card. Report not found after initial check, or no changes made.' };
        }
         return { 
            success: true, 
            message: 'Report card updated successfully!', 
            reportCardId: existingReport._id.toString(),
            isPublished: (existingReport as ReportCardData).isPublished || false,
        };

    } else {
        const reportToInsertWithStatus: Omit<ReportCardData, '_id'> = {
            ...reportBaseData,
            isPublished: false, 
            createdAt: new Date(),
        };
        const result = await reportCardsCollection.insertOne(reportToInsertWithStatus as any);
        if (!result.insertedId) {
          return { success: false, message: 'Failed to save report card.', error: 'Database insertion failed.' };
        }
        return { 
            success: true, 
            message: 'Report card saved successfully!', 
            reportCardId: result.insertedId.toString(),
            isPublished: false,
        };
    }

  } catch (error) {
    console.error('Save report card server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during report card saving.', error: errorMessage };
  }
}


export async function setReportCardPublicationStatus(
  reportCardId: string,
  adminSchoolId: string, 
  isPublished: boolean
): Promise<SetReportCardPublicationStatusResult> {
  try {
    if (!ObjectId.isValid(reportCardId) || !ObjectId.isValid(adminSchoolId)) {
      return { success: false, message: 'Invalid Report Card ID or Admin School ID format.' };
    }

    const { db } = await connectToDatabase();
    const reportCardsCollection = db.collection<ReportCardData>('report_cards');

    const reportToUpdate = await reportCardsCollection.findOne({ 
      _id: new ObjectId(reportCardId),
      schoolId: new ObjectId(adminSchoolId) 
    });

    if (!reportToUpdate) {
      return { success: false, message: 'Report card not found or access denied for this school.' };
    }

    const result = await reportCardsCollection.updateOne(
      { _id: new ObjectId(reportCardId) },
      { $set: { isPublished: isPublished, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'Report card not found during update.' };
    }
    if (result.modifiedCount === 0 && result.matchedCount > 0) {
       return { success: true, message: `Report card is already ${isPublished ? 'published' : 'unpublished'}.`, isPublished };
    }
    
    revalidatePath('/dashboard/admin/reports/generate-cbse-state');
    revalidatePath('/dashboard/admin/reports');
    revalidatePath('/dashboard/student/results', 'layout');


    return { success: true, message: `Report card ${isPublished ? 'published' : 'unpublished'} successfully.`, isPublished };

  } catch (error) {
    console.error('Set report card publication status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred.', error: errorMessage };
  }
}


export async function getStudentReportCard(
  studentId: string, 
  schoolId: string, 
  academicYear: string,
  term?: string, 
  publishedOnly?: boolean 
): Promise<GetStudentReportCardResult> {
  try {
    if (!ObjectId.isValid(schoolId)) { 
      return { success: false, message: 'Invalid school ID format.' };
    }

    if (publishedOnly) {
      const schoolResult = await getSchoolById(schoolId);
      if (!schoolResult.success || !schoolResult.school) {
        return { success: false, message: 'Could not verify school settings. Please try again later.' };
      }
      if (!schoolResult.school.allowStudentsToViewPublishedReports) {
        return { success: false, message: 'Report card viewing is currently disabled by the school administration for this academic year.' };
      }
    }

    const { db } = await connectToDatabase();
    const reportCardsCollection = db.collection<ReportCardData>('report_cards');

    const query: any = {
      studentId: studentId, 
      schoolId: new ObjectId(schoolId),
      academicYear: academicYear,
      reportCardTemplateKey: 'cbse_state', 
    };

    if (term) {
      query.term = term;
    }

    if (publishedOnly) {
      query.isPublished = true;
    }

    const reportCardDoc = await reportCardsCollection.findOne(query, {
      sort: { updatedAt: -1 }, 
    });

    if (!reportCardDoc) {
      let message = 'No report card found for the specified criteria.';
      if (publishedOnly) {
        message = 'Your report card for this academic year has not been published yet or is not available. Please check back later or contact your school.';
      }
      return { success: false, message };
    }
    
    const reportCard: ReportCardData = {
        ...reportCardDoc,
        _id: reportCardDoc._id?.toString(),
        schoolId: reportCardDoc.schoolId.toString(),
        generatedByAdminId: reportCardDoc.generatedByAdminId?.toString(),
        isPublished: reportCardDoc.isPublished === undefined ? false : reportCardDoc.isPublished, 
        createdAt: reportCardDoc.createdAt ? new Date(reportCardDoc.createdAt) : undefined,
        updatedAt: reportCardDoc.updatedAt ? new Date(reportCardDoc.updatedAt) : undefined,
    };

    return { success: true, reportCard };

  } catch (error)
{
    console.error('Get student report card error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch student report card.' };
  }
}

export interface GetReportCardsForClassResult {
  success: boolean;
  reports?: BulkPublishReportInfo[];
  message?: string;
  error?: string;
}

export async function getReportCardsForClass(schoolId: string, classId: string, academicYear: string): Promise<GetReportCardsForClassResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID format.' };
    }
    if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
      return { success: false, message: 'Valid Academic Year (YYYY-YYYY) is required.' };
    }

    const { db } = await connectToDatabase();
    const reportCardsCollection = db.collection<ReportCardData>('report_cards');
    const usersCollection = db.collection<User>('users');
    
    const studentsInClass = await usersCollection.find({
      schoolId: new ObjectId(schoolId),
      classId: classId, 
      role: 'student'
    }).project({ _id: 1, name: 1, admissionId: 1 }).toArray();

    if (studentsInClass.length === 0) {
      return { success: true, reports: [], message: 'No students found in this class.' };
    }
    const studentIds = studentsInClass.map(s => s._id.toString());

    const reportDocs = await reportCardsCollection.find({
      schoolId: new ObjectId(schoolId),
      studentId: { $in: studentIds },
      academicYear: academicYear,
      reportCardTemplateKey: 'cbse_state',
      term: 'Annual',
    }).project({ _id: 1, studentId: 1, 'studentInfo.studentName': 1, isPublished: 1 }).toArray();
    
    const reportsInfo: BulkPublishReportInfo[] = studentsInClass.map(student => {
      const report = reportDocs.find(r => r.studentId === student._id.toString());
      return {
        reportId: report?._id.toString() || null,
        studentId: student._id.toString(),
        studentName: student.name,
        admissionId: student.admissionId || 'N/A',
        isPublished: report ? report.isPublished || false : false,
        hasReport: !!report,
      };
    }).sort((a, b) => a.studentName.localeCompare(b.studentName));

    return { success: true, reports: reportsInfo };

  } catch (error) {
    console.error('Get report cards for class error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch report cards for class.' };
  }
}


export interface SetReportPublicationStatusForClassResult {
  success: boolean;
  updatedCount: number;
  message: string;
  error?: string;
}

export async function setReportPublicationStatusForClass(schoolId: string, classId: string, academicYear: string, isPublished: boolean): Promise<SetReportPublicationStatusForClassResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, updatedCount: 0, message: 'Invalid School or Class ID format.' };
    }
     if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
      return { success: false, updatedCount: 0, message: 'Valid Academic Year (YYYY-YYYY) is required.' };
    }
    
    const { db } = await connectToDatabase();
    const reportCardsCollection = db.collection<ReportCardData>('report_cards');
    const usersCollection = db.collection<User>('users');

    const studentsInClass = await usersCollection.find({
      schoolId: new ObjectId(schoolId),
      classId: classId, 
      role: 'student'
    }).project({ _id: 1 }).toArray();

    if (studentsInClass.length === 0) {
      return { success: true, updatedCount: 0, message: 'No students found in this class to update reports for.' };
    }
    const studentIds = studentsInClass.map(s => s._id.toString());

    const result = await reportCardsCollection.updateMany(
      { 
        schoolId: new ObjectId(schoolId), 
        studentId: { $in: studentIds },
        academicYear: academicYear,
        reportCardTemplateKey: 'cbse_state', 
        term: 'Annual',
      },
      { $set: { isPublished: isPublished, updatedAt: new Date() } }
    );
    
    revalidatePath('/dashboard/admin/reports');
    revalidatePath('/dashboard/student/results', 'layout');

    return { 
      success: true, 
      updatedCount: result.modifiedCount,
      message: `${result.modifiedCount} report cards ${isPublished ? 'published' : 'unpublished'} successfully for class.`
    };

  } catch (error) {
    console.error('Set report publication status for class error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, updatedCount: 0, message: 'An unexpected error occurred.', error: errorMessage };
  }
}
