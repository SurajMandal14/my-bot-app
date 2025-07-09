
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Receipt, Info, Loader2, ListChecks, BadgePercent } from "lucide-react"; // Added BadgePercent
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getFeePaymentsByStudent } from "@/app/actions/fees";
// School and AuthUser details will come from context
import type { FeePayment } from "@/types/fees";
import { useStudentData } from "@/contexts/StudentDataContext"; // Import context

const getCurrentAcademicYearLocal = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  if (currentMonth >= 5) { 
    return `${currentYear}-${currentYear + 1}`;
  } else { 
    return `${currentYear - 1}-${currentYear}`;
  }
};

export default function StudentFeesPage() {
  const { 
    authUser, 
    feeSummary, 
    appliedConcessions, 
    isLoading: isLoadingContext, 
    error: errorContext,
    schoolDetails 
  } = useStudentData();
  
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const { toast } = useToast();

  const fetchPayments = useCallback(async () => {
    if (!authUser || !authUser._id || !authUser.schoolId) {
      setIsLoadingPayments(false);
      return;
    }
    setIsLoadingPayments(true);
    const paymentsResult = await getFeePaymentsByStudent(authUser._id.toString(), authUser.schoolId.toString());
    if (paymentsResult.success && paymentsResult.payments) {
      setFeePayments(paymentsResult.payments);
    } else {
      toast({ variant: "warning", title: "Payment History", description: paymentsResult.message || "Could not load your payment history." });
      setFeePayments([]);
    }
    setIsLoadingPayments(false);
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser?._id && authUser?.schoolId) {
      fetchPayments();
    }
  }, [authUser, fetchPayments]);

  const displayAcademicYear = schoolDetails?.academicYear || getCurrentAcademicYearLocal();

  if (isLoadingContext) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (errorContext) {
    return (
      <Card>
        <CardHeader><CardTitle>Error</CardTitle></CardHeader>
        <CardContent><p>{errorContext}</p></CardContent>
      </Card>
    );
  }
  
  if (!authUser) {
    return (
      <Card>
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Please log in as a student to view your fee details.</p></CardContent>
      </Card>
    );
  }

  if (!authUser.classId || !schoolDetails) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center"><Info className="mr-2 h-6 w-6 text-yellow-500"/> Fee Information Unavailable</CardTitle></CardHeader>
        <CardContent>
            <p>Your fee details cannot be displayed currently.</p>
            {!authUser.classId && <p className="text-muted-foreground">Reason: You are not assigned to a class. Please contact administration.</p>}
            {!schoolDetails && authUser.classId && <p className="text-muted-foreground">Reason: School fee configuration could not be loaded. Please try again later or contact administration.</p>}
        </CardContent>
      </Card>
    );
  }

  const netPayable = feeSummary ? feeSummary.totalFee - feeSummary.totalConcessions : 0;
  const displayPercentage = feeSummary ? feeSummary.percentagePaid : 0;


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <DollarSign className="mr-2 h-6 w-6" /> My Fee Status
          </CardTitle>
          <CardDescription>Overview of your fee payments, concessions, and dues for class {authUser.classId}.</CardDescription>
        </CardHeader>
      </Card>

      {feeSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>Fee Summary (Annual Tuition for {displayAcademicYear})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col space-y-1 rounded-lg border p-4 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Applicable Fee</p>
              <p className="text-2xl font-bold"><span className="font-sans">₹</span>{feeSummary.totalFee.toLocaleString()}</p>
            </div>
            <div className="flex flex-col space-y-1 rounded-lg border p-4 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold text-green-600"><span className="font-sans">₹</span>{feeSummary.totalPaid.toLocaleString()}</p>
            </div>
            <div className="flex flex-col space-y-1 rounded-lg border p-4 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Concessions</p>
              <p className="text-2xl font-bold text-blue-600"><span className="font-sans">₹</span>{feeSummary.totalConcessions.toLocaleString()}</p>
            </div>
            <div className="flex flex-col space-y-1 rounded-lg border p-4 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Remaining Due</p>
              <p className={`text-2xl font-bold ${feeSummary.totalDue > 0 ? 'text-destructive' : 'text-green-600'}`}>
                <span className="font-sans">₹</span>{feeSummary.totalDue.toLocaleString()}
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col space-y-1 rounded-lg border p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Payment Progress (of Net Payable after Concession)</p>
                <ListChecks className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">
                {displayPercentage}%
              </p>
              <Progress 
                value={displayPercentage} 
                className="h-3 mt-1" 
              />
              <p className="text-xs text-muted-foreground">
                <span className="font-sans">₹</span>{feeSummary.totalPaid.toLocaleString()} paid / 
                <span className="font-sans">₹</span>{netPayable.toLocaleString()} net payable
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
            <CardContent className="py-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-muted-foreground">Calculating fee summary...</p>
            </CardContent>
        </Card>
      )}

      {appliedConcessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><BadgePercent className="mr-2 h-5 w-5 text-blue-600" />Applied Concessions (Academic Year: {displayAcademicYear})</CardTitle>
            <CardDescription>List of fee concessions applied to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concession Type</TableHead>
                  <TableHead>Amount (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Applied On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appliedConcessions.map((concession) => (
                  <TableRow key={concession._id.toString()}>
                    <TableCell>{concession.concessionType}</TableCell>
                    <TableCell><span className="font-sans">₹</span>{concession.amount.toLocaleString()}</TableCell>
                    <TableCell>{concession.reason}</TableCell>
                    <TableCell>{format(new Date(concession.createdAt), "PPP")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Detailed log of all payments made.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="text-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="mt-2">Loading payment history...</p></div>
          ) : feePayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Amount Paid (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Recorded On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feePayments.map((payment) => (
                  <TableRow key={payment._id.toString()}>
                    <TableCell>{format(new Date(payment.paymentDate), "PPP")}</TableCell>
                    <TableCell><span className="font-sans">₹</span>{payment.amountPaid.toLocaleString()}</TableCell>
                    <TableCell>{payment.paymentMethod || 'N/A'}</TableCell>
                    <TableCell>{payment.notes || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(payment.createdAt), "Pp")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-4">No payment records found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
