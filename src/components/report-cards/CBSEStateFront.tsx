"use client";

import React from 'react';
import type { SchoolClassSubject } from '@/types/classes';
import type { UserRole } from '@/types/user';
import type { AssessmentScheme } from '@/types/assessment';

// --- 1. REFACTORED INTERFACES FOR DYNAMISM ---

export interface StudentData {
  udiseCodeSchoolName?: string;
  studentName?: string;
  fatherName?: string;
  motherName?: string;
  class?: string;
  section?: string;
  studentIdNo?: string;
  rollNo?: string;
  medium?: string;
  dob?: string;
  admissionNo?: string;
  examNo?: string;
  aadharNo?: string;
}

// Changed from hardcoded { tool1, tool2... } to dynamic dictionary
export type MarksEntry = Record<string, number | null>;

// Changed from hardcoded { fa1, fa2... } to dynamic dictionary
export type SubjectFAData = Record<string, MarksEntry>;

export interface CoCurricularSAData {
  sa1Max: number | null;
  sa1Marks: number | null;
  sa2Max: number | null;
  sa2Marks: number | null;
  sa3Max: number | null;
  sa3Marks: number | null;
}

interface CBSEStateFrontProps {
  studentData: StudentData;
  onStudentDataChange: (field: keyof StudentData, value: string) => void;

  academicSubjects: SchoolClassSubject[];
  assessmentScheme: AssessmentScheme | null;
  
  // Data is now a dynamic record of subjects
  faMarks: Record<string, SubjectFAData>;
  
  // Callback accepts strings now, allowing for 'fa1' or 'term1', 'tool1' or 'project'
  onFaMarksChange: (subjectIdentifier: string, faPeriod: string, toolKey: string, value: string) => void;

  coMarks: CoCurricularSAData[];
  onCoMarksChange: (subjectIndex: number, saPeriod: 'sa1' | 'sa2' | 'sa3', type: 'Marks' | 'Max', value: string) => void;

  secondLanguage: 'Hindi' | 'Telugu';
  onSecondLanguageChange: (value: 'Hindi' | 'Telugu') => void;

  academicYear: string;
  onAcademicYearChange: (value: string) => void;

  schoolLogoUrl?: string;

  currentUserRole: UserRole;
  editableSubjects?: string[];
}

// Grade scales
const overallSubjectGradeScale = [
  { min: 180, grade: 'A+' }, { min: 160, grade: 'A' },
  { min: 140, grade: 'B+' }, { min: 120, grade: 'B' },
  { min: 100, grade: 'C+' }, { min: 80, grade: 'C' },
  { min: 60, grade: 'D' }, { min: 40, grade: 'E' },
  { min: 0, grade: 'F' }
];

const faPeriodGradeScale = [
  { min: 46, grade: 'A1' }, { min: 41, grade: 'A2' },
  { min: 36, grade: 'B1' }, { min: 31, grade: 'B2' },
  { min: 26, grade: 'C1' }, { min: 21, grade: 'C2' },
  { min: 18, grade: 'D1' }, { min: 0, grade: 'D2' }
];
const faPeriodGradeScale2ndLang = [
  { min: 45, grade: 'A1' }, { min: 40, grade: 'A2' },
  { min: 34, grade: 'B1' }, { min: 29, grade: 'B2' },
  { min: 23, grade: 'C1' }, { min: 18, grade: 'C2' },
  { min: 10, grade: 'D1' }, { min: 0, grade: 'D2' }
];

const getGrade = (totalMarks: number, scale: { min: number; grade: string }[]): string => {
  for (let i = 0; i < scale.length; i++) {
    if (totalMarks >= scale[i].min) return scale[i].grade;
  }
  return scale[scale.length - 1]?.grade || 'N/A';
};


const CBSEStateFront: React.FC<CBSEStateFrontProps> = ({
  studentData,
  onStudentDataChange,
  academicSubjects,
  assessmentScheme,
  faMarks,
  onFaMarksChange,
  secondLanguage,
  onSecondLanguageChange,
  academicYear,
  onAcademicYearChange,
  currentUserRole,
  editableSubjects = [],
  schoolLogoUrl,
}) => {

  const formativeGroups = React.useMemo(() => {
    const groups = assessmentScheme?.assessments || [];
    return groups.filter((g: any) => g.type === 'formative');
  }, [assessmentScheme]);


  const isTeacher = currentUserRole === 'teacher';
  const isStudent = currentUserRole === 'student';
  const isAdmin = currentUserRole === 'admin';

  const isFieldDisabledForRole = (subjectName?: string): boolean => {
    if (isStudent) return true;
    if (isAdmin && !!studentData.studentIdNo) return true;
    if (isTeacher) {
      if (!subjectName) return true;
      return !editableSubjects.includes(subjectName);
    }
    return false;
  };

  // --- 2. REFACTORED CALCULATION LOGIC ---
  const calculateFaResults = React.useCallback((subjectIdentifier: string) => {
    const subjectFaData = faMarks[subjectIdentifier] || {};
    
    type Results = Record<string, { total: number; grade: string }> & { overallTotal: number; overallGrade: string };
    
    // Initialize results
    const results = {
        overallTotal: 0,
        overallGrade: 'N/A'
    } as Results;
    
    let currentOverallTotal = 0;

    const subjectName = subjectIdentifier;
    const isSecondLang = subjectName === secondLanguage;
    const currentFaPeriodGradeScale = isSecondLang ? faPeriodGradeScale2ndLang : faPeriodGradeScale;

    // Iterate strictly over the CONFIGURATION (formativeGroups)
    formativeGroups.forEach((assessment, index) => {
      // DYNAMIC KEY: Prefer assessment.id from config, fall back to fa{index}
      const faPeriodKey = (assessment as any).id || `fa${index + 1}`;
      
      // Get marks for this period (safe access)
      const periodMarks = subjectFaData[faPeriodKey] || {};

      let periodTotal = 0;

      // Sum up based on configured tests
      assessment.tests.forEach((test: any, testIndex: number) => {
        // DYNAMIC TOOL KEY: Prefer test.id from config, fall back to tool{index}
        const toolKey = test.id || `tool${testIndex + 1}`;
        
        // Ensure we handle strings/nulls safely
        const val = Number(periodMarks[toolKey]);
        periodTotal += isNaN(val) ? 0 : val;
      });

      currentOverallTotal += periodTotal;
      
      // Store result keyed by Group Name (or ID if you prefer)
      results[assessment.groupName] = { 
        total: periodTotal,
        grade: getGrade(periodTotal, currentFaPeriodGradeScale),
      };
    });

    results.overallTotal = currentOverallTotal;
    results.overallGrade = getGrade(currentOverallTotal, overallSubjectGradeScale);
    return results;
  }, [faMarks, secondLanguage, formativeGroups]);


  return (
    <>
      <style jsx global>{`
        /* Base container */
        .report-card-container body, .report-card-container {
          font-family: Arial, sans-serif;
          font-size: 11px;
          margin: 0;
          padding: 5px;
          color: #000;
          background-color: #fff;
          overflow-x: hidden;
        }
        .report-card-container table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
          margin-bottom: 10px;
          max-width: 100%;
        }
        .report-card-container th, .report-card-container td {
          border: 1px solid #e5e7eb;
          padding: 3px 4px;
          text-align: center;
          vertical-align: middle;
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
          min-width: 40px;
        }
        .report-card-container th.group-header {
          background: #f3f4f6;
          font-weight: 600;
          padding: 4px 2px;
        }
        .report-card-container th.sub-header {
          background: #f9fafb;
          font-weight: 500;
          font-size: 10px;
          word-wrap: break-word;
          white-space: normal;
          max-width: 80px;
        }
        .report-card-container td.calculated {
          background: #f0fdf4;
          font-weight: 500;
        }
        #fa-table thead tr:first-child th:first-child,
        #fa-table tbody td:first-child { min-width: 40px; }
        #fa-table thead tr:first-child th:nth-child(2),
        #fa-table tbody td:nth-child(2) { min-width: 80px; text-align: left; }
        #fa-table .fa-test-head, #fa-table .fa-test-cell { min-width: 40px; }
        #fa-table .fa-total-head, #fa-table .fa-total-cell { min-width: 45px; }
        #fa-table .fa-grade-head, #fa-table .fa-grade-cell { min-width: 45px; }
        
        @media (max-width: 768px) {
          .report-card-container th, .report-card-container td {
            padding: 2px 3px;
            font-size: 10px;
            min-width: 32px;
          }
          #fa-table .fa-test-cell input {
            width: 30px;
          }
        }
        
        @media print {
          .report-card-container {
            overflow-x: visible !important;
            padding: 0 !important;
            background: #fff !important;
            font-size: 9px !important;
          }
          .report-card-container table { min-width: 0 !important; width: 100% !important; table-layout: fixed !important; }
          .report-card-container th, .report-card-container td { padding: 2px 3px !important; font-size: 9px !important; max-width: none !important; }
          .subtitle {
            margin-top: 10px !important;
            margin-bottom: 6px !important;
            font-weight: 700 !important;
            text-align: center !important;
            font-size: 10px !important;
          }
          #fa-table .fa-test-head, #fa-table .fa-test-cell, #fa-table .fa-total-head, #fa-table .fa-total-cell, #fa-table .fa-grade-head, #fa-table .fa-grade-cell { min-width: auto !important; }
          #fa-table tbody td:first-child, #fa-table tbody .fa-subject-sticky { position: static !important; left: auto !important; z-index: auto !important; background: transparent !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
        .report-card-container .header-table td {
          border: none;
          text-align: left;
          padding: 2px 4px;
        }
        .report-card-container .title {
          text-align: center;
          font-weight: bold;
          font-size: 14px; 
          margin-bottom: 3px;
        }
        .report-card-container .subtitle {
          text-align: center;
          font-weight: 700;
          font-size: 12px; 
          margin-top: 12px;
          margin-bottom: 8px; 
        }
        .report-card-container .small-note {
          font-size: 12px; 
          margin-top: 8px; 
          text-align: left;
        }
        .report-card-container input[type="text"],
        .report-card-container input[type="number"],
        .report-card-container select {
          padding: 2px;
          border: 1px solid #ccc;
          border-radius: 2px;
          font-size: 12px;
          box-sizing: border-box;
          background-color: #fff;
          color: #000;
        }
        .report-card-container input:disabled, .report-card-container select:disabled {
          background-color: #f0f0f0 !important; 
          color: #555 !important;
          cursor: not-allowed;
          border: 1px solid #ddd !important;
        }
        .report-card-container input[type="number"] {
          width: 45px; 
          text-align: center;
          -moz-appearance: textfield; 
        }
        .report-card-container input::-webkit-outer-spin-button,
        .report-card-container input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .report-card-container .header-table input[type="text"] {
          width: 95%;
          max-width: 180px;
        }
         .report-card-container .header-table td:first-child input[type="text"] {
          max-width: 300px;
        }
        .report-card-container #fa-table input[type="number"]{
          width: 40px;
        }
        .report-card-container th {
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
          font-size: 12px;
          line-height: 1.2;
        }
         .report-card-container .header-table select {
            min-width: 90px;
            padding: 2px;
        }
        .report-card-container .academic-year-input {
            font-weight: bold;
            font-size: 14px; 
            border: 1px solid #ccc; 
            text-align: center;
            width: 100px; 
            display: inline-block; 
            vertical-align: baseline;
        }
        .report-card-container .academic-year-input:disabled {
            border: none; 
            background-color: transparent !important;
            color: #000 !important; 
        }
      `}</style>
      <style jsx global>{`
        @media print {
          html, body { height: auto; }
          .report-card-container {
            width: 100%;
            overflow: visible !important;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 12px;
          }
          .report-card-container .subtitle {
            margin-top: 10px !important;
            margin-bottom: 6px !important;
            font-weight: 700 !important;
            text-align: center !important;
            font-size: 11px !important;
          }
          .report-card-container table, #fa-table {
            table-layout: fixed !important;
            width: 100% !important;
            border-collapse: collapse;
            max-width: 100% !important;
          }
          .report-card-container th, .report-card-container td {
            padding: 4px 6px !important;
            font-size: 12px !important;
            line-height: 1 !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            max-width: 1px;
          }
          .report-card-container input, .report-card-container select {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: auto !important;
          }
          #fa-table tr { page-break-inside: avoid; }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {schoolLogoUrl && (
          <img
            src={schoolLogoUrl}
            alt="School Logo"
            style={{ height: 48, width: 48, objectFit: 'contain' }}
          />
        )}
        <input
          type="text"
          value={studentData.udiseCodeSchoolName || ""}
          readOnly
          style={{ textAlign: 'center' }}
        />
        <br></br><br></br>
      </div>
      <div className="report-card-container">
        <div className="title" style={{ fontWeight: 'bold', textAlign: 'center' }}>STUDENT ACADEMIC PERFORMANCE REPORT -
          <input
            type="text"
            className="academic-year-input"
            value={academicYear}
            onChange={e => onAcademicYearChange(e.target.value)}
            placeholder="20XX-20YY"
            disabled={isFieldDisabledForRole()}
          />
        </div>
        <table className="header-table"><tbody>
          <tr>
            <td colSpan={4}>
              <div style={{ flex: 1 }}>
                U-DISE Code & School Name : <input type="text" value={studentData.udiseCodeSchoolName || ""} onChange={e => onStudentDataChange('udiseCodeSchoolName', e.target.value)} disabled={isFieldDisabledForRole()} />
              </div>
            </td>
          </tr>
          <tr>
            <td>Student Name: <input type="text" value={studentData.studentName || ""} onChange={e => onStudentDataChange('studentName', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Father Name: <input type="text" value={studentData.fatherName || ""} onChange={e => onStudentDataChange('fatherName', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Mother Name: <input type="text" value={studentData.motherName || ""} onChange={e => onStudentDataChange('motherName', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Roll No: <input type="text" value={studentData.rollNo || ""} onChange={e => onStudentDataChange('rollNo', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
          </tr>
          <tr>
            <td>Class: <input type="text" value={studentData.class || ""} onChange={e => onStudentDataChange('class', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Section: <input type="text" value={studentData.section || ""} onChange={e => onStudentDataChange('section', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Admn. No: <input type="text" value={studentData.admissionNo || ""} onChange={e => onStudentDataChange('admissionNo', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
          </tr>
          <tr>
            <td>Medium: <input type="text" value={studentData.medium || ""} onChange={e => onStudentDataChange('medium', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Date of Birth: <input type="text" value={studentData.dob || ""} onChange={e => onStudentDataChange('dob', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Exam No: <input type="text" value={studentData.examNo || ""} onChange={e => onStudentDataChange('examNo', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            <td>Aadhar No: <input type="text" value={studentData.aadharNo || ""} onChange={e => onStudentDataChange('aadharNo', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
          </tr>
          <tr>
            <td colSpan={4}>
              Second Language:
              <select value={secondLanguage} onChange={(e) => onSecondLanguageChange(e.target.value as 'Hindi' | 'Telugu')} disabled={isFieldDisabledForRole()}>
                <option value="Hindi">Hindi</option>
                <option value="Telugu">Telugu</option>
              </select>
            </td>
          </tr>
        </tbody></table>

        <div className="subtitle">Formative Assessment</div>
        {(() => {
          return (
            <table className="fa-table" id="fa-table">
              <thead>
                {/* Group Headers */}
                <tr>
                  <th rowSpan={2}>Sl. No</th>
                  <th rowSpan={2}>Subject</th>
                  {formativeGroups.map((assessment, gIndex) => {
                    const groupMax = (assessment.tests || []).reduce((sum: number, t: any) => sum + (t.maxMarks || 0), 0);
                    return (
                      <th
                        key={`fa-group-${assessment.groupName || gIndex}`}
                        colSpan={(assessment.tests || []).length + 2}
                        className="group-header"
                      >
                        {assessment.groupName} ({groupMax}M)
                      </th>
                    );
                  })}
                </tr>
                {/* Sub Headers */}
                <tr>
                  {formativeGroups.map((assessment, gIndex) => {
                    return (
                      <React.Fragment key={`fa-subheaders-${assessment.groupName || gIndex}`}>
                        {assessment.tests.map((test: any, testIndex: number) => (
                          <th key={`fa-subhead-${assessment.groupName}-${testIndex}`} className="sub-header">
                            {test.testName} ({test.maxMarks}M)
                          </th>
                        ))}
                        <th className="sub-header">Total</th>
                        <th className="sub-header">Grade</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(academicSubjects || []).map((subject, SIndex) => {
                  const subjectIdentifier = subject.name;
                  const isCurrentSubjectDisabled = isFieldDisabledForRole(subjectIdentifier);
                  
                  // Get raw data or empty object, no forced defaults needed anymore
                  const subjectFaData = faMarks[subjectIdentifier] || {};
                  
                  // Calculate on the fly based on configuration
                  const results = calculateFaResults(subjectIdentifier);

                  return (
                    <tr key={`fa-row-${SIndex}-${subject.name}`}>
                      <td>{SIndex + 1}</td>
                      <td className="fa-subject-sticky" style={{ textAlign: 'left', paddingLeft: '5px' }}>{subject.name}</td>
                      
                      {/* --- 3. DYNAMIC RENDERING LOOP --- */}
                      {formativeGroups.map((assessment, gIndex) => {
                        // Dynamic Key Generation
                        const faPeriodKey = (assessment as any).id || `fa${gIndex + 1}`;
                        const periodData = subjectFaData[faPeriodKey] || {};

                        return (
                          <React.Fragment key={`fa-cells-${gIndex}-${subject.name}`}>
                            {assessment.tests.map((test: any, testIndex: number) => {
                              // Dynamic Tool Key Generation
                              const toolKey = test.id || `tool${testIndex + 1}`;
                              
                              return (
                                <td key={`fa-cell-${gIndex}-${SIndex}-${testIndex}-${toolKey}`} className="fa-test-cell">
                                  <input
                                    type="number"
                                    // Safely access dynamic property
                                    value={periodData[toolKey] ?? ''}
                                    onChange={(e) => onFaMarksChange(subjectIdentifier, faPeriodKey, toolKey, e.target.value)}
                                    max={test.maxMarks}
                                    min="0"
                                    disabled={isCurrentSubjectDisabled}
                                  />
                                </td>
                              );
                            })}
                            <td className="fa-total-cell calculated">{results[assessment.groupName]?.total ?? ''}</td>
                            <td className="fa-grade-cell calculated">{results[assessment.groupName]?.grade ?? ''}</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
        <p className="small-note">
          Formative Assessment Tools: (1) Children Participation and Reflections, (2) Project work, (3) Written work, (4) Slip Test (20M)
        </p>

        <p className="small-note" style={{ marginTop: '15px' }}>
          NOTE: In case of Science, Physical Science & Biological Science Teachers conduct & Record Formative Assessment Separately for 50 Marks each. Sum of FA1 to FA4 for Phy.Sci (200M) and Bio.Sci (200M) to be considered for respective rows on backside.
        </p>
      </div>
    </>
  );
};

export default CBSEStateFront;