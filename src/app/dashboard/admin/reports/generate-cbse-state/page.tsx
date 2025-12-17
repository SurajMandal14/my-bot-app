
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import CBSEStateFront, { 
    type StudentData as FrontStudentData, 
    type SubjectFAData as FrontSubjectFAData, 
    type MarksEntry as FrontMarksEntryType, 
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
import { getStudentReportCard } from '@/app/actions/reports';
import type { ReportCardData } from '@/types/report';
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


type FrontMarksEntry = FrontMarksEntryType;
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

const defaultCoMarksFront: any[] = []; 

const defaultStudentDataFront: FrontStudentData = {
  udiseCodeSchoolName: '', studentName: '', fatherName: '', motherName: '',
  class: '', section: '', studentIdNo: '', rollNo: '', medium: 'English',
  dob: '', admissionNo: '', examNo: '', aadharNo: '',
};

const defaultAttendanceDataBack: ReportCardAttendanceMonth[] = Array(11).fill(null).map(() => ({ workingDays: null, presentDays: null }));

// Helpers to classify assessment groups by explicit group naming only
const isFormativeGroup = (group: { groupName: string }) => {
  return !group.groupName.toUpperCase().startsWith('SA');
};

const isSummativeGroup = (group: { groupName: string }) => {
  return group.groupName.toUpperCase().startsWith('SA');
};

const calculateFaTotal200MForRow = (subjectNameForBack: string, paperNameForBack: string, currentFaMarks: Record<string, FrontSubjectFAData>, scheme: AssessmentScheme | null): number | null => {
  if (!scheme) return null;
  const faSubjectKey = (subjectNameForBack === "Science") ? "Science" : subjectNameForBack;
  const subjectFaData = currentFaMarks[faSubjectKey];

  if (!subjectFaData) return null;

  let overallTotal = 0;
  const hasTypedScheme = Array.isArray(scheme.assessments) && scheme.assessments.some((g: any) => typeof g.type !== 'undefined');
  const formativeGroups = hasTypedScheme
    ? scheme.assessments.filter((g: any) => g.type === 'formative')
    : scheme.assessments.filter(g => isFormativeGroup({ groupName: g.groupName }));
  formativeGroups.forEach((assessment, index) => {
    const faPeriodKey = `fa${index + 1}` as keyof FrontSubjectFAData;
    const periodMarks = subjectFaData[faPeriodKey];
    if (periodMarks) {
        assessment.tests.forEach((test, testIndex) => {
            const toolKey = `tool${testIndex + 1}` as keyof FrontMarksEntry;
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
  const [isLoadingStudentAndClassData, setIsLoadingStudentAndClassData] = useState(false);

  // Live data state
  const [studentData, setStudentData] = useState<FrontStudentData | null>(null);
  const [faMarks, setFaMarks] = useState<Record<string, FrontSubjectFAData>>({}); 
  const [coMarks, setCoMarks] = useState<any[]>(defaultCoMarksFront); 
  const [frontSecondLanguage, setFrontSecondLanguage] = useState<'Hindi' | 'Telugu'>('Hindi');
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [frontAcademicYear, setFrontAcademicYear] = useState<string>("");
  const [saData, setSaData] = useState<ReportCardSASubjectEntry[]>([]); 
  const [attendanceData, setAttendanceData] = useState<ReportCardAttendanceMonth[]>(defaultAttendanceDataBack);
  const [finalOverallGradeInput, setFinalOverallGradeInput] = useState<string | null>(null);
  const [assessmentScheme, setAssessmentScheme] = useState<AssessmentScheme | null>(null);
  const [loadedClassSubjects, setLoadedClassSubjects] = useState<SchoolClassSubject[]>([]);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);


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
      toast({ variant: 'default', title: 'Could not load academic years' });
    }
  }, [toast]);

  useEffect(() => {
    fetchAcademicYearsData();
  }, [fetchAcademicYearsData]);

  const initializeReportState = () => {
    setStudentData(null);
    setFaMarks({});
    setCoMarks(defaultCoMarksFront);
    setSaData([]); 
    setAttendanceData(defaultAttendanceDataBack);
    setFinalOverallGradeInput(null);
    setAssessmentScheme(null);
    setLoadedClassSubjects([]);
  };

  const handleLoadStudentAndClassData = async () => {
    if (!admissionIdInput.trim() || !authUser?.schoolId || !frontAcademicYear) {
      toast({ variant: "destructive", title: "Missing Input", description: "Please enter an Admission ID and select an Academic Year." });
      return;
    }

    setIsLoadingStudentAndClassData(true);
    initializeReportState();
    
    try {
    const studentIdRes = await getStudentDetailsForReportCard(admissionIdInput, String(authUser.schoolId), frontAcademicYear);
    if(!studentIdRes.success || !studentIdRes.student) {
      toast({ variant: "destructive", title: "Student Not Found", description: studentIdRes.message || `Could not find student with Admission ID: ${admissionIdInput}.` });
      setIsLoadingStudentAndClassData(false);
      return;
    }
      
      const reportRes = await getStudentReportCard(String(studentIdRes.student._id), String(authUser.schoolId), frontAcademicYear);
      
      if (!reportRes.success || !reportRes.reportCard) {
        console.log(reportRes);
        toast({ variant: "destructive", title: "Report Generation Failed", description: reportRes.message || "Could not generate the report card data." });
        setIsLoadingStudentAndClassData(false);
        return;
      }

      const { reportCard } = reportRes;
      const currentAssessmentScheme = reportCard._rawSchemeData!;
      const currentClass = reportCard._rawClassData!;
      const allFetchedMarks = reportCard._rawMarksData || [];

      setAssessmentScheme(currentAssessmentScheme);
      setLoadedClassSubjects(currentClass.subjects);
      setStudentData(reportCard.studentInfo);
      setFrontSecondLanguage(currentClass.secondLanguageSubjectName === "Telugu" ? "Telugu" : "Hindi");

      const newFaMarksForState: Record<string, FrontSubjectFAData> = {};
      const newSaDataForState: ReportCardSASubjectEntry[] = [];
      const formativeGroups = currentAssessmentScheme.assessments.filter(isFormativeGroup);
      
      currentClass.subjects.forEach(subject => {
        // Build FA periods dynamically based on scheme
        const faPeriodObj: any = {};
        formativeGroups.forEach((_, idx) => {
          const key = `fa${idx + 1}`;
          faPeriodObj[key] = getDefaultFaMarksEntryFront();
        });
        newFaMarksForState[subject.name] = faPeriodObj as FrontSubjectFAData;
        let papers: string[] = ["I"];
        if(subject.name === "Science") papers = ["Physics", "Biology"];
        else if(allFetchedMarks.some(m => m.subjectName === subject.name && m.assessmentName && m.assessmentName.includes('Paper2'))) papers = ["I", "II"];
        papers.forEach(paper => {
            newSaDataForState.push({ subjectName: subject.name, paper, sa1: JSON.parse(JSON.stringify(getDefaultSaPaperData())), sa2: JSON.parse(JSON.stringify(getDefaultSaPaperData())), faTotal200M: null });
        });
      });

      allFetchedMarks.forEach(mark => {
        // Support older mark documents that may not have `assessmentName`
        const assessmentName = mark.assessmentName || (mark.assessmentKey && mark.testKey ? `${mark.assessmentKey}-${mark.testKey}` : undefined);
        if (!assessmentName) return;
        const [assessmentGroup, ...restOfName] = assessmentName.split('-');
        const testName = restOfName.join('-');

        const assessmentConfig = currentAssessmentScheme.assessments.find(a => a.groupName === assessmentGroup);
        if (!assessmentConfig) return;
        const testConfig = assessmentConfig.tests.find(t => t.testName === testName);
        if(!testConfig) return;

        if ((typeof (assessmentConfig as any).type !== 'undefined' && (assessmentConfig as any).type === 'formative') ||
          (typeof (assessmentConfig as any).type === 'undefined' && isFormativeGroup({ groupName: assessmentConfig.groupName }))
        ) {
          const faPeriodIndex = formativeGroups.findIndex(a => a.groupName === assessmentGroup);
          if (faPeriodIndex === -1) return;
          const faPeriodKey = `fa${faPeriodIndex + 1}` as keyof FrontSubjectFAData;
          const testIndex = assessmentConfig.tests.findIndex(t => t.testName === testName);
          if (testIndex === -1) return;
          const toolKey = `tool${testIndex + 1}` as keyof FrontMarksEntry;
          if (newFaMarksForState[mark.subjectName]?.[faPeriodKey]) {
            (newFaMarksForState[mark.subjectName][faPeriodKey] as any)[toolKey] = mark.marksObtained;
          }
        } else if ((typeof (assessmentConfig as any).type !== 'undefined' && (assessmentConfig as any).type === 'summative') ||
             (typeof (assessmentConfig as any).type === 'undefined' && isSummativeGroup({ groupName: assessmentConfig.groupName }))
        ) {
          const saPeriod = (assessmentGroup.toLowerCase() === 'sa1' ? 'sa1' : 'sa2') as 'sa1' | 'sa2';
          const asKey = testConfig.testName.toLowerCase() as keyof SAPaperData;
          const dbPaperPart = "Paper1";
          let displayPaperName = (mark.subjectName === "Science") ? (dbPaperPart === 'Paper1' ? 'Physics' : 'Biology') : (dbPaperPart === 'Paper1' ? 'I' : 'II');
          const targetRow = newSaDataForState.find(row => row.subjectName === mark.subjectName && row.paper === displayPaperName);
          if (targetRow?.[saPeriod]?.[asKey]) {
            (targetRow[saPeriod] as any)[asKey] = { marks: mark.marksObtained, maxMarks: mark.maxMarks };
          }
        }
      });
      setFaMarks(newFaMarksForState);
      
      newSaDataForState.forEach(row => {
          row.faTotal200M = calculateFaTotal200MForRow(row.subjectName, row.paper, newFaMarksForState, currentAssessmentScheme);
      });
      setSaData(newSaDataForState);

      // Fetch school details (logo) for header branding
      try {
        const schoolRes = await getSchoolById(String(authUser.schoolId));
        if (schoolRes.success && schoolRes.school) {
          setSchoolLogoUrl(schoolRes.school.schoolLogoUrl || null);
        } else {
          setSchoolLogoUrl(null);
        }
      } catch (err) {
        setSchoolLogoUrl(null);
      }

    } catch (error) {
      toast({ variant: "destructive", title: "Error Loading Data", description: "An unexpected error occurred."});
      console.error("Error loading student/class data:", error);
      initializeReportState();
    } finally {
      setIsLoadingStudentAndClassData(false);
    }
  };

  const isFieldDisabledForRole = (): boolean => true; // Always read-only for admin

  const handlePrint = () => {
    const printableNodes = document.querySelectorAll('.printable-report-card');
    if (!printableNodes || printableNodes.length === 0) {
      toast({ title: 'Nothing to print', description: 'Load a student report first.' });
      return;
    }

    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (err) {
      printWindow = null;
    }
    if (!printWindow) {
      toast({ title: 'Popup blocked', description: 'Please allow popups to print.' });
      return;
    }

    const headStyle = `
      <style>
        html, body { margin: 8mm; padding: 0; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; table-layout: fixed; word-break: break-word; }
        th, td { border: 1px solid #000; padding: 6px; vertical-align: middle; font-size: 12px; background: #fff; }
        .header-table td { border: none; padding: 2px 4px; }
        img.report-logo { height: 48px; width: auto; object-fit: contain; margin-right: 8px; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Ensure no UI or scrollbars included */
          * { -webkit-print-color-adjust: exact; }
          html, body { overflow: visible; }
        }
      </style>
    `;

    // Build body content by cloning and converting inputs to text
    const container = document.createElement('div');
    printableNodes.forEach((node, idx) => {
      const clone = node.cloneNode(true) as HTMLElement;
      // Replace inputs/selects/textareas with their displayed values
      clone.querySelectorAll('input, select, textarea').forEach((el) => {
        const value = (el as HTMLInputElement).value ?? '';
        const text = document.createTextNode(value.toString());
        if (el.parentNode) el.parentNode.replaceChild(text, el);
      });
      // remove UI-only elements
      clone.querySelectorAll('.no-print').forEach(n => n.remove());
      // ensure images have explicit sizes
      clone.querySelectorAll('img').forEach(img => img.classList.add('report-logo'));
      const wrapper = document.createElement('div');
      wrapper.style.pageBreakAfter = idx < printableNodes.length - 1 ? 'always' : 'auto';
      wrapper.appendChild(clone);
      container.appendChild(wrapper);
    });

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Report</title>${headStyle}</head><body>${container.innerHTML}</body></html>`;
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    } catch (err) {
      console.error('Failed to write to print window:', err);
      try {
        // Fallback: navigate the opened window to a data URL
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        printWindow.location.href = url;
      } catch (err2) {
        console.error('Fallback failed:', err2);
      }
    }
    // print after a short delay to allow images to load
    setTimeout(() => { try { printWindow.print(); } catch (e) { console.error(e); } }, 400);
  };
  
  const handleResetData = () => {
    setAdmissionIdInput("");
    initializeReportState();
    toast({ title: "Data Reset", description: "All fields have been cleared."});
  }

  const currentUserRole = authUser?.role as UserRole;

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-report-card { display: block !important; width: 100%; height: auto; box-shadow: none !important; border: none !important; page-break-after: always; }
          .printable-report-card:last-child { page-break-after: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileText className="mr-2 h-6 w-6" /> Generate CBSE State Pattern Report Card
          </CardTitle>
          <CardDescription>
            Logged in as: <span className="font-semibold capitalize">{authUser?.role || 'N/A'}</span>. 
            Enter Student's Admission ID and select an academic year to load their latest marks data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="w-full sm:w-auto">
              <Label htmlFor="admissionIdInput" className="mb-1 flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>Enter Admission ID</Label>
              <Input id="admissionIdInput" placeholder="Enter Admission ID" value={admissionIdInput} onChange={(e) => setAdmissionIdInput(e.target.value)} className="w-full sm:min-w-[200px]" disabled={isLoadingStudentAndClassData}/>
            </div>
             {authUser?.schoolId && 
              <div className="w-full sm:w-auto">
                <Label className="mb-1 flex items-center"><SchoolIconUI className="mr-2 h-4 w-4 text-muted-foreground"/>School ID (Auto)</Label>
                <Input value={authUser.schoolId.toString()} disabled className="w-full sm:min-w-[180px]" />
              </div>
            }
             <div className="w-full sm:w-auto">
                <Label htmlFor="academicYearInput">Academic Year</Label>
                <Select value={frontAcademicYear} onValueChange={setFrontAcademicYear} disabled={academicYears.length === 0}><SelectTrigger id="academicYearInput" className="w-full sm:min-w-[150px]"><SelectValue placeholder="Select Year" /></SelectTrigger><SelectContent>{academicYears.map((year) => (<SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>))}</SelectContent></Select>
            </div>
            <Button onClick={handleLoadStudentAndClassData} disabled={isLoadingStudentAndClassData || !admissionIdInput.trim() || !authUser || !authUser.schoolId}>
                {isLoadingStudentAndClassData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <SearchIcon className="mr-2 h-4 w-4"/>} Load Student Data
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrint} variant="outline" disabled={!studentData}><Printer className="mr-2 h-4 w-4"/> Print Report</Button>
            <Button onClick={handleResetData} variant="destructive" className="ml-auto"><RotateCcw className="mr-2 h-4 w-4"/> Reset</Button>
          </div>
        </CardContent>
      </Card>

      {isLoadingStudentAndClassData && <div className="flex justify-center items-center p-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Loading student and class information...</p></div>}
      
      {!isLoadingStudentAndClassData && studentData && (
        <div className="space-y-4">
            <div className="printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md">
                <CBSEStateFront
                  studentData={studentData} onStudentDataChange={() => {}}
                  academicSubjects={loadedClassSubjects} 
                  assessmentScheme={assessmentScheme}
                  faMarks={faMarks} onFaMarksChange={() => {}} 
                  coMarks={coMarks} onCoMarksChange={() => {}} 
                  secondLanguage={frontSecondLanguage} onSecondLanguageChange={() => {}}
                  academicYear={frontAcademicYear} onAcademicYearChange={() => {}}
                  currentUserRole={currentUserRole}
                  schoolLogoUrl={schoolLogoUrl}
                  editableSubjects={[]}
                />
            </div>
          
            <div className="printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md">
                <CBSEStateBack
                  saData={saData}
                  assessmentScheme={assessmentScheme}
                  onSaDataChange={() => {}}
                  onFaTotalChange={() => {}}
                  attendanceData={attendanceData} onAttendanceDataChange={() => {}}
                  finalOverallGradeInput={finalOverallGradeInput} onFinalOverallGradeInputChange={setFinalOverallGradeInput}
                  secondLanguageSubjectName={frontSecondLanguage} 
                  currentUserRole={currentUserRole}
                  editableSubjects={[]} 
                />
            </div>
        </div>
      )}
      {!isLoadingStudentAndClassData && !studentData && admissionIdInput && (
          <Card className="no-print border-destructive"><CardHeader className="flex-row items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive"/><CardTitle className="text-destructive">Student Data Not Loaded</CardTitle></CardHeader><CardContent><p>Student data could not be loaded for Admission ID: <span className="font-semibold">{admissionIdInput}</span> for academic year <span className="font-semibold">{frontAcademicYear}</span>.</p><p className="mt-1">Please ensure the Admission ID and Academic Year are correct and the student is properly configured in the system (assigned to a class, etc.).</p></CardContent></Card>
      )}
       {!isLoadingStudentAndClassData && !admissionIdInput && (
          <Card className="no-print"><CardContent className="p-6 text-center"><p className="text-muted-foreground">Enter an Admission ID and Academic Year, then click "Load Student Data" to begin.</p></CardContent></Card>
      )}
    </div>
  );
}

