
import { z } from 'zod';

export const academicYearSchema = z.object({
  year: z.string().regex(/^\d{4}-\d{4}$/, "Year must be in YYYY-YYYY format."),
  isDefault: z.boolean().optional(),
});
export type AcademicYearFormData = z.infer<typeof academicYearSchema>;

export interface AcademicYear {
  _id: string;
  year: string;
  isDefault: boolean;
  createdAt: string;
}

export interface AcademicYearResult {
  success: boolean;
  message: string;
  error?: string;
  academicYear?: AcademicYear;
}

export interface AcademicYearsResult {
    success: boolean;
    message?: string;
    error?: string;
    academicYears?: AcademicYear[];
}
