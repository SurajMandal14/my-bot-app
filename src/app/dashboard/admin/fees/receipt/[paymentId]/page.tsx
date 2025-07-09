
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getPaymentById } from '@/app/actions/fees';
import { getSchoolById } from '@/app/actions/schools'; 
import type { FeePayment } from '@/types/fees';
import type { School } from '@/types/school';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Printer, AlertTriangle } from "lucide-react";
import { format } from 'date-fns';

export default function FeeReceiptPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;
  
  const [payment, setPayment] = useState<FeePayment | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const studentNameQuery = searchParams?.get('studentName');
  const classNameQuery = searchParams?.get('className');


  const fetchReceiptData = useCallback(async () => {
    if (!paymentId) {
      setError("Payment ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const paymentResult = await getPaymentById(paymentId);
      if (paymentResult.success && paymentResult.payment) {
        setPayment(paymentResult.payment);
        const schoolResult = await getSchoolById(paymentResult.payment.schoolId.toString());
        if (schoolResult.success && schoolResult.school) {
          setSchool(schoolResult.school);
        } else {
          setError(schoolResult.message || "Could not load school details.");
        }
      } else {
        setError(paymentResult.message || "Could not load payment details.");
        setPayment(null);
      }
    } catch (e) {
      console.error("Fetch receipt data error:", e);
      setError("An unexpected error occurred while fetching receipt data.");
    } finally {
      setIsLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    fetchReceiptData();
  }, [fetchReceiptData]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading Receipt...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-destructive mb-2">Error Loading Receipt</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => typeof window !== "undefined" && window.close()}>Close</Button>
      </div>
    );
  }

  if (!payment || !school) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Receipt Data Not Found</h1>
        <p className="text-muted-foreground mb-6">The requested payment or school details could not be found.</p>
        <Button onClick={() => typeof window !== "undefined" && window.close()}>Close</Button>
      </div>
    );
  }
  
  const studentDisplayName = studentNameQuery || payment.studentName;
  const studentDisplayClass = classNameQuery || payment.classId;

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8 flex flex-col items-center print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-receipt-container { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
      <Card className="w-full max-w-2xl shadow-xl print-receipt-container print:shadow-none print:border-none">
        <CardHeader className="text-center space-y-2">
          {school.schoolLogoUrl && (
            <img 
                src={school.schoolLogoUrl} 
                alt={`${school.schoolName} Logo`} 
                data-ai-hint="school logo"
                width={80} 
                height={80} 
                className="mx-auto rounded-md object-contain h-20 w-20 border bg-muted"
                onError={(e) => (e.currentTarget.src = "https://placehold.co/80x80.png")} 
            />
          )}
          <CardTitle className="text-3xl font-bold">{school.schoolName}</CardTitle>
          <CardDescription className="text-lg">Fee Payment Receipt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div><strong className="font-medium">Receipt No:</strong> {payment._id.toString().slice(-8).toUpperCase()}</div>
            <div><strong className="font-medium">Payment Date:</strong> {format(new Date(payment.paymentDate), "PPP")}</div>
            <div><strong className="font-medium">Student Name:</strong> {studentDisplayName}</div>
            <div><strong className="font-medium">Class:</strong> {studentDisplayClass}</div>
            <div><strong className="font-medium">Admission No. (Student ID):</strong> {payment.studentId.toString().slice(-10)}</div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-md font-semibold mb-2">Payment Details:</h3>
            <div className="flex justify-between">
              <span>Amount Paid:</span>
              <span className="font-bold text-lg"><span className="font-sans">₹</span>{payment.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Mode of Payment:</span>
              <span>{payment.paymentMethod || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span>Towards:</span>
              <span>School Fees for Class {studentDisplayClass}</span>
            </div>
            {payment.notes && (
              <div className="flex justify-between">
                <span>Notes:</span>
                <span>{payment.notes}</span>
              </div>
            )}
          </div>
          
          <Separator />

          <div className="text-center text-xs text-muted-foreground pt-4">
            This is a computer-generated receipt and does not require a signature.
            <p>Thank you for your payment!</p>
            <p>{school.schoolName} - Contact: (School Contact Info Placeholder)</p>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex gap-4 no-print w-full max-w-2xl">
        <Button onClick={handlePrint} className="w-full sm:w-auto flex-1">
          <Printer className="mr-2 h-4 w-4" /> Print Receipt
        </Button>
        <Button variant="outline" onClick={() => typeof window !== "undefined" && window.close()} className="w-full sm:w-auto flex-1">
          Close
        </Button>
      </div>
    </div>
  );
}
