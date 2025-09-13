
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

// Result Types
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

// --- Assessment Scheme Actions ---

export async function createAssessmentScheme(
  formData: AssessmentSchemeFormData,
  masterAdminId: string,
  schoolId: string
): Promise<AssessmentSchemeResult> {
  try {
    const validatedFields = assessmentSchemeSchema.safeParse(formData);
    if (!validatedFields.success) {
      return { success: false, message: 'Validation failed.', error: validatedFields.error.flatten().fieldErrors.toString() };
    }
    if (!ObjectId.isValid(masterAdminId) || !ObjectId.isValid(schoolId)) {
        return { success: false, message: 'Invalid Admin or School ID.' };
    }

    const { db } = await connectToDatabase();
    
    // Convert class names back to class IDs for storage
    const classDocs = await db.collection('school_classes').find({ 
        schoolId: new ObjectId(schoolId),
        name: { $in: validatedFields.data.classIds }
    }).project({ _id: 1, name: 1 }).toArray();
    
    const classIdStrings = classDocs.map(c => c._id.toString());
    const classNames = classDocs.map(c => c.name);

    const newScheme = {
      ...validatedFields.data,
      classIds: classIdStrings, // Store IDs now
      classNames: classNames, // Store names for display
      schemeName: classNames.join(', '),
      schoolId: new ObjectId(schoolId),
      createdBy: new ObjectId(masterAdminId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('assessment_schemes').insertOne(newScheme);
    if (!result.insertedId) {
      return { success: false, message: 'Failed to create assessment scheme.' };
    }

    revalidatePath('/dashboard/master-admin/configure-marks');
    return { 
        success: true, 
        message: 'Assessment scheme created successfully!',
        scheme: { ...newScheme, _id: result.insertedId.toString() } as unknown as AssessmentScheme
    };
  } catch (error) {
    console.error("createAssessmentScheme Error:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

export async function getAssessmentSchemes(schoolId: string): Promise<AssessmentSchemesResult> {
  try {
    if (!ObjectId.isValid(schoolId)) {
      return { success: false, message: 'Invalid School ID.' };
    }
    const { db } = await connectToDatabase();
    const schemesDocs = await db.collection('assessment_schemes').find({ schoolId: new ObjectId(schoolId) }).sort({ createdAt: -1 }).toArray();
    
    const schemes: AssessmentScheme[] = schemesDocs.map(s => ({
        ...s,
        _id: s._id.toString(),
        schoolId: s.schoolId.toString(),
        createdBy: s.createdBy.toString(),
      })) as unknown as AssessmentScheme[];

    // If no schemes are found, return a default one.
    if (schemes.length === 0) {
      const defaultScheme: AssessmentScheme[] = [
        {
          _id: 'default_cbse_state',
          schoolId: schoolId,
          schemeName: 'CBSE State Pattern (Default)',
          classIds: ['All Classes'],
          classNames: ['All Classes'],
          assessments: [
            { groupName: 'FA1', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
            { groupName: 'FA2', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
            { groupName: 'FA3', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
            { groupName: 'FA4', tests: [{testName: 'Tool 1', maxMarks: 10}, {testName: 'Tool 2', maxMarks: 10}, {testName: 'Tool 3', maxMarks: 10}, {testName: 'Tool 4', maxMarks: 20}] },
            { groupName: 'SA1', tests: [{testName: 'AS1', maxMarks: 20}, {testName: 'AS2', maxMarks: 20}, {testName: 'AS3', maxMarks: 20}, {testName: 'AS4', maxMarks: 20}, {testName: 'AS5', maxMarks: 20}, {testName: 'AS6', maxMarks: 20}] },
            { groupName: 'SA2', tests: [{testName: 'AS1', maxMarks: 20}, {testName: 'AS2', maxMarks: 20}, {testName: 'AS3', maxMarks: 20}, {testName: 'AS4', maxMarks: 20}, {testName: 'AS5', maxMarks: 20}, {testName: 'AS6', maxMarks: 20}] },
          ],
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
      return {
        success: true,
        schemes: defaultScheme,
      };
    }
    
    return {
      success: true,
      schemes: schemes,
    };
  } catch (error) {
    return { success: false, message: 'Failed to fetch assessment schemes.' };
  }
}

export async function getAssessmentSchemeForClass(classId: string, schoolId: string): Promise<AssessmentSchemeResult> {
  try {
    if (!ObjectId.isValid(schoolId) || !ObjectId.isValid(classId)) {
      return { success: false, message: 'Invalid School or Class ID.' };
    }
    const { db } = await connectToDatabase();
    // Find a scheme where the classId is included in the classIds array
    const schemeDoc = await db.collection('assessment_schemes').findOne({
      schoolId: new ObjectId(schoolId),
      classIds: classId,
    });

    if (!schemeDoc) {
      return { success: false, message: 'No custom assessment scheme found for this class.' };
    }
    
    const scheme: AssessmentScheme = {
        ...schemeDoc,
        _id: schemeDoc._id.toString(),
        schoolId: schemeDoc.schoolId.toString(),
        createdBy: schemeDoc.createdBy.toString(),
      } as unknown as AssessmentScheme;

    return {
      success: true,
      message: 'Scheme found.',
      scheme: scheme,
    };
  } catch (error) {
    return { success: false, message: 'Failed to fetch assessment scheme for the class.' };
  }
}


export async function updateAssessmentScheme(
  schemeId: string,
  formData: AssessmentSchemeFormData,
  schoolId: string
): Promise<AssessmentSchemeResult> {
    try {
        if (!ObjectId.isValid(schemeId) || !ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid ID format.' };
        }
        const validatedFields = assessmentSchemeSchema.safeParse(formData);
        if (!validatedFields.success) {
            return { success: false, message: 'Validation failed.', error: validatedFields.error.flatten().fieldErrors.toString() };
        }

        const { db } = await connectToDatabase();
        const classDocs = await db.collection('school_classes').find({ 
            schoolId: new ObjectId(schoolId),
            name: { $in: validatedFields.data.classIds }
        }).project({ _id: 1, name: 1 }).toArray();

        const classIdStrings = classDocs.map(c => c._id.toString());
        const classNames = classDocs.map(c => c.name);

        const updateData = {
            ...validatedFields.data,
            classIds: classIdStrings,
            classNames: classNames,
            schemeName: classNames.join(', '),
            updatedAt: new Date(),
        };

        const result = await db.collection('assessment_schemes').updateOne(
            { _id: new ObjectId(schemeId), schoolId: new ObjectId(schoolId) },
            { $set: updateData }
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

export async function deleteAssessmentScheme(schemeId: string, schoolId: string): Promise<AssessmentSchemeResult> {
    try {
        if (!ObjectId.isValid(schemeId) || !ObjectId.isValid(schoolId)) {
            return { success: false, message: 'Invalid ID format.' };
        }
        const { db } = await connectToDatabase();
        const result = await db.collection('assessment_schemes').deleteOne({ _id: new ObjectId(schemeId), schoolId: new ObjectId(schoolId) });

        if (result.deletedCount === 0) {
            return { success: false, message: 'Scheme not found or already deleted.' };
        }

        revalidatePath('/dashboard/master-admin/configure-marks');
        return { success: true, message: 'Assessment scheme deleted successfully!' };
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
