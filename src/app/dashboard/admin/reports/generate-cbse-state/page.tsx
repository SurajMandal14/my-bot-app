
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import CBSEStateFront, { 
    type StudentData as FrontStudentData, 
    type SubjectFAData as FrontSubjectFAData, 
    type MarksEntry as FrontMarksEntryTypeImport, 
} from '@/components/report-cards/CBSEStateFront';
import CBSEStateBack, { 
    type ReportCardSASubjectEntry, 
    type ReportCardAttendanceMonth, 
    type SAPaperData
} from '@/components/report-cards/CBSEStateBack';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Printer, RotateCcw, Eye, EyeOff, Save, Loader2, User, School as SchoolIconUI, Search as SearchIcon, AlertTriangle, UploadCloud, XOctagon, AlertDialogTrigger } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { AuthUser, UserRole } from '@/types/user';
import { saveReportCard, getStudentReportCard, setReportCardPublicationStatus } from '@/app/actions/reports';
import type { ReportCardData, FormativeAssessmentEntryForStorage } from '@/types/report';
import { Input } from '@/components/ui/input'; 
import { Label } from '@/components/ui/label'; 
import { getStudentDetailsForReportCard, type StudentDetailsForReportCard } from '@/app/actions/schoolUsers';
import { getClassDetailsById } from '@/app/actions/classes';
import type { SchoolClassSubject } from '@/types/classes';
import type { School } from '@/types/school';
import { getStudentMarksForReportCard } from '@/app/actions/marks'; 
import type { MarkEntry as MarkEntryType } from '@/types/marks'; 
import { getAcademicYears } from '@/app/actions/academicYears';
import type { AcademicYear } from "@/types/academicYear";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getSchoolById } from '@/app/actions/schools';
import { getAssessmentSchemeForClass } from '@/app/actions/assessmentConfigurations';
import type { AssessmentScheme } from '@/types/assessment';


type FrontMarksEntry = FrontMarksEntryTypeImport;
type FaToolKey = keyof FrontMarksEntry;

const getDefaultSaPaperData = (): SAPaperData => ({
    as1: { marks: null, maxMarks: 20 },
    as2: { marks: null, maxMarks: 20 },
    as3: { marks: null, maxMarks: 20 },
    as4: { marks: null, maxMarks: 20 },
    as5: { marks: null, maxMarks: 20 },
    as6: { marks: null, maxMarks: 20 },
});

const getDefaultFaMarksEntryFront = (): FrontMarksEntry => ({ tool1: null, tool2: null, tool3: null, tool4: null });
const getDefaultSubjectFaDataFront = (subjects: SchoolClassSubject[]): Record<string, FrontSubjectFAData> => {
    const initialFaMarks: Record<string, FrontSubjectFAData> = {};
    (subjects || []).forEach(subject => {
        initialFaMarks[subject.name] = {
            fa1: getDefaultFaMarksEntryFront(),
            fa2: getDefaultFaMarksEntryFront(),
            fa3: getDefaultFaMarksEntryFront(),
            fa4: getDefaultFaMarksEntryFront(),
        };
    });
    return initialFaMarks;
};

const defaultCoMarksFront: any[] = []; 

const defaultStudentDataFront: FrontStudentData = {
  udiseCodeSchoolName: '', studentName: '', fatherName: '', motherName: '',
  class: '', section: '', studentIdNo: '', rollNo: '', medium: 'English',
  dob: '', admissionNo: '', examNo: '', aadharNo: '',
};

const defaultAttendanceDataBack: ReportCardAttendanceMonth[] = Array(11).fill(null).map(() => ({ workingDays: null, presentDays: null }));

const calculateFaTotal200MForRow = (subjectNameForBack: string, paperNameForBack: string, currentFaMarks: Record<string, FrontSubjectFAData>): number | null => {
  const faSubjectKey = (subjectNameForBack === "Science") ? "Science" : subjectNameForBack;
  const subjectFaData = currentFaMarks[faSubjectKey];

  if (!subjectFaData) return null;

  let overallTotal = 0;
  (['fa1', 'fa2', 'fa3', 'fa4'] as const).forEach(faPeriodKey => {
    const periodMarks = subjectFaData[faPeriodKey];
    if (periodMarks) {
      overallTotal += (periodMarks.tool1 || 0) + (periodMarks.tool2 || 0) + (periodMarks.tool3 || 0) + (periodMarks.tool4 || 0);
    }
  });
  
  return overallTotal > 200 ? 200 : overallTotal; 
};


export default function GenerateCBSEStateReportPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  
  const [admissionIdInput, setAdmissionIdInput] = useState<string>(""); 
  const [loadedStudent, setLoadedStudent] = useState<StudentDetailsForReportCard | null>(null);
  const [loadedClassSubjects, setLoadedClassSubjects] = useState<SchoolClassSubject[]>([]);
  const [teacherEditableSubjects, setTeacherEditableSubjects] = useState<string[]>([]);
  const [loadedSchool, setLoadedSchool] = useState<School | null>(null);
  const [isLoadingStudentAndClassData, setIsLoadingStudentAndClassData] = useState(false);

  const [studentData, setStudentData] = useState<FrontStudentData>(defaultStudentDataFront);
  const [faMarks, setFaMarks] = useState<Record<string, FrontSubjectFAData>>(getDefaultSubjectFaDataFront([])); 
  const [coMarks, setCoMarks] = useState<any[]>(defaultCoMarksFront); 
  const [frontSecondLanguage, setFrontSecondLanguage] = useState<'Hindi' | 'Telugu'>('Hindi');
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [frontAcademicYear, setFrontAcademicYear] = useState<string>("");

  const [saData, setSaData] = useState<ReportCardSASubjectEntry[]>([]); 
  const [attendanceData, setAttendanceData] = useState<ReportCardAttendanceMonth[]>(defaultAttendanceDataBack);
  const [finalOverallGradeInput, setFinalOverallGradeInput] = useState<string | null>(null);

  const [showBackSide, setShowBackSide] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null);
  const [loadedReportIsPublished, setLoadedReportIsPublished] = useState<boolean | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [actionToConfirm, setActionToConfirm] = useState<'publish' | 'unpublish' | null>(null);

  const [assessmentScheme, setAssessmentScheme] = useState<AssessmentScheme | null>(null);


  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && (parsedUser.role === 'admin' || parsedUser.role === 'teacher') && parsedUser.schoolId) { 
          setAuthUser(parsedUser);
        } else {
          toast({ variant: "destructive", title: "Access Denied", description: "You must be an admin or teacher." });
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Session Error", description: "Failed to load user data." });
      }
    }
  }, [toast]);
  
  const fetchAcademicYearsData = useCallback(async () => {
    const result = await getAcademicYears();
    if(result.success && result.academicYears) {
      setAcademicYears(result.academicYears);
      const defaultYear = result.academicYears.find(y => y.isDefault) || result.academicYears[0];
      if (defaultYear) {
        setFrontAcademicYear(defaultYear.year);
      }
    } else {
      toast({ variant: 'warning', title: 'Could not load academic years' });
    }
  }, [toast]);

  useEffect(() => {
    fetchAcademicYearsData();
  }, [fetchAcademicYearsData]);

  const initializeReportState = (subjects: SchoolClassSubject[] = []) => {
    setLoadedStudent(null);
    setLoadedClassSubjects(subjects);
    setTeacherEditableSubjects([]);
    setLoadedSchool(null);
    setStudentData(defaultStudentDataFront);
    setFaMarks(getDefaultSubjectFaDataFront(subjects));
    setCoMarks(defaultCoMarksFront);
    setSaData([]); 
    setAttendanceData(defaultAttendanceDataBack);
    setFinalOverallGradeInput(null);
    setLoadedReportId(null);
    setLoadedReportIsPublished(null);
    setAssessmentScheme(null);
  };

  const handleLoadStudentAndClassData = async () => {
    if (!admissionIdInput.trim()) {
      toast({ variant: "destructive", title: "Missing Input", description: "Please enter an Admission ID." });
      return;
    }
    if (!authUser || !authUser.schoolId || !authUser._id) {
        toast({ variant: "destructive", title: "Error", description: "Admin/Teacher session or school ID missing." });
        return;
    }
     if (!frontAcademicYear) {
      toast({ variant: "destructive", title: "Missing Input", description: "Please select an Academic Year." });
      return;
    }

    setIsLoadingStudentAndClassData(true);
    initializeReportState();
    
    try {
      const studentRes = await getStudentDetailsForReportCard(admissionIdInput, authUser.schoolId.toString(), frontAcademicYear);
      
      if (!studentRes.success || !studentRes.student) {
        toast({ variant: "destructive", title: "Student Not Found", description: studentRes.message || `Could not find student with Admission ID: ${admissionIdInput} for the selected academic year.` });
        setIsLoadingStudentAndClassData(false);
        return;
      }
      const currentStudent = studentRes.student;
      setLoadedStudent(currentStudent);
      
      const schoolRes = await getSchoolById(currentStudent.schoolId!);
      if(schoolRes.success && schoolRes.school) {
        setLoadedSchool(schoolRes.school);
      } else {
        toast({variant: "warning", title: "School Info", description: "Could not load school details for report header."});
      }

      let currentLoadedClassSubjects: SchoolClassSubject[] = [];
      let currentAssessmentScheme: AssessmentScheme | null = null;
      if (currentStudent.classId) {
        const classRes = await getClassDetailsById(currentStudent.classId, currentStudent.schoolId!);
        if (classRes.success && classRes.classDetails && classRes.classDetails.academicYear === frontAcademicYear) {
          currentLoadedClassSubjects = classRes.classDetails.subjects || [];
          setLoadedClassSubjects(currentLoadedClassSubjects);
          setFrontSecondLanguage(classRes.classDetails.secondLanguageSubjectName === "Telugu" ? "Telugu" : "Hindi");
          
          if (authUser.role === 'teacher' && classRes.classDetails.subjects) {
            const editableSubs = classRes.classDetails.subjects
              .filter(sub => sub.teacherId === authUser._id)
              .map(sub => sub.name);
            setTeacherEditableSubjects(editableSubs);
          }
          
          const schemeRes = await getAssessmentSchemeForClass(classRes.classDetails.name, currentStudent.schoolId!, frontAcademicYear);
          if(schemeRes.success && schemeRes.scheme) {
              currentAssessmentScheme = schemeRes.scheme;
              setAssessmentScheme(schemeRes.scheme);
          } else {
              toast({variant: 'destructive', title: "Scheme Missing", description: "Could not load the assessment scheme for this class. Report may be incorrect."})
          }


          setStudentData(prev => ({
            ...prev,
            udiseCodeSchoolName: schoolRes.school?.schoolName || '', 
            studentName: currentStudent.name || '',
            fatherName: currentStudent.fatherName || '',
            motherName: currentStudent.motherName || '',
            class: classRes.classDetails?.name || '', 
            section: currentStudent.section || '',
            studentIdNo: currentStudent._id || '', 
            rollNo: currentStudent.rollNo || '',
            dob: currentStudent.dob || '',
            admissionNo: currentStudent.admissionId || '',
            examNo: currentStudent.examNo || '',
            aadharNo: currentStudent.aadharNo || '',
          }));
        } else {
          toast({ variant: "destructive", title: "Class Details Error", description: classRes.message || `Could not load correct class details for student's assigned class for academic year ${frontAcademicYear}.`});
          setIsLoadingStudentAndClassData(false);
          return; 
        }
      } else {
         toast({ variant: "destructive", title: "Class Missing", description: `Student ${currentStudent.name} is not assigned to a class for this academic year.`});
         setIsLoadingStudentAndClassData(false);
         return;
      }
      
      const existingReportRes = await getStudentReportCard(
          currentStudent._id, 
          currentStudent.schoolId!, 
          frontAcademicYear,
          "Annual", 
          false 
      );

      if (existingReportRes.success && existingReportRes.reportCard) {
          const report = existingReportRes.reportCard;
          toast({title: "Existing Report Loaded", description: `Report for ${report.studentInfo.studentName} (${report.academicYear}) loaded.`});
          setStudentData(report.studentInfo);
          setFrontSecondLanguage(report.secondLanguage || 'Hindi');
          setFrontAcademicYear(report.academicYear);

          const loadedFaMarksState: Record<string, FrontSubjectFAData> = getDefaultSubjectFaDataFront(currentLoadedClassSubjects);
          report.formativeAssessments.forEach(reportSubjectFa => {
              if (loadedFaMarksState[reportSubjectFa.subjectName]) {
                loadedFaMarksState[reportSubjectFa.subjectName] = {
                    fa1: reportSubjectFa.fa1, fa2: reportSubjectFa.fa2,
                    fa3: reportSubjectFa.fa3, fa4: reportSubjectFa.fa4,
                };
              }
          });
          setFaMarks(loadedFaMarksState);
          setCoMarks(report.coCurricularAssessments || defaultCoMarksFront);
          
          let tempSaData = report.summativeAssessments;
          tempSaData = tempSaData.map(row => ({
              ...row,
              faTotal200M: calculateFaTotal200MForRow(row.subjectName, row.paper, loadedFaMarksState)
          }));
          setSaData(tempSaData);

          setAttendanceData(report.attendance.length > 0 ? report.attendance : defaultAttendanceDataBack);
          setFinalOverallGradeInput(report.finalOverallGrade);
          setLoadedReportId(report._id!.toString());
          setLoadedReportIsPublished(report.isPublished || false);

      } else { 
          setLoadedReportId(null);
          setLoadedReportIsPublished(null);
          toast({title: "Generating New Report", description: "Fetching all available marks..."});

          const marksResult = await getStudentMarksForReportCard(
            currentStudent._id,
            currentStudent.schoolId!,
            frontAcademicYear
          );
          
          const newFaMarksForState: Record<string, FrontSubjectFAData> = getDefaultSubjectFaDataFront(currentLoadedClassSubjects);
          let tempSaDataForNewReport: ReportCardSASubjectEntry[] = [];
          
          if (marksResult.success && marksResult.marks && currentAssessmentScheme) {
            const allFetchedMarks = marksResult.marks;

            const saTestNamesFromScheme = new Set<string>();
            currentAssessmentScheme.assessments
                .filter(a => a.groupName.startsWith('SA'))
                .forEach(a => a.tests.forEach(t => saTestNamesFromScheme.add(t.testName)));

            // Initialize SA data structure based on the scheme
            currentLoadedClassSubjects.forEach(subject => {
                const saGroupsForSubject = currentAssessmentScheme.assessments
                    .filter(a => a.groupName.startsWith('SA'))
                    .sort((a,b) => a.groupName.localeCompare(b.groupName));

                let papers: string[] = ["I"];
                if(subject.name === "Science") {
                    papers = ["Physics", "Biology"];
                } else if(allFetchedMarks.some(m => m.subjectName === subject.name && m.assessmentName.includes('Paper2'))) {
                    papers = ["I", "II"];
                }
                
                papers.forEach(paper => {
                    const sa1Data: SAPaperData = getDefaultSaPaperData();
                    const sa2Data: SAPaperData = getDefaultSaPaperData();
                    
                    const sa1Group = saGroupsForSubject.find(g => g.groupName === 'SA1');
                    if(sa1Group) sa1Group.tests.forEach(t => (sa1Data as any)[t.testName.toLowerCase()] = { marks: null, maxMarks: t.maxMarks });
                    
                    const sa2Group = saGroupsForSubject.find(g => g.groupName === 'SA2');
                    if(sa2Group) sa2Group.tests.forEach(t => (sa2Data as any)[t.testName.toLowerCase()] = { marks: null, maxMarks: t.maxMarks });

                    tempSaDataForNewReport.push({
                        subjectName: subject.name,
                        paper: paper,
                        sa1: sa1Data,
                        sa2: sa2Data,
                        faTotal200M: null
                    });
                });
            });

            // Map fetched marks to the structured state
            allFetchedMarks.forEach(mark => {
                const subjectIdentifier = mark.subjectName;
                const assessmentName = mark.assessmentName;
                const [assessmentGroup, ...restOfName] = assessmentName.split('-');
                
                if (assessmentGroup.startsWith("FA") && restOfName.length > 0) {
                    const faPeriodKey = assessmentGroup.toLowerCase() as keyof SubjectFAData;
                    const toolKey = restOfName.join('-').toLowerCase().replace('tool', 'tool') as FaToolKey;

                    if (newFaMarksForState[subjectIdentifier]?.[faPeriodKey] && toolKey in newFaMarksForState[subjectIdentifier][faPeriodKey]) {
                        (newFaMarksForState[subjectIdentifier][faPeriodKey] as any)[toolKey] = mark.marksObtained;
                    }
                } else if (assessmentGroup.startsWith("SA") && restOfName.length > 1) {
                    const saPeriod = (assessmentGroup.toLowerCase() === 'sa1' ? 'sa1' : 'sa2') as 'sa1' | 'sa2';
                    const dbPaperPart = restOfName[0];
                    const asKey = restOfName[1].toLowerCase() as keyof SAPaperData;
                    
                    let displayPaperName: string;
                    if (mark.subjectName === "Science") {
                        displayPaperName = dbPaperPart === 'Paper1' ? 'Physics' : 'Biology';
                    } else {
                        displayPaperName = dbPaperPart === 'Paper1' ? 'I' : 'II';
                    }
                    
                    const targetRow = tempSaDataForNewReport.find(row => row.subjectName === mark.subjectName && row.paper === displayPaperName);
                    
                    if (targetRow && targetRow[saPeriod]?.[asKey]) {
                        (targetRow[saPeriod] as any)[asKey] = {
                            marks: mark.marksObtained,
                            maxMarks: mark.maxMarks,
                        };
                    }
                }
            });

            setFaMarks(newFaMarksForState);
          } else { 
            if (marksResult.message) {
                toast({ variant: "info", title: "Marks Info", description: marksResult.message });
            }
            setFaMarks(getDefaultSubjectFaDataFront(currentLoadedClassSubjects)); 
          }
          
          tempSaDataForNewReport = tempSaDataForNewReport.map(row => ({
              ...row,
              faTotal200M: calculateFaTotal200MForRow(row.subjectName, row.paper, newFaMarksForState)
          }));
          setSaData(tempSaDataForNewReport);
          setCoMarks(defaultCoMarksFront);
          setAttendanceData(defaultAttendanceDataBack);
          setFinalOverallGradeInput(null);
          await handleSaveReportCard(true); // Initial autosave for a new report
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error Loading Data", description: "An unexpected error occurred."});
      console.error("Error loading student/class data:", error);
      initializeReportState();
    } finally {
      setIsLoadingStudentAndClassData(false);
    }
  };


  const handleStudentDataChange = (field: keyof FrontStudentData, value: string) => {
    if (isFieldDisabledForRole()) return; 
    setStudentData(prev => ({ ...prev, [field]: value }));
  };

  const handleFaMarksChange = (subjectIdentifier: string, faPeriod: keyof SubjectFAData, toolKey: keyof FrontMarksEntry, value: string) => {
    if (isFieldDisabledForRole(subjectIdentifier)) return; 
    
    const assessmentGroup = assessmentScheme?.assessments?.find(a => a.groupName === faPeriod.toUpperCase());
    const testConfig = assessmentGroup?.tests?.find(t => t.testName.toLowerCase().replace('tool ','tool') === toolKey);
    const maxMark = testConfig?.maxMarks || (toolKey === 'tool4' ? 20 : 10);
    
    const numValue = parseInt(value, 10);
    const validatedValue = isNaN(numValue) ? null : Math.min(Math.max(numValue, 0), maxMark);
    
    setFaMarks(prevFaMarks => {
      const currentSubjectMarks = prevFaMarks[subjectIdentifier] || {
        fa1: getDefaultFaMarksEntryFront(), fa2: getDefaultFaMarksEntryFront(),
        fa3: getDefaultFaMarksEntryFront(), fa4: getDefaultFaMarksEntryFront(),
      };
      const updatedPeriodMarks = { 
        ...(currentSubjectMarks[faPeriod] || getDefaultFaMarksEntryFront()), 
        [toolKey]: validatedValue 
      };
      const newFaMarks = { ...prevFaMarks, [subjectIdentifier]: { ...currentSubjectMarks, [faPeriod]: updatedPeriodMarks }};
      
      setSaData(currentSaData =>
        currentSaData.map(row => ({
          ...row,
          faTotal200M: calculateFaTotal200MForRow(row.subjectName, row.paper, newFaMarks)
        }))
      );
      return newFaMarks;
    });
  };

  const handleCoMarksChange = (subjectIndex: number, saPeriodKey: 'sa1' | 'sa2' | 'sa3', type: 'Marks' | 'Max', value: string) => {
    if (isFieldDisabledForRole("CoCurricular")) return;
  };

  const handleSaDataChange = (rowIndex: number, period: 'sa1' | 'sa2', fieldKey: keyof SAPaperData, value: string) => {
    const subjectName = saData[rowIndex]?.subjectName;
    if (isFieldDisabledForRole(subjectName)) return;

    const numValue = parseInt(value, 10);
    const validatedValue = isNaN(numValue) ? null : Math.max(numValue, 0);

    setSaData(prev => prev.map((row, idx) => {
        if (idx === rowIndex) {
            const updatedRow = { ...row };
            const paperData = updatedRow[period];
            const skillData = paperData[fieldKey];

            if (skillData) {
                skillData.marks = validatedValue;
            }
            return updatedRow;
        }
        return row;
    }));
  };
  
  const handleFaTotalChangeBack = (rowIndex: number, value: string) => {
    const subjectName = saData[rowIndex]?.subjectName;
    if (isFieldDisabledForRole(subjectName)) return; 
     const numValue = parseInt(value, 10);
     const validatedValue = isNaN(numValue) ? null : Math.min(Math.max(numValue, 0), 200);
     setSaData(prev => prev.map((row, idx) => 
        idx === rowIndex ? { ...row, faTotal200M: validatedValue } : row
     ));
  };

  const handleAttendanceDataChange = (monthIndex: number, type: 'workingDays' | 'presentDays', value: string) => {
    if (isFieldDisabledForRole()) return;
    const numValue = parseInt(value, 10);
    const validatedValue = isNaN(numValue) ? null : Math.max(numValue, 0);
    setAttendanceData(prev => prev.map((month, idx) => 
        idx === monthIndex ? { ...month, [type]: validatedValue } : month
    ));
  };
  
  const isFieldDisabledForRole = (subjectName?: string): boolean => {
    if (currentUserRole === 'student') return true;
    if (currentUserRole === 'admin' && !!loadedStudent) return false; 
    if (currentUserRole === 'teacher') {
      if (!subjectName) return true; 
      if (subjectName === "Science" && (teacherEditableSubjects.includes("Physics") || teacherEditableSubjects.includes("Biology"))) return false;
      return !teacherEditableSubjects.includes(subjectName);
    }
    return true; 
  };

  const handlePrint = () => window.print();
  
  const handleResetData = () => {
    setAdmissionIdInput("");
    initializeReportState(loadedClassSubjects);
    toast({ title: "Data Reset", description: "All fields have been reset for current view."});
  }

  const handleSaveReportCard = async (isAutoSave = false) => {
    if (!authUser || !authUser.schoolId || !authUser._id) {
      if(!isAutoSave) toast({ variant: "destructive", title: "Error", description: "Admin/Teacher session not found." });
      return;
    }
    if (!loadedStudent || !loadedStudent._id) {
       if(!isAutoSave) toast({ variant: "destructive", title: "Missing Student ID", description: "Please load student data first using Admission ID." });
      return;
    }
    setIsSaving(true);
    const formativeAssessmentsForStorage: FormativeAssessmentEntryForStorage[] = Object.entries(faMarks)
      .map(([subjectName, marksData]) => ({ subjectName, ...marksData }));
    
    for (const row of saData) {
        for (const saPeriod of ['sa1', 'sa2'] as const) {
            for (const asKey of Object.keys(row[saPeriod] || {}) as (keyof SAPaperData)[]) {
                const skill = row[saPeriod]?.[asKey];
                if (skill && skill.marks !== null && skill.maxMarks !== null && skill.marks > skill.maxMarks) {
                    if(!isAutoSave) toast({ variant: "destructive", title: "Validation Error", description: `${row.subjectName} (${row.paper}) ${saPeriod.toUpperCase()}-${asKey.toUpperCase()} marks (${skill.marks}) exceed max marks (${skill.maxMarks}).` });
                    setIsSaving(false); return;
                }
            }
        }
    }


    const reportPayload: Omit<ReportCardData, '_id' | 'createdAt' | 'updatedAt' | 'isPublished'> = {
      studentId: loadedStudent._id, 
      schoolId: (loadedSchool?._id || authUser.schoolId).toString(),
      academicYear: frontAcademicYear, 
      reportCardTemplateKey: 'cbse_state', 
      studentInfo: studentData,
      formativeAssessments: formativeAssessmentsForStorage, 
      coCurricularAssessments: coMarks,
      secondLanguage: frontSecondLanguage, 
      summativeAssessments: saData, 
      attendance: attendanceData,
      finalOverallGrade: finalOverallGradeInput, 
      generatedByAdminId: authUser._id.toString(), 
      term: "Annual",
    };
    const result = await saveReportCard(reportPayload);
    setIsSaving(false);
    if (result.success) {
      if(!isAutoSave) toast({ title: "Report Card Saved", description: result.message + (result.reportCardId ? ` ID: ${result.reportCardId}` : '') });
      if(result.reportCardId) setLoadedReportId(result.reportCardId);
      if(result.isPublished !== undefined) setLoadedReportIsPublished(result.isPublished);
    } else {
      if(!isAutoSave) toast({ variant: "destructive", title: "Save Failed", description: result.error || result.message });
    }
  };

  const handleConfirmPublishAction = async () => {
    if (!loadedReportId || !authUser || !authUser.schoolId || loadedReportIsPublished === null || !actionToConfirm) {
        toast({ variant: "destructive", title: "Error", description: "No report loaded or publication status unknown."});
        return;
    }
    await handleSaveReportCard(true); // Auto-save before publishing
    setIsPublishing(true);
    const result = await setReportCardPublicationStatus(loadedReportId, authUser.schoolId.toString(), actionToConfirm === 'publish');
    setIsPublishing(false);
    setActionToConfirm(null);
    if (result.success && result.isPublished !== undefined) {
        setLoadedReportIsPublished(result.isPublished);
        toast({ title: "Status Updated", description: result.message });
    } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || result.message });
    }
  };

  const currentUserRole = authUser?.role as UserRole;
  const canPublish = authUser?.role === 'admin' && !!loadedStudent && !!loadedReportId && !isPublishing;

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @page {
            size: landscape;
            margin: 0.5cm;
        }
        @media print {
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          .printable-report-card {
            display: block !important; /* Ensure both are visible for print */
            width: 100%;
            height: auto;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always; /* Ensure each card is on a new page */
          }
          .printable-report-card:last-child {
            page-break-after: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileText className="mr-2 h-6 w-6" /> Generate CBSE State Pattern Report Card
          </CardTitle>
          <CardDescription>
            Logged in as: <span className="font-semibold capitalize">{authUser?.role || 'N/A'}</span>. 
            Enter Student's Admission ID and select an academic year to load data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="w-full sm:w-auto">
              <Label htmlFor="admissionIdInput" className="mb-1 flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>Enter Admission ID</Label>
              <Input 
                id="admissionIdInput" placeholder="Enter Admission ID" value={admissionIdInput}
                onChange={(e) => setAdmissionIdInput(e.target.value)} className="w-full sm:min-w-[200px]"
                disabled={isLoadingStudentAndClassData || isSaving || isPublishing}
              />
            </div>
             {authUser?.schoolId && 
              <div className="w-full sm:w-auto">
                <Label className="mb-1 flex items-center"><SchoolIconUI className="mr-2 h-4 w-4 text-muted-foreground"/>School ID (Auto)</Label>
                <Input value={authUser.schoolId.toString()} disabled className="w-full sm:min-w-[180px]" />
              </div>
            }
             <div className="w-full sm:w-auto">
                <Label htmlFor="academicYearInput">Academic Year</Label>
                <Select
                  value={frontAcademicYear}
                  onValueChange={setFrontAcademicYear}
                  disabled={academicYears.length === 0}
                >
                  <SelectTrigger id="academicYearInput" className="w-full sm:min-w-[150px]">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year._id} value={year.year}>
                        {year.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <Button onClick={handleLoadStudentAndClassData} disabled={isLoadingStudentAndClassData || isSaving || isPublishing || !admissionIdInput.trim() || !authUser || !authUser.schoolId}>
                {isLoadingStudentAndClassData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <SearchIcon className="mr-2 h-4 w-4"/>}
                Load Student Data
            </Button>
          </div>
          {loadedReportId && loadedReportIsPublished !== null && (
             <p className="text-sm font-medium">
                Current Report Status: <span className={loadedReportIsPublished ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>
                    {loadedReportIsPublished ? "Published" : "Not Published"}
                </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>handleSaveReportCard(false)} disabled={isSaving || !loadedStudent}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
              {isSaving ? 'Saving...' : 'Save Report'}
            </Button>
            {currentUserRole === 'admin' && (
                <AlertDialog open={!!actionToConfirm} onOpenChange={(open) => !open && setActionToConfirm(null)}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      onClick={() => setActionToConfirm(loadedReportIsPublished ? 'unpublish' : 'publish')}
                      disabled={!canPublish}
                    >
                      {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (loadedReportIsPublished ? <XOctagon className="mr-2 h-4 w-4"/> : <UploadCloud className="mr-2 h-4 w-4"/>)}
                      {isPublishing ? "Updating..." : (loadedReportIsPublished ? "Unpublish Report" : "Publish Report")}
                    </Button>
                  </AlertDialogTrigger>
                  {actionToConfirm && (
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Action: {actionToConfirm === 'publish' ? 'Publish' : 'Unpublish'} Report?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will make the report card for <strong>{studentData.studentName}</strong> {actionToConfirm === 'publish' ? 'VISIBLE' : 'HIDDEN'} to the student. Are you sure you want to proceed?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleConfirmPublishAction}
                        className={actionToConfirm === 'unpublish' ? 'bg-destructive hover:bg-destructive/90' : ''}
                      >
                        Confirm {actionToConfirm === 'publish' ? 'Publish' : 'Unpublish'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                  )}
                </AlertDialog>
            )}
            <Button onClick={handlePrint} variant="outline" disabled={!loadedStudent}><Printer className="mr-2 h-4 w-4"/> Print Preview</Button>
            <Button onClick={() => setShowBackSide(prev => !prev)} variant="secondary" className="ml-auto mr-2" disabled={!loadedStudent}>
                {showBackSide ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                {showBackSide ? "View Front" : "View Back"}
            </Button>
            <Button onClick={handleResetData} variant="destructive"><RotateCcw className="mr-2 h-4 w-4"/> Reset All</Button>
          </div>
        </CardContent>
      </Card>

      {isLoadingStudentAndClassData && (
        <div className="flex justify-center items-center p-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg">Loading student and class information...</p>
        </div>
      )}

      {/* Report Card Display Area */}
      {!isLoadingStudentAndClassData && loadedStudent && authUser && (
        <div className="space-y-4">
            <div className={`printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md ${showBackSide ? 'hidden lg:block' : ''}`}>
                <CBSEStateFront
                  studentData={studentData} onStudentDataChange={handleStudentDataChange}
                  academicSubjects={loadedClassSubjects} 
                  assessmentScheme={assessmentScheme}
                  faMarks={faMarks} onFaMarksChange={handleFaMarksChange} 
                  coMarks={coMarks} onCoMarksChange={handleCoMarksChange} 
                  secondLanguage={frontSecondLanguage} onSecondLanguageChange={(val) => { if(!isFieldDisabledForRole()) setFrontSecondLanguage(val)}}
                  academicYear={frontAcademicYear} onAcademicYearChange={(val) => {if(!isFieldDisabledForRole()) setFrontAcademicYear(val)}}
                  currentUserRole={currentUserRole}
                  editableSubjects={teacherEditableSubjects}
                />
            </div>
          
            <div className={`printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md ${!showBackSide ? 'hidden lg:block' : ''}`}>
                <CBSEStateBack
                  saData={saData}
                  assessmentScheme={assessmentScheme}
                  onSaDataChange={handleSaDataChange}
                  onFaTotalChange={handleFaTotalChangeBack}
                  attendanceData={attendanceData} onAttendanceDataChange={handleAttendanceDataChange}
                  finalOverallGradeInput={finalOverallGradeInput} onFinalOverallGradeInputChange={setFinalOverallGradeInput}
                  secondLanguageSubjectName={frontSecondLanguage} 
                  currentUserRole={currentUserRole}
                  editableSubjects={teacherEditableSubjects} 
                />
            </div>
        </div>
      )}
      {!isLoadingStudentAndClassData && !loadedStudent && admissionIdInput && (
          <Card className="no-print border-destructive">
            <CardHeader className="flex-row items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive"/>
                <CardTitle className="text-destructive">Student Data Not Loaded</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Student data could not be loaded for Admission ID: <span className="font-semibold">{admissionIdInput}</span> for academic year <span className="font-semibold">{frontAcademicYear}</span>.</p>
                <p className="mt-1">Please ensure the Admission ID and Academic Year are correct and the student is properly configured in the system (assigned to a class, etc.).</p>
            </CardContent>
          </Card>
      )}
       {!isLoadingStudentAndClassData && !admissionIdInput && (
          <Card className="no-print">
            <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Enter an Admission ID and Academic Year, then click "Load Student Data" to begin.</p>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
