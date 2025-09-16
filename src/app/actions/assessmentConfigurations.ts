
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

// --- CONSTANTS ---
const DEFAULT_SCHEME_ID = 'default_cbse_state_scheme';


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

const defaultSchemeData: Omit<AssessmentScheme, '_id' | 'schoolId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'classIds'> = {
    schemeName: 'Default CBSE State Pattern',
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

export async function getAssessmentSchemes(schoolId: string): Promise<AssessmentSchemesResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID.' };
    }
    const { db } = await connectToDatabase();
    const collection = db.collection('assessment_schemes');
    
    // Find the single editable scheme for the school.
    let schemeDoc = await collection.findOne({ schoolId: new ObjectId(schoolId), _id: DEFAULT_SCHEME_ID });

    // If it doesn't exist, create it.
    if (!schemeDoc) {
        const newScheme: Omit<AssessmentScheme, 'createdAt' | 'updatedAt'> & { createdAt: Date, updatedAt: Date } = {
            _id: DEFAULT_SCHEME_ID,
            schoolId: new ObjectId(schoolId),
            ...defaultSchemeData,
            classIds: [], // Initially assigned to no classes
            createdBy: 'system',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await collection.insertOne(newScheme as any);
        schemeDoc = newScheme;
    }
    
    const finalScheme: AssessmentScheme = {
        _id: schemeDoc._id.toString(),
        schoolId: schemeDoc.schoolId.toString(),
        schemeName: schemeDoc.schemeName,
        classIds: (schemeDoc.classIds || []).map((id: ObjectId | string) => id.toString()),
        assessments: schemeDoc.assessments,
        createdBy: schemeDoc.createdBy.toString(),
        createdAt: new Date(schemeDoc.createdAt).toISOString(),
        updatedAt: new Date(schemeDoc.updatedAt).toISOString(),
    };

    return {
      success: true,
      schemes: [finalScheme],
    };
  } catch (error) {
    console.error("getAssessmentSchemes Error:", error);
    return { success: false, message: 'Failed to fetch or create the default assessment scheme.' };
  }
}

export async function getAssessmentSchemeForClass(classId: string, schoolId: string): Promise<AssessmentSchemeResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID.' };
    }
    
    const schemesResult = await getAssessmentSchemes(schoolId);
    if (!schemesResult.success || !schemesResult.schemes || schemesResult.schemes.length === 0) {
        return { success: false, message: "Could not load the default assessment scheme for the school." };
    }
    
    const defaultScheme = schemesResult.schemes[0];

    // Check if the classId is in the default scheme's classIds array
    if (defaultScheme.classIds.includes(classId)) {
        return {
          success: true,
          message: 'Scheme found.',
          scheme: defaultScheme,
        };
    } else {
        // If not assigned, return a version of the default scheme but indicate it's not assigned by name
        return {
            success: true,
            message: 'Class not explicitly assigned. Using unassigned default.',
            scheme: { ...defaultScheme, schemeName: 'Not Assigned (Using Default)' }
        }
    }
    
  } catch (error) {
    return { success: false, message: 'Failed to fetch assessment scheme for the class.' };
  }
}

export async function updateAssessmentScheme(
  schoolId: string,
  formData: AssessmentSchemeFormData,
): Promise<AssessmentSchemeResult> {
    try {
        if (!ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid School ID format.' };
        }
        
        const validatedFields = assessmentSchemeSchema.safeParse(formData);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed.', error: validatedFields.error.flatten().fieldErrors.toString() };
        }

        const { db } = await connectToDatabase();

        // Always update the single default scheme for the school
        const updateData = {
            ...validatedFields.data,
            updatedAt: new Date(),
        };

        const result = await db.collection('assessment_schemes').updateOne(
            { _id: DEFAULT_SCHEME_ID, schoolId: new ObjectId(schoolId) },
            { $set: updateData },
            { upsert: true } // Create it if it somehow doesn't exist
        );

        if (result.matchedCount === 0 && result.upsertedCount === 0) {
            return { success: false, message: 'Assessment scheme not found or access denied.' };
        }

        revalidatePath('/dashboard/master-admin/configure-marks');
        return { success: true, message: 'Default assessment scheme updated successfully.' };
    } catch (error) {
        return { success: false, message: 'An unexpected error occurred.' };
    }
}


export async function assignSchemeToClasses(classIds: string[], schoolId: string, assign: boolean): Promise<AssessmentSchemeResult> {
    try {
        if (!ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid School ID.' };
        }
        if (classIds.some(id => !ObjectId.isValid(id))) {
            return { success: false, message: 'Invalid Class ID in selection.' };
        }
        
        const { db } = await connectToDatabase();
        const schemesCollection = db.collection('assessment_schemes');

        const updateOperation = assign
            ? { $addToSet: { classIds: { $each: classIds } } }
            : { $pull: { classIds: { $in: classIds } } };

        const result = await schemesCollection.updateOne(
            { _id: DEFAULT_SCHEME_ID, schoolId: new ObjectId(schoolId) },
            updateOperation
        );
        
        if (result.matchedCount === 0) {
            // This case might happen if the scheme doesn't exist yet, we can try to create it.
            if(assign) {
                await getAssessmentSchemes(schoolId); // This will create it
                await schemesCollection.updateOne({ _id: DEFAULT_SCHEME_ID, schoolId: new ObjectId(schoolId) }, updateOperation);
            } else {
                 return { success: false, message: "Default scheme not found." };
            }
        }
        
        revalidatePath('/dashboard/master-admin/configure-marks');
        return { success: true, message: `Scheme assignment updated for ${classIds.length} class(es).` };

    } catch (e) {
        console.error("Assign Scheme Error:", e);
        return { success: false, message: "An unexpected error occurred during assignment." };
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
