
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
  admissionNo?: string;
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
  admissionNo,
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
    allFinalGrades.forEach(grade => { gradeCounts[grade] = (gradeCounts[grade] || 0) + 1; });
    let maxCount = 0; let mostFrequentGrade = '';
    for (const grade in gradeCounts) { if (gradeCounts[grade] > maxCount) { maxCount = gradeCounts[grade]; mostFrequentGrade = grade; } }
    return mostFrequentGrade;
  };

  const totalWorkingDays = attendanceData.slice(0, 11).reduce((sum, month) => sum + (month?.workingDays || 0), 0);
  const totalPresentDays = attendanceData.slice(0, 11).reduce((sum, month) => sum + (month?.presentDays || 0), 0);
  const attendancePercentage = totalWorkingDays > 0 ? Math.round((totalPresentDays / totalWorkingDays) * 100) : 0;
  
  const isPageReadOnlyForAdmin = isAdmin;

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

  const saKeyOrder: (keyof SAPaperData)[] = ['as1','as2','as3','as4','as5','as6'];
  
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
  return (
    <>
      <style jsx global>{`
        .report-card-back-container {
          width: 100%;
        }
        .sa-table-container {
          width: 100%;
          overflow-x: auto;
        }
        .sa-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
          font-size: 11px;
        }
        .sa-table th, .sa-table td {
          border: 1px solid #e5e7eb;
          padding: 3px 4px;
          background: #fff;
          text-align: center;
          vertical-align: middle;
          min-width: 40px;
        }
        .sa-table th.small, .sa-table td.small {
          white-space: nowrap;
        }
        .sa-table th.group-header {
          background: #f3f4f6;
          font-weight: 600;
          padding: 4px 2px;
        }
        .sa-table th.sub-header {
          background: #f9fafb;
          font-weight: 500;
          font-size: 10px;
          word-wrap: break-word;
          white-space: normal;
          max-width: 80px;
        }
        .sa-table td.test-input input {
          width: 35px;
          padding: 2px;
          text-align: center;
          border: 1px solid #d1d5db;
        }
        .sa-table td.fatotal-input input {
          width: 40px;
          padding: 2px;
          text-align: center;
          border: 1px solid #d1d5db;
        }
        .sa-table td.calculated {
          background: #f0fdf4;
          font-weight: 500;
        }
        .final-result-table th, .final-result-table td {
          border: 1px solid #e5e7eb;
          padding: 3px 4px;
          text-align: center;
          vertical-align: middle;
          background: #fff;
          font-size: 11px;
        }
        .final-result-table th {
          background: #f3f4f6;
          font-weight: 600;
          word-wrap: break-word;
          white-space: normal;
          max-width: 80px;
        }
        .final-result-table td.calculated {
          background: #f0fdf4;
          font-weight: 500;
        }
        .final-result-table td.fatotal-input input {
          width: 40px;
          padding: 2px;
          text-align: center;
          border: 1px solid #d1d5db;
        }
        .subtitle {
          margin-top: 12px;
          margin-bottom: 8px;
          font-weight: 700;
          font-size: 12px;
          text-align: center;
        }
        .attendance-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
          font-size: 11px;
          margin-top: 12px;
        }
        .attendance-table th, .attendance-table td {
          border: 1px solid #e5e7eb;
          padding: 3px 4px;
          text-align: center;
          vertical-align: middle;
          background: #fff;
        }
        .attendance-table th {
          background: #f3f4f6;
          font-weight: 600;
        }
        .attendance-table td.calculated {
          background: #f0fdf4;
          font-weight: 500;
        }
        .attendance-table input {
          width: 35px;
          padding: 2px;
          text-align: center;
          border: 1px solid #d1d5db;
          font-size: 10px;
        }
        .grades-legend-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: auto;
          font-size: 10px;
          margin-top: 12px;
        }
        .grades-legend-table th, .grades-legend-table td {
          border: 1px solid #e5e7eb;
          padding: 3px 4px;
          text-align: center;
          vertical-align: middle;
          background: #fff;
        }
        .grades-legend-table th {
          background: #f3f4f6;
          font-weight: 600;
        }
        .final-grade-input {
          padding: 4px 6px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 11px;
        }
        .small-note {
          font-size: 9px;
          color: #666;
          margin-top: 8px;
          font-style: italic;
        }
        .subject-cell.sa-subject-sticky {
          position: sticky;
          left: 0;
          background: #f5f5f5;
          font-weight: 600;
          min-width: 80px;
          z-index: 2;
        }
        .paper-cell {
          min-width: 50px;
          max-width: 60px;
          text-align: center;
        }
        /* Responsive: stack on mobile */
        @media (max-width: 768px) {
          .sa-table {
            font-size: 10px;
          }
          .sa-table th, .sa-table td {
            padding: 2px 3px;
            min-width: 32px;
          }
          .sa-table td.test-input input {
            width: 30px;
          }
        }
        /* Print-specific rules for A4 Landscape */
        @media print {
          html, body { height: auto; }
          .report-card-back-container {
            width: 100%;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 10px; /* compact for A4 landscape */
          }
          .report-card-back-container table, #mainTable {
            table-layout: fixed !important;
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse;
          }
          .report-card-back-container th, .report-card-back-container td {
            padding: 2px 3px !important;
            font-size: 9px !important;
            line-height: 1 !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }
          .report-card-back-container input, .report-card-back-container select {
            border: 0.5px solid #999 !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: auto !important;
            height: 18px !important;
            font-size: 9px !important;
          }
          /* Avoid breaking rows across pages */
          #mainTable tr { page-break-inside: avoid; }
          .sa-table-container {
            overflow: visible !important;
          }
          .subtitle {
            margin-top: 10px !important;
            margin-bottom: 6px !important;
            font-weight: 700 !important;
            text-align: center !important;
            font-size: 10px !important;
          }
        }
      `}</style>
      <div className="report-card-back-container">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <span style={{ fontWeight: 'bold', fontSize: 14 }}>Admission No: {admissionNo || '--'}</span>
        </div>
        <h2 style={{ textAlign: 'center' }}>SUMMATIVE ASSESSMENTS & FINAL RESULT</h2>

        {(() => {
          const sa1Group = summativeGroups[0];
          const sa2Group = summativeGroups[1];
          const sa1Tests = sa1Group?.tests || [];
          const sa2Tests = sa2Group?.tests || [];
          const sa1Max = sa1Tests.reduce((sum, t) => sum + (t.maxMarks || 0), 0);
          const sa2Max = sa2Tests.reduce((sum, t) => sum + (t.maxMarks || 0), 0);
          return (
            <div className="sa-table-container">
              <table className="sa-table" id="mainTable">
              <thead>
                {/* Group Headers */}
                <tr>
                  <th rowSpan={2}>Subject</th>
                  <th rowSpan={2}>Paper</th>
                  <th colSpan={sa1Tests.length + 2} className="group-header">SA1 ({sa1Max}M)</th>
                  <th colSpan={sa2Tests.length + 2} className="group-header">SA2 ({sa2Max}M)</th>
                  <th colSpan={4} className="group-header">Final Result (100M)</th>
                </tr>
                {/* Sub Headers */}
                <tr>
                  {sa1Tests.map((t) => (
                    <th key={`sa1-${t.testName}`} className="sub-header">
                      {t.testName}
                    </th>
                  ))}
                  <th className="sub-header">Total Marks</th>
                  <th className="sub-header">Grade</th>
                  {sa2Tests.map((t) => (
                    <th key={`sa2-${t.testName}`} className="sub-header">
                      {t.testName}
                    </th>
                  ))}
                  <th className="sub-header">Total Marks</th>
                  <th className="sub-header">Grade</th>
                  <th className="sub-header">FA (200M)</th>
                  <th className="sub-header">FA(Avg)+SA1 (100M)</th>
                  <th className="sub-header">Internal (20M)</th>
                  <th className="sub-header">TOTAL (100M)</th>
                  <th className="sub-header">GRADE</th>
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
                    <tr key={`combined-${rowData.subjectName}-${rowData.paper}-${rowIndex}`}>
                      {isFirstPaperOfSubject && <td rowSpan={subjectPaperCount} className="subject-cell sa-subject-sticky">{rowData.subjectName}</td>}
                      <td className="paper-cell">{rowData.paper}</td>
                      {sa1Tests.map((_, testIndex) => {
                        const skillKey = saKeyOrder[testIndex] || 'as1';
                        return (
                          <td key={`sa1-${rowIndex}-${String(skillKey)}`} className="test-input">
                            <input
                              type="number"
                              value={rowData.sa1?.[skillKey]?.marks ?? ''}
                              onChange={e => onSaDataChange(rowIndex, 'sa1', skillKey, e.target.value)}
                              disabled={isInputDisabled}
                              min="0"
                              max={sa1Tests[testIndex]?.maxMarks || 100}
                            />
                          </td>
                        );
                      })}
                      <td className="calculated">{derived.sa1Total}</td>
                      <td className="calculated">{derived.sa1Grade}</td>
                      {sa2Tests.map((_, testIndex) => {
                        const skillKey = saKeyOrder[testIndex] || 'as1';
                        return (
                          <td key={`sa2-${rowIndex}-${String(skillKey)}`} className="test-input">
                            <input
                              type="number"
                              value={rowData.sa2?.[skillKey]?.marks ?? ''}
                              onChange={e => onSaDataChange(rowIndex, 'sa2', skillKey, e.target.value)}
                              disabled={isInputDisabled}
                              min="0"
                              max={sa2Tests[testIndex]?.maxMarks || 100}
                            />
                          </td>
                        );
                      })}
                      <td className="calculated">{derived.sa2Total}</td>
                      <td className="calculated">{derived.sa2Grade}</td>
                      <td className="fatotal-input">
                        <input
                          type="number"
                          value={faTotal200M_display}
                          onChange={e => onFaTotalChange(rowIndex, e.target.value)}
                          disabled={isInputDisabled}
                          min="0"
                          max="200"
                        />
                      </td>
                      <td className="calculated">{derived.faAvgPlusSa1_100M}</td>
                      <td className="calculated">{derived.internalMarks}</td>
                      <td className="calculated">{derived.finalTotal100M}</td>
                      <td className="calculated">{derived.finalGrade}</td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          );
        })()}

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