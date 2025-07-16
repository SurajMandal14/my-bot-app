
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, Printer, Loader2, Info, CalendarDays, BadgePercent, Search, ArrowUpDown } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/attendance";
import type { User as AppUser } from "@/types/user";
import type { School, TermFee } from "@/types/school";
import type { FeePayment, FeePaymentPayload } from "@/types/fees";
import type { FeeConcession } from "@/types/concessions";
import { getSchoolUsers } from "@/app/actions/schoolUsers";
import { getSchoolById } from "@/app/actions/schools";
import { recordFeePayment, getFeePaymentsBySchool } from "@/app/actions/fees";
import { getFeeConcessionsForSchool } from "@/app/actions/concessions";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { format } from "date-fns";

const getCurrentAcademicYear = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  if (currentMonth >= 5) { 
    return `${currentYear}-${currentYear + 1}`;
  } else { 
    return `${currentYear - 1}-${currentYear}`;
  }
};

interface ClassOption {
  value: string;
  label: string;
  name?: string;
}

interface StudentFeeDetailsProcessed extends AppUser {
  totalAnnualTuitionFee: number;
  paidAmount: number;
  totalConcessions: number;
  dueAmount: number;
  className?: string; 
  classLabel?: string;
}

type SortableKeys = 'name' | 'classLabel' | 'totalAnnualTuitionFee' | 'paidAmount' | 'totalConcessions' | 'dueAmount';

export default function FeeManagementPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [allStudents, setAllStudents] = useState<AppUser[]>([]);
  const [allSchoolPayments, setAllSchoolPayments] = useState<FeePayment[]>([]);
  const [allSchoolConcessions, setAllSchoolConcessions] = useState<FeeConcession[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  
  const [studentFeeList, setStudentFeeList] = useState<StudentFeeDetailsProcessed[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStudents, setFilteredStudents] = useState<StudentFeeDetailsProcessed[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [paymentAmount, setPaymentAmount] = useState<number | string>("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const { toast } = useToast();
  const currentAcademicYear = getCurrentAcademicYear();
  
  const [feeStatusFilterTerm, setFeeStatusFilterTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'admin' && parsedUser.schoolId && parsedUser._id) {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
          toast({ variant: "destructive", title: "Access Denied", description: "You must be a school admin with valid session data." });
        }
      } catch (e) {
        console.error("FeeManagementPage: Failed to parse authUser", e);
        setAuthUser(null);
      }
    } else {
      setAuthUser(null);
    }
  }, [toast]);

  const calculateAnnualTuitionFee = useCallback((className: string | undefined, schoolConfig: School | null): number => {
    if (!className || !schoolConfig || !schoolConfig.tuitionFees) return 0;
    const classFeeConfig = schoolConfig.tuitionFees.find(cf => cf.className === className);
    if (!classFeeConfig || !classFeeConfig.terms) return 0;
    return classFeeConfig.terms.reduce((sum, term) => sum + (term.amount || 0), 0);
  }, []);

  const fetchSchoolDataAndRelated = useCallback(async () => {
    if (!authUser || !authUser.schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [schoolResult, usersResult, paymentsResult, concessionsResult, classesOptResult] = await Promise.all([
        getSchoolById(authUser.schoolId.toString()),
        getSchoolUsers(authUser.schoolId.toString()),
        getFeePaymentsBySchool(authUser.schoolId.toString()),
        getFeeConcessionsForSchool(authUser.schoolId.toString(), currentAcademicYear),
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
  }, [authUser, toast, currentAcademicYear]);
  
  useEffect(() => {
    if (authUser && authUser.schoolId) fetchSchoolDataAndRelated();
    else if (!authUser) setIsLoading(false);
  }, [authUser, fetchSchoolDataAndRelated]);


  const processStudentFeeDetails = useCallback(() => {
    if (!schoolDetails || allStudents.length === 0 || classOptions.length === 0) {
      setStudentFeeList([]);
      return;
    }

    const processedList = allStudents.map(student => {
      const classInfo = classOptions.find(opt => opt.value === student.classId);
      const studentClassName = classInfo?.name;
      const studentClassLabel = classInfo?.label || student.classId || 'N/A';
      
      const totalAnnualTuitionFee = calculateAnnualTuitionFee(studentClassName, schoolDetails);
      const paidAmount = allSchoolPayments.filter(p => p.studentId.toString() === student._id.toString()).reduce((sum, p) => sum + p.amountPaid, 0);
      const totalConcessions = allSchoolConcessions.filter(c => c.studentId.toString() === student._id.toString() && c.academicYear === currentAcademicYear).reduce((sum, c) => sum + c.amount, 0);
      const dueAmount = Math.max(0, totalAnnualTuitionFee - paidAmount - totalConcessions);

      return { ...student, className: studentClassName, classLabel: studentClassLabel, totalAnnualTuitionFee, paidAmount, totalConcessions, dueAmount };
    }) as StudentFeeDetailsProcessed[];
    setStudentFeeList(processedList);

  }, [allStudents, schoolDetails, allSchoolPayments, allSchoolConcessions, calculateAnnualTuitionFee, currentAcademicYear, classOptions]);

  useEffect(() => {
     processStudentFeeDetails();
  }, [allStudents, schoolDetails, allSchoolPayments, allSchoolConcessions, classOptions, processStudentFeeDetails]);

  useEffect(() => {
    if (searchTerm.trim().length > 1) {
      const results = studentFeeList.filter(student => 
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.admissionId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(results.slice(0, 10)); // Limit to top 10 results for performance
    } else {
      setFilteredStudents([]);
    }
  }, [searchTerm, studentFeeList]);


  const selectedStudentFullData = selectedStudentId ? studentFeeList.find(s => s._id.toString() === selectedStudentId) : null;

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

  const handleRecordPayment = async () => {
    if (!selectedStudentFullData || !paymentAmount || +paymentAmount <= 0 || !paymentDate || !authUser?._id || !authUser?.schoolId) {
      toast({ variant: "destructive", title: "Error", description: "Please select a student, enter a valid payment amount, date, and ensure admin details are available." });
      return;
    }
    setIsSubmittingPayment(true);

    const payload: FeePaymentPayload = {
      studentId: selectedStudentFullData._id.toString(),
      studentName: selectedStudentFullData.name || 'N/A',
      schoolId: authUser.schoolId.toString(),
      classId: selectedStudentFullData.classLabel || 'N/A',
      amountPaid: +paymentAmount,
      paymentDate: paymentDate,
      recordedByAdminId: authUser._id.toString(),
      paymentMethod: paymentMethod || undefined,
      notes: paymentNotes || undefined,
    };

    const result = await recordFeePayment(payload);
    
    if (result.success) {
      toast({ title: "Payment Recorded", description: result.message });
      if (authUser?.schoolId) await fetchSchoolDataAndRelated();
      setSelectedStudentId(null);
    } else {
      toast({ variant: "destructive", title: "Payment Failed", description: result.error || result.message });
    }
    setIsSubmittingPayment(false);
  };

  const handleGenerateReceipt = (studentId: string) => {
    const student = studentFeeList.find(s => s._id.toString() === studentId);
    if (!student || !schoolDetails) return toast({variant: "destructive", title: "Error", description: "Student or school details not found."});
    
    const studentPayments = allSchoolPayments.filter(p => p.studentId.toString() === studentId.toString());
    if (studentPayments.length === 0) return toast({title: "No Payments", description: `No payments found for ${student.name || 'this student'}.`});

    const latestPayment = studentPayments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
    if (latestPayment && latestPayment._id) {
      const receiptUrl = `/dashboard/admin/fees/receipt/${latestPayment._id.toString()}?studentName=${encodeURIComponent(student.name || '')}&className=${encodeURIComponent(student.classLabel || '')}`;
      window.open(receiptUrl, '_blank');
    } else {
       toast({variant: "destructive", title: "Error", description: "Could not identify the latest payment for receipt generation."});
    }
  };
  
  const handleSort = (key: SortableKeys) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedFeeList = useMemo(() => {
    let processableStudents = [...studentFeeList];
    
    // Filtering
    if (feeStatusFilterTerm) {
      const lowercasedFilter = feeStatusFilterTerm.toLowerCase();
      processableStudents = processableStudents.filter(student => 
        student.name?.toLowerCase().includes(lowercasedFilter) ||
        student.admissionId?.toLowerCase().includes(lowercasedFilter)
      );
    }
    
    // Sorting
    processableStudents.sort((a, b) => {
      const { key, direction } = sortConfig;
      
      const aValue = a[key] ?? (typeof a[key] === 'number' ? 0 : '');
      const bValue = b[key] ?? (typeof b[key] === 'number' ? 0 : '');

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return processableStudents;
  }, [studentFeeList, feeStatusFilterTerm, sortConfig]);

  const renderSortIcon = (columnKey: SortableKeys) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };
  
  if (isLoading && !authUser) return <div className="flex flex-1 items-center justify-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Loading session...</p></div>;
  if (!authUser && !isLoading) return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>Please log in as a school administrator to manage fees.</p><Button onClick={() => window.location.href = '/'} className="mt-4">Go to Login</Button></CardContent></Card>;
  if (isLoading && authUser) return <div className="flex flex-1 items-center justify-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Loading fee management data...</p></div>;
  if (!schoolDetails && !isLoading) return <Card><CardHeader><CardTitle className="flex items-center"><Info className="mr-2 h-6 w-6 text-destructive"/> Configuration Error</CardTitle></CardHeader><CardContent><p className="text-destructive">School details could not be loaded.</p><p className="mt-2 text-sm text-muted-foreground">Please ensure the school profile is set up by a Super Admin.</p><Button onClick={fetchSchoolDataAndRelated} className="mt-4" variant="outline" disabled={isLoading}>Refresh Data</Button></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center"><DollarSign className="mr-2 h-6 w-6" /> Fee Management</CardTitle>
          <CardDescription>Manage student fees for {schoolDetails?.schoolName || "your school"}, record payments, and generate receipts. Fees shown are for academic year: {currentAcademicYear}.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="student-search">Search Student (by Name or Adm. No.)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    id="student-search"
                    placeholder="Start typing..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (selectedStudentId) setSelectedStudentId(null);
                    }}
                    className="pl-8"
                    disabled={isSubmittingPayment}
                />
              </div>
              {searchTerm && (
                <div className="mt-2 border rounded-md max-h-60 overflow-y-auto bg-background absolute w-[calc(100%-3rem)] md:w-full max-w-sm z-10">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                      <div 
                        key={student._id!.toString()}
                        onClick={() => {
                          setSelectedStudentId(student._id!.toString());
                          setSearchTerm("");
                          setFilteredStudents([]);
                        }}
                        className="p-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
                      >
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">{student.classLabel || 'N/A'} - Adm No: {student.admissionId || 'N/A'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="p-2 text-center text-sm text-muted-foreground">No students found matching "{searchTerm}"</p>
                  )}
                </div>
              )}
            </div>
            {selectedStudentFullData && (
              <>
                <p className="text-sm font-semibold pt-2">Selected: <span className="text-primary">{selectedStudentFullData.name}</span></p>
                <p className="text-sm">Class: {selectedStudentFullData.classLabel || 'N/A'}</p>
                <p className="text-sm">Total Annual Tuition Fee: <span className="font-sans">₹</span>{selectedStudentFullData.totalAnnualTuitionFee.toLocaleString()}</p>
                <p className="text-sm">Amount Paid: <span className="font-sans">₹</span>{selectedStudentFullData.paidAmount.toLocaleString()}</p>
                <p className="text-sm text-blue-600">Total Concessions ({currentAcademicYear}): <span className="font-sans">₹</span>{selectedStudentFullData.totalConcessions.toLocaleString()}</p>
                <p className="text-sm font-semibold">Amount Due: <span className="font-sans">₹</span>{selectedStudentFullData.dueAmount.toLocaleString()}</p>
                
                <div className="pt-2 space-y-3">
                    <div>
                        <Label htmlFor="payment-amount">Payment Amount (<span className="font-sans">₹</span>)</Label>
                        <Input id="payment-amount" type="number" placeholder="Enter amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} disabled={!selectedStudentFullData || isSubmittingPayment || selectedStudentFullData.dueAmount <= 0}/>
                    </div>
                    <div>
                        <Label htmlFor="payment-date">Payment Date</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button id="payment-date" variant={"outline"} className="w-full justify-start text-left font-normal" disabled={!selectedStudentFullData || isSubmittingPayment || !paymentDate}>
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {paymentDate ? format(paymentDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus disabled={(date) => date > new Date() || date < new Date("2000-01-01")}/></PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <Label htmlFor="payment-method">Payment Method (Optional)</Label>
                        <Input id="payment-method" type="text" placeholder="e.g., Cash, Card, Online" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={!selectedStudentFullData || isSubmittingPayment}/>
                    </div>
                    <div>
                        <Label htmlFor="payment-notes">Notes (Optional)</Label>
                        <Textarea id="payment-notes" placeholder="e.g., Part payment for Term 1" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} disabled={!selectedStudentFullData || isSubmittingPayment}/>
                    </div>
                </div>

                <Button onClick={handleRecordPayment} disabled={!selectedStudentFullData || !paymentAmount || +paymentAmount <= 0 || isSubmittingPayment || selectedStudentFullData.dueAmount <= 0 || !paymentDate} className="w-full">
                  {isSubmittingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmittingPayment ? "Recording..." : "Record Payment"}
                </Button>
                {selectedStudentFullData.dueAmount <= 0 && <p className="text-sm text-green-600 text-center pt-2">No amount due for this student.</p>}
              </>
            )}
            {!selectedStudentId && !searchTerm && <p className="text-sm text-muted-foreground text-center pt-2">Search for a student to record a payment.</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div className="w-full sm:w-auto">
                <CardTitle>Student Fee Status (Annual Tuition - {currentAcademicYear})</CardTitle>
                <CardDescription>Overview of student tuition fees, payments, concessions, and dues.</CardDescription>
              </div>
              <Input
                placeholder="Filter by name or admission no..."
                value={feeStatusFilterTerm}
                onChange={(e) => setFeeStatusFilterTerm(e.target.value)}
                className="w-full sm:max-w-xs"
                disabled={isLoading}
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredAndSortedFeeList.length > 0 ? (
              <Table>
                <TableHeader><TableRow>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Student Name {renderSortIcon('name')}</Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('classLabel')}>Class {renderSortIcon('classLabel')}</Button></TableHead>
                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('totalAnnualTuitionFee')}>Total Fee {renderSortIcon('totalAnnualTuitionFee')}</Button></TableHead>
                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('paidAmount')}>Paid {renderSortIcon('paidAmount')}</Button></TableHead>
                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('totalConcessions')}>Concessions {renderSortIcon('totalConcessions')}</Button></TableHead>
                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('dueAmount')}>Due {renderSortIcon('dueAmount')}</Button></TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredAndSortedFeeList.map((student) => (
                    <TableRow key={student._id.toString()}>
                      <TableCell>{student.name}</TableCell><TableCell>{student.classLabel || 'N/A'}</TableCell>
                      <TableCell className="text-right"><span className="font-sans">₹</span>{student.totalAnnualTuitionFee.toLocaleString()}</TableCell>
                      <TableCell className="text-right"><span className="font-sans">₹</span>{student.paidAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-blue-600"><span className="font-sans">₹</span>{student.totalConcessions.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-semibold ${student.dueAmount > 0 ? "text-destructive" : "text-green-600"}`}><span className="font-sans">₹</span>{student.dueAmount.toLocaleString()}</TableCell>
                      <TableCell className="space-x-1 text-center">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedStudentId(student._id.toString())} title="Record Payment"><DollarSign className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleGenerateReceipt(student._id.toString())} title="Generate Receipt" disabled={student.paidAmount === 0}><Printer className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (<p className="text-center text-muted-foreground py-4">{isLoading ? "Loading student fee data..." : allStudents.length === 0 ? "No students found." : !schoolDetails ? "School fee config not loaded." : "No fee details to display."}</p>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
