
import { z } from 'zod';
import type { ObjectId } from 'mongodb';

export const CONCESSION_TYPES = [
  "Sibling Discount",
  "Scholarship",
  "Staff Ward",
  "Early Bird Discount",
  "Financial Aid",
  "Special Talent",
  "Other",
] as const;

export type FeeConcessionType = (typeof CONCESSION_TYPES)[number];

// Schema for creating/updating a fee concession
export const feeConcessionFormSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  schoolId: z.string().min(1, "School ID is required."),
  academicYear: z.string().min(4, "Academic Year (e.g., 2023-2024) is required.").regex(/^\d{4}-\d{4}$/, "Invalid academic year format."),
  concessionType: z.enum(CONCESSION_TYPES, { required_error: "Concession type is required." }),
  amount: z.coerce.number({invalid_type_error: "Amount must be a number"}).positive("Concession amount must be a positive number."),
  reason: z.string().min(5, "Reason must be at least 5 characters long.").max(500, "Reason too long."),
});
export type FeeConcessionFormData = z.infer<typeof feeConcessionFormSchema>;

// Interface for FeeConcession document in DB and for client display
export interface FeeConcession {
  _id: string; // ObjectId as string
  studentId: string; // User._id of the student
  studentName?: string; // For display, to be populated via lookup
  schoolId: string; // School._id
  schoolName?: string; // For display
  admissionId?: string; // For display
  academicYear: string;
  concessionType: FeeConcessionType;
  amount: number;
  reason: string;
  appliedByMasterAdminId: string; // User._id of the master admin
  appliedByMasterAdminName?: string; // For display
  createdAt: string; // ISOString
  updatedAt: string; // ISOString
}

// Result types for server actions
export interface ApplyFeeConcessionResult {
  success: boolean;
  message: string;
  error?: string; // Zod errors or general errors
  concession?: FeeConcession;
}

export interface GetFeeConcessionsResult {
  success: boolean;
  message?: string;
  error?: string;
  concessions?: FeeConcession[];
}

export interface RevokeFeeConcessionResult {
  success: boolean;
  message: string;
  error?: string;
}
