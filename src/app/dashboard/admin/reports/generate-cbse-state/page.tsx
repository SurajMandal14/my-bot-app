
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
import { FileText, Printer, RotateCcw, Loader2, User, School as SchoolIconUI, Search as SearchIcon, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AuthUser, UserRole } from '@/types/user';
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

const calculateFaTotal200MForRow = (subjectNameForBack: string, paperNameForBack: string, currentFaMarks: Record<string, FrontSubjectFAData>, scheme: AssessmentScheme | null): number | null => {
  if (!scheme) return null;
  const faSubjectKey = (subjectNameForBack === "Science") ? "Science" : subjectNameForBack;
  const subjectFaData = currentFaMarks[faSubjectKey];

  if (!subjectFaData) return null;

  let overallTotal = 0;
  scheme.assessments.filter(a => a.groupName.startsWith("FA")).forEach((assessment, index) => {
    const faPeriodKey = `fa${index + 1}` as keyof SubjectFAData;
    const periodMarks = subjectFaData[faPeriodKey];
    if (periodMarks) {
        assessment.tests.forEach((test, testIndex) => {
            const toolKey = `tool${testIndex + 1}` as keyof MarksEntry;
            overallTotal += periodMarks[toolKey] || 0;
        });
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
      
      const marksResult = await getStudentMarksForReportCard(
        currentStudent._id,
        currentStudent.schoolId!,
        frontAcademicYear
      );
      
      const newFaMarksForState: Record<string, FrontSubjectFAData> = getDefaultSubjectFaDataFront(currentLoadedClassSubjects);
      let tempSaDataForNewReport: ReportCardSASubjectEntry[] = [];
      
      if (marksResult.success && marksResult.marks && currentAssessmentScheme) {
        const allFetchedMarks = marksResult.marks;

        // Initialize SA data structure based on the scheme
        currentLoadedClassSubjects.forEach(subject => {
            const saGroupsForSubject = currentAssessmentScheme.assessments
                .filter(a => a.groupName.startsWith('SA'))
                .sort((a,b) => a.groupName.localeCompare(b.groupName));

            let papers: string[] = ["I"];
            if(subject.name === "Science") {
                papers = ["Physics", "Biology"];
            } else if(allFetchedMarks.some(m => m.subjectName === subject.name && m.assessmentName && m.assessmentName.includes('Paper2'))) {
                papers = ["I", "II"];
            }
            
            papers.forEach(paper => {
                const sa1Data: SAPaperData = JSON.parse(JSON.stringify(getDefaultSaPaperData()));
                const sa2Data: SAPaperData = JSON.parse(JSON.stringify(getDefaultSaPaperData()));
                
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
            if (!mark.assessmentName) return;

            const [assessmentGroup, ...restOfName] = mark.assessmentName.split('-');
            const testName = restOfName.join('-');
            
            const assessmentConfig = currentAssessmentScheme.assessments.find(a => a.groupName === assessmentGroup);
            if (!assessmentConfig) return;
            const testConfig = assessmentConfig.tests.find(t => t.testName === testName);
            if(!testConfig) return;

            if (assessmentGroup.startsWith("FA")) {
                const faPeriodIndex = currentAssessmentScheme.assessments.filter(a => a.groupName.startsWith("FA")).findIndex(a => a.groupName === assessmentGroup);
                if (faPeriodIndex === -1) return;

                const faPeriodKey = `fa${faPeriodIndex + 1}` as keyof SubjectFAData;
                
                const testIndex = assessmentConfig.tests.findIndex(t => t.testName === testName);
                if (testIndex === -1) return;
                const toolKey = `tool${testIndex + 1}` as keyof MarksEntry;

                if (newFaMarksForState[subjectIdentifier]?.[faPeriodKey] && toolKey in newFaMarksForState[subjectIdentifier][faPeriodKey]) {
                    (newFaMarksForState[subjectIdentifier][faPeriodKey] as any)[toolKey] = mark.marksObtained;
                }

            } else if (assessmentGroup.startsWith("SA")) {
                const saPeriod = (assessmentGroup.toLowerCase() === 'sa1' ? 'sa1' : 'sa2') as 'sa1' | 'sa2';
                const asKey = testConfig.testName.toLowerCase() as keyof SAPaperData;
                
                const dbPaperPart = "Paper1"; // Simplified assumption
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
          faTotal200M: calculateFaTotal200MForRow(row.subjectName, row.paper, newFaMarksForState, currentAssessmentScheme)
      }));
      setSaData(tempSaDataForNewReport);
      setCoMarks(defaultCoMarksFront);
      setAttendanceData(defaultAttendanceDataBack);
      setFinalOverallGradeInput(null);
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

  const handleFaMarksChange = (subjectIdentifier: string, faPeriodKey: keyof SubjectFAData, toolKey: keyof FrontMarksEntry, value: string) => {
      // This is now effectively read-only in this component
  };

  const handleCoMarksChange = (subjectIndex: number, saPeriodKey: 'sa1' | 'sa2' | 'sa3', type: 'Marks' | 'Max', value: string) => {
    // Read-only
  };

  const handleSaDataChange = (rowIndex: number, period: 'sa1' | 'sa2', fieldKey: keyof SAPaperData, value: string) => {
     // Read-only
  };
  
  const handleFaTotalChangeBack = (rowIndex: number, value: string) => {
     // Read-only
  };

  const handleAttendanceDataChange = (monthIndex: number, type: 'workingDays' | 'presentDays', value: string) => {
    // Read-only
  };
  
  const isFieldDisabledForRole = (subjectName?: string): boolean => {
    // In this component, everything should be read-only for all roles.
    return true; 
  };

  const handlePrint = () => window.print();
  
  const handleResetData = () => {
    setAdmissionIdInput("");
    initializeReportState(loadedClassSubjects);
    toast({ title: "Data Reset", description: "All fields have been reset for current view."});
  }

  const currentUserRole = authUser?.role as UserRole;

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
                disabled={isLoadingStudentAndClassData}
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
            <Button onClick={handleLoadStudentAndClassData} disabled={isLoadingStudentAndClassData || !admissionIdInput.trim() || !authUser || !authUser.schoolId}>
                {isLoadingStudentAndClassData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <SearchIcon className="mr-2 h-4 w-4"/>}
                Load Student Data
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrint} variant="outline" disabled={!loadedStudent}><Printer className="mr-2 h-4 w-4"/> Print Report</Button>
            <Button onClick={handleResetData} variant="destructive" className="ml-auto"><RotateCcw className="mr-2 h-4 w-4"/> Reset</Button>
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
            <div className="printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md">
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
          
            <div className="printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md">
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
