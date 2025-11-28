

'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { ReportCardData, GetStudentReportCardResult } from '@/types/report';
import { reportCardDataSchemaForSave } from '@/types/report'; // Import the new schema from types/report
import { ObjectId } from 'mongodb';
import type { User } from '@/types/user'; 
import { revalidatePath } from 'next/cache';

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

    // Since we are no longer saving reports, this will likely not find anything.
    // This function can be kept for future use or adapted.
    // For now, it will return "not found" which the client will handle by fetching live marks.
    const reportCardDoc = await reportCardsCollection.findOne(query, {
      sort: { updatedAt: -1 }, 
    });

    if (!reportCardDoc) {
      let message = 'No pre-saved report card found. A live report will be generated from current marks.';
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

    
