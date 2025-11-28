

'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { ReportCardData, SaveReportCardResult, GetStudentReportCardResult } from '@/types/report';
import { reportCardDataSchemaForSave } from '@/types/report'; // Import the new schema from types/report
import { ObjectId } from 'mongodb';
import type { User } from '@/types/user'; 
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
        };

    } else {
        const reportToInsert: Omit<ReportCardData, '_id'> = {
            ...reportBaseData,
            createdAt: new Date(),
        };
        const result = await reportCardsCollection.insertOne(reportToInsert as any);
        if (!result.insertedId) {
          return { success: false, message: 'Failed to save report card.', error: 'Database insertion failed.' };
        }
        return { 
            success: true, 
            message: 'Report card saved successfully!', 
            reportCardId: result.insertedId.toString(),
        };
    }

  } catch (error) {
    console.error('Save report card server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during report card saving.', error: errorMessage };
  }
}

export async function getStudentReportCard(
  studentId: string, 
  schoolId: string, 
  academicYear: string,
  term?: string
): Promise<GetStudentReportCardResult> {
  try {
    if (!ObjectId.isValid(schoolId)) { 
      return { success: false, message: 'Invalid school ID format.' };
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

    const reportCardDoc = await reportCardsCollection.findOne(query, {
      sort: { updatedAt: -1 }, 
    });

    if (!reportCardDoc) {
      let message = 'No report card found for the specified criteria.';
      return { success: false, message };
    }
    
    const reportCard: ReportCardData = {
        ...reportCardDoc,
        _id: reportCardDoc._id?.toString(),
        schoolId: reportCardDoc.schoolId.toString(),
        generatedByAdminId: reportCardDoc.generatedByAdminId?.toString(),
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

    