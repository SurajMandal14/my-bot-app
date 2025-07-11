import { z } from 'zod';

export const courseMaterialSchema = z.object({
  schoolId: z.string().min(1, "School ID is required."),
  classId: z.string().min(1, "Class ID is required."),
  subjectName: z.string().min(1, "Subject name is required."),
  title: z.string().min(3, "Title must be at least 3 characters."),
  pdfUrl: z.string().min(1, "A PDF file is required."),
});
export type CourseMaterialFormData = z.infer<typeof courseMaterialSchema>;

export interface CourseMaterial {
  _id: string;
  schoolId: string;
  classId: string;
  subjectName: string;
  title: string;
  pdfUrl: string;
  createdAt: string;
}

export interface CourseMaterialResult {
    success: boolean;
    message: string;
    error?: string;
    material?: CourseMaterial;
}

export interface CourseMaterialsResult {
    success: boolean;
    message?: string;
    error?: string;
    materials?: CourseMaterial[];
}
