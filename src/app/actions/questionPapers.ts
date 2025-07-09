
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import type { QuestionPaper, QuestionPaperFormData, QuestionPaperResult, QuestionPapersResult } from '@/types/questionPaper';
import { questionPaperSchema } from '@/types/questionPaper';

export async function createQuestionPaper(values: QuestionPaperFormData & { schoolId: string }): Promise<QuestionPaperResult> {
    try {
        const validatedFields = questionPaperSchema.safeParse(values);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed', error: 'Invalid fields!' };
        }

        const { schoolId, classId, subjectName, examName, year, pdfUrl } = validatedFields.data;

        const { db } = await connectToDatabase();
        const papersCollection = db.collection('question_papers');

        const newPaper = {
            schoolId: new ObjectId(schoolId),
            classId: new ObjectId(classId),
            subjectName,
            examName,
            year,
            pdfUrl,
            createdAt: new Date(),
        };

        const result = await papersCollection.insertOne(newPaper);
        if (!result.insertedId) {
            return { success: false, message: 'Failed to create question paper record.' };
        }

        revalidatePath('/dashboard/admin/question-papers');
        revalidatePath('/dashboard/master-admin/question-papers');
        revalidatePath('/dashboard/student/question-papers');

        return {
            success: true,
            message: 'Question paper added successfully!',
            paper: {
                ...newPaper,
                _id: result.insertedId.toString(),
                schoolId: newPaper.schoolId.toString(),
                classId: newPaper.classId.toString(),
                createdAt: newPaper.createdAt.toISOString(),
            },
        };
    } catch (error) {
        console.error("Create Question Paper Error:", error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function getQuestionPapersForClass(classId: string, schoolId: string): Promise<QuestionPapersResult> {
  try {
    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid Class or School ID.' };
    }
    const { db } = await connectToDatabase();
    const papersCollection = db.collection('question_papers');
    const papersDocs = await papersCollection.find({ 
        classId: new ObjectId(classId),
        schoolId: new ObjectId(schoolId) 
    }).sort({ year: -1, subjectName: 1 }).toArray();

    const papers: QuestionPaper[] = papersDocs.map(doc => ({
      _id: doc._id.toString(),
      schoolId: doc.schoolId.toString(),
      classId: doc.classId.toString(),
      subjectName: doc.subjectName,
      examName: doc.examName,
      year: doc.year,
      pdfUrl: doc.pdfUrl,
      createdAt: new Date(doc.createdAt).toISOString(),
    }));

    return { success: true, papers };
  } catch (error) {
    console.error("Get Question Papers for Class Error:", error);
    return { success: false, message: 'Failed to fetch question papers.' };
  }
}

// This action is for students to view papers for their class
export async function getQuestionPapersForStudent(classId: string, schoolId: string): Promise<QuestionPapersResult> {
  return getQuestionPapersForClass(classId, schoolId); // Re-use the same logic
}

export async function deleteQuestionPaper(id: string, schoolId: string): Promise<QuestionPaperResult> {
    try {
        if (!ObjectId.isValid(id) || !ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid Paper or School ID.' };
        }

        const { db } = await connectToDatabase();
        const result = await db.collection('question_papers').deleteOne({ 
            _id: new ObjectId(id),
            schoolId: new ObjectId(schoolId)
        });

        if (result.deletedCount === 0) {
            return { success: false, message: 'Paper not found or already deleted.' };
        }

        revalidatePath('/dashboard/admin/question-papers');
        revalidatePath('/dashboard/master-admin/question-papers');
        revalidatePath('/dashboard/student/question-papers');
        return { success: true, message: 'Question paper deleted successfully!' };
    } catch (error) {
        console.error("Delete Question Paper Error:", error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
