
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { 
  assessmentSchemeSchema, type AssessmentScheme, type AssessmentSchemeFormData,
  gradingPatternSchema, type GradingPatternFormData, defaultGrades
} from '@/types/assessment';
import type { SchoolClass } from '@/types/classes';

// --- Result Types ---
export interface AssessmentSchemeResult {
  success: boolean;
  message: string;
  error?: string;
  scheme?: AssessmentScheme;
}

export interface AssessmentSchemesResult {
  success: boolean;
  message?: string;
  error?: string;
  schemes?: AssessmentScheme[];
}

// Default structure for a new assessment scheme when one doesn't exist for a class.
const defaultSchemeStructure: Omit<AssessmentScheme, '_id' | 'schoolId' | 'classId' | 'academicYear' | 'schemeName'> = {
    assessments: [
        { groupName: 'FA1', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
        { groupName: 'FA2', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
        { groupName: 'FA3', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
        { groupName: 'FA4', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
        { groupName: 'SA1', tests: [{testName: 'AS1', maxMarks: 20}, {testName: 'AS2', maxMarks: 20}, {testName: 'AS3', maxMarks: 20}, {testName: 'AS4', maxMarks: 20}, {testName: 'AS5', maxMarks: 20}, {testName: 'AS6', maxMarks: 20}] },
        { groupName: 'SA2', tests: [{testName: 'AS1', maxMarks: 20}, {testName: 'AS2', maxMarks: 20}, {testName: 'AS3', maxMarks: 20}, {testName: 'AS4', maxMarks: 20}, {testName: 'AS5', maxMarks: 20}, {testName: 'AS6', maxMarks: 20}] },
    ],
};

// --- Assessment Scheme Actions ---

// Get or create a scheme for a specific class
export async function getAssessmentSchemeForClass(classId: string, schoolId: string, academicYear: string, className?: string): Promise<AssessmentSchemeResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID.' };
    }
    
    const { db } = await connectToDatabase();
    const collection = db.collection('assessment_schemes');
    
    let schemeDoc = await collection.findOne({ 
      classId: new ObjectId(classId),
      schoolId: new ObjectId(schoolId),
      academicYear: academicYear,
    });

    // If it doesn't exist for the class, create it based on the default structure.
    if (!schemeDoc) {
        const newSchemeData = {
            schoolId: new ObjectId(schoolId),
            classId: new ObjectId(classId),
            academicYear: academicYear,
            schemeName: `Scheme for ${className || classId}`,
            ...defaultSchemeStructure,
            createdBy: 'system',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await collection.insertOne(newSchemeData);
        schemeDoc = await collection.findOne({_id: result.insertedId });
    }

    if (!schemeDoc) {
       return { success: false, message: "Could not find or create an assessment scheme for this class." };
    }
    
    const finalScheme: AssessmentScheme = {
        _id: schemeDoc._id.toString(),
        schoolId: schemeDoc.schoolId.toString(),
        classId: schemeDoc.classId.toString(),
        academicYear: schemeDoc.academicYear,
        schemeName: schemeDoc.schemeName,
        assessments: schemeDoc.assessments,
        createdBy: schemeDoc.createdBy?.toString(),
        createdAt: new Date(schemeDoc.createdAt).toISOString(),
        updatedAt: new Date(schemeDoc.updatedAt).toISOString(),
    };

    return {
      success: true,
      message: 'Scheme found.',
      scheme: finalScheme,
    };
    
  } catch (error) {
    return { success: false, message: 'Failed to fetch assessment scheme for the class.' };
  }
}

export async function updateAssessmentScheme(
  schemeId: string,
  schoolId: string,
  formData: Omit<AssessmentSchemeFormData, 'schemeName'>, // schemeName is now optional
): Promise<AssessmentSchemeResult> {
    try {
        if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(schemeId)) {
            return { success: false, message: 'Invalid School or Scheme ID format.' };
        }
        
        // Use a more specific schema that doesn't require schemeName for updates
        const updateSchema = assessmentSchemeSchema.omit({ schemeName: true });
        const validatedFields = updateSchema.safeParse(formData);
        
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed.', error: validatedFields.error.flatten().fieldErrors.toString() };
        }

        const { db } = await connectToDatabase();
        const updateData = {
            ...validatedFields.data,
            updatedAt: new Date(),
        };

        const result = await db.collection('assessment_schemes').updateOne(
            { _id: new ObjectId(schemeId), schoolId: new ObjectId(schoolId) },
            { $set: updateData },
        );

        if (result.matchedCount === 0) {
            return { success: false, message: 'Assessment scheme not found or access denied.' };
        }

        revalidatePath('/dashboard/master-admin/configure-marks');
        return { success: true, message: 'Assessment scheme updated successfully.' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}


export async function updateGradingForClass(
  classId: string,
  schoolId: string,
  formData: GradingPatternFormData,
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    if (!ObjectId.isValid(classId) || !ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid Class or School ID.' };
    }
    
    // The Zod schema for grading patterns is just fine for validating the structure
    const validatedFields = gradingPatternSchema.safeParse(formData);
    if (!validatedFields.success) {
      return { success: false, message: 'Validation failed.', error: validatedFields.error.flatten().fieldErrors.toString() };
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('school_classes').updateOne(
      { _id: new ObjectId(classId), schoolId: new ObjectId(schoolId) },
      { $set: { 
          gradingPattern: validatedFields.data, // Embed the whole object
          updatedAt: new Date() 
      }}
    );

    if (result.matchedCount === 0) {
      return { success: false, message: "Class not found or does not belong to this school." };
    }
    
    revalidatePath('/dashboard/master-admin/configure-marks');
    return { success: true, message: "Grading pattern updated for the class." };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred during grading update.' };
  }
}
