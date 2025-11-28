
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Printer, Loader2, Info, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AuthUser, UserRole, User as AppUser } from '@/types/user';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentData } from '@/contexts/StudentDataContext';
import { getAcademicYears } from '@/app/actions/academicYears';
import { getStudentMarksForReportCard } from '@/app/actions/marks';
import type { MarkEntry } from '@/types/marks';
import { getAssessmentSchemeForClass } from '@/app/actions/assessmentConfigurations';
import type { AssessmentScheme } from '@/types/assessment';
import { getStudentMonthlyAttendance } from '@/app/actions/attendance';
import type { MonthlyAttendanceRecord } from '@/types/attendance';

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
import { getClassDetailsById } from '@/app/actions/classes';

const getDefaultFaMarksEntryFront = (): FrontMarksEntryType => ({ tool1: null, tool2: null, tool3: null, tool4: null });
const getDefaultSaPaperData = (): SAPaperData => ({ as1: { marks: null, maxMarks: 20 }, as2: { marks: null, maxMarks: 20 }, as3: { marks: null, maxMarks: 20 }, as4: { marks: null, maxMarks: 20 }, as5: { marks: null, maxMarks: 20 }, as6: { marks: null, maxMarks: 20 }});

export default function StudentResultsPage() {
  const { toast } = useToast();
  const { authUser: contextAuthUser, schoolDetails, activeAcademicYear, isLoading: isContextLoading } = useStudentData();
  const [authUser, setAuthUser] = useState<AppUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetAcademicYear, setTargetAcademicYear] = useState<string>("");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [showBackSide, setShowBackSide] = useState(false);

  // State to hold live report data
  const [studentData, setStudentData] = useState<FrontStudentData | null>(null);
  const [faMarks, setFaMarks] = useState<Record<string, FrontSubjectFAData>>({});
  const [saData, setSaData] = useState<ReportCardSASubjectEntry[]>([]);
  const [attendanceData, setAttendanceData] = useState<ReportCardAttendanceMonth[]>([]);
  const [assessmentScheme, setAssessmentScheme] = useState<AssessmentScheme | null>(null);
  const [secondLanguage, setSecondLanguage] = useState<'Hindi' | 'Telugu'>('Hindi');


  useEffect(() => {
    const fullUserString = localStorage.getItem('loggedInUser');
    if (fullUserString && fullUserString !== "undefined") {
      setAuthUser(JSON.parse(fullUserString));
    }
  }, [contextAuthUser]);


  useEffect(() => {
    async function fetchYears() {
      const result = await getAcademicYears();
      if(result.success && result.academicYears) {
        const years = result.academicYears.map(y => y.year);
        setAvailableYears(years);
        if (!targetAcademicYear) {
            setTargetAcademicYear(activeAcademicYear || years.find(y => y === new Date().getFullYear().toString()) || years[0]);
        }
      }
    }
    fetchYears();
  }, [activeAcademicYear, targetAcademicYear]);

  const calculateFaTotal200MForRow = (subjectName: string, allFaMarks: Record<string, FrontSubjectFAData>): number | null => {
      const subjectFaData = allFaMarks[subjectName];
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


  const fetchReport = useCallback(async () => {
    if (!authUser || !authUser._id || !authUser.schoolId || !authUser.classId || !targetAcademicYear) {
      setError("Student information is incomplete.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch all necessary data in parallel
      const [classRes, schemeRes, marksRes, attendanceRes] = await Promise.all([
        getClassDetailsById(authUser.classId, authUser.schoolId.toString()),
        getClassDetailsById(authUser.classId, authUser.schoolId.toString()).then(res => 
            res.success && res.classDetails ? getAssessmentSchemeForClass(res.classDetails.name, authUser.schoolId!.toString(), targetAcademicYear) : null
        ),
        getStudentMarksForReportCard(authUser._id.toString(), authUser.schoolId.toString(), targetAcademicYear),
        getStudentMonthlyAttendance(authUser._id.toString())
      ]);

      // 2. Validate essential data
      if (!classRes.success || !classRes.classDetails) throw new Error("Could not load class details.");
      if (!schemeRes || !schemeRes.success || !schemeRes.scheme) throw new Error("Could not load assessment scheme for this class.");
      
      const currentClass = classRes.classDetails;
      const currentScheme = schemeRes.scheme;
      setAssessmentScheme(currentScheme);
      setSecondLanguage(currentClass.secondLanguageSubjectName === 'Telugu' ? 'Telugu' : 'Hindi');

      // 3. Process Student Info
      setStudentData({
        udiseCodeSchoolName: schoolDetails?.schoolName || '',
        studentName: authUser.name || '',
        fatherName: authUser.fatherName || '',
        motherName: authUser.motherName || '',
        class: currentClass.name || '',
        section: authUser.section || '',
        studentIdNo: authUser._id.toString(),
        rollNo: authUser.rollNo || '',
        medium: 'English',
        dob: authUser.dob || '',
        admissionNo: authUser.admissionId || '',
        examNo: authUser.examNo || '',
        aadharNo: authUser.aadharNo || '',
      });

      const allFetchedMarks = marksRes.success ? marksRes.marks || [] : [];
      
      // 4. Process FA and SA Marks
      const newFaMarks: Record<string, FrontSubjectFAData> = {};
      const newSaData: ReportCardSASubjectEntry[] = [];
      
      currentClass.subjects.forEach(subject => {
        // Initialize FA marks structure
        newFaMarks[subject.name] = {
            fa1: getDefaultFaMarksEntryFront(),
            fa2: getDefaultFaMarksEntryFront(),
            fa3: getDefaultFaMarksEntryFront(),
            fa4: getDefaultFaMarksEntryFront(),
        };

        // Initialize SA data structure
        let papers: string[] = ["I"];
        if(subject.name === "Science") papers = ["Physics", "Biology"];
        else if(allFetchedMarks.some(m => m.subjectName === subject.name && m.assessmentName?.includes('Paper2'))) papers = ["I", "II"];
        
        papers.forEach(paper => {
            const sa1Data: SAPaperData = JSON.parse(JSON.stringify(getDefaultSaPaperData()));
            const sa2Data: SAPaperData = JSON.parse(JSON.stringify(getDefaultSaPaperData()));
            newSaData.push({ subjectName: subject.name, paper, sa1: sa1Data, sa2: sa2Data, faTotal200M: null });
        });
      });

      // Populate marks from fetched data
      allFetchedMarks.forEach(mark => {
        if (!mark.assessmentName) return;
        const [assessmentGroup, ...restOfName] = mark.assessmentName.split('-');
        const testName = restOfName.join('-');
        
        const assessmentConfig = currentScheme.assessments.find(a => a.groupName === assessmentGroup);
        if (!assessmentConfig) return;

        if (assessmentGroup.startsWith("FA")) {
            const faPeriodKey = assessmentGroup.toLowerCase() as keyof SubjectFAData;
            const toolKey = testName.toLowerCase().replace('tool ', 'tool') as keyof FrontMarksEntryType;
            if (newFaMarks[mark.subjectName]?.[faPeriodKey] && toolKey in newFaMarks[mark.subjectName][faPeriodKey]) {
                (newFaMarks[mark.subjectName][faPeriodKey] as any)[toolKey] = mark.marksObtained;
            }
        } else if (assessmentGroup.startsWith("SA")) {
            const saPeriod = (assessmentGroup.toLowerCase() === 'sa1' ? 'sa1' : 'sa2') as 'sa1' | 'sa2';
            const asKey = testName.toLowerCase() as keyof SAPaperData;
            const dbPaperPart = "Paper1"; // Simplified assumption
            let displayPaperName = (mark.subjectName === "Science") ? (dbPaperPart === 'Paper1' ? 'Physics' : 'Biology') : (dbPaperPart === 'Paper1' ? 'I' : 'II');
            
            const targetRow = newSaData.find(row => row.subjectName === mark.subjectName && row.paper === displayPaperName);
            if (targetRow && targetRow[saPeriod]?.[asKey]) {
                (targetRow[saPeriod] as any)[asKey] = { marks: mark.marksObtained, maxMarks: mark.maxMarks };
            }
        }
      });
      setFaMarks(newFaMarks);
      setSaData(newSaData.map(row => ({ ...row, faTotal200M: calculateFaTotal200MForRow(row.subjectName, newFaMarks) })));

      // 5. Process Attendance
      if (attendanceRes.success && attendanceRes.records) {
        const attendanceMap = new Map<number, ReportCardAttendanceMonth>();
        attendanceRes.records.forEach(r => attendanceMap.set(r.month, { workingDays: r.totalWorkingDays, presentDays: r.daysPresent }));
        
        const completeAttendance: ReportCardAttendanceMonth[] = Array(11).fill(null).map((_, i) => {
            const monthIndex = (i + 5) % 12; // June is 0, May is 10
            return attendanceMap.get(monthIndex) || { workingDays: null, presentDays: null };
        });
        setAttendanceData(completeAttendance);
      } else {
        setAttendanceData(Array(11).fill(null).map(() => ({ workingDays: null, presentDays: null })));
      }

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred while fetching the report card.");
    } finally {
      setIsLoading(false);
    }
  }, [authUser, targetAcademicYear, toast, schoolDetails]);

  useEffect(() => {
    if (authUser?._id && authUser?.schoolId && targetAcademicYear) {
      fetchReport();
    }
  }, [authUser, targetAcademicYear, fetchReport]);

  const handlePrint = () => window.print();

  if (isContextLoading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!authUser) {
    return <Card><CardHeader><CardTitle>Please Log In</CardTitle></CardHeader><CardContent><p>You must be logged in as a student to view results.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @page { size: landscape; margin: 0.5cm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .printable-report-card { display: block !important; width: 100%; height: auto; box-shadow: none !important; border: none !important; page-break-after: always; }
          .printable-report-card:last-child { page-break-after: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center"><Award className="mr-2 h-6 w-6" /> My Exam Results</CardTitle>
          <CardDescription>View your academic performance and report card for the selected year.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-grow"><Label htmlFor="academicYearSelect">Select Academic Year</Label>
                <Select value={targetAcademicYear} onValueChange={setTargetAcademicYear} disabled={isLoading || isContextLoading || availableYears.length === 0}>
                  <SelectTrigger id="academicYearSelect" className="max-w-xs"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>{availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="flex gap-2">
                 <Button onClick={() => setShowBackSide(prev => !prev)} variant="secondary" disabled={!studentData}>
                    {showBackSide ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                    {showBackSide ? "View Front" : "View Back"}
                </Button>
                <Button onClick={handlePrint} variant="outline" disabled={!studentData}><Printer className="mr-2 h-4 w-4"/> Print</Button>
            </div>
        </CardContent>
      </Card>

      {(isLoading) && <div className="flex justify-center items-center p-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Loading report card...</p></div>}

      {error && !isLoading && <Card className="border-destructive"><CardHeader className="flex-row items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive"/><CardTitle className="text-destructive">Report Not Available</CardTitle></CardHeader><CardContent><p>{error}</p></CardContent></Card>}

      {!isLoading && !error && !studentData && authUser && <Card><CardContent className="p-10 text-center"><Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><p className="text-lg font-semibold">No Report Card Data</p><p className="text-muted-foreground">Your report for '{targetAcademicYear}' has not been generated or is not available. Please check back later.</p></CardContent></Card>}

      {studentData && assessmentScheme && (
        <div className="space-y-4">
          <div className={`printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md ${showBackSide ? 'hidden lg:block' : ''}`}>
            <CBSEStateFront
              studentData={studentData}
              academicSubjects={Object.keys(faMarks).map(name => ({ name, teacherId: '' }))} 
              assessmentScheme={assessmentScheme}
              faMarks={faMarks}
              coMarks={[]}
              secondLanguage={secondLanguage}
              academicYear={targetAcademicYear}
              currentUserRole="student"
              editableSubjects={[]}
              onStudentDataChange={() => {}} onFaMarksChange={() => {}} onCoMarksChange={() => {}} onSecondLanguageChange={() => {}} onAcademicYearChange={() => {}}
            />
          </div>
          <div className={`printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md ${!showBackSide ? 'hidden lg:block' : ''}`}>
            <CBSEStateBack
              saData={saData}
              assessmentScheme={assessmentScheme}
              attendanceData={attendanceData}
              finalOverallGradeInput={null}
              secondLanguageSubjectName={secondLanguage}
              currentUserRole="student"
              editableSubjects={[]}
              onSaDataChange={() => {}} onFaTotalChange={() => {}} onAttendanceDataChange={() => {}} onFinalOverallGradeInputChange={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
