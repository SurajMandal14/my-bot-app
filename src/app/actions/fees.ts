
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import type { FeePayment, FeePaymentPayload, GetFeePaymentResult } from '@/types/fees';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

const feePaymentPayloadSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  studentName: z.string().min(1, "Student name is required."),
  schoolId: z.string().min(1, "School ID is required."),
  classId: z.string().min(1, "Class ID (name) is required."),
  amountPaid: z.number().positive("Payment amount must be positive."),
  paymentDate: z.date(),
  recordedByAdminId: z.string().min(1, "Admin ID is required."),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

export interface RecordFeePaymentResult {
  success: boolean;
  message: string;
  error?: string;
  payment?: FeePayment;
}

export async function recordFeePayment(payload: FeePaymentPayload): Promise<RecordFeePaymentResult> {
  try {
    const validatedPayload = feePaymentPayloadSchema.safeParse(payload);
    if (!validatedPayload.success) {
      const errors = validatedPayload.error.errors.map(e => e.message).join(' ');
      return { success: false, message: 'Validation failed', error: errors || 'Invalid payload!' };
    }

    const { 
        studentId, studentName, schoolId, classId, 
        amountPaid, paymentDate, recordedByAdminId,
        paymentMethod, notes 
    } = validatedPayload.data;

    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(recordedByAdminId) || !ObjectId.isValid(studentId)) {
        return { success: false, message: 'Invalid ID format for school, admin, or student.' };
    }

    const { db } = await connectToDatabase();
    const feePaymentsCollection = db.collection<Omit<FeePayment, '_id'>>('fee_payments');

    const newPayment: Omit<FeePayment, '_id'> = {
      studentId: new ObjectId(studentId),
      studentName,
      schoolId: new ObjectId(schoolId),
      classId, // classId from payload is className
      amountPaid,
      paymentDate: new Date(paymentDate),
      recordedByAdminId: new ObjectId(recordedByAdminId),
      paymentMethod,
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await feePaymentsCollection.insertOne(newPayment);

    if (!result.insertedId) {
      return { success: false, message: 'Failed to record fee payment.', error: 'Database insertion failed.' };
    }
    
    revalidatePath('/dashboard/admin/fees'); // Revalidate admin fees page
    revalidatePath(`/dashboard/student/fees`); // Revalidate student fees page (if studentId could be passed)

    return {
      success: true,
      message: 'Fee payment recorded successfully!',
      payment: { ...newPayment, _id: result.insertedId.toString() } as FeePayment,
    };

  } catch (error) {
    console.error('Record fee payment server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: 'An unexpected error occurred during payment recording.', error: errorMessage };
  }
}

export interface GetFeePaymentsResult {
  success: boolean;
  payments?: FeePayment[];
  error?: string;
  message?: string;
}

export async function getFeePaymentsBySchool(schoolId: string): Promise<GetFeePaymentsResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid School ID format.', error: 'Invalid School ID.'};
    }

    const { db } = await connectToDatabase();
    const feePaymentsCollection = db.collection<FeePayment>('fee_payments');
    
    const payments = await feePaymentsCollection.find({
      schoolId: new ObjectId(schoolId) as any, 
    }).sort({ paymentDate: -1, createdAt: -1 }).toArray();
    
    const paymentsWithStrId = payments.map(payment => ({
      ...payment,
      _id: payment._id.toString(),
      studentId: payment.studentId.toString(),
      schoolId: payment.schoolId.toString(),
      recordedByAdminId: payment.recordedByAdminId.toString(),
    }));

    return { success: true, payments: paymentsWithStrId };
  } catch (error) {
    console.error('Get fee payments by school server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch fee payments.' };
  }
}


export async function getFeePaymentsByStudent(studentId: string, schoolId: string): Promise<GetFeePaymentsResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(studentId)) {
        return { success: false, message: 'Invalid School or Student ID format.', error: 'Invalid ID.'};
    }

    const { db } = await connectToDatabase();
    const feePaymentsCollection = db.collection<FeePayment>('fee_payments');
    
    const payments = await feePaymentsCollection.find({
      studentId: new ObjectId(studentId) as any,
      schoolId: new ObjectId(schoolId) as any, 
    }).sort({ paymentDate: -1, createdAt: -1 }).toArray();
    
    const paymentsWithStrId = payments.map(payment => ({
      ...payment,
      _id: payment._id.toString(),
      studentId: payment.studentId.toString(),
      schoolId: payment.schoolId.toString(),
      recordedByAdminId: payment.recordedByAdminId.toString(),
    }));

    return { success: true, payments: paymentsWithStrId };
  } catch (error) {
    console.error('Get fee payments by student server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch student fee payments.' };
  }
}

export async function getPaymentById(paymentId: string): Promise<GetFeePaymentResult> {
  try {
    if (!ObjectId.isValid(paymentId)) {
      return { success: false, message: 'Invalid Payment ID format.', error: 'Invalid Payment ID.' };
    }

    const { db } = await connectToDatabase();
    const feePaymentsCollection = db.collection<FeePayment>('fee_payments');
    
    const payment = await feePaymentsCollection.findOne({ _id: new ObjectId(paymentId) as any });

    if (!payment) {
      return { success: false, message: 'Payment not found.' };
    }
    
    const paymentWithStrId = {
      ...payment,
      _id: payment._id.toString(),
      studentId: payment.studentId.toString(),
      schoolId: payment.schoolId.toString(),
      recordedByAdminId: payment.recordedByAdminId.toString(),
    };

    return { success: true, payment: paymentWithStrId };
  } catch (error) {
    console.error('Get payment by ID server action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: errorMessage, message: 'Failed to fetch payment details.' };
  }
}
