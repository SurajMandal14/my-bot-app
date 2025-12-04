
"use client";

import React from 'react';
import type { SchoolClassSubject } from '@/types/classes';
import type { UserRole } from '@/types/user';
import type { AssessmentScheme } from '@/types/assessment';

// Define interfaces for props and state
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

export interface MarksEntry {
  tool1: number | null;
  tool2: number | null;
  tool3: number | null;
  tool4: number | null; // This is the 20M tool
}

export interface SubjectFAData {
  fa1: MarksEntry;
  fa2: MarksEntry;
  fa3: MarksEntry;
  fa4: MarksEntry;
}

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
  faMarks: Record<string, SubjectFAData>; 
  onFaMarksChange: (subjectIdentifier: string, faPeriod: keyof SubjectFAData, toolKey: keyof MarksEntry, value: string) => void;
  
  coMarks: CoCurricularSAData[]; // Kept for structure, but rendering removed
  onCoMarksChange: (subjectIndex: number, saPeriod: 'sa1' | 'sa2' | 'sa3', type: 'Marks' | 'Max', value: string) => void; // Kept for structure
  
  secondLanguage: 'Hindi' | 'Telugu';
  onSecondLanguageChange: (value: 'Hindi' | 'Telugu') => void;
  
  academicYear: string;
  onAcademicYearChange: (value: string) => void;

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
  // coMarks, // Prop kept
  // onCoMarksChange, // Prop kept
  secondLanguage,
  onSecondLanguageChange,
  academicYear,
  onAcademicYearChange,
  currentUserRole,
  editableSubjects = [],
}) => {
  // Helpers to classify assessment groups by group name only
  const isFormativeGroup = (group: { groupName: string }) => {
    return !group.groupName.toUpperCase().startsWith('SA');
  };

  const formativeGroups = React.useMemo(() => {
    const groups = assessmentScheme?.assessments || [];
    const hasTypedScheme = groups.some((g: any) => typeof g.type !== 'undefined');
    return hasTypedScheme
      ? groups.filter((g: any) => g.type === 'formative')
      : groups.filter(g => isFormativeGroup({ groupName: g.groupName }));
  }, [assessmentScheme]);

  const isTeacher = currentUserRole === 'teacher';
  const isStudent = currentUserRole === 'student';
  const isAdmin = currentUserRole === 'admin';

  const isFieldDisabledForRole = (subjectName?: string): boolean => {
    if (isStudent) return true;
    // Admins can see but not edit if a student is loaded.
    if (isAdmin && !!studentData.studentIdNo) return true; 
    if (isTeacher) {
      if (!subjectName) return true; // Disable general fields for teachers
      return !editableSubjects.includes(subjectName);
    }
    return false; // Superadmin can edit
  };


  const calculateFaResults = React.useCallback((subjectIdentifier: string) => {
    const subjectFaData = faMarks[subjectIdentifier];
    const defaultFaPeriodMarks: MarksEntry = { tool1: null, tool2: null, tool3: null, tool4: null };
    const dynamicDefaultSubjectFaData: any = {};
    formativeGroups.forEach((_, idx) => {
      const key = `fa${idx + 1}`;
      dynamicDefaultSubjectFaData[key] = { ...defaultFaPeriodMarks };
    });
    const currentSubjectData = subjectFaData || (dynamicDefaultSubjectFaData as SubjectFAData);

    type Results = Record<string, { total: number; grade: string }> & { overallTotal: number; overallGrade: string };
    const results = {} as Results;
    let currentOverallTotal = 0;
    results.overallTotal = 0;
    results.overallGrade = 'N/A';

    const subjectName = subjectIdentifier; 
    const isSecondLang = subjectName === secondLanguage;
    const currentFaPeriodGradeScale = isSecondLang ? faPeriodGradeScale2ndLang : faPeriodGradeScale;

    formativeGroups.forEach((assessment, index) => {
        const faPeriodKey = `fa${index + 1}` as keyof SubjectFAData;
        const periodMarks = currentSubjectData[faPeriodKey] || defaultFaPeriodMarks;
        
        let periodTotal = 0;
        assessment.tests.forEach((test, testIndex) => {
          const toolKey = `tool${testIndex + 1}` as keyof MarksEntry;
          periodTotal += periodMarks[toolKey] || 0;
        });

        currentOverallTotal += periodTotal;
        results[assessment.groupName] = { // Use dynamic group name for results key
          total: periodTotal,
          grade: getGrade(periodTotal, currentFaPeriodGradeScale),
        };
      });
      
    results.overallTotal = currentOverallTotal;
    results.overallGrade = getGrade(currentOverallTotal, overallSubjectGradeScale); 
    return results;
  }, [faMarks, secondLanguage, assessmentScheme]);


  return (
    <>
      <style jsx global>{`
        .report-card-container body, .report-card-container { 
          font-family: Arial, sans-serif;
          font-size: 11px; 
          margin: 0; 
          padding: 5px; 
          color: #000;
          background-color: #fff;
          overflow-x: auto; /* Enable horizontal scroll if too many columns */
        }
        .report-card-container table {
          border-collapse: collapse;
          width: 100%;
          table-layout: auto; /* Allow natural widths; avoid overly narrow columns */
          margin-bottom: 10px; 
          min-width: 1100px; /* Ensure table doesn't compress too much */
        }
        .report-card-container th, .report-card-container td {
          border: 1px solid #000;
          padding: 3px; 
          text-align: center;
          vertical-align: middle; 
          word-break: break-word; /* Break long continuous words */
          overflow-wrap: anywhere; /* Allow breaking at any point if needed */
          white-space: normal; /* Allow wrapping */
          max-width: 160px; /* Prevent extreme shrinking */
        }
        /* Ensure key FA columns don't shrink too much */
        /* S.No column */
        #fa-table thead tr:first-child th:first-child,
        #fa-table tbody td:first-child { min-width: 55px; }
        /* Subject column */
        #fa-table thead tr:first-child th:nth-child(2),
        #fa-table tbody td:nth-child(2) { min-width: 180px; text-align: left; }
        /* Overall TOTAL and GRADE (last two columns) */
        #fa-table thead tr:first-child th:nth-last-child(2),
        #fa-table tbody td:nth-last-child(2) { min-width: 90px; }
        #fa-table thead tr:first-child th:last-child,
        #fa-table tbody td:last-child { min-width: 80px; }
        /* FA per-group Total and Grade columns */
        #fa-table .fa-total-head, #fa-table .fa-total-cell { min-width: 50px; }
        #fa-table .fa-grade-head, #fa-table .fa-grade-cell { min-width: 50px; }
        /* Uniform widths for FA test columns via class */
        #fa-table .fa-test-head { min-width: 115px; }
        #fa-table .fa-test-cell { min-width: 105px; }
        .report-card-container .header-table td {
          border: none;
          text-align: left;
          padding: 1px 3px; 
        }
        .report-card-container .title {
          text-align: center;
          font-weight: bold;
          font-size: 14px; 
          margin-bottom: 3px; 
        }
        .report-card-container .subtitle {
          text-align: center;
          font-weight: bold;
          font-size: 12px; 
          margin-bottom: 8px; 
        }
        .report-card-container .small-note {
          font-size: 9px; 
          margin-top: 8px; 
          text-align: left;
        }
        .report-card-container input[type="text"], 
        .report-card-container input[type="number"], 
        .report-card-container select {
          padding: 2px; 
          border: 1px solid #ccc;
          border-radius: 2px; 
          font-size: 11px; 
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
          font-size: 10px; /* Slightly smaller to fit more headers */
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
      <div className="report-card-container">
        <div className="title">STUDENT ACADEMIC PERFORMANCE REPORT - 
            <input 
              type="text" 
              className="academic-year-input"
              value={academicYear} 
              onChange={e => onAcademicYearChange(e.target.value)}
              placeholder="20XX-20YY"
              disabled={isFieldDisabledForRole()}
            />
        </div>
        <div className="subtitle">CBSE STATE</div>

        <table className="header-table"><tbody>
            <tr>
              <td colSpan={4}>U-DISE Code & School Name : <input type="text" value={studentData.udiseCodeSchoolName || ""} onChange={e => onStudentDataChange('udiseCodeSchoolName', e.target.value)} disabled={isFieldDisabledForRole()} /></td>
            </tr>
            <tr>
              <td>Student Name: <input type="text" value={studentData.studentName || ""} onChange={e => onStudentDataChange('studentName', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
              <td>Father Name: <input type="text" value={studentData.fatherName || ""} onChange={e => onStudentDataChange('fatherName', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
              <td>Mother Name: <input type="text" value={studentData.motherName || ""} onChange={e => onStudentDataChange('motherName', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
               <td>Roll No: <input type="text" value={studentData.rollNo || ""} onChange={e => onStudentDataChange('rollNo', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
            </tr>
            <tr>
              <td>Class: <input type="text" value={studentData.class || ""} onChange={e => onStudentDataChange('class', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
              <td>Section: <input type="text" value={studentData.section || ""} onChange={e => onStudentDataChange('section', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
              {/* <td>Student ID No: <input type="text" value={studentData.studentIdNo || ""} onChange={e => onStudentDataChange('studentIdNo', e.target.value)} disabled={isFieldDisabledForRole()}/></td> */}
              <td>Admn. No: <input type="text" value={studentData.admissionNo || ""} onChange={e => onStudentDataChange('admissionNo', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
            </tr>
            <tr>
              <td>Medium: <input type="text" value={studentData.medium || ""} onChange={e => onStudentDataChange('medium', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
              <td>Date of Birth: <input type="text" value={studentData.dob || ""} onChange={e => onStudentDataChange('dob', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
              <td>Exam No: <input type="text" value={studentData.examNo || ""} onChange={e => onStudentDataChange('examNo', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
               <td>Aadhar No: <input type="text" value={studentData.aadharNo || ""} onChange={e => onStudentDataChange('aadharNo', e.target.value)} disabled={isFieldDisabledForRole()}/></td>
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
        <table id="fa-table">
          <thead>
            <tr>
              <th rowSpan={2}>Sl. No</th>
              <th rowSpan={2}>Subject</th>
              {formativeGroups.map(assessment => {
                  const groupMax = (assessment.tests || []).reduce((sum, t) => sum + (t.maxMarks || 0), 0);
                  const colSpan = (assessment.tests?.length || 0) + 2; // tests + Total + Grade
                  return (
                    <th key={assessment.groupName} colSpan={colSpan}>
                      {assessment.groupName} ({groupMax}M)
                    </th>
                  );
              })}
              <th rowSpan={2}>
                {(() => {
                  const overallFaMax = formativeGroups.reduce((sum, ag) => sum + (ag.tests || []).reduce((s, t) => s + (t.maxMarks || 0), 0), 0);
                  return `TOTAL (${overallFaMax}M)`;
                })()}
              </th>
              <th rowSpan={2}>GRADE</th>
            </tr>
            <tr>
                {formativeGroups.flatMap(assessment => {
                  const groupMax = (assessment.tests || []).reduce((sum, t) => sum + (t.maxMarks || 0), 0);
                  return assessment.tests
                    .map((test) => (
                      <th key={`${assessment.groupName}-${test.testName}`} className="fa-test-head">{test.testName} ({test.maxMarks}M)</th>
                    ))
                    .concat([
                      <th key={`${assessment.groupName}-Total`} className="fa-total-head">Total ({groupMax}M)</th>,
                      <th key={`${assessment.groupName}-Grade`} className="fa-grade-head">Grade</th>
                    ]);
                })}
            </tr>
          </thead>
          <tbody>
            {(academicSubjects || []).map((subject, SIndex) => { 
              const subjectIdentifier = subject.name; 
              const isCurrentSubjectDisabled = isFieldDisabledForRole(subjectIdentifier);
              const defaultFaPeriodMarksRow: MarksEntry = { tool1: null, tool2: null, tool3: null, tool4: null };
              const dynamicDefaultSubjectFaRow: any = {};
              formativeGroups.forEach((_, idx) => {
                const key = `fa${idx + 1}`;
                dynamicDefaultSubjectFaRow[key] = { ...defaultFaPeriodMarksRow };
              });
              const subjectFaData = faMarks[subjectIdentifier] || (dynamicDefaultSubjectFaRow as SubjectFAData);
              const results = calculateFaResults(subjectIdentifier);
              return (
                <tr key={subject.name}>
                  <td>{SIndex + 1}</td>
                  <td style={{textAlign: 'left', paddingLeft: '5px'}}>{subject.name}</td>
                  {formativeGroups.map((assessment, index) => {
                     const faPeriodKey = `fa${index + 1}` as keyof SubjectFAData;
                     const periodData = subjectFaData[faPeriodKey];
                     return (
                        <React.Fragment key={faPeriodKey}>
                        {assessment.tests.map((test, testIndex) => {
                            const toolKey = `tool${testIndex+1}` as keyof MarksEntry;
                            return (
                            <td key={`${faPeriodKey}-${toolKey}`} className="fa-test-cell">
                                <input
                                    type="number"
                                    value={periodData?.[toolKey] ?? ''}
                                    onChange={(e) => onFaMarksChange(subjectIdentifier, faPeriodKey, toolKey, e.target.value)}
                                    max={test.maxMarks}
                                    min="0"
                                    disabled={isCurrentSubjectDisabled}
                                />
                                </td>
                            );
                        })}
                        <td className="fa-total-cell">{results[assessment.groupName]?.total ?? ''}</td>
                        <td className="fa-grade-cell">{results[assessment.groupName]?.grade ?? ''}</td>
                        </React.Fragment>
                     );
                  })}
                  <td>{results.overallTotal}</td>
                  <td>{results.overallGrade}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="small-note">
          Formative Assessment Tools: (1) Children Participation and Reflections, (2) Project work, (3) Written work, (4) Slip Test (20M)
        </p>
        
        <p className="small-note" style={{marginTop: '15px'}}>
            NOTE: In case of Science, Physical Science & Biological Science Teachers conduct & Record Formative Assessment Separately for 50 Marks each. Sum of FA1 to FA4 for Phy.Sci (200M) and Bio.Sci (200M) to be considered for respective rows on backside.
        </p>
      </div>
    </>
  );
};

export default CBSEStateFront;
