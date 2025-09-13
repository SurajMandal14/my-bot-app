
import { z } from 'zod';
import type { ObjectId } from 'mongodb';

// --- Assessment Schemes ---

const assessmentComponentSchema = z.object({
  name: z.string().min(1, "Assessment name is required."),
  maxMarks: z.coerce.number().min(1, "Max marks must be at least 1."),
});

export const assessmentSchemeSchema = z.object({
  // schemeName is now optional as it's derived
  schemeName: z.string().optional(), 
  // classIds will now store class names, not ObjectIds, to simplify grouping.
  classIds: z.array(z.string()).min(1, "At least one class must be selected."),
  assessments: z.array(assessmentComponentSchema).min(1, "At least one assessment is required."),
});

export type AssessmentSchemeFormData = z.infer<typeof assessmentSchemeSchema>;

export interface AssessmentScheme {
  _id: ObjectId | string;
  schoolId: ObjectId | string;
  schemeName: string;
  classIds: string[]; // Storing class names, e.g., ["Class 1", "Class 2"]
  assessments: {
    name: string;
    maxMarks: number;
  }[];
  createdBy: ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}


// --- Grading Patterns ---

const gradeRowSchema = z.object({
  label: z.string().min(1, "Grade label is required (e.g., A1)."),
  minPercentage: z.coerce.number().min(0, "Min % cannot be negative.").max(100, "Min % cannot exceed 100."),
  maxPercentage: z.coerce.number().min(0, "Max % cannot be negative.").max(100, "Max % cannot exceed 100."),
}).refine(data => data.minPercentage <= data.maxPercentage, {
  message: "Minimum percentage cannot be greater than maximum percentage.",
  path: ["minPercentage"], 
});

export const gradingPatternSchema = z.object({
  patternName: z.string().min(3, "Pattern name is required."),
  grades: z.array(gradeRowSchema).min(1, "At least one grade row is required."),
});

export type GradingPatternFormData = z.infer<typeof gradingPatternSchema>;

export interface GradingPattern {
  _id: ObjectId | string;
  schoolId: ObjectId | string;
  patternName: string;
  grades: {
    label: string;
    minPercentage: number;
    maxPercentage: number;
  }[];
  createdBy: ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}
