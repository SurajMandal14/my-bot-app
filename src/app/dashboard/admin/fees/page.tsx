
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Printer, Loader2, Info, CalendarDays, BadgePercent, Search, ArrowUpDown, Bus, Download } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/attendance";
import type { User as AppUser } from "@/types/user";
import type { School, TermFee, BusFeeLocationCategory } from "@/types/school";
import type { FeePayment, FeePaymentPayload, PaymentMethod } from "@/types/fees";
import { PAYMENT_METHODS } from "@/types/fees";
import type { FeeConcession } from "@/types/concessions";
import { getSchoolUsers } from "@/app/actions/schoolUsers";
import { getSchoolById } from "@/app/actions/schools";
import { recordFeePayment, getFeePaymentsBySchool } from "@/app/actions/fees";
import { getFeeConcessionsForSchool } from "@/app/actions/concessions";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { format } from "date-fns";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClassOption {
  value: string;
  label: string;
  name?: string;
}

interface StudentFeeDetailsProcessed extends AppUser {
  totalAnnualTuitionFee: number;
  totalAnnualBusFee: number;
  totalAnnualFee: number;
  paidAmount: number;
  totalConcessions: number;
  dueAmount: number;
  className?: string; 
  classLabel?: string;
}

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

export default function FeeManagementPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [allStudents, setAllStudents] = useState<AppUser[]>([]);
  const [allSchoolPayments, setAllSchoolPayments] = useState<FeePayment[]>([]);
  const [allSchoolConcessions, setAllSchoolConcessions] = useState<FeeConcession[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  
  const [feeClassSummaries, setFeeClassSummaries] = useState<ClassFeeSummary[]>([]);
  const [feeOverallSummary, setFeeOverallSummary] = useState<OverallFeeSummary | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStudents, setFilteredStudents] = useState<StudentFeeDetailsProcessed[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [paymentAmount, setPaymentAmount] = useState<number | string>("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingFeePdf, setIsDownloadingFeePdf] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const { toast } = useToast();
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>("");

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'admin' && parsedUser.schoolId && parsedUser._id) {
          setAuthUser(parsedUser);
        }
      } catch (e) { console.error("FeeManagementPage: Failed to parse authUser", e); }
    }
  }, []);

  const fetchInitialOptions = useCallback(async () => {
    setIsLoading(true);
    const academicYearsResult = await getAcademicYears();
    if (academicYearsResult.success && academicYearsResult.academicYears) {
      setAcademicYears(academicYearsResult.academicYears);
      const defaultYear = academicYearsResult.academicYears.find(y => y.isDefault) || academicYearsResult.academicYears[0];
      if (defaultYear) {
        setFilterAcademicYear(defaultYear.year);
      }
    }
    setIsLoading(false);
  }, []);
  
  useEffect(() => { fetchInitialOptions() }, [fetchInitialOptions]);

  const loadReportData = useCallback(async () => {
    if (!authUser || !authUser.schoolId || !filterAcademicYear) return;
    setIsLoading(true);
    try {
      const [schoolResult, usersResult, paymentsResult, concessionsResult, classesOptResult] = await Promise.all([
        getSchoolById(authUser.schoolId.toString()),
        getSchoolUsers(authUser.schoolId.toString()),
        getFeePaymentsBySchool(authUser.schoolId.toString()),
        getFeeConcessionsForSchool(authUser.schoolId.toString(), filterAcademicYear),
        getClassesForSchoolAsOptions(authUser.schoolId.toString())
      ]);

      if (schoolResult.success && schoolResult.school) setSchoolDetails(schoolResult.school);
      else toast({ variant: "destructive", title: "Error", description: schoolResult.message || "Failed to load school details." });
      
      if (usersResult.success && usersResult.users) setAllStudents(usersResult.users.filter(u => u.role === 'student'));
      else toast({ variant: "destructive", title: "Error", description: usersResult.message || "Failed to load students." });
      
      if (paymentsResult.success && paymentsResult.payments) setAllSchoolPayments(paymentsResult.payments);
      else toast({ variant: "warning", title: "Payment Info", description: paymentsResult.message || "Could not load payment history." });
      
      if (concessionsResult.success && concessionsResult.concessions) setAllSchoolConcessions(concessionsResult.concessions);
      else toast({ variant: "warning", title: "Concession Info", description: concessionsResult.message || "Could not load concession data." });

      if(classesOptResult) setClassOptions(classesOptResult);
      else toast({ variant: "warning", title: "Class Info", description: "Could not load class information." });

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred fetching school data." });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, toast, filterAcademicYear]);
  
  useEffect(() => {
    if (authUser && authUser.schoolId && filterAcademicYear) loadReportData();
  }, [authUser, filterAcademicYear, loadReportData]);

  const studentFeeList: StudentFeeDetailsProcessed[] = useMemo(() => {
      if (!schoolDetails || allStudents.length === 0 || classOptions.length === 0) return [];
      
      const calculateAnnualTuitionFee = (className: string | undefined): number => {
          if (!className || !schoolDetails?.tuitionFees) return 0;
          const classFeeConfig = schoolDetails.tuitionFees.find(cf => cf.className === className);
          return classFeeConfig?.terms.reduce((sum, term) => sum + (term.amount || 0), 0) || 0;
      };

      const calculateAnnualBusFee = (student: AppUser): number => {
          if (!student.busRouteLocation || !student.busClassCategory || !schoolDetails?.busFeeStructures) return 0;
          const busFeeConfig = schoolDetails.busFeeStructures.find(bfs => bfs.location === student.busRouteLocation && bfs.classCategory === student.busClassCategory);
          return busFeeConfig?.terms.reduce((sum, term) => sum + (term.amount || 0), 0) || 0;
      };

      return allStudents
        .filter(s => s.academicYear === filterAcademicYear)
        .map(student => {
          const classInfo = classOptions.find(opt => opt.value === student.classId);
          const studentClassName = classInfo?.name;
          const studentClassLabel = classInfo?.label || student.classId || 'N/A';
          
          const totalAnnualTuitionFee = calculateAnnualTuitionFee(studentClassName);
          const totalAnnualBusFee = calculateAnnualBusFee(student);
          const totalAnnualFee = totalAnnualTuitionFee + totalAnnualBusFee;

          const paidAmount = allSchoolPayments.filter(p => p.studentId.toString() === student._id!.toString()).reduce((sum, p) => sum + p.amountPaid, 0);
          const totalConcessions = allSchoolConcessions.filter(c => c.studentId.toString() === student._id!.toString() && c.academicYear === filterAcademicYear).reduce((sum, c) => sum + c.amount, 0);
          const dueAmount = Math.max(0, totalAnnualFee - paidAmount - totalConcessions);

          return { ...student, className: studentClassName, classLabel: studentClassLabel, totalAnnualTuitionFee, totalAnnualBusFee, totalAnnualFee, paidAmount, totalConcessions, dueAmount } as StudentFeeDetailsProcessed;
        });

  }, [allStudents, schoolDetails, allSchoolPayments, allSchoolConcessions, classOptions, filterAcademicYear]);

  const selectedStudentFullData = useMemo(() => {
    return selectedStudentId ? studentFeeList.find(s => s._id!.toString() === selectedStudentId) : null;
  }, [selectedStudentId, studentFeeList]);

  useEffect(() => {
    if (selectedStudentFullData) {
      setPaymentAmount(selectedStudentFullData.dueAmount > 0 ? selectedStudentFullData.dueAmount : "");
      setPaymentDate(new Date()); 
      setPaymentMethod("");
      setPaymentNotes("");
    } else {
      setPaymentAmount("");
      setPaymentDate(undefined); 
      setPaymentMethod("");
      setPaymentNotes("");
    }
  }, [selectedStudentId, selectedStudentFullData]);

  useEffect(() => {
    if (searchTerm.trim().length > 1) {
      setFilteredStudents(studentFeeList.filter(student => 
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.admissionId?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10));
    } else {
      setFilteredStudents([]);
    }
  }, [searchTerm, studentFeeList]);


  useEffect(() => {
    if (!schoolDetails || studentFeeList.length === 0) {
      setFeeClassSummaries([]);
      setFeeOverallSummary(null);
      return;
    }

    let grandTotalExpected = 0;
    let grandTotalCollected = 0;
    let grandTotalConcessions = 0;

    const classFeeMap = new Map<string, { totalExpected: number, totalCollected: number, totalConcessions: number, studentCount: number }>();
    
    studentFeeList.forEach(student => {
        const { classLabel, totalAnnualFee, paidAmount, totalConcessions } = student;
        if (!classLabel) return;
        
        grandTotalExpected += totalAnnualFee;
        grandTotalCollected += paidAmount;
        grandTotalConcessions += totalConcessions;

        if (!classFeeMap.has(classLabel)) {
            classFeeMap.set(classLabel, { totalExpected: 0, totalCollected: 0, totalConcessions: 0, studentCount: 0 });
        }
        const classData = classFeeMap.get(classLabel)!;
        classData.totalExpected += totalAnnualFee;
        classData.totalCollected += paidAmount;
        classData.totalConcessions += totalConcessions;
        classData.studentCount++;
    });

    const summaries = Array.from(classFeeMap.entries()).map(([className, data]) => {
      const netExpectedForClass = data.totalExpected - data.totalConcessions;
      const totalDue = Math.max(0, netExpectedForClass - data.totalCollected);
      const collectionPercentage = netExpectedForClass > 0 ? Math.round((data.totalCollected / netExpectedForClass) * 100) : (data.totalCollected > 0 ? 100 : 0);
      return { className, totalExpected: data.totalExpected, totalCollected: data.totalCollected, totalConcessions: data.totalConcessions, totalDue, collectionPercentage };
    });

    const grandNetExpected = grandTotalExpected - grandTotalConcessions;
    const grandTotalDue = Math.max(0, grandNetExpected - grandTotalCollected);
    const overallCollectionPercentage = grandNetExpected > 0 ? Math.round((grandTotalCollected / grandNetExpected) * 100) : (grandTotalCollected > 0 ? 100 : 0);

    setFeeClassSummaries(summaries.sort((a,b) => a.className.localeCompare(b.className)));
    setFeeOverallSummary({ grandTotalExpected, grandTotalCollected, grandTotalConcessions, grandTotalDue, overallCollectionPercentage });

  }, [studentFeeList, schoolDetails, allSchoolPayments, allSchoolConcessions, filterAcademicYear]);
  
  
  const handleRecordPayment = async () => {
    if (!selectedStudentFullData || !paymentAmount || +paymentAmount <= 0 || !paymentDate || !authUser?._id || !authUser?.schoolId) return;
    setIsSubmittingPayment(true);
    const payload: FeePaymentPayload = {
      studentId: selectedStudentFullData._id!.toString(), studentName: selectedStudentFullData.name!, schoolId: authUser.schoolId.toString(),
      classId: selectedStudentFullData.classLabel!, amountPaid: +paymentAmount, paymentDate: paymentDate,
      recordedByAdminId: authUser._id.toString(), paymentMethod: paymentMethod || undefined, notes: paymentNotes || undefined,
    };
    const result = await recordFeePayment(payload);
    if (result.success) {
      toast({ title: "Payment Recorded", description: result.message });
      if (authUser?.schoolId) loadReportData();
      setSelectedStudentId(null);
    } else {
      toast({ variant: "destructive", title: "Payment Failed", description: result.error || result.message });
    }
    setIsSubmittingPayment(false);
  };
  
  const handlePrintReceipt = (student: StudentFeeDetailsProcessed | null) => {
    if (!student) return;
    const latestPayment = allSchoolPayments.filter(p => p.studentId === student._id).sort((a,b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
    if (latestPayment?._id) {
        window.open(`/dashboard/admin/fees/receipt/${latestPayment._id.toString()}`, '_blank');
    } else {
        toast({ title: "No Payments", description: `No payments found for ${student.name} to generate a receipt.` });
    }
  };

  const handleDownloadFeePdf = async () => {
    const reportContent = document.getElementById('feeReportContent');
    if (!reportContent || !schoolDetails) return;
    setIsDownloadingFeePdf(true);
    try {
      const canvas = await html2canvas(reportContent, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const { width: imgWidth, height: imgHeight } = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = imgWidth / imgHeight;
      let newImgWidth = pdfWidth - 20; let newImgHeight = newImgWidth / ratio;
      if (newImgHeight > pdfHeight - 20) { newImgHeight = pdfHeight - 20; newImgWidth = newImgHeight * ratio; }
      const x = (pdfWidth - newImgWidth) / 2; const y = 10;
      pdf.addImage(imgData, 'PNG', x, y, newImgWidth, newImgHeight);
      pdf.save(`Fee_Collection_Report_${schoolDetails.schoolName.replace(/\s+/g, '_')}_${filterAcademicYear}.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
      toast({ variant: "destructive", title: "PDF Error", description: "Could not generate fee report PDF."});
    } finally {
      setIsDownloadingFeePdf(false);
    }
  };


  if (!authUser) {
    if (!isLoading) return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>Please log in as an admin.</p></CardContent></Card>;
    return <div className="flex flex-1 items-center justify-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center"><DollarSign className="mr-2 h-6 w-6" /> Fee Management</CardTitle>
          <CardDescription>Manage student fees, record payments, and view summary reports.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-2">
                <Label htmlFor="academic-year-select" className="text-sm font-medium">Academic Year:</Label>
                <Select value={filterAcademicYear} onValueChange={setFilterAcademicYear} disabled={isLoading || academicYears.length === 0}>
                    <SelectTrigger id="academic-year-select" className="w-[180px]"><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent>{academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="student-search">Search Student (by Name or Adm. No.)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="student-search" placeholder="Start typing..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedStudentId(null);}} className="pl-8" disabled={isSubmittingPayment}/>
              </div>
              {searchTerm && (<div className="mt-2 border rounded-md max-h-60 overflow-y-auto bg-background absolute w-[calc(100%-3rem)] md:w-full max-w-sm z-10">{filteredStudents.length > 0 ? (filteredStudents.map(student => (<div key={student._id!.toString()} onClick={() => {setSelectedStudentId(student._id!.toString()); setSearchTerm(""); setFilteredStudents([]);}} className="p-2 hover:bg-accent cursor-pointer border-b last:border-b-0"><p className="font-medium">{student.name}</p><p className="text-sm text-muted-foreground">{student.classLabel || 'N/A'} - Adm No: {student.admissionId || 'N/A'}</p></div>))) : (<p className="p-2 text-center text-sm text-muted-foreground">No students found</p>)}</div>)}
            </div>
            {selectedStudentFullData && (
              <>
                <div className="text-sm font-semibold pt-2">Selected: <span className="text-primary">{selectedStudentFullData.name}</span> <span className="text-muted-foreground">({selectedStudentFullData.classLabel})</span></div>
                <p className="text-sm font-semibold">Amount Due: <span className="font-sans">₹</span>{selectedStudentFullData.dueAmount.toLocaleString()}</p>
                <div className="pt-2 space-y-3">
                    <div><Label htmlFor="payment-amount">Payment Amount (<span className="font-sans">₹</span>)</Label><Input id="payment-amount" type="number" placeholder="Enter amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} disabled={isSubmittingPayment || selectedStudentFullData.dueAmount <= 0}/></div>
                    <div><Label htmlFor="payment-date">Payment Date</Label><Popover><PopoverTrigger asChild><Button id="payment-date" variant={"outline"} className="w-full justify-start text-left font-normal" disabled={isSubmittingPayment || !paymentDate}><CalendarDays className="mr-2 h-4 w-4" />{paymentDate ? format(paymentDate, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus disabled={(date) => date > new Date()}/></PopoverContent></Popover></div>
                    <div><Label htmlFor="payment-method">Payment Method</Label><Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} disabled={isSubmittingPayment}><SelectTrigger><SelectValue placeholder="Select method..."/></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label htmlFor="payment-notes">Notes</Label><Textarea id="payment-notes" placeholder="e.g., Part payment for Term 1" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} disabled={isSubmittingPayment}/></div>
                </div>
                <div className="flex gap-2"><Button onClick={handleRecordPayment} disabled={!paymentAmount || +paymentAmount <= 0 || isSubmittingPayment || selectedStudentFullData.dueAmount <= 0} className="flex-1">{isSubmittingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Payment</Button><Button onClick={() => handlePrintReceipt(selectedStudentFullData)} variant="outline"><Printer className="mr-2 h-4 w-4"/>Print Last Receipt</Button></div>
                {selectedStudentFullData.dueAmount <= 0 && <p className="text-sm text-green-600 text-center pt-2">No amount due for this student.</p>}
              </>
            )}
            {!selectedStudentId && !searchTerm && <p className="text-sm text-muted-foreground text-center pt-2">Search for a student to record a payment.</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2"><CardTitle>Fee Collection Summary</CardTitle><Button onClick={handleDownloadFeePdf} variant="outline" size="sm" disabled={isLoading || isDownloadingFeePdf}>{isDownloadingFeePdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}Download Report</Button></div></CardHeader>
          <CardContent>
            {isLoading ? (<div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading fee summary...</p></div>) :
             feeOverallSummary ? (
                <div id="feeReportContent" className="p-4 bg-card rounded-md">
                    <Card className="mb-6 bg-secondary/30 border-none"><CardHeader><CardTitle className="text-lg">Overall Summary for {filterAcademicYear}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center"><div><p className="text-sm text-muted-foreground">Expected</p><p className="text-2xl font-bold"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalExpected.toLocaleString()}</p></div><div><p className="text-sm text-muted-foreground">Concessions</p><p className="text-2xl font-bold text-blue-600"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalConcessions.toLocaleString()}</p></div><div><p className="text-sm text-muted-foreground">Collected</p><p className="text-2xl font-bold text-green-600"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalCollected.toLocaleString()}</p></div><div><p className="text-sm text-muted-foreground">Due</p><p className="text-2xl font-bold text-red-600"><span className="font-sans">₹</span>{feeOverallSummary.grandTotalDue.toLocaleString()}</p></div><div><p className="text-sm text-muted-foreground">Collection %</p><p className="text-2xl font-bold text-blue-600">{feeOverallSummary.overallCollectionPercentage}%</p><Progress value={feeOverallSummary.overallCollectionPercentage} className="h-2 mt-1" /></div></CardContent></Card>
                    <Table><TableHeader><TableRow><TableHead>Class Name</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Concessions</TableHead><TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Due</TableHead><TableHead className="text-center">Collection %</TableHead></TableRow></TableHeader><TableBody>{feeClassSummaries.map((summary) => (<TableRow key={summary.className}><TableCell className="font-medium">{summary.className}</TableCell><TableCell className="text-right"><span className="font-sans">₹</span>{summary.totalExpected.toLocaleString()}</TableCell><TableCell className="text-right text-blue-600"><span className="font-sans">₹</span>{summary.totalConcessions.toLocaleString()}</TableCell><TableCell className="text-right text-green-600"><span className="font-sans">₹</span>{summary.totalCollected.toLocaleString()}</TableCell><TableCell className="text-right text-red-600"><span className="font-sans">₹</span>{summary.totalDue.toLocaleString()}</TableCell><TableCell className="text-center"><div className="flex flex-col items-center"><span className="font-bold">{summary.collectionPercentage}%</span><Progress value={summary.collectionPercentage} className="h-1.5 w-20 mt-1" /></div></TableCell></TableRow>))}</TableBody></Table>
                </div>
            ) : (<p className="text-center text-muted-foreground py-4">No fee data found for the selected academic year.</p>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
