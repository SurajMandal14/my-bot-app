
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TicketPercent, PlusCircle, Trash2, Loader2, User, CalendarFold, Search, Info, DollarSign } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

import { useToast } from "@/hooks/use-toast";
import { applyFeeConcession, getFeeConcessionsForSchool, revokeFeeConcession } from "@/app/actions/concessions";
import { getStudentDetailsForReportCard } from "@/app/actions/schoolUsers";
import type { FeeConcessionFormData, FeeConcession } from '@/types/concessions';
import { feeConcessionFormSchema, CONCESSION_TYPES } from '@/types/concessions';
import type { User as AppUser, AuthUser } from "@/types/user";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';

export default function MasterAdminConcessionPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  
  const [concessions, setConcessions] = useState<FeeConcession[]>([]);
  
  const [isLoadingConcessions, setIsLoadingConcessions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [concessionToRevoke, setConcessionToRevoke] = useState<FeeConcession | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  
  const [academicYearFilter, setAcademicYearFilter] = useState<string>(`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  
  // State for student search
  const [admissionIdInput, setAdmissionIdInput] = useState("");
  const [foundStudentName, setFoundStudentName] = useState<string | null>(null);
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);
  
  const [concessionToApply, setConcessionToApply] = useState<FeeConcessionFormData | null>(null);

  const form = useForm<FeeConcessionFormData>({
    resolver: zodResolver(feeConcessionFormSchema),
    defaultValues: {
      studentId: "",
      schoolId: "",
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      concessionType: undefined,
      amount: 0,
      reason: "",
    },
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        if (parsedUser && parsedUser.role === 'masteradmin' && parsedUser._id && parsedUser.schoolId) {
          setAuthUser(parsedUser);
          form.setValue("schoolId", parsedUser.schoolId.toString());
        } else {
          setAuthUser(null);
          toast({ variant: "destructive", title: "Access Denied" });
        }
      } catch (e) { setAuthUser(null); }
    } else { setAuthUser(null); }
  }, [toast, form]);

  const fetchConcessionsForSchool = useCallback(async (schoolId: string, year?: string) => {
    setIsLoadingConcessions(true);
    const concessionsResult = await getFeeConcessionsForSchool(schoolId, year);
    if (concessionsResult.success && concessionsResult.concessions) {
      setConcessions(concessionsResult.concessions);
    } else {
      toast({ variant: "warning", title: "Concessions", description: concessionsResult.message || "Failed to load concessions."});
      setConcessions([]);
    }
    setIsLoadingConcessions(false);
  }, [toast]);

  useEffect(() => {
    if (authUser?.schoolId) {
      fetchConcessionsForSchool(authUser.schoolId.toString(), academicYearFilter);
    }
  }, [authUser, academicYearFilter, fetchConcessionsForSchool]);

  const handleSearchStudent = async () => {
    if (!admissionIdInput.trim() || !authUser?.schoolId) {
      toast({ variant: "destructive", title: "Input Missing", description: "Please provide an admission number." });
      return;
    }
    setIsSearchingStudent(true);
    setFoundStudentName(null);
    form.setValue('studentId', '');

    const result = await getStudentDetailsForReportCard(admissionIdInput, authUser.schoolId.toString());
    if (result.success && result.student) {
      setFoundStudentName(result.student.name);
      form.setValue('studentId', result.student._id.toString());
      toast({ title: "Student Found", description: `Selected: ${result.student.name}` });
    } else {
      toast({ variant: "destructive", title: "Student Not Found", description: result.message || "No student found with that admission number." });
    }
    setIsSearchingStudent(false);
  };

  async function onSubmit(values: FeeConcessionFormData) {
    if (!authUser?._id) {
      toast({ variant: "destructive", title: "Error", description: "Admin session not found."});
      return;
    }
    if (!values.studentId) {
      toast({ variant: "destructive", title: "Student Not Selected", description: "Please search for and select a student first." });
      return;
    }
    setConcessionToApply(values);
  }
  
  const handleConfirmApply = async () => {
    if (!concessionToApply || !authUser?._id) return;
    setIsSubmitting(true);
    const result = await applyFeeConcession(concessionToApply, authUser._id.toString());
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Concession Applied", description: result.message });
      form.reset({ ...form.getValues(), studentId: "", amount: 0, reason: "", concessionType: undefined });
      setAdmissionIdInput("");
      setFoundStudentName(null);
      if (authUser.schoolId) fetchConcessionsForSchool(authUser.schoolId.toString(), academicYearFilter);
    } else {
      toast({ variant: "destructive", title: "Application Failed", description: result.error || result.message });
    }
    setConcessionToApply(null);
  };

  const handleRevokeConcession = async () => {
    if (!concessionToRevoke?._id || !authUser?.schoolId) return;
    setIsRevoking(true);
    const result = await revokeFeeConcession(concessionToRevoke._id.toString());
    setIsRevoking(false);
    if (result.success) {
      toast({ title: "Concession Revoked", description: result.message });
      fetchConcessionsForSchool(authUser.schoolId.toString(), academicYearFilter);
    } else {
      toast({ variant: "destructive", title: "Revocation Failed", description: result.error || result.message });
    }
    setConcessionToRevoke(null);
  };

  if (!authUser) {
    return (
      <Card>
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>Please log in as a Master Admin.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center"><TicketPercent className="mr-2 h-6 w-6" /> Fee Concession Management</CardTitle>
          <CardDescription>Apply and manage student fee concessions for your assigned school.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>Apply New Concession</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>Student Admission Number</FormLabel>
                  <div className="flex items-center gap-2">
                      <Input 
                          placeholder="Type admission number"
                          value={admissionIdInput}
                          onChange={(e) => {
                              setAdmissionIdInput(e.target.value);
                              setFoundStudentName(null);
                              form.setValue('studentId', '');
                          }}
                          disabled={isSubmitting}
                      />
                      <Button type="button" onClick={handleSearchStudent} disabled={isSubmitting || !admissionIdInput || isSearchingStudent}>
                          {isSearchingStudent ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
                      </Button>
                  </div>
                  {foundStudentName && <p className="text-sm text-green-600 mt-1">Student Found: <span className="font-semibold">{foundStudentName}</span></p>}
                  <FormField control={form.control} name="studentId" render={({ field }) => (
                      <FormItem>
                          <FormControl><Input type="hidden" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )}/>
                </div>
                
                <FormField control={form.control} name="academicYear" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center"><CalendarFold className="mr-2 h-4 w-4 text-muted-foreground"/>Academic Year</FormLabel>
                    <FormControl><Input placeholder="e.g., 2023-2024" {...field} disabled={isSubmitting} /></FormControl><FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="concessionType" render={({ field }) => (
                  <FormItem><FormLabel>Concession Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value as string | undefined} disabled={isSubmitting}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select concession type" /></SelectTrigger></FormControl>
                      <SelectContent>{CONCESSION_TYPES.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/>Concession Amount (<span className="font-sans">₹</span>)</FormLabel>
                    <FormControl><Input type="number" placeholder="0.00" {...field} disabled={isSubmitting} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem className="lg:col-span-3"><FormLabel>Reason for Concession</FormLabel>
                    <FormControl><Textarea placeholder="Detailed reason..." {...field} disabled={isSubmitting} rows={3} /></FormControl><FormMessage />
                  </FormItem>
                )}/>
              </div>
              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || !form.formState.isValid || !foundStudentName}>
                 <PlusCircle className="mr-2 h-4 w-4"/> Apply Concession
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <AlertDialog open={!!concessionToApply} onOpenChange={(open) => !open && setConcessionToApply(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Concession</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm the details before applying the concession:
              <ul className="mt-2 list-disc list-inside text-sm text-foreground">
                <li>Student: <strong>{foundStudentName}</strong></li>
                <li>Amount: <strong><span className="font-sans">₹</span>{concessionToApply?.amount.toLocaleString()}</strong></li>
                <li>Type: <strong>{concessionToApply?.concessionType}</strong></li>
                <li>Academic Year: <strong>{concessionToApply?.academicYear}</strong></li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConcessionToApply(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApply} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirm and Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Existing Fee Concessions</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label htmlFor="academicYearFilter" className="whitespace-nowrap">Filter Year:</Label>
              <Input id="academicYearFilter" placeholder="e.g., 2023-2024" className="w-full sm:w-[180px]" value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)} disabled={isLoadingConcessions}/>
              <Button variant="outline" size="icon" onClick={() => fetchConcessionsForSchool(authUser.schoolId!, academicYearFilter)} disabled={isLoadingConcessions}><Search className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingConcessions ? (<div className="flex items-center justify-center py-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading concessions...</p></div>)
          : concessions.length > 0 ? (
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>School</TableHead><TableHead>Academic Year</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount (<span className="font-sans">₹</span>)</TableHead><TableHead>Reason</TableHead><TableHead>Applied By</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {concessions.map((con) => (
                <TableRow key={con._id.toString()}>
                  <TableCell>{con.studentName || 'N/A'}</TableCell><TableCell>{con.schoolName || 'N/A'}</TableCell><TableCell>{con.academicYear}</TableCell><TableCell>{con.concessionType}</TableCell>
                  <TableCell className="text-right"><span className="font-sans">₹</span>{con.amount.toLocaleString()}</TableCell>
                  <TableCell className="max-w-xs truncate" title={con.reason}>{con.reason}</TableCell>
                  <TableCell>{con.appliedByMasterAdminName || 'N/A'}</TableCell><TableCell>{format(new Date(con.createdAt), "PP")}</TableCell>
                  <TableCell>
                    <AlertDialog open={concessionToRevoke?._id === con._id} onOpenChange={(open) => !open && setConcessionToRevoke(null)}>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={() => setConcessionToRevoke(con)} disabled={isRevoking} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                      {concessionToRevoke && concessionToRevoke._id === con._id && (
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will revoke the concession of <span className="font-sans">₹</span>{concessionToRevoke.amount} for {concessionToRevoke.studentName}. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setConcessionToRevoke(null)} disabled={isRevoking}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRevokeConcession} disabled={isRevoking} className="bg-destructive hover:bg-destructive/90">{isRevoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Revoke</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      )}
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          ) : (<p className="text-center text-muted-foreground py-4">No concessions found for the selected academic year.</p>)}
        </CardContent>
      </Card>
    </div>
  );
}
