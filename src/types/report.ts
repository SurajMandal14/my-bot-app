

import type { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { ReportCardTemplateKey } from './school';
import type { StudentData as FrontStudentData, MarksEntry as FrontMarksEntryType } from '@/components/report-cards/CBSEStateFront';
import type { MarkEntry } from './marks';
import type { AssessmentScheme } from './assessment';
import type { SchoolClass } from './classes';

export interface FormativeAssessmentEntryForStorage {
  subjectName: string;
  fa1: FrontMarksEntryType;
  fa2: FrontMarksEntryType;
  fa3: FrontMarksEntryType;
  fa4: FrontMarksEntryType;
}

export interface AssessmentSkillScore {
  marks: number | null;
  maxMarks: number | null;
}

export interface SAPaperData {
  as1: AssessmentSkillScore;
  as2: AssessmentSkillScore;
  as3: AssessmentSkillScore;
  as4: AssessmentSkillScore;
  as5: AssessmentSkillScore;
  as6: AssessmentSkillScore;
}

export interface ReportCardSASubjectEntry {
  subjectName: string; 
  paper: string; // "I", "II", "Physics", "Biology"
  sa1: SAPaperData;
  sa2: SAPaperData;
  faTotal200M: number | null;
}

export interface ReportCardAttendanceMonth {
  workingDays: number | null;
  presentDays: number | null;
}


export interface ReportCardData {
  _id?: ObjectId | string;
  studentId: string;
  schoolId: ObjectId | string;
  academicYear: string;
  reportCardTemplateKey: ReportCardTemplateKey;
  
  studentInfo: FrontStudentData;
  formativeAssessments: FormativeAssessmentEntryForStorage[];
  coCurricularAssessments: any[];
  secondLanguage?: 'Hindi' | 'Telugu';

  summativeAssessments: ReportCardSASubjectEntry[];
  attendance: ReportCardAttendanceMonth[];
  finalOverallGrade: string | null;

  generatedByAdminId?: ObjectId | string;
  createdAt?: Date;
  updatedAt?: Date;
  term?: string;
  
  // Fields for live data transfer
  _rawMarksData?: MarkEntry[];
  _rawSchemeData?: AssessmentScheme;
  _rawClassData?: SchoolClass;
}

// --- Zod Schemas for Validation ---

const assessmentSkillScoreSchema = z.object({
  marks: z.number().nullable(),
  maxMarks: z.number().nullable(),
});

const saPaperDataSchema = z.object({
  as1: assessmentSkillScoreSchema,
  as2: assessmentSkillScoreSchema,
  as3: assessmentSkillScoreSchema,
  as4: assessmentSkillScoreSchema,
  as5: assessmentSkillScoreSchema,
  as6: assessmentSkillScoreSchema,
});

const reportCardSASubjectEntrySchemaForSave = z.object({
  subjectName: z.string(),
  paper: z.string(),
  sa1: saPaperDataSchema,
  sa2: saPaperDataSchema,
  faTotal200M: z.number().nullable(),
});

export const reportCardDataSchemaForSave = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  schoolId: z.string().min(1, "School ID is required."),
  academicYear: z.string().min(4, "Academic year is required."),
  reportCardTemplateKey: z.string().min(1, "Report card template key is required."),
  studentInfo: z.any(), 
  formativeAssessments: z.array(z.any()),
  coCurricularAssessments: z.array(z.any()),
  secondLanguage: z.enum(['Hindi', 'Telugu']).optional(),
  summativeAssessments: z.array(reportCardSASubjectEntrySchemaForSave),
  attendance: z.array(z.any()),
  finalOverallGrade: z.string().nullable(),
  generatedByAdminId: z.string().optional(),
  term: z.string().optional(),
});


// --- Server Action Result Types ---

// SaveReportCardResult is no longer needed as we are not saving reports.
// Keeping it commented out for now in case the feature is re-introduced.
/*
export interface SaveReportCardResult {
  success: boolean;
  message: string;
  error?: string;
  reportCardId?: string;
}
*/

export interface GetStudentReportCardResult {
  success: boolean;
  reportCard?: ReportCardData;
  message?: string;
  error?: string;
}

    
