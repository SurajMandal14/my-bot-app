
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChartBig, Loader2, Info, Download, DollarSign, FileText, BadgePercent, Users, ShieldCheck, ShieldOff, BookOpenCheck, CheckCircle2, XCircleIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/attendance";
import type { User as AppUser } from "@/types/user";
import type { School } from "@/types/school";
import type { FeePayment } from "@/types/fees";
import type { FeeConcession } from "@/types/concessions";
import { getReportCardsForClass, setReportPublicationStatusForClass } from "@/app/actions/reports"; 
import type { BulkPublishReportInfo } from "@/types/report"; 
import { getClassesForSchoolAsOptions } from "@/app/actions/classes"; 
import { getSchoolUsers } from "@/app/actions/schoolUsers";
import { getSchoolById } from "@/app/actions/schools";
import { getFeePaymentsBySchool } from "@/app/actions/fees";
import { getFeeConcessionsForSchool } from "@/app/actions/concessions";
import { getMonthlyAttendanceForAdmin } from "@/app/actions/attendance";
import type { MonthlyAttendanceRecord } from "@/types/attendance";
import Link from "next/link";
import { format } from "date-fns";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClassFeeSummary {
  className: string;
  totalExpected: number;
  totalCollected: number;
  totalConcessions: number;
  totalDue: number;
  collectionPercentage: number;
}

interface OverallFeeSummary {
  grandTotalExpected: number;
  grandTotalCollected: number;
  grandTotalConcessions: number;
  grandTotalDue: number;
  overallCollectionPercentage: number;
}

interface ClassOption {
  value: string; // class _id
  label: string; // "ClassName - Section"
  name?: string;
}

export default function AdminReportsPage() {
  const [allSchoolStudents, setAllSchoolStudents] = useState<AppUser[]>([]);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [allSchoolPayments, setAllSchoolPayments] = useState<FeePayment[]>([]);
  const [allSchoolConcessions, setAllSchoolConcessions] = useState<FeeConcession[]>([]);
  const [feeClassSummaries, setFeeClassSummaries] = useState<ClassFeeSummary[]>([]);
  const [feeOverallSummary, setFeeOverallSummary] = useState<OverallFeeSummary | null>(null);
  
  const [attendanceRecords, setAttendanceRecords] = useState<MonthlyAttendanceRecord[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [attendanceMonth, setAttendanceMonth] = useState<number>(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState<number>(new Date().getFullYear());


  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingFeePdf, setIsDownloadingFeePdf] = useState(false);
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>("");
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  // States for Bulk Report Publishing
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [selectedClassForBulkPublish, setSelectedClassForBulkPublish] = useState<string>("");
  const [academicYearForBulkPublish, setAcademicYearForBulkPublish] = useState<string>("");
  const [reportsForBulkPublish, setReportsForBulkPublish] = useState<BulkPublishReportInfo[]>([]);
  const [isLoadingBulkReports, setIsLoadingBulkReports] = useState(false);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [bulkActionToConfirm, setBulkActionToConfirm] = useState<'publish' | 'unpublish' | null>(null);


  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
        try {
            const parsedUser: AuthUser = JSON.parse(storedUser);
            if (parsedUser && parsedUser.role === 'admin' && parsedUser.schoolId) {
                 setAuthUser(parsedUser);
            } else {
                setAuthUser(null);
                 toast({ variant: "destructive", title: "Access Denied", description: "You must be a school admin." });
            }
        } catch(e) {
            console.error("Failed to parse user from localStorage in AdminReportsPage:", e);
            setAuthUser(null);
            toast({ variant: "destructive", title: "Session Error", description: "Failed to load user data." });
        }
    } else {
      setAuthUser(null);
    }
  }, [toast]);
  
  const fetchOptions = useCallback(async () => {
    if (!authUser?.schoolId) return;

    setIsLoading(true);
    const [classOptionsResult, academicYearsResult] = await Promise.all([
      getClassesForSchoolAsOptions(authUser.schoolId.toString()),
      getAcademicYears()
    ]);
    
    setClassOptions(classOptionsResult);

    if (academicYearsResult.success && academicYearsResult.academicYears) {
      setAcademicYears(academicYearsResult.academicYears);
      const activeYear = schoolDetails?.activeAcademicYear || academicYearsResult.academicYears.find(y => y.isDefault)?.year || academicYearsResult.academicYears[0]?.year || "";
      if (activeYear) {
        setFilterAcademicYear(activeYear);
        setAcademicYearForBulkPublish(activeYear);
      }
    } else {
      toast({ variant: "destructive", title: "Error", description: "Could not load academic years." });
    }
    setIsLoading(false);
  }, [authUser?.schoolId, schoolDetails?.activeAcademicYear, toast]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);


  const calculateAnnualTuitionFee = useCallback((className: string | undefined, schoolConfig: School | null): number => {
    if (!className || !schoolConfig || !schoolConfig.tuitionFees) return 0;
    const classFeeConfig = schoolConfig.tuitionFees.find(cf => cf.className === className);
    if (!classFeeConfig || !classFeeConfig.terms) return 0;
    return classFeeConfig.terms.reduce((sum, term) => sum + (term.amount || 0), 0);
  }, []);

  const loadReportData = useCallback(async () => {
    if (!authUser || !authUser.schoolId || !filterAcademicYear) {
        setIsLoading(false);
        return;
    }

    setIsLoading(true);

    try {
      const [studentsResult, schoolRes, paymentsResult, concessionsResult] = await Promise.all([
        getSchoolUsers(authUser.schoolId.toString()),
        getSchoolById(authUser.schoolId.toString()),
        getFeePaymentsBySchool(authUser.schoolId.toString()),
        getFeeConcessionsForSchool(authUser.schoolId.toString(), filterAcademicYear),
      ]);

      if (studentsResult.success && studentsResult.users) {
        setAllSchoolStudents(studentsResult.users.filter(u => u.role === 'student'));
      }
      if (schoolRes.success && schoolRes.school) setSchoolDetails(schoolRes.school);
      if (paymentsResult.success && paymentsResult.payments) setAllSchoolPayments(paymentsResult.payments);
      if (concessionsResult.success && concessionsResult.concessions) setAllSchoolConcessions(concessionsResult.concessions);
      
    } catch (error) {
       toast({ variant: "destructive", title: "Error Fetching Report Data", description: "An error occurred while fetching school-wide information."});
       console.error("Error fetching report data:", error);
    }
    setIsLoading(false);
  }, [authUser, toast, filterAcademicYear]);
  
  useEffect(() => {
    loadReportData();
  }, [loadReportData]);


  const processFeeData = useCallback(() => {
    if (!allSchoolStudents.length || !schoolDetails || !allSchoolPayments) {
      setFeeClassSummaries([]);
      setFeeOverallSummary(null);
      return;
    }

    let grandTotalExpected = 0;
    let grandTotalCollected = 0;
    let grandTotalConcessions = 0;

    const classFeeMap = new Map<string, { totalExpected: number, totalCollected: number, totalConcessions: number, studentCount: number }>();

    const studentsForYear = allSchoolStudents.filter(s => s.academicYear === filterAcademicYear);

    studentsForYear.forEach(student => {
      if (student.classId) {
        const classObj = classOptions.find(c => c.value === student.classId);
        const classNameForTuitionLookup = classObj?.name; 
        const displayClassName = classObj?.label || student.classId;

        if (classNameForTuitionLookup) {
          const studentTotalAnnualTuitionFee = calculateAnnualTuitionFee(classNameForTuitionLookup, schoolDetails);
          const studentPayments = allSchoolPayments.filter(p => p.studentId.toString() === student._id!.toString());
          const studentTotalPaid = studentPayments.reduce((sum, p) => sum + p.amountPaid, 0);

          const studentConcessionsForYear = allSchoolConcessions.filter(
              c => c.studentId.toString() === student._id!.toString() && c.academicYear === filterAcademicYear
          );
          const studentTotalConcessions = studentConcessionsForYear.reduce((sum, c) => sum + c.amount, 0);

          grandTotalExpected += studentTotalAnnualTuitionFee;
          grandTotalCollected += studentTotalPaid;
          grandTotalConcessions += studentTotalConcessions;

          if (!classFeeMap.has(displayClassName)) {
            classFeeMap.set(displayClassName, { totalExpected: 0, totalCollected: 0, totalConcessions: 0, studentCount: 0 });
          }
          const classData = classFeeMap.get(displayClassName)!;
          classData.totalExpected += studentTotalAnnualTuitionFee;
          classData.totalCollected += studentTotalPaid;
          classData.totalConcessions += studentTotalConcessions;
          classData.studentCount++;
        }
      }
    });

    const feeSummaries: ClassFeeSummary[] = [];
    for (const [className, data] of classFeeMap.entries()) {
      const netExpectedForClass = data.totalExpected - data.totalConcessions;
      const totalDue = Math.max(0, netExpectedForClass - data.totalCollected);
      const collectionPercentage = netExpectedForClass > 0 ? Math.round((data.totalCollected / netExpectedForClass) * 100) : (data.totalCollected > 0 ? 100 : 0);

      feeSummaries.push({
        className,
        totalExpected: data.totalExpected,
        totalCollected: data.totalCollected,
        totalConcessions: data.totalConcessions,
        totalDue,
        collectionPercentage,
      });
    }

    const grandNetExpected = grandTotalExpected - grandTotalConcessions;
    const grandTotalDue = Math.max(0, grandNetExpected - grandTotalCollected);
    const overallCollectionPercentage = grandNetExpected > 0 ? Math.round((grandTotalCollected / grandNetExpected) * 100) : (grandTotalCollected > 0 ? 100 : 0);

    setFeeOverallSummary({
      grandTotalExpected,
      grandTotalCollected,
      grandTotalConcessions,
      grandTotalDue,
      overallCollectionPercentage,
    });
    setFeeClassSummaries(feeSummaries.sort((a,b) => a.className.localeCompare(b.className)));

  }, [allSchoolStudents, schoolDetails, allSchoolPayments, allSchoolConcessions, calculateAnnualTuitionFee, filterAcademicYear, classOptions]);


  useEffect(() => {
    processFeeData();
  }, [allSchoolStudents, schoolDetails, allSchoolPayments, allSchoolConcessions, processFeeData]);


  const fetchAttendance = useCallback(async () => {
    if (!authUser || !authUser.schoolId) return;

    setIsLoadingAttendance(true);
    const result = await getMonthlyAttendanceForAdmin(authUser.schoolId.toString(), attendanceMonth, attendanceYear);
    if (result.success && result.records) {
      setAttendanceRecords(result.records);
    } else {
      setAttendanceRecords([]);
      toast({ variant: "warning", title: "Attendance Report", description: result.message || "Could not fetch attendance data."});
    }
    setIsLoadingAttendance(false);
  }, [authUser, attendanceMonth, attendanceYear, toast]);


  useEffect(() => {
    if (authUser && authUser.schoolId) {
      fetchAttendance();
    }
  }, [authUser, fetchAttendance]);


  const handleDownloadFeePdf = async () => {
    const reportContent = document.getElementById('feeReportContent');
    if (!reportContent) {
      toast({ variant: "destructive", title: "Error", description: "Fee report content not found for PDF generation." });
      return;
    }
     if (!schoolDetails) {
        toast({ variant: "info", title: "Missing Data", description: "School details not loaded, cannot generate fee report PDF." });
        return;
    }

    setIsDownloadingFeePdf(true);
    try {
      const canvas = await html2canvas(reportContent, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;

      const ratio = imgWidth / imgHeight;
      let newImgWidth = pdfWidth - 20;
      let newImgHeight = newImgWidth / ratio;

      if (newImgHeight > pdfHeight - 20) {
        newImgHeight = pdfHeight - 20;
        newImgWidth = newImgHeight * ratio;
      }

      const x = (pdfWidth - newImgWidth) / 2;
      const y = (pdfHeight - newImgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, newImgWidth, newImgHeight);
      pdf.save(`Fee_Collection_Report_${schoolDetails.schoolName.replace(/\s+/g, '_')}_${filterAcademicYear}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ variant: "destructive", title: "PDF Error", description: "Could not generate fee report PDF. See console for details."});
    } finally {
      setIsDownloadingFeePdf(false);
    }
  };

  const handleLoadReportsForBulkPublish = async () => {
    if (!authUser?.schoolId || !selectedClassForBulkPublish || !academicYearForBulkPublish) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please select a class and academic year."});
      setReportsForBulkPublish([]);
      return;
    }
    setIsLoadingBulkReports(true);
    const result = await getReportCardsForClass(authUser.schoolId.toString(), selectedClassForBulkPublish, academicYearForBulkPublish);
    if (result.success && result.reports) {
      setReportsForBulkPublish(result.reports);
      if (result.reports.length === 0) {
        toast({title: "No Reports Found", description: "No existing report cards found for this class and academic year to publish."});
      }
    } else {
      toast({variant: "destructive", title: "Error Loading Reports", description: result.message || "Could not load reports."});
      setReportsForBulkPublish([]);
    }
    setIsLoadingBulkReports(false);
  };

  const handleBulkPublishAction = async (publish: boolean) => {
    if (!authUser?.schoolId || !selectedClassForBulkPublish || !academicYearForBulkPublish || reportsForBulkPublish.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "No reports loaded or selection missing."});
      return;
    }
    setIsBulkPublishing(true);
    const result = await setReportPublicationStatusForClass(authUser.schoolId.toString(), selectedClassForBulkPublish, academicYearForBulkPublish, publish);
    if (result.success) {
      toast({ title: "Bulk Update Successful", description: result.message});
      handleLoadReportsForBulkPublish();
    } else {
      toast({variant: "destructive", title: "Bulk Update Failed", description: result.message || "Could not update report statuses."});
    }
    setIsBulkPublishing(false);
  };
  
  const handleConfirmBulkPublish = async () => {
    if (bulkActionToConfirm === null) return;
    await handleBulkPublishAction(bulkActionToConfirm === 'publish');
    setBulkActionToConfirm(null);
  };


  const reportsThatExistCount = reportsForBulkPublish.filter(r => r.hasReport).length;
  
  const handleAttendanceMonthChange = (direction: 'prev' | 'next') => {
    let newMonth = attendanceMonth;
    let newYear = attendanceYear;
    if (direction === 'prev') {
        newMonth = newMonth === 0 ? 11 : newMonth - 1;
        newYear = newMonth === 11 ? newYear - 1 : newYear;
    } else {
        newMonth = newMonth === 11 ? 0 : newMonth + 1;
        newYear = newMonth === 0 ? newYear + 1 : newYear;
    }
    setAttendanceMonth(newMonth);
    setAttendanceYear(newYear);
    fetchAttendance();
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <BarChartBig className="mr-2 h-6 w-6" /> School Reports
          </CardTitle>
          <CardDescription>View summaries and reports for school operations. Access report card generation tools.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-lg">Report Card Generation</CardTitle>
            <CardDescription>Select a template to start generating student report cards.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link href="/dashboard/admin/reports/generate-cbse-state" passHref>
                 <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                    <FileText className="h-6 w-6 mb-1"/>
                    <span>CBSE State Template</span>
                 </Button>
            </Link>
            <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center" disabled>
                <FileText className="h-6 w-6 mb-1 text-muted-foreground"/>
                <span className="text-muted-foreground">More Templates (Soon)</span>
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Report Card Publishing</CardTitle>
          <CardDescription>Publish or unpublish existing, generated report cards for a selected class and academic year.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-grow">
              <Label htmlFor="bulk-class-select">Select Class</Label>
              <Select onValueChange={setSelectedClassForBulkPublish} value={selectedClassForBulkPublish} disabled={isLoadingBulkReports || isBulkPublishing || classOptions.length === 0}>
                <SelectTrigger id="bulk-class-select">
                  <SelectValue placeholder={classOptions.length > 0 ? "Select class" : "No classes available"} />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-grow">
              <Label htmlFor="bulk-academic-year">Academic Year</Label>
              <Select onValueChange={setAcademicYearForBulkPublish} value={academicYearForBulkPublish} disabled={isLoadingBulkReports || isBulkPublishing || academicYears.length === 0}>
                <SelectTrigger id="bulk-academic-year">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleLoadReportsForBulkPublish} disabled={isLoadingBulkReports || isBulkPublishing || !selectedClassForBulkPublish || !academicYearForBulkPublish.match(/^\d{4}-\d{4}$/)}>
              {isLoadingBulkReports ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4"/>} Load Reports
            </Button>
          </div>

          {reportsForBulkPublish.length > 0 && !isLoadingBulkReports && (
            <div className="space-y-3 mt-4">
              <div className="flex gap-2">
                <Button
                  onClick={() => setBulkActionToConfirm('publish')}
                  disabled={isBulkPublishing || reportsThatExistCount === 0}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isBulkPublishing && bulkActionToConfirm === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4"/>} Publish All ({reportsThatExistCount})
                </Button>
                <Button
                  onClick={() => setBulkActionToConfirm('unpublish')}
                  disabled={isBulkPublishing || reportsThatExistCount === 0}
                  variant="destructive"
                >
                  {isBulkPublishing && bulkActionToConfirm === 'unpublish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldOff className="mr-2 h-4 w-4"/>} Unpublish All ({reportsThatExistCount})
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Admission ID</TableHead>
                    <TableHead>Report Exists?</TableHead>
                    <TableHead>Current Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportsForBulkPublish.map(report => (
                    <TableRow key={report.studentId}>
                      <TableCell>{report.studentName}</TableCell>
                      <TableCell>{report.admissionId}</TableCell>
                       <TableCell className="text-center">
                        {report.hasReport ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : <XCircleIcon className="h-5 w-5 text-red-500 mx-auto" />}
                      </TableCell>
                      <TableCell>
                        {report.hasReport ? (report.isPublished ?
                          <span className="text-green-600 font-semibold">Published</span> :
                          <span className="text-red-600 font-semibold">Not Published</span>
                        ) : (
                          <span className="text-muted-foreground">No Report</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
           {isLoadingBulkReports && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Loading student report statuses...</div>}
           {!isLoadingBulkReports && reportsForBulkPublish.length === 0 && selectedClassForBulkPublish && (
                <p className="text-center text-muted-foreground py-4">No reports found for the selected class and year, or no students in class.</p>
            )}
        </CardContent>
      </Card>
      
      <AlertDialog open={!!bulkActionToConfirm} onOpenChange={(open) => !open && setBulkActionToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to <strong>{bulkActionToConfirm === 'publish' ? 'publish' : 'unpublish'}</strong> all {reportsThatExistCount} generated reports for this class. 
              This will make them {bulkActionToConfirm === 'publish' ? 'visible' : 'hidden'} to students. Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkPublish}
              className={bulkActionToConfirm === 'unpublish' ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700'}
            >
              Confirm {bulkActionToConfirm === 'publish' ? 'Publish' : 'Unpublish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <CardTitle>Attendance Report</CardTitle>
                    <CardDescription>Monthly attendance summary for the school.</CardDescription>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleAttendanceMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-lg font-semibold w-32 text-center">{format(new Date(attendanceYear, attendanceMonth), 'MMM yyyy')}</span>
                    <Button variant="outline" size="icon" onClick={() => handleAttendanceMonthChange('next')}><ChevronRight className="h-4 w-4" /></Button>
                 </div>
            </div>
        </CardHeader>
        <CardContent>
             {isLoadingAttendance ? (
                 <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2">Loading attendance report...</p>
                </div>
             ) : attendanceRecords.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Days Present</TableHead>
                            <TableHead>Total Working Days</TableHead>
                            <TableHead>Percentage</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {attendanceRecords.map((record) => (
                            <TableRow key={record._id.toString()}>
                                <TableCell>{record.studentName}</TableCell>
                                <TableCell>{record.className}</TableCell>
                                <TableCell>{record.daysPresent}</TableCell>
                                <TableCell>{record.totalWorkingDays}</TableCell>
                                <TableCell>{record.totalWorkingDays > 0 ? `${Math.round((record.daysPresent / record.totalWorkingDays) * 100)}%` : 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             ) : (
                <div className="text-center py-10">
                    <Info className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg font-semibold">No Attendance Data</p>
                    <p className="text-muted-foreground">No attendance has been submitted for this month.</p>
                </div>
             )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <CardTitle>Fee Collection Summary Report</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                        <Label htmlFor="fee-academic-year">Academic Year:</Label>
                        <Select onValueChange={setFilterAcademicYear} value={filterAcademicYear} disabled={isLoading || academicYears.length === 0}>
                            <SelectTrigger id="fee-academic-year" className="w-[180px]">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleDownloadFeePdf}
                        disabled={isLoading || isDownloadingFeePdf || !authUser || !feeOverallSummary || !schoolDetails}
                        className="w-full sm:w-auto"
                    >
                        {isDownloadingFeePdf ? <Loader2 className="mr-0 sm:mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-0 sm:mr-2 h-4 w-4"/>}
                        <span className="sm:inline hidden">Download PDF</span>
                        <span className="sm:hidden inline">PDF</span>
                    </Button>
                 </div>
            </div>
        </CardHeader>
        <CardContent>
             {isLoading && !feeOverallSummary ? (
                 <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2">Loading fee collection data...</p>
                </div>
             ) : !authUser ? (
                <p className="text-center text-muted-foreground py-4">Please log in as a school admin to view reports.</p>
             ) : feeClassSummaries.length > 0 && feeOverallSummary && schoolDetails ? (
                <div id="feeReportContent" className="p-4 bg-card rounded-md">
                <Card className="mb-6 bg-secondary/30">
                    <CardHeader>
                        <CardTitle className="text-lg">Overall School Fee Summary - {schoolDetails?.schoolName || 'School'} ({filterAcademicYear})</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Expected (Gross)</p>
                            <p className="text-2xl font-bold"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalExpected.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Concessions</p>
                            <p className="text-2xl font-bold text-blue-600"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalConcessions.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Collected</p>
                            <p className="text-2xl font-bold text-green-600"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalCollected.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Due (Net)</p>
                            <p className="text-2xl font-bold text-red-600"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalDue.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Collection % (of Net Payable)</p>
                            <p className="text-2xl font-bold text-blue-600">{feeOverallSummary.overallCollectionPercentage}%</p>
                            <Progress value={feeOverallSummary.overallCollectionPercentage} className="h-2 mt-1" />
                        </div>
                    </CardContent>
                </Card>

                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Class Name</TableHead>
                    <TableHead className="text-right">Expected (<span className="font-sans">₹</span>)</TableHead>
                    <TableHead className="text-right">Concessions (<span className="font-sans">₹</span>)</TableHead>
                    <TableHead className="text-right">Collected (<span className="font-sans">₹</span>)</TableHead>
                    <TableHead className="text-right">Net Due (<span className="font-sans">₹</span>)</TableHead>
                    <TableHead className="text-center">Collection %</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {feeClassSummaries.map((summary) => (
                    <TableRow key={summary.className}>
                        <TableCell className="font-medium">{summary.className}</TableCell>
                        <TableCell className="text-right"><span className="font-sans">₹</span>{summary.totalExpected.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-blue-600"><span className="font-sans">₹</span>{summary.totalConcessions.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium"><span className="font-sans">₹</span>{summary.totalCollected.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600 font-medium"><span className="font-sans">₹</span>{summary.totalDue.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                                <span className={`font-bold ${summary.collectionPercentage >= 90 ? 'text-green-600' : summary.collectionPercentage >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {summary.collectionPercentage}%
                                </span>
                                <Progress value={summary.collectionPercentage} className="h-1.5 w-20 mt-1" />
                            </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
                </div>
             ) : (
                <div className="text-center py-10">
                    <Info className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-lg font-semibold">No Fee Data to Display</p>
                    <p className="text-muted-foreground">
                        {(!allSchoolStudents.length) ? "No students found for this school. Please add students." :
                         (!schoolDetails) ? "School fee structure not loaded. Cannot calculate fee summaries." :
                         (!allSchoolPayments.length && !allSchoolConcessions.length && schoolDetails && allSchoolStudents.length > 0) ? "No fee payments or concessions have been recorded for this school year yet." :
                         "Fee data is currently unavailable."
                        }
                    </p>
                </div>
             )}
        </CardContent>
      </Card>
    </div>
  );
}

    