
import { z } from 'zod';
import type { ObjectId } from 'mongodb';

export interface SchoolClassSubject {
  name: string;
  teacherId?: string | ObjectId | null; // User._id of the teacher assigned to this subject for this class
  teacherName?: string; // For display, populated by aggregation or client-side mapping
}

// This type is for data passed to CLIENT components.
export interface SchoolClass {
  _id: string;
  schoolId: string;
  name: string; // e.g., Grade 10
  section?: string; // e.g., A, B
  academicYear: string; 
  classTeacherId?: string | null;
  classTeacherName?: string; // From aggregation
  subjects: SchoolClassSubject[]; 
  createdAt: string; // ISOString
  updatedAt: string; // ISOString
  secondLanguageSubjectName?: string; 
  studentCount?: number; 
  gradingPatternId?: string | null; // New field
  gradingPatternName?: string; // For display
}

// Schema for creating a new class
export const createClassFormSchema = z.object({
  name: z.string().min(1, { message: "Class name (e.g., Grade 10) is required." }).max(100, { message: "Class name too long."}),
  section: z.string().min(1, { message: "Section (e.g., A) is required."}).max(10, { message: "Section name too long."}),
  academicYear: z.string().min(1, { message: "Academic Year is required." }),
  classTeacherId: z.string().optional().nullable().or(z.literal('')), 
  subjects: z.array(z.object({ 
      name: z.string().min(1, "Subject name cannot be empty."),
      teacherId: z.string().optional().nullable().or(z.literal('')) 
    }))
    .min(1, { message: "At least one subject is required." })
    .max(20, { message: "Maximum 20 subjects allowed."}),
  secondLanguageSubjectName: z.string().optional().nullable().or(z.literal('')),
});
export type CreateClassFormData = z.infer<typeof createClassFormSchema>;

// Schema for updating an existing class
export const updateClassFormSchema = createClassFormSchema.extend({});
export type UpdateClassFormData = z.infer<typeof updateClassFormSchema>;

// Result type for class actions
export interface SchoolClassResult {
  success: boolean;
  message: string;
  error?: string;
  class?: SchoolClass; // Use client-facing type
}

export interface SchoolClassesResult {
  success: boolean;
  message?: string;
  error?: string;
  classes?: SchoolClass[]; // Use client-facing type
}
