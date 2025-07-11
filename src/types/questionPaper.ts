
import { z } from 'zod';

export const questionPaperSchema = z.object({
  schoolId: z.string().min(1, "School ID is required."),
  classId: z.string().min(1, "Class ID is required."),
  subjectName: z.string().min(1, "Subject name is required."),
  examName: z.string().min(3, "Exam name must be at least 3 characters."),
  year: z.coerce.number().min(2000, "Year must be 2000 or later.").max(new Date().getFullYear() + 1, "Year cannot be too far in the future."),
  pdfUrl: z.string().min(1, "A PDF file is required."),
});
export type QuestionPaperFormData = z.infer<typeof questionPaperSchema>;

export interface QuestionPaper {
  _id: string;
  schoolId: string;
  classId: string;
  subjectName: string;
  examName: string;
  year: number;
  pdfUrl: string;
  createdAt: string;
}

export interface QuestionPaperResult {
    success: boolean;
    message: string;
    error?: string;
    paper?: QuestionPaper;
}

export interface QuestionPapersResult {
    success: boolean;
    message?: string;
    error?: string;
    papers?: QuestionPaper[];
}
