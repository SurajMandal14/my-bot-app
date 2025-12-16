
"use client";

import React from 'react';
import type { UserRole } from '@/types/user';
import type { ReportCardSASubjectEntry, ReportCardAttendanceMonth, SAPaperData } from '@/types/report';
import type { AssessmentScheme } from '@/types/assessment';

export type { ReportCardSASubjectEntry, ReportCardAttendanceMonth, SAPaperData };


interface CBSEStateBackProps {
  saData: ReportCardSASubjectEntry[];
  assessmentScheme: AssessmentScheme | null;
  onSaDataChange: (rowIndex: number, period: 'sa1' | 'sa2', fieldKey: keyof SAPaperData, value: string) => void;
  onFaTotalChange: (rowIndex: number, value: string) => void; 
  
  attendanceData: ReportCardAttendanceMonth[];
  onAttendanceDataChange: (monthIndex: number, type: 'workingDays' | 'presentDays', value: string) => void;
  
  finalOverallGradeInput: string | null; 
  onFinalOverallGradeInputChange: (value: string) => void;

  secondLanguageSubjectName?: string; 

  currentUserRole: UserRole;
  editableSubjects?: string[];
}

// Grading Scales
const saGradeScale = (marks: number, maxMarks: number, _isSecondLang: boolean) => { 
  if (maxMarks === 0 || marks === null || maxMarks === null) return 'N/A';
  const percentage = (marks / maxMarks) * 100;
  if (percentage >= 91.25) return 'A1'; 
  if (percentage >= 81.25) return 'A2'; 
  if (percentage >= 71.25) return 'B1'; 
  if (percentage >= 61.25) return 'B2'; 
  if (percentage >= 51.25) return 'C1'; 
  if (percentage >= 41.25) return 'C2'; 
  if (percentage >= 35) return 'D1';    
  return 'D2';
};

const finalGradeScale = (marks: number, _isSecondLang: boolean) => { 
  if (marks === null) return 'N/A';
  if (marks >= 91) return 'A1';
  if (marks >= 81) return 'A2';
  if (marks >= 71) return 'B1';
  if (marks >= 61) return 'B2';
  if (marks >= 51) return 'C1';
  if (marks >= 41) return 'C2';
  if (marks >= 35) return 'D1';
  return 'D2';
};

const monthNames = ["June", "July", "August", "September", "October", "November", "December", "January", "February", "March", "April"];


const CBSEStateBack: React.FC<CBSEStateBackProps> = ({
  saData,
  assessmentScheme,
  onSaDataChange,
  onFaTotalChange,
  attendanceData,
  onAttendanceDataChange,
  finalOverallGradeInput,
  onFinalOverallGradeInputChange,
  secondLanguageSubjectName,
  currentUserRole,
  editableSubjects = [],
}) => {

  const isTeacher = currentUserRole === 'teacher';
  const isStudent = currentUserRole === 'student';
  const isAdmin = currentUserRole === 'admin';

  const isSubjectEditableForTeacher = (subjectName: string): boolean => {
    if (isTeacher) {
      if (subjectName === "Science" && (editableSubjects.includes("Physics") || editableSubjects.includes("Biology"))) {
        return true;
      }
      return editableSubjects.includes(subjectName);
    }
    return false; 
  };
  
  const calculateRowDerivedData = (rowData: ReportCardSASubjectEntry) => {
    const isSecondLang = rowData.subjectName === secondLanguageSubjectName;

    const sa1_data = rowData.sa1 || {};
    const sa2_data = rowData.sa2 || {};
    
    const sa1_total_marks = Object.values(sa1_data).reduce((sum, skill) => sum + (skill?.marks || 0), 0);
    const sa1_total_max_marks = Object.values(sa1_data).reduce((sum, skill) => sum + (skill?.maxMarks || 0), 0);

    const sa2_total_marks = Object.values(sa2_data).reduce((sum, skill) => sum + (skill?.marks || 0), 0);
    const sa2_total_max_marks = Object.values(sa2_data).reduce((sum, skill) => sum + (skill?.maxMarks || 0), 0);
    
    const sa1Grade = saGradeScale(sa1_total_marks, sa1_total_max_marks, isSecondLang);
    const sa2Grade = saGradeScale(sa2_total_marks, sa2_total_max_marks, isSecondLang);
    
    const faTotal200M_val = rowData.faTotal200M ?? 0;

    const sa1ForCalc = sa1_total_max_marks > 0 ? Math.min(sa1_total_marks, sa1_total_max_marks) : 0;
    const sa2ForCalc = sa2_total_max_marks > 0 ? Math.min(sa2_total_marks, sa2_total_max_marks) : 0;
    
    const faAvg50 = faTotal200M_val / 4; 
    const sa1_50_for_avg = sa1_total_max_marks > 0 ? sa1ForCalc * (50 / sa1_total_max_marks) : 0;
    const faAvgPlusSa1_100M = Math.round(faAvg50 + sa1_50_for_avg); 
    
    const internalMarks = Math.round(faTotal200M_val / 10);
    const sa2_external_80M = sa2_total_max_marks > 0 ? sa2ForCalc * (80 / sa2_total_max_marks) : 0;
    const finalTotal100M = Math.round(internalMarks + sa2_external_80M);
    const finalGrade = finalGradeScale(finalTotal100M, isSecondLang);
    
    return {
      sa1Total: sa1_total_marks, sa1Max: sa1_total_max_marks, sa1Grade,
      sa2Total: sa2_total_marks, sa2Max: sa2_total_max_marks, sa2Grade,
      faAvgPlusSa1_100M, internalMarks,
      finalTotal100M, finalGrade
    };
  };
  
  const calculateOverallFinalGrade = () => {
    const allFinalGrades: string[] = [];
    saData.forEach((rowData) => {
      if (rowData && typeof rowData === 'object') {
        const derived = calculateRowDerivedData(rowData);
        if (derived.finalGrade) {
          allFinalGrades.push(derived.finalGrade);
        }
      }
    });

    if (allFinalGrades.length === 0) return '';
    
    const gradeCounts: { [key: string]: number } = {};
    allFinalGrades.forEach(grade => {
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    });

    let maxCount = 0;
    let mostFrequentGrade = '';
    for (const grade in gradeCounts) {
      if (gradeCounts[grade] > maxCount) {
        maxCount = gradeCounts[grade];
        mostFrequentGrade = grade;
      }
    }
    return mostFrequentGrade;
  };

  const totalWorkingDays = attendanceData.slice(0, 11).reduce((sum, month) => sum + (month?.workingDays || 0), 0);
  const totalPresentDays = attendanceData.slice(0, 11).reduce((sum, month) => sum + (month?.presentDays || 0), 0);
  const attendancePercentage = totalWorkingDays > 0 ? Math.round((totalPresentDays / totalWorkingDays) * 100) : 0;
  
  const isPageReadOnlyForAdmin = isAdmin;

  // Detect summative groups by group naming only (SA prefix)
  const isSummativeGroup = (group: { groupName: string }) => {
    return group.groupName.toUpperCase().startsWith('SA');
  };
  const summativeGroups = (() => {
    const groups = assessmentScheme?.assessments || [];
    const hasTypedScheme = groups.some((g: any) => typeof g.type !== 'undefined');
    return hasTypedScheme
      ? groups.filter((g: any) => g.type === 'summative')
      : groups.filter(g => isSummativeGroup({ groupName: g.groupName }));
  })();
  const sa1Group = summativeGroups[0];
  const sa2Group = summativeGroups[1];
  const sa1Tests = sa1Group?.tests || [];
  const sa2Tests = sa2Group?.tests || [];
  const sa1Label = sa1Group?.groupName || 'Summative Assessment-1';
  const sa2Label = sa2Group?.groupName || 'Summative Assessment-2';


  return (
    <>
      <style jsx global>{`
        .report-card-back-container body, .report-card-back-container {
          font-family: Arial, sans-serif;
          font-size: 9px;
          padding: 8px;
          color: #000;
          background-color: #fff;
          overflow-x: hidden; /* Prevent horizontal scroll; allow wrapping */
        }
        .report-card-back-container table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed; /* Force columns to share available width and wrap */
          margin-bottom: 8px;
          max-width: 100%;
        }
        .report-card-back-container th, .report-card-back-container td {
          border: 1px solid #000;
          text-align: center;
          padding: 3px 6px;
          height: auto;
          word-break: break-word; /* Break long tokens */
          overflow-wrap: anywhere; /* Allow break at any point */
          white-space: normal; /* Wrap content */
          min-width: 0; /* Allow columns to shrink to fit */
        }
        .report-card-back-container th {
          background-color: #f0f0f0;
          font-size: 8px;
          vertical-align: middle;
          line-height: 1.2;
        }
        .report-card-back-container td {
            font-size: 9px;
            vertical-align: middle;
        }
        .report-card-back-container .small {
          font-size: 7px;
        }
        .report-card-back-container .bold {
          font-weight: bold;
        }
        .report-card-back-container .nowrap {
          white-space: nowrap;
        }
        .report-card-back-container input[type="number"], .report-card-back-container input[type="text"] {
          width: 28px;
          text-align: center;
          border: 1px solid #ccc;
          font-size: 9px;
          padding: 1px;
          box-sizing: border-box;
          -moz-appearance: textfield;
        }
        .report-card-back-container input:disabled {
            background-color: #f0f0f0 !important;
            color: #555 !important;
            cursor: not-allowed;
            border: 1px solid #ddd !important;
        }
        .report-card-back-container input.calculated-input {
             border: none;
             background-color: transparent;
             font-weight: bold;
        }
        .report-card-back-container input::-webkit-outer-spin-button,
        .report-card-back-container input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .report-card-back-container .calculated {
          background-color: #e9e9e9;
          font-weight: bold;
        }
        .report-card-back-container h2 {
            font-size: 14px;
            margin: 5px 0;
        }
        .report-card-back-container .subject-cell {
            text-align: left;
            padding-left: 5px;
            font-weight: bold;
            vertical-align: middle;
        }
         .report-card-back-container .paper-cell {
            font-style: italic;
            vertical-align: middle;
            font-size: 8px;
        }
        .report-card-back-container .attendance-table input[type="number"] {
            width: 35px;
        }
         .report-card-back-container .final-grade-input {
            width: 50px !important;
            font-weight: bold;
            border: 1px solid black !important;
         }
         .report-card-back-container .fatotal-input {
            width: 40px !important;
         }
      `}</style>
      <style jsx global>{`
        /* Print-specific rules for A4 Landscape */
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body { height: auto; }
          .report-card-back-container {
            width: 100%;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 9px; /* small reduction for print if needed */
          }
          .report-card-back-container table, #mainTable {
            table-layout: fixed !important;
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse;
          }
          .report-card-back-container th, .report-card-back-container td {
            padding: 3px 6px !important;
            font-size: 9px !important;
            line-height: 1 !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }
          .report-card-back-container input, .report-card-back-container select {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: auto !important;
          }
          /* Avoid breaking rows across pages */
          #mainTable tr { page-break-inside: avoid; }
        }
      `}</style>
      <div className="report-card-back-container">
        <h2 style={{ textAlign: 'center' }}>SUMMATIVE ASSESSMENT</h2>

        <table id="mainTable">
            <thead>
                <tr>
                    <th rowSpan={3}>Subject</th>
                    <th rowSpan={3} className="paper-cell">Paper</th>
                    {(() => {
                      const sa1Max = sa1Tests.reduce((sum, t) => sum + (t.maxMarks || 0), 0);
                      const colSpanSa1 = sa1Tests.length + 2; // tests + Total + Grade
                      return (
                        <th colSpan={colSpanSa1}>{`${sa1Label} (${sa1Max}M)`}</th>
                      );
                    })()}
                    {(() => {
                      const sa2Max = sa2Tests.reduce((sum, t) => sum + (t.maxMarks || 0), 0);
                      const colSpanSa2 = sa2Tests.length + 2; // tests + Total + Grade
                      return (
                        <th colSpan={colSpanSa2}>{`${sa2Label} (${sa2Max}M)`}</th>
                      );
                    })()}
                    <th colSpan={7}>Final Result (Based on FA+SA1 and Internal+SA2)</th>
                </tr>
                <tr>
                    <th colSpan={sa1Tests.length}>Assessment Skills</th>
                    <th rowSpan={2}>Total Marks</th>
                    <th rowSpan={2}>Grade</th>
                    <th colSpan={sa2Tests.length}>Assessment Skills</th>
                    <th rowSpan={2}>Total Marks</th>
                    <th rowSpan={2}>Grade</th>
                    <th rowSpan={2} className="small">FA (Total)</th>
                    <th rowSpan={2} className="small">SA1 (Adj)</th>
                    <th rowSpan={2} className="small">FA(Avg)+SA1 (100M)</th>
                    <th rowSpan={2} className="small">Internal (20M)</th>
                    <th rowSpan={2} className="small">SA2 (Adj)</th>
                    <th rowSpan={2} className="small">TOTAL (100M)</th>
                    <th rowSpan={2}>GRADE</th>
                </tr>
                <tr>
                    {sa1Tests.map(t => <th key={`sa1-head-${t.testName}`}>{t.testName} ({t.maxMarks}M)</th>)}
                    {sa2Tests.map(t => <th key={`sa2-head-${t.testName}`}>{t.testName} ({t.maxMarks}M)</th>)}
                </tr>
            </thead>
            <tbody>
                {saData.map((rowData, rowIndex) => {
                    if (!rowData || typeof rowData !== 'object') {
                        return <tr key={`invalid-row-${rowIndex}`}><td colSpan={24}>Invalid data</td></tr>;
                    }
                    const derived = calculateRowDerivedData(rowData);
                    const faTotal200M_display = rowData.faTotal200M ?? '';
                    const isInputDisabled = isStudent || isPageReadOnlyForAdmin || (isTeacher && !isSubjectEditableForTeacher(rowData.subjectName));
                    const isFirstPaperOfSubject = rowIndex === 0 || saData[rowIndex - 1].subjectName !== rowData.subjectName;
                    const subjectPaperCount = saData.filter(r => r.subjectName === rowData.subjectName).length;

                    return (
                        <tr key={`${rowData.subjectName}-${rowData.paper}-${rowIndex}`}>
                            {isFirstPaperOfSubject && <td rowSpan={subjectPaperCount} className="subject-cell">{rowData.subjectName}</td>}
                            <td className="paper-cell">{rowData.paper}</td>
                            
                            {/* SA1 Marks */}
                            {sa1Tests.map(test => {
                              const skillKey = test.testName.toLowerCase() as keyof SAPaperData;
                              return (
                                <td key={`sa1-${skillKey}`}>
                                    <input type="number" 
                                        value={rowData.sa1?.[skillKey]?.marks ?? ''} 
                                        onChange={e => onSaDataChange(rowIndex, 'sa1', skillKey, e.target.value)}
                                        disabled={isInputDisabled} 
                                    />
                                </td>
                            )})}
                            <td className="calculated">{derived.sa1Total}</td>
                            <td className="calculated">{derived.sa1Grade}</td>
                            
                            {/* SA2 Marks */}
                             {sa2Tests.map(test => {
                              const skillKey = test.testName.toLowerCase() as keyof SAPaperData;
                              return (
                                <td key={`sa2-${skillKey}`}>
                                    <input type="number" 
                                        value={rowData.sa2?.[skillKey]?.marks ?? ''} 
                                        onChange={e => onSaDataChange(rowIndex, 'sa2', skillKey, e.target.value)}
                                        disabled={isInputDisabled} 
                                    />
                                </td>
                            )})}
                            <td className="calculated">{derived.sa2Total}</td>
                            <td className="calculated">{derived.sa2Grade}</td>

                            {/* Final Result */}
                            <td><input type="number" className="fatotal-input" value={faTotal200M_display} onChange={e => onFaTotalChange(rowIndex, e.target.value)} disabled={isInputDisabled} /></td>
                            <td className="calculated">{derived.sa1Total}</td>
                            <td className="calculated">{derived.faAvgPlusSa1_100M}</td>
                            <td className="calculated">{derived.internalMarks}</td>
                            <td className="calculated">{derived.sa2Total}</td>
                            <td className="calculated">{derived.finalTotal100M}</td>
                            <td className="calculated">{derived.finalGrade}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>

        <p><strong>Final Grade in Curricular Areas:</strong> <input type="text" value={finalOverallGradeInput ?? calculateOverallFinalGrade()} onChange={e => onFinalOverallGradeInputChange(e.target.value)} className="final-grade-input" disabled={isStudent || isTeacher || isPageReadOnlyForAdmin} /></p>
        <p className="small-note">*(Internal 20M) Calculation assumes standard max marks. Grades based on percentage of max marks.</p>
        
        <table className="attendance-table">
          <thead>
            <tr><th colSpan={12}>ATTENDANCE REPORT</th><th rowSpan={2}>Total</th><th rowSpan={2}>%</th><th rowSpan={2}>Result</th></tr>
            <tr>
              <th>MONTH</th>
              {monthNames.map(month => <th key={month}>{month.substring(0,3)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>No. of Working days</td>
              {attendanceData.map((month, index) => (
                <td key={`wd-${index}`}><input type="number" value={month?.workingDays ?? ''} onChange={e => onAttendanceDataChange(index, 'workingDays', e.target.value)} disabled={isStudent || isTeacher || isPageReadOnlyForAdmin} /></td>
              ))}
              <td className="calculated">{totalWorkingDays}</td>
              <td rowSpan={2} className="calculated">{attendancePercentage}%</td>
              <td rowSpan={2}><input type="text" style={{width:'50px'}} disabled={isStudent || isTeacher || isPageReadOnlyForAdmin}/></td>
            </tr>
            <tr>
              <td>No. of days present</td>
              {attendanceData.map((month, index) => (
                <td key={`pd-${index}`}><input type="number" value={month?.presentDays ?? ''} onChange={e => onAttendanceDataChange(index, 'presentDays', e.target.value)} disabled={isStudent || isTeacher || isPageReadOnlyForAdmin}/></td>
              ))}
              <td className="calculated">{totalPresentDays}</td>
            </tr>
            <tr>
              <td>Sign. of Class Teacher</td><td colSpan={11}><input type="text" style={{width:'100%', textAlign:'left'}} disabled={isStudent || isTeacher || isPageReadOnlyForAdmin} /></td><td></td><td></td><th>Final Grade</th>
            </tr>
             <tr>
              <td>Sign. of Headmaster</td><td colSpan={11}><input type="text" style={{width:'100%', textAlign:'left'}} disabled={isStudent || isTeacher || isPageReadOnlyForAdmin} /></td><td></td><td></td><th>School Re Opening</th>
            </tr>
             <tr>
              <td>Sign. of Parent</td><td colSpan={11}><input type="text" style={{width:'100%', textAlign:'left'}} disabled={isStudent || isTeacher || isPageReadOnlyForAdmin} /></td><td></td><td></td><td><input type="text" style={{width:'100%'}} disabled={isStudent || isTeacher || isPageReadOnlyForAdmin}/></td>
            </tr>
          </tbody>
        </table>

        <table className="grades-legend-table">
          <thead>
            <tr><th colSpan={6}>The Grade Point Average (GPA) will be calculated by taking arithmetic average of Grade Points</th></tr>
            <tr>
              <th rowSpan={2}>Grade</th>
              <th colSpan={2}>Marks Scale (Based on % of Max)</th>
              <th colSpan={2}>Marks Scale (Based on % of Max)</th>
              <th rowSpan={2}>Grade Points</th>
            </tr>
            <tr>
              <th>Excl. 2nd Lang</th>
              <th>2nd Lang</th>
              <th>Excl. 2nd Lang</th>
              <th>2nd Lang</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>A1</td><td>91.25%-100%</td><td>90%-100%</td><td>91%-100%</td><td>90%-100%</td><td>10</td></tr>
            <tr><td>A2</td><td>81.25%-91.24%</td><td>78.75%-89%</td><td>81%-90%</td><td>79%-89%</td><td>9</td></tr>
            <tr><td>B1</td><td>71.25%-81.24%</td><td>67.5%-78.74%</td><td>71%-80%</td><td>68%-78%</td><td>8</td></tr>
            <tr><td>B2</td><td>61.25%-71.24%</td><td>57.5%-67.4%</td><td>61%-70%</td><td>57%-67%</td><td>7</td></tr>
            <tr><td>C1</td><td>51.25%-61.24%</td><td>45%-57.4%</td><td>51%-60%</td><td>46%-56%</td><td>6</td></tr>
            <tr><td>C2</td><td>41.25%-51.24%</td><td>35%-44.9%</td><td>41%-50%</td><td>35%-45%</td><td>5</td></tr>
            <tr><td>D1</td><td>35%-41.24%</td><td>20%-34.9%</td><td>35%-40%</td><td>20%-34%</td><td>4</td></tr>
            <tr><td>D2</td><td>0%-34.9%</td><td>0%-19.9%</td><td>0%-34%</td><td>0%-19%</td><td>-</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
};

export default CBSEStateBack;
