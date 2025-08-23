
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChartBig, Loader2, Info, Users, ShieldCheck, ShieldOff, CheckCircle2, XCircleIcon, AlertTriangle, FileSignature, FileText, UserSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/attendance";
import { getReportCardsForClass, setReportPublicationStatusForClass, generateAllReportsForClass } from "@/app/actions/reports";
import type { BulkPublishReportInfo } from "@/types/report";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import Link from "next/link";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";

interface ClassOption {
  value: string; // class _id
  label: string; // "ClassName - Section"
  academicYear: string;
}

export default function AdminReportsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  // States for Bulk Report Publishing
  const [allClassOptions, setAllClassOptions] = useState<ClassOption[]>([]);
  const [filteredClassOptions, setFilteredClassOptions] = useState<ClassOption[]>([]);
  const [selectedClassForBulkPublish, setSelectedClassForBulkPublish] = useState<string>("");
  const [academicYearForBulkPublish, setAcademicYearForBulkPublish] = useState<string>("");
  const [reportsForBulkPublish, setReportsForBulkPublish] = useState<BulkPublishReportInfo[]>([]);
  const [isLoadingBulkReports, setIsLoadingBulkReports] = useState(false);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [bulkActionToConfirm, setBulkActionToConfirm] = useState<'publish' | 'unpublish' | 'generate' | null>(null);
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);


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
    
    // Process class options to separate academic year
    const processedClasses = classOptionsResult.map(c => {
        const match = c.label.match(/\((\d{4}-\d{4})\)/);
        const year = match ? match[1] : '';
        const label = c.label.replace(` (${year})`, '').trim();
        return { value: c.value, label, academicYear: year };
    });
    setAllClassOptions(processedClasses);

    if (academicYearsResult.success && academicYearsResult.academicYears) {
      setAcademicYears(academicYearsResult.academicYears);
      const activeYear = academicYearsResult.academicYears.find(y => y.isDefault)?.year || academicYearsResult.academicYears[0]?.year || "";
      if (activeYear) {
        setAcademicYearForBulkPublish(activeYear);
      }
    } else {
      toast({ variant: "destructive", title: "Error", description: "Could not load academic years." });
    }
    setIsLoading(false);
  }, [authUser?.schoolId, toast]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Filter classes when academic year changes
  useEffect(() => {
    if (academicYearForBulkPublish) {
      const filtered = allClassOptions.filter(c => c.academicYear === academicYearForBulkPublish);
      setFilteredClassOptions(filtered);
      // Reset selected class if it's not in the new list of options
      if (!filtered.some(c => c.value === selectedClassForBulkPublish)) {
          setSelectedClassForBulkPublish("");
          setReportsForBulkPublish([]);
      }
    } else {
      setFilteredClassOptions([]);
      setSelectedClassForBulkPublish("");
      setReportsForBulkPublish([]);
    }
  }, [academicYearForBulkPublish, allClassOptions, selectedClassForBulkPublish]);


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
        toast({title: "No Students Found", description: "No students found in this class for the selected academic year."});
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

  const handleGenerateAllReports = async () => {
    if (!authUser?.schoolId || !selectedClassForBulkPublish || !academicYearForBulkPublish) return;
    setIsGeneratingReports(true);
    const result = await generateAllReportsForClass(
      authUser.schoolId.toString(),
      selectedClassForBulkPublish,
      academicYearForBulkPublish,
      authUser._id.toString()
    );
     if (result.success) {
      toast({ title: "Report Generation Complete", description: result.message, duration: 8000 });
      handleLoadReportsForBulkPublish(); // Refresh the list
    } else {
      toast({ variant: "destructive", title: "Generation Failed", description: result.error || result.message, duration: 8000 });
    }
    setIsGeneratingReports(false);
    setBulkActionToConfirm(null);
  }
  
  const handleConfirmBulkAction = async () => {
    if (bulkActionToConfirm === 'publish') {
        await handleBulkPublishAction(true);
    } else if (bulkActionToConfirm === 'unpublish') {
        await handleBulkPublishAction(false);
    } else if (bulkActionToConfirm === 'generate') {
        await handleGenerateAllReports();
    }
    setBulkActionToConfirm(null);
  };


  const reportsThatExistCount = reportsForBulkPublish.filter(r => r.hasReport).length;


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
            <CardTitle className="text-lg">Report Generation & Search</CardTitle>
            <CardDescription>Select a template to start generating student report cards, or use the master search to find a specific student's full report.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link href="/dashboard/admin/reports/generate-cbse-state" passHref>
                 <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                    <FileText className="h-6 w-6 mb-1"/>
                    <span>CBSE State Template</span>
                 </Button>
            </Link>
             <Link href="/dashboard/reports/student" passHref>
                 <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center">
                    <UserSearch className="h-6 w-6 mb-1"/>
                    <span>Student Master Search</span>
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
              <Label htmlFor="bulk-academic-year">Academic Year</Label>
              <Select onValueChange={setAcademicYearForBulkPublish} value={academicYearForBulkPublish} disabled={isLoading || isBulkPublishing || academicYears.length === 0}>
                <SelectTrigger id="bulk-academic-year">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(year => <SelectItem key={year._id} value={year.year}>{year.year}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-grow">
              <Label htmlFor="bulk-class-select">Select Class</Label>
              <Select onValueChange={setSelectedClassForBulkPublish} value={selectedClassForBulkPublish} disabled={isLoading || isBulkPublishing || filteredClassOptions.length === 0}>
                <SelectTrigger id="bulk-class-select">
                  <SelectValue placeholder={!academicYearForBulkPublish ? "Select year first" : (filteredClassOptions.length > 0 ? "Select class" : "No classes in year")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredClassOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleLoadReportsForBulkPublish} disabled={isLoadingBulkReports || isBulkPublishing || !selectedClassForBulkPublish || !academicYearForBulkPublish.match(/^\d{4}-\d{4}$/)}>
              {isLoadingBulkReports ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4"/>} Load Reports
            </Button>
          </div>

          {reportsForBulkPublish.length > 0 && !isLoadingBulkReports && (
            <div className="space-y-3 mt-4">
               <div className="flex flex-wrap gap-2">
                 <Button
                    onClick={() => setBulkActionToConfirm('generate')}
                    disabled={isGeneratingReports}
                    variant="outline"
                  >
                    {isGeneratingReports ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileSignature className="mr-2 h-4 w-4"/>} 
                    Generate All Reports ({reportsForBulkPublish.length})
                  </Button>
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
              {bulkActionToConfirm === 'generate' ? (
                <>You are about to generate/regenerate all {reportsForBulkPublish.length} reports for this class. This will overwrite any existing reports for these students for this academic year. This process may take a few moments. Proceed?</>
              ) : (
                <>You are about to <strong>{bulkActionToConfirm === 'publish' ? 'publish' : 'unpublish'}</strong> all {reportsThatExistCount} generated reports for this class. This will make them {bulkActionToConfirm === 'publish' ? 'visible' : 'hidden'} to students. Proceed?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkAction}
              className={bulkActionToConfirm === 'unpublish' ? 'bg-destructive hover:bg-destructive/90' : (bulkActionToConfirm === 'generate' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700')}
            >
              {isGeneratingReports || isBulkPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              Confirm {bulkActionToConfirm === 'publish' ? 'Publish' : (bulkActionToConfirm === 'unpublish' ? 'Unpublish' : 'Generate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
