
import type { ObjectId } from 'mongodb';

export const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Cheque", "DD", "Others"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_TOWARDS_OPTIONS = ["Academic Fees", "Bus Fees"] as const;
export type PaymentTowards = (typeof PAYMENT_TOWARDS_OPTIONS)[number];

export interface FeePaymentPayload {
  studentId: string;
  studentName: string; // For easier display on receipts or logs if needed
  schoolId: string;
  classId: string; // Stores className
  amountPaid: number;
  paymentDate: Date;
  recordedByAdminId: string;
  paymentMethod?: PaymentMethod; // e.g., 'cash', 'card', 'online'
  paymentTowards?: PaymentTowards;
  notes?: string;
}

export interface FeePayment {
  _id: ObjectId | string;
  studentId: ObjectId | string; // Store as ObjectId in DB if student IDs are ObjectIds
  studentName: string;
  schoolId: ObjectId | string;
  classId: string; // Stores className
  amountPaid: number;
  paymentDate: Date;
  recordedByAdminId: ObjectId | string;
  paymentMethod?: PaymentMethod;
  paymentTowards?: PaymentTowards;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Represents the consolidated fee status for a student
export interface StudentFeeStatus {
  studentId: string;
  studentName: string;
  className?: string;
  totalFee: number;
  totalPaid: number;
  totalDue: number;
  payments: FeePayment[]; // Optional: if you want to show payment history directly
}

export interface GetFeePaymentResult {
  success: boolean;
  payment?: FeePayment;
  error?: string;
  message?: string;
}
