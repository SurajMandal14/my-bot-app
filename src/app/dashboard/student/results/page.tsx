
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Printer, RotateCcw, Loader2, Info, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AuthUser, UserRole } from '@/types/user';
import { getStudentReportCard } from '@/app/actions/reports';
import type { ReportCardData, FormativeAssessmentEntryForStorage } from '@/types/report';
import type { SchoolClassSubject } from '@/types/classes';
import CBSEStateFront, { 
    type StudentData as FrontStudentData, 
    type SubjectFAData as FrontSubjectFAData, 
    type CoCurricularSAData as FrontCoCurricularSAData,
} from '@/components/report-cards/CBSEStateFront';
import CBSEStateBack, {
    type SARowData as BackSARowData,
    type AttendanceMonthData as BackAttendanceMonthData,
} from '@/components/report-cards/CBSEStateBack';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentData } from '@/contexts/StudentDataContext';

const generateAcademicYears = (range = 5): string[] => {
  const years: string[] = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const endYearOfCurrent = currentMonth >= 5 ? currentYear + 1 : currentYear;

  for (let i = 0; i < range; i++) {
    const end = endYearOfCurrent - i;
    const start = end - 1;
    years.push(`${start}-${end}`);
  }
  return years;
};


export default function StudentResultsPage() {
  const { toast } = useToast();
  const { authUser, schoolDetails, activeAcademicYear, isLoading: isContextLoading } = useStudentData();
  const [reportCardData, setReportCardData] = useState<ReportCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetAcademicYear, setTargetAcademicYear] = useState<string>("");
  const [showBackSide, setShowBackSide] = useState(false);
  const [academicYears, setAcademicYears] = useState<string[]>([]);


  useEffect(() => {
    setAcademicYears(generateAcademicYears());
  }, []);

  useEffect(() => {
    if (activeAcademicYear) {
      setTargetAcademicYear(activeAcademicYear);
    }
  }, [activeAcademicYear]);


  const fetchReport = useCallback(async () => {
    if (!authUser || !authUser._id || !authUser.schoolId) {
      setError("Student information is missing.");
      setIsLoading(false);
      setReportCardData(null);
      return;
    }
    if (!targetAcademicYear || !targetAcademicYear.match(/^\d{4}-\d{4}$/)) {
        setError("Invalid academic year format. Please use YYYY-YYYY.");
        setIsLoading(false);
        setReportCardData(null);
        return;
    }

    setIsLoading(true);
    setError(null);
    setReportCardData(null);

    try {
      // Students should only see published reports
      const result = await getStudentReportCard(authUser._id, authUser.schoolId, targetAcademicYear, undefined, true); 
      if (result.success && result.reportCard) {
        setReportCardData(result.reportCard);
      } else {
        setReportCardData(null);
        setError(result.message || "Failed to load report card."); // Show message from action
        if (result.message && !result.message.toLowerCase().includes('not found') && !result.message.toLowerCase().includes('not published')) {
             toast({ variant: "info", title: "Report Card Status", description: result.message });
        }
      }
    } catch (e) {
      console.error("Fetch report error:", e);
      setError("An unexpected error occurred while fetching the report card.");
      setReportCardData(null);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, targetAcademicYear, toast]);

  useEffect(() => {
    if (authUser?._id && authUser?.schoolId && targetAcademicYear) {
      fetchReport();
    } else if (!isContextLoading && !authUser) { 
      setIsLoading(false);
    }
  }, [authUser, targetAcademicYear, fetchReport, isContextLoading]);


  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const frontProps = reportCardData ? {
    studentData: reportCardData.studentInfo,
    academicSubjects: (reportCardData.formativeAssessments || []).map(fa => ({ name: fa.subjectName, teacherId: undefined, teacherName: undefined })),
    faMarks: (reportCardData.formativeAssessments || []).reduce((acc, curr) => {
      acc[curr.subjectName] = { fa1: curr.fa1, fa2: curr.fa2, fa3: curr.fa3, fa4: curr.fa4 };
      return acc;
    }, {} as Record<string, FrontSubjectFAData>),
    coMarks: reportCardData.coCurricularAssessments,
    secondLanguage: reportCardData.secondLanguage || 'Hindi', 
    academicYear: reportCardData.academicYear,
    onStudentDataChange: () => {},
    onFaMarksChange: () => {},
    onCoMarksChange: () => {},
    onSecondLanguageChange: () => {},
    onAcademicYearChange: () => {},
    currentUserRole: "student" as UserRole,
    editableSubjects: [], // Students cannot edit
  } : null;

  const backProps = reportCardData ? {
    saData: reportCardData.summativeAssessments,
    attendanceData: reportCardData.attendance,
    finalOverallGradeInput: reportCardData.finalOverallGrade,
    secondLanguageSubjectName: reportCardData.secondLanguage,
    onSaDataChange: () => {},
    onFaTotalChange: () => {},
    onAttendanceDataChange: () => {},
    onFinalOverallGradeInputChange: () => {},
    currentUserRole: "student" as UserRole,
    editableSubjects: [], // Students cannot edit
  } : null;


  if (!authUser && !isLoading && !error) {
    return (
      <Card>
        <CardHeader><CardTitle>Please Log In</CardTitle></CardHeader>
        <CardContent><p>You need to be logged in as a student to view your results.</p></CardContent>
      </Card>
    );
  }
  

  return (
    <div className="space-y-6">
       <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .printable-report-card, .printable-report-card * { visibility: visible !important; }
          .printable-report-card { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            transform: scale(0.95); 
            transform-origin: top left;
          }
          .no-print { display: none !important; }
           .page-break { page-break-after: always; }
        }
      `}</style>
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Award className="mr-2 h-6 w-6" /> My Exam Results
          </CardTitle>
          <CardDescription>
            View your academic performance and report card.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-grow">
                <Label htmlFor="academicYearSelect">Select Academic Year</Label>
                <Select
                  value={targetAcademicYear}
                  onValueChange={setTargetAcademicYear}
                  disabled={isLoading || isContextLoading}
                >
                  <SelectTrigger id="academicYearSelect" className="max-w-xs">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map(year => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <Button onClick={fetchReport} disabled={isLoading || isContextLoading || !targetAcademicYear.match(/^\d{4}-\d{4}$/)}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4"/>}
                Fetch Report
            </Button>
        </CardContent>
      </Card>

      {(isLoading || isContextLoading) && (
        <div className="flex justify-center items-center p-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg">Loading report card...</p>
        </div>
      )}

      {error && !isLoading && (
         <Card className="no-print border-destructive">
            <CardHeader className="flex-row items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive"/>
                <CardTitle className="text-destructive">Report Not Available</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{error}</p>
            </CardContent>
         </Card>
      )}

      {!isLoading && !error && !reportCardData && authUser && ( // Only show "No Report Found" if user is logged in and no error
        <Card className="no-print">
          <CardContent className="p-10 text-center">
            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Report Card Found</p>
            <p className="text-muted-foreground">
              Your report card for the academic year '{targetAcademicYear}' has not been published or does not exist.
              Please check back later or contact your school administration.
            </p>
          </CardContent>
        </Card>
      )}

      {reportCardData && frontProps && backProps && !isLoading && !error &&(
        <>
          <div className="flex justify-end gap-2 no-print mb-4">
             <Button onClick={() => setShowBackSide(prev => !prev)} variant="outline">
                {showBackSide ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                {showBackSide ? "View Front" : "View Back"}
            </Button>
            <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/> Print Report Card</Button>
          </div>
          <div className={`printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md ${showBackSide ? 'hidden print:!block' : ''}`}>
            <CBSEStateFront {...frontProps} />
          </div>
          
          <div className="page-break no-print"></div>

          <div className={`printable-report-card bg-white p-2 sm:p-4 rounded-lg shadow-md ${!showBackSide ? 'hidden print:!block' : 'block'}`}>
            <CBSEStateBack {...backProps} />
          </div>
        </>
      )}
    </div>
  );
}
