
'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { 
  assessmentSchemeSchema, type AssessmentScheme, type AssessmentSchemeFormData,
  gradingPatternSchema, type GradingPattern, type GradingPatternFormData
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

export interface GradingPatternResult {
  success: boolean;
  message: string;
  error?: string;
  pattern?: GradingPattern;
}

export interface GradingPatternsResult {
  success: boolean;
  message?: string;
  error?: string;
  patterns?: GradingPattern[];
}

const defaultSchemeStructure: Omit<AssessmentScheme, '_id' | 'schoolId' | 'classId' | 'academicYear' | 'createdBy' | 'createdAt' | 'updatedAt' | 'schemeName' | 'isDefault'> = {
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

// Get all schemes for a school. Primarily for Master Admin view.
export async function getAssessmentSchemes(schoolId: string, academicYear: string): Promise<AssessmentSchemesResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID.' };
    }
    const { db } = await connectToDatabase();
    const collection = db.collection('assessment_schemes');
    
    const schemeDocs = await collection.find({ 
      schoolId: new ObjectId(schoolId),
      academicYear: academicYear
    }).toArray();
    
    const finalSchemes: AssessmentScheme[] = schemeDocs.map(doc => ({
        _id: doc._id.toString(),
        schoolId: doc.schoolId.toString(),
        classId: doc.classId.toString(),
        academicYear: doc.academicYear,
        schemeName: doc.schemeName,
        assessments: doc.assessments,
        isDefault: doc.isDefault || false,
        createdBy: doc.createdBy?.toString(),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
    }));

    return {
      success: true,
      schemes: finalSchemes,
    };
  } catch (error) {
    console.error("getAssessmentSchemes Error:", error);
    return { success: false, message: 'Failed to fetch assessment schemes.' };
  }
}

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
            isDefault: false, // It's a copy, not the global default
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
        isDefault: schemeDoc.isDefault,
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
  formData: AssessmentSchemeFormData,
): Promise<AssessmentSchemeResult> {
    try {
        if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(schemeId)) {
            return { success: false, message: 'Invalid School or Scheme ID format.' };
        }
        
        const validatedFields = assessmentSchemeSchema.safeParse(formData);
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


// --- Grading Pattern Actions ---

export async function createGradingPattern(
  formData: GradingPatternFormData,
  masterAdminId: string,
  schoolId: string
): Promise<GradingPatternResult> {
  try {
    const validatedFields = gradingPatternSchema.safeParse(formData);
    if (!validatedFields.success) {
      return { success: false, message: 'Validation failed.', error: validatedFields.error.flatten().fieldErrors.toString() };
    }
     if (!ObjectId.isValid(masterAdminId) || !ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid Admin or School ID.' };
    }

    const { db } = await connectToDatabase();
    const newPattern = {
      ...validatedFields.data,
      schoolId: new ObjectId(schoolId),
      createdBy: new ObjectId(masterAdminId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('grading_patterns').insertOne(newPattern);
    if (!result.insertedId) {
      return { success: false, message: 'Failed to create grading pattern.' };
    }

    revalidatePath('/dashboard/master-admin/configure-marks');
    return { 
        success: true, 
        message: 'Grading pattern created successfully!',
        pattern: { ...newPattern, _id: result.insertedId.toString() } as unknown as GradingPattern
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

export async function getGradingPatterns(schoolId: string): Promise<GradingPatternsResult> {
  try {
     if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID.' };
    }
    const { db } = await connectToDatabase();
    const patterns = await db.collection('grading_patterns').find({ schoolId: new ObjectId(schoolId) }).sort({ createdAt: -1 }).toArray();
    
    return {
      success: true,
      patterns: patterns.map(p => ({
        ...p,
        _id: p._id.toString(),
        schoolId: p.schoolId.toString(),
        createdBy: p.createdBy.toString(),
        createdAt: new Date(p.createdAt).toISOString(),
        updatedAt: new Date(p.updatedAt).toISOString(),
      })) as unknown as GradingPattern[],
    };
  } catch (error) {
    return { success: false, message: 'Failed to fetch grading patterns.' };
  }
}

export async function updateGradingPattern(
  patternId: string,
  formData: GradingPatternFormData,
  schoolId: string
): Promise<GradingPatternResult> {
    try {
        if (!ObjectId.isValid(patternId) || !ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid ID format.' };
        }
        const validatedFields = gradingPatternSchema.safeParse(formData);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed.', error: validatedFields.error.flatten().fieldErrors.toString() };
        }

        const { db } = await connectToDatabase();
        const updateData = {
            ...validatedFields.data,
            updatedAt: new Date(),
        };

        const result = await db.collection('grading_patterns').updateOne(
            { _id: new ObjectId(patternId), schoolId: new ObjectId(schoolId) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return { success: false, message: 'Grading pattern not found or access denied.' };
        }

        revalidatePath('/dashboard/master-admin/configure-marks');
        return { success: true, message: 'Grading pattern updated successfully.' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function deleteGradingPattern(patternId: string, schoolId: string): Promise<GradingPatternResult> {
    try {
         if (!ObjectId.isValid(patternId) || !ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid ID format.' };
        }
        const { db } = await connectToDatabase();
        const result = await db.collection('grading_patterns').deleteOne({ _id: new ObjectId(patternId), schoolId: new ObjectId(schoolId) });

        if (result.deletedCount === 0) {
            return { success: false, message: 'Pattern not found or already deleted.' };
        }

        revalidatePath('/dashboard/master-admin/configure-marks');
        return { success: true, message: 'Grading pattern deleted successfully!' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
