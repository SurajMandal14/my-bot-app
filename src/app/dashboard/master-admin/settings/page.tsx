
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, School as SchoolIconUI, DollarSign, Loader2, Edit, XCircle, FileText, ImageIcon, Trash2, Bus, Eye, CheckSquare, Settings, Lock, Unlock, Save } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { getSchoolById, updateSchool } from "@/app/actions/schools";
import { schoolFormSchema, type SchoolFormData, REPORT_CARD_TEMPLATES, type ReportCardTemplateKey, type TermFee, ATTENDANCE_TYPES, type AssessmentLocks } from '@/types/school'; 
import type { School as SchoolType } from "@/types/school";
import type { AuthUser } from "@/types/user";
import { useEffect, useState, useCallback } from "react";
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";

const DEFAULT_TERMS: TermFee[] = [
  { term: 'Term 1', amount: 0 },
  { term: 'Term 2', amount: 0 },
  { term: 'Term 3', amount: 0 },
];

const DEFAULT_ASSESSMENT_LOCKS: AssessmentLocks = {
    FA1: false, FA2: false, FA3: false, FA4: false, SA1: false, SA2: false
};

const assessmentKeys: (keyof AssessmentLocks)[] = ["FA1", "FA2", "FA3", "FA4", "SA1", "SA2"];

export default function MasterAdminSettingsPage() {
    const { toast } = useToast();
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [school, setSchool] = useState<SchoolType | null>(null);
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<SchoolFormData>({
        resolver: zodResolver(schoolFormSchema),
        defaultValues: {
            schoolName: "",
            tuitionFees: [{ className: "", terms: [...DEFAULT_TERMS] }],
            busFeeStructures: [{ location: "", classCategory: "", terms: [...DEFAULT_TERMS] }],
            schoolLogoUrl: "",
            reportCardTemplate: 'none',
            allowStudentsToViewPublishedReports: false,
            attendanceType: 'monthly',
            activeAcademicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
            marksEntryLocks: {},
        }
    });
    
    const { fields: tuitionFeeFields, append: appendTuitionFee, remove: removeTuitionFee, update: updateTuitionFee } = useFieldArray({
        control: form.control,
        name: "tuitionFees",
    });

    const { fields: busFeeFields, append: appendBusFee, remove: removeBusFee, update: updateBusFee } = useFieldArray({
        control: form.control,
        name: "busFeeStructures",
    });
    
    const termNames: TermFee['term'][] = ['Term 1', 'Term 2', 'Term 3'];
    const activeAcademicYear = form.watch("activeAcademicYear");

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser && storedUser !== "undefined") {
            try {
                const parsedUser: AuthUser = JSON.parse(storedUser);
                if (parsedUser.role === 'masteradmin' && parsedUser.schoolId) {
                    setAuthUser(parsedUser);
                } else {
                    setAuthUser(null);
                    toast({ variant: 'destructive', title: 'Access Denied' });
                }
            } catch (e) {
                setAuthUser(null);
            }
        } else {
            setAuthUser(null);
        }
    }, [toast]);
    
    const mapSchoolToFormData = useCallback((school: SchoolType): SchoolFormData => ({
        schoolName: school.schoolName,
        schoolLogoUrl: school.schoolLogoUrl || "", 
        reportCardTemplate: school.reportCardTemplate || 'none',
        allowStudentsToViewPublishedReports: school.allowStudentsToViewPublishedReports || false,
        attendanceType: school.attendanceType || 'monthly',
        tuitionFees: school.tuitionFees?.length > 0 ? school.tuitionFees.map(tf => ({ 
          className: tf.className,
          terms: tf.terms && tf.terms.length === 3 ? tf.terms.map(t => ({term: t.term, amount: t.amount || 0})) : [...DEFAULT_TERMS],
        })) : [{ className: "", terms: [...DEFAULT_TERMS] }],
        busFeeStructures: school.busFeeStructures?.length > 0 ? school.busFeeStructures.map(bfs => ({
          location: bfs.location,
          classCategory: bfs.classCategory,
          terms: bfs.terms && bfs.terms.length === 3 ? bfs.terms.map(t => ({term: t.term, amount: t.amount || 0})) : [...DEFAULT_TERMS],
        })) : [{ location: "", classCategory: "", terms: [...DEFAULT_TERMS] }],
        activeAcademicYear: school.activeAcademicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        marksEntryLocks: school.marksEntryLocks || {},
    }), []);

    const loadSchoolData = useCallback(async () => {
        if (!authUser?.schoolId) {
            setIsLoading(false);
            if (authUser) toast({ variant: 'destructive', title: 'Error', description: "You are not assigned to a school." });
            return;
        }

        setIsLoading(true);
        const [schoolResult, academicYearsResult] = await Promise.all([
            getSchoolById(authUser.schoolId),
            getAcademicYears()
        ]);
        
        if (schoolResult.success && schoolResult.school) {
            setSchool(schoolResult.school);
            form.reset(mapSchoolToFormData(schoolResult.school));
        } else {
            toast({ variant: 'destructive', title: "Error", description: "Failed to load your school's details."});
            setSchool(null);
        }

        if (academicYearsResult.success && academicYearsResult.academicYears) {
            setAcademicYears(academicYearsResult.academicYears);
        } else {
             toast({ variant: 'warning', title: "Warning", description: "Could not load academic years list."});
        }
        setIsLoading(false);
    }, [authUser, form, toast, mapSchoolToFormData]);

    useEffect(() => {
        if (authUser) {
            loadSchoolData();
        } else {
            setIsLoading(false);
        }
    }, [authUser, loadSchoolData]);

    async function onSubmit(values: SchoolFormData) {
        if (!school) {
            toast({variant: 'warning', title: 'No School Loaded', description: 'Cannot save settings without school information.'});
            return;
        }
        setIsSubmitting(true);
        const result = await updateSchool(school._id, values);
        if (result.success) {
            toast({ title: 'School Settings Updated', description: result.message });
            if(result.school) {
                setSchool(result.school);
                form.reset(mapSchoolToFormData(result.school));
            }
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error || result.message });
        }
        setIsSubmitting(false);
    }
    
    if (isLoading) {
        return <div className="flex justify-center items-center p-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (!authUser) {
        return <Card><CardHeader><CardTitle>Access Denied</CardTitle><CardDescription>Please log in as a Master Admin.</CardDescription></CardHeader></Card>;
    }
    
    if (!school) {
         return <Card><CardHeader><CardTitle>Error</CardTitle><CardDescription>Could not load school settings. Please ensure you are assigned to a school.</CardDescription></CardHeader></Card>;
    }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Settings className="mr-2 h-6 w-6" /> School Settings for {school.schoolName}
          </CardTitle>
          <CardDescription>
            Manage fee structures, academic year, and other settings for your school.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">School Profile</CardTitle>
                </CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="schoolName" render={({ field }) => (<FormItem><FormLabel>School Name</FormLabel><FormControl><Input placeholder="e.g., Springfield Elementary" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="schoolLogoUrl" render={({ field }) => ( <FormItem><FormLabel className="flex items-center"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" /> School Logo URL</FormLabel><FormControl><Input type="text" placeholder="https://example.com/logo.png" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem> )}/>
                    <FormField control={form.control} name="reportCardTemplate" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" /> Report Card Template</FormLabel><Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger></FormControl><SelectContent>{Object.entries(REPORT_CARD_TEMPLATES).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="attendanceType" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" /> Attendance Type</FormLabel><Select onValueChange={field.onChange} value={field.value || 'monthly'} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{Object.entries(ATTENDANCE_TYPES).map(([key, label]) => (<SelectItem key={key} value={key} disabled={key !== 'monthly'}>{label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="allowStudentsToViewPublishedReports" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm md:col-span-1"><div className="space-y-0.5"><FormLabel className="text-base flex items-center"><Eye className="mr-2 h-4 w-4"/>Student Report Visibility</FormLabel><p className="text-xs text-muted-foreground">Allow students of this school to view their published report cards.</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem>)}/>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg">Tuition Fees Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {tuitionFeeFields.map((field, classIndex) => (
                    <Card key={field.id} className="p-4 border shadow-sm"><div className="flex justify-between items-start mb-3">
                        <FormField control={form.control} name={`tuitionFees.${classIndex}.className`} render={({ field: classNameField }) => (<FormItem className="flex-grow mr-2"><FormLabel>Class Name</FormLabel><FormControl><Input placeholder="e.g., Grade 10" {...classNameField} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTuitionFee(classIndex)} className="mt-6 text-destructive hover:bg-destructive/10" disabled={isSubmitting}><Trash2 className="h-5 w-5" /></Button>
                    </div><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{termNames.map((termName, termIndex) => (
                        <FormField key={`${field.id}-tuition-term-${termIndex}`} control={form.control} name={`tuitionFees.${classIndex}.terms.${termIndex}.amount`} render={({ field: amountField }) => (<FormItem><FormLabel className="flex items-center"><span className="font-sans mr-1">₹</span>{termName} Fee</FormLabel><FormControl><Input type="number" placeholder="Amount" {...amountField} value={amountField.value || ""} onChange={e => { const val = parseFloat(e.target.value); amountField.onChange(isNaN(val) ? "" : val); const currentTerms = form.getValues(`tuitionFees.${classIndex}.terms`); if (currentTerms[termIndex] && currentTerms[termIndex].term !== termName) { updateTuitionFee(classIndex, { ...form.getValues(`tuitionFees.${classIndex}`), terms: currentTerms.map((t, i) => i === termIndex ? {...t, term: termName} : t) }); } }} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>))}
                    </div></Card>))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendTuitionFee({ className: "", terms: [...DEFAULT_TERMS] })} disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> Add Class Tuition</Button>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader><CardTitle className="text-lg">Bus Fees Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {busFeeFields.map((field, busIndex) => (
                    <Card key={field.id} className="p-4 border shadow-sm"><div className="flex justify-between items-start mb-3"><div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mr-2">
                        <FormField control={form.control} name={`busFeeStructures.${busIndex}.location`} render={({ field: locationField }) => (<FormItem><FormLabel>Location/Route</FormLabel><FormControl><Input placeholder="e.g., Downtown Route A" {...locationField} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name={`busFeeStructures.${busIndex}.classCategory`} render={({ field: categoryField }) => (<FormItem><FormLabel>Stations</FormLabel><FormControl><Input placeholder="e.g., Station 1, Station 2" {...categoryField} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
                    </div><Button type="button" variant="ghost" size="icon" onClick={() => removeBusFee(busIndex)} className="mt-6 text-destructive hover:bg-destructive/10" disabled={isSubmitting}><Trash2 className="h-5 w-5" /></Button>
                    </div><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{termNames.map((termName, termIndex) => (
                        <FormField key={`${field.id}-bus-term-${termIndex}`} control={form.control} name={`busFeeStructures.${busIndex}.terms.${termIndex}.amount`} render={({ field: amountField }) => (<FormItem><FormLabel className="flex items-center"><span className="font-sans mr-1">₹</span>{termName} Bus Fee</FormLabel><FormControl><Input type="number" placeholder="Amount" {...amountField} value={amountField.value || ""} onChange={e => { const val = parseFloat(e.target.value); amountField.onChange(isNaN(val) ? "" : val); const currentTerms = form.getValues(`busFeeStructures.${busIndex}.terms`); if (currentTerms[termIndex] && currentTerms[termIndex].term !== termName) { updateBusFee(busIndex, { ...form.getValues(`busFeeStructures.${busIndex}`), terms: currentTerms.map((t, i) => i === termIndex ? {...t, term: termName} : t) }); } }} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)}/>))}
                    </div></Card>))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendBusFee({ location: "", classCategory: "", terms: [...DEFAULT_TERMS] })} disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> Add Bus Fee</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg">Operational Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="activeAcademicYear"
                        render={({ field }) => (
                            <FormItem className="max-w-xs">
                                <FormLabel>Active Academic Year</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value || ""}
                                    disabled={isSubmitting || academicYears.length === 0}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={academicYears.length > 0 ? "Select academic year" : "No years available"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {academicYears.map(year => (
                                            <SelectItem key={year._id} value={year.year}>{year.year} {year.isDefault && "(Default)"}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="space-y-2">
                        <Label>Marks Entry Lock for <span className="font-semibold text-primary">{activeAcademicYear || '...'}</span></Label>
                        <p className="text-sm text-muted-foreground">Enable or disable marks entry for specific assessments in the active academic year.</p>
                    </div>
                     {activeAcademicYear ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assessmentKeys.map(key => {
                            const fieldName = `marksEntryLocks.${activeAcademicYear}.${key}` as const;
                            return (
                                <Controller
                                    key={key}
                                    name={fieldName}
                                    control={form.control}
                                    defaultValue={form.getValues(fieldName) ?? false}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base flex items-center">
                                                    {field.value ? <Lock className="mr-2 h-4 w-4 text-destructive"/> : <Unlock className="mr-2 h-4 w-4 text-green-600"/>}
                                                    {key} Entry
                                                </FormLabel>
                                            </div>
                                            <FormControl>
                                                <Switch 
                                                    checked={field.value} 
                                                    onCheckedChange={(checked) => {
                                                        const currentLocks = form.getValues('marksEntryLocks') || {};
                                                        const yearLocks = currentLocks[activeAcademicYear] || {};
                                                        form.setValue('marksEntryLocks', {
                                                          ...currentLocks,
                                                          [activeAcademicYear]: {
                                                            ...yearLocks,
                                                            [key]: checked,
                                                          },
                                                        });
                                                    }}
                                                    disabled={isSubmitting} 
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            );
                        })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">Select an active academic year to manage marks entry locks.</p>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save School Settings
                </Button>
            </div>
        </form>
      </Form>
    </div>
  );
}
