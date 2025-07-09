import { z } from 'zod';

export const subjectSchema = z.object({
  name: z.string().min(1, { message: "Subject name is required." }),
  schoolId: z.string().min(1, "School ID is required."),
});
export type SubjectFormData = z.infer<typeof subjectSchema>;

export interface Subject {
  _id: string;
  name: string;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectResult {
  success: boolean;
  message: string;
  error?: string;
  subject?: Subject;
}

export interface SubjectsResult {
    success: boolean;
    message?: string;
    error?: string;
    subjects?: Subject[];
}
