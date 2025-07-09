
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label"; // Added Label
import { Switch } from "@/components/ui/switch"; // Added Switch
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; 
import { Building, DollarSign, Edit, Loader2, AlertTriangle, Info, Image as ImageIcon, Settings as SettingsIcon, CalendarCog, Bus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useCallback } from "react";
import type { AuthUser } from "@/types/user";
import type { School, TermFee, BusFeeLocationCategory } from "@/types/school";
import { getSchoolById, setSchoolReportVisibility } from "@/app/actions/schools"; // Added setSchoolReportVisibility

export default function AdminSchoolSettingsPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

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
      } catch (e) {
        console.error("Failed to parse user from localStorage:", e);
        setAuthUser(null);
      }
    } else {
      setAuthUser(null);
    }
  }, [toast]);

  const fetchSchoolDetails = useCallback(async () => {
    if (!authUser || !authUser.schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await getSchoolById(authUser.schoolId.toString());
    if (result.success && result.school) {
      setSchoolDetails(result.school);
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message || "Failed to load school details." });
      setSchoolDetails(null);
    }
    setIsLoading(false);
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser && authUser.schoolId) {
      fetchSchoolDetails();
    } else {
      setIsLoading(false); 
    }
  }, [authUser, fetchSchoolDetails]);

  const handleReportVisibilityToggle = async (checked: boolean) => {
    if (!schoolDetails || !authUser?.schoolId) {
      toast({ variant: "destructive", title: "Error", description: "School details not available."});
      return;
    }
    setIsUpdatingVisibility(true);
    const result = await setSchoolReportVisibility(authUser.schoolId.toString(), checked);
    if (result.success && result.school) {
      setSchoolDetails(result.school); // Update local state with the new setting
      toast({ title: "Setting Updated", description: result.message });
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update report visibility." });
      // Revert switch optimistic update if API call fails
      setSchoolDetails(prev => prev ? {...prev, allowStudentsToViewPublishedReports: !checked} : null);
    }
    setIsUpdatingVisibility(false);
  };

  const calculateAnnualTotal = (terms: TermFee[]): number => {
    return terms.reduce((sum, term) => sum + (term.amount || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please log in as a school administrator.</p>
        </CardContent>
      </Card>
    );
  }

  if (!schoolDetails) {
    return (
      <Card>
        <CardHeader className="flex-row items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive"/>
            <CardTitle>School Details Unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load details for your school. This might be a temporary issue, or the school profile may not be fully configured.</p>
          <p className="mt-2 text-sm text-muted-foreground">Please try refreshing or contact support if the problem persists.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <SettingsIcon className="mr-2 h-6 w-6" /> School Settings & Profile
          </CardTitle>
          <CardDescription>
            Viewing profile details for {schoolDetails.schoolName}. Core profile (name, logo, fees) is managed by Super Admin. School-specific operational settings can be managed here.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            {schoolDetails.schoolLogoUrl ? (
                <img 
                    src={schoolDetails.schoolLogoUrl} 
                    alt={`${schoolDetails.schoolName} Logo`}
                    data-ai-hint="school logo"
                    width={80} 
                    height={80} 
                    className="h-20 w-20 rounded-md object-contain border bg-muted"
                    onError={(e) => (e.currentTarget.src = "https://placehold.co/80x80.png")}
                />
            ) : (
                <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl bg-muted border flex items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-muted-foreground" data-ai-hint="school campus"/>
                    </AvatarFallback>
                </Avatar>
            )}
            <div>
              <CardTitle className="text-xl flex items-center"><Building className="mr-2 h-5 w-5 text-primary" />{schoolDetails.schoolName}</CardTitle>
              <p className="text-muted-foreground">School ID: {schoolDetails._id.toString()}</p>
               <Button variant="outline" disabled className="mt-2 text-xs">
                <Edit className="mr-2 h-3 w-3" /> Edit School Profile (Super Admin Only)
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5 text-primary" /> Class Tuition Fee Structure</CardTitle>
          <CardDescription>Configured tuition fees for different classes (Managed by Super Admin).</CardDescription>
        </CardHeader>
        <CardContent>
          {schoolDetails.tuitionFees && schoolDetails.tuitionFees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Name</TableHead>
                  <TableHead className="text-right">Term 1 (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead className="text-right">Term 2 (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead className="text-right">Term 3 (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead className="text-right">Annual Total (<span className="font-sans">₹</span>)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolDetails.tuitionFees.map((cf) => (
                  <TableRow key={cf.className}>
                    <TableCell className="font-medium">{cf.className}</TableCell>
                    <TableCell className="text-right"><span className="font-sans">₹</span>{(cf.terms.find(t => t.term === 'Term 1')?.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right"><span className="font-sans">₹</span>{(cf.terms.find(t => t.term === 'Term 2')?.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right"><span className="font-sans">₹</span>{(cf.terms.find(t => t.term === 'Term 3')?.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">
                        <span className="font-sans">₹</span>{calculateAnnualTotal(cf.terms).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6">
                <Info className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">No class tuition fee structures have been configured for this school.</p>
                <p className="text-xs text-muted-foreground">Please contact a Super Administrator to set up class fees.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Bus className="mr-2 h-5 w-5 text-primary" /> Bus Fee Structure</CardTitle>
          <CardDescription>Configured bus fees per location and class category (Managed by Super Admin).</CardDescription>
        </CardHeader>
        <CardContent>
          {schoolDetails.busFeeStructures && schoolDetails.busFeeStructures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location/Route</TableHead>
                  <TableHead>Class Category</TableHead>
                  <TableHead className="text-right">Term 1 (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead className="text-right">Term 2 (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead className="text-right">Term 3 (<span className="font-sans">₹</span>)</TableHead>
                  <TableHead className="text-right">Annual Total (<span className="font-sans">₹</span>)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolDetails.busFeeStructures.map((bfs, index) => (
                  <TableRow key={`${bfs.location}-${bfs.classCategory}-${index}`}>
                    <TableCell className="font-medium">{bfs.location}</TableCell>
                    <TableCell>{bfs.classCategory}</TableCell>
                    <TableCell className="text-right"><span className="font-sans">₹</span>{(bfs.terms.find(t => t.term === 'Term 1')?.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right"><span className="font-sans">₹</span>{(bfs.terms.find(t => t.term === 'Term 2')?.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right"><span className="font-sans">₹</span>{(bfs.terms.find(t => t.term === 'Term 3')?.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">
                        <span className="font-sans">₹</span>{calculateAnnualTotal(bfs.terms).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6">
                <Info className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">No bus fee structures have been configured for this school.</p>
                <p className="text-xs text-muted-foreground">Please contact a Super Administrator to set up bus fees.</p>
            </div>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <CalendarCog className="mr-2 h-5 w-5 text-primary" /> School Operational Settings
          </CardTitle>
          <CardDescription>Manage academic years, terms, and other school-specific operational settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                <div className="space-y-0.5">
                    <Label htmlFor="report-visibility-switch" className="text-base flex items-center">
                       {schoolDetails.allowStudentsToViewPublishedReports ? <Eye className="mr-2 h-4 w-4 text-green-600"/> : <EyeOff className="mr-2 h-4 w-4 text-red-600"/>}
                        Student Report Card Visibility
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        {schoolDetails.allowStudentsToViewPublishedReports 
                            ? "Students can view their published report cards." 
                            : "Students cannot currently view their report cards, even if published individually."}
                    </p>
                </div>
                <Switch
                    id="report-visibility-switch"
                    checked={schoolDetails.allowStudentsToViewPublishedReports}
                    onCheckedChange={handleReportVisibilityToggle}
                    disabled={isUpdatingVisibility}
                    aria-label="Toggle student report card visibility"
                />
            </div>
            {isUpdatingVisibility && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Updating status...</div>}

            <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg p-4 mt-6">
                <Info className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                    More Settings Coming Soon
                </h3>
                <p className="text-sm text-muted-foreground text-center">
                    Settings for academic year configuration, term dates, grading periods, and other operational parameters will be available here in a future update.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
