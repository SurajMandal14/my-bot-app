
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, School as SchoolIconUI, DollarSign, Loader2, Edit, XCircle, FileText, Image as ImageIcon, Trash2, Bus, Eye, CheckSquare } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createSchool, getSchools, updateSchool, deleteSchool } from "@/app/actions/schools";
import { schoolFormSchema, type SchoolFormData, REPORT_CARD_TEMPLATES, type ReportCardTemplateKey, type TermFee, ATTENDANCE_TYPES } from '@/types/school'; 
import type { School as SchoolType } from "@/types/school";
import { useEffect, useState, useCallback } from "react";

const DEFAULT_TERMS: TermFee[] = [
  { term: 'Term 1', amount: 0 },
  { term: 'Term 2', amount: 0 },
  { term: 'Term 3', amount: 0 },
];

export default function SchoolManagementPage() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolType | null>(null);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    },
  });

  const { fields: tuitionFeeFields, append: appendTuitionFee, remove: removeTuitionFee, update: updateTuitionFee } = useFieldArray({
    control: form.control,
    name: "tuitionFees",
  });

  const { fields: busFeeFields, append: appendBusFee, remove: removeBusFee, update: updateBusFee } = useFieldArray({
    control: form.control,
    name: "busFeeStructures",
  });

  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);
    const result = await getSchools();
    if (result.success && result.schools) {
      setSchools(result.schools);
    } else {
      toast({
        variant: "destructive",
        title: "Failed to load schools",
        description: result.error || "Could not fetch school data.",
      });
    }
    setIsLoadingSchools(false);
  }, [toast]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const mapSchoolToFormData = (school: SchoolType): SchoolFormData => ({
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
  });

  const handleEdit = (school: SchoolType) => {
    setEditingSchool(school);
    form.reset(mapSchoolToFormData(school));
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const cancelEdit = () => {
    setEditingSchool(null);
    form.reset({
      schoolName: "",
      tuitionFees: [{ className: "", terms: [...DEFAULT_TERMS] }],
      busFeeStructures: [{ location: "", classCategory: "", terms: [...DEFAULT_TERMS] }],
      schoolLogoUrl: "",
      reportCardTemplate: 'none',
      allowStudentsToViewPublishedReports: false,
      attendanceType: 'monthly',
    });
  };

  async function onSubmit(values: SchoolFormData) {
    setIsSubmitting(true);
    let result;

    if (editingSchool) {
      result = await updateSchool(editingSchool._id, values);
    } else {
      result = await createSchool(values);
    }
    
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: editingSchool ? "School Updated" : "School Created",
        description: result.message,
      });
      fetchSchools();
      cancelEdit(); 
    } else {
      toast({
        variant: "destructive",
        title: `Error ${editingSchool ? "Updating" : "Creating"} School`,
        description: result.error || result.message,
      });
    }
  }

  const handleConfirmDelete = async () => {
    if (!schoolToDelete?._id) return;
    setIsDeleting(true);
    const result = await deleteSchool(schoolToDelete._id);
    setIsDeleting(false);
    setSchoolToDelete(null);
    if (result.success) {
      toast({ title: "School Deleted", description: result.message });
      fetchSchools();
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message, duration: 5000 });
    }
  };
  
  const termNames: TermFee['term'][] = ['Term 1', 'Term 2', 'Term 3'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <SchoolIconUI className="mr-2 h-6 w-6" /> School Management 
          </CardTitle>
          <CardDescription>
            {editingSchool ? `Editing: ${editingSchool.schoolName}` : "Create schools, configure term-wise tuition fees, bus fees, logos, and report card templates."}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingSchool ? "Edit School Profile" : "Create New School"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="schoolName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Springfield Elementary" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="schoolLogoUrl"
                render={({ field }) => ( 
                  <FormItem>
                    <FormLabel className="flex items-center"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" /> School Logo URL (Optional)</FormLabel>
                    <FormControl>
                        <Input 
                          type="text" 
                          placeholder="https://example.com/logo.png"
                          {...field}
                          disabled={isSubmitting}
                        />
                    </FormControl>
                    <FormMessage />
                     <p className="text-xs text-muted-foreground pt-1">
                       Enter the full URL of the school's logo. Leave blank to remove logo during update.
                     </p>
                  </FormItem>
                )}
              />
              
                <FormField
                  control={form.control}
                  name="reportCardTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" /> Report Card Template</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a report card template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(REPORT_CARD_TEMPLATES).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attendanceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" /> Attendance Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'monthly'} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select attendance type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ATTENDANCE_TYPES).map(([key, label]) => (
                            <SelectItem key={key} value={key} disabled={key !== 'monthly'}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                 <FormField
                  control={form.control}
                  name="allowStudentsToViewPublishedReports"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm md:col-span-1">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center">
                          <Eye className="mr-2 h-4 w-4"/>
                          Student Report Visibility
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Allow students of this school to view their published report cards.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Tuition Fees Configuration */}
              <div className="space-y-4 border-t pt-6">
                <FormLabel className="text-lg font-semibold flex items-center"><DollarSign className="mr-2 h-5 w-5 text-primary" />Tuition Fees Configuration</FormLabel>
                {tuitionFeeFields.map((field, classIndex) => (
                  <Card key={field.id} className="p-4 border shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                        <FormField
                            control={form.control}
                            name={`tuitionFees.${classIndex}.className`}
                            render={({ field: classNameField }) => (
                            <FormItem className="flex-grow mr-2">
                                <FormLabel>Class Name</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., Grade 10" {...classNameField} disabled={isSubmitting} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTuitionFee(classIndex)} className="mt-6 text-destructive hover:bg-destructive/10" disabled={isSubmitting}>
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {termNames.map((termName, termIndex) => (
                        <FormField
                          key={`${field.id}-tuition-term-${termIndex}`}
                          control={form.control}
                          name={`tuitionFees.${classIndex}.terms.${termIndex}.amount`}
                          render={({ field: amountField }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                <span className="font-sans mr-1">₹</span>{termName} Fee
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="Amount" 
                                  {...amountField}
                                  value={amountField.value || ""}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    amountField.onChange(isNaN(val) ? "" : val);
                                    const currentTerms = form.getValues(`tuitionFees.${classIndex}.terms`);
                                    if (currentTerms[termIndex] && currentTerms[termIndex].term !== termName) {
                                       updateTuitionFee(classIndex, {
                                          ...form.getValues(`tuitionFees.${classIndex}`),
                                          terms: currentTerms.map((t, i) => i === termIndex ? {...t, term: termName} : t)
                                       });
                                    }
                                  }}
                                  disabled={isSubmitting} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendTuitionFee({ className: "", terms: [...DEFAULT_TERMS] })}
                  disabled={isSubmitting}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Class Tuition Configuration
                </Button>
              </div>

              {/* Bus Fees Configuration */}
              <div className="space-y-4 border-t pt-6">
                <FormLabel className="text-lg font-semibold flex items-center"><Bus className="mr-2 h-5 w-5 text-primary"/>Bus Fees Configuration</FormLabel>
                {busFeeFields.map((field, busIndex) => (
                  <Card key={field.id} className="p-4 border shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mr-2">
                            <FormField
                                control={form.control}
                                name={`busFeeStructures.${busIndex}.location`}
                                render={({ field: locationField }) => (
                                <FormItem>
                                    <FormLabel>Location/Route</FormLabel>
                                    <FormControl>
                                    <Input placeholder="e.g., Downtown Route A" {...locationField} disabled={isSubmitting} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`busFeeStructures.${busIndex}.classCategory`}
                                render={({ field: categoryField }) => (
                                <FormItem>
                                    <FormLabel>Stations</FormLabel>
                                    <FormControl>
                                    <Input placeholder="e.g., Station 1, Station 2" {...categoryField} disabled={isSubmitting} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeBusFee(busIndex)} className="mt-6 text-destructive hover:bg-destructive/10" disabled={isSubmitting}>
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {termNames.map((termName, termIndex) => (
                        <FormField
                          key={`${field.id}-bus-term-${termIndex}`}
                          control={form.control}
                          name={`busFeeStructures.${busIndex}.terms.${termIndex}.amount`}
                          render={({ field: amountField }) => (
                            <FormItem>
                              <FormLabel className="flex items-center">
                                <span className="font-sans mr-1">₹</span>{termName} Bus Fee
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="Amount" 
                                  {...amountField}
                                  value={amountField.value || ""}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    amountField.onChange(isNaN(val) ? "" : val);
                                    const currentTerms = form.getValues(`busFeeStructures.${busIndex}.terms`);
                                    if (currentTerms[termIndex] && currentTerms[termIndex].term !== termName) {
                                       updateBusFee(busIndex, {
                                          ...form.getValues(`busFeeStructures.${busIndex}`),
                                          terms: currentTerms.map((t, i) => i === termIndex ? {...t, term: termName} : t)
                                       });
                                    }
                                  }}
                                  disabled={isSubmitting} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendBusFee({ location: "", classCategory: "", terms: [...DEFAULT_TERMS] })}
                  disabled={isSubmitting}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Bus Fee Configuration
                </Button>
              </div>
              
              <div className="flex gap-2 pt-6">
                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? (editingSchool ? "Updating..." : "Creating...") : (editingSchool ? "Update School Profile" : "Create School Profile")}
                </Button>
                {editingSchool && (
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSubmitting}>
                    <XCircle className="mr-2 h-4 w-4" /> Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Schools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSchools ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading schools...</p>
            </div>
          ) : schools.length > 0 ? (
            schools.map(school => (
            <Card key={school._id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
              <div className="flex items-center gap-4">
                <img 
                    src={school.schoolLogoUrl || "https://placehold.co/48x48.png"} 
                    alt={`${school.schoolName} logo`} 
                    data-ai-hint="school logo"
                    width={48} 
                    height={48} 
                    className="h-12 w-12 rounded-md object-cover flex-shrink-0 bg-muted border"
                    onError={(e) => (e.currentTarget.src = "https://placehold.co/48x48.png")}
                />
                <div className="flex-grow">
                  <h3 className="font-semibold">{school.schoolName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {school.tuitionFees?.length || 0} tuition config(s), {school.busFeeStructures?.length || 0} bus fee config(s)
                  </p>
                  <p className="text-xs text-muted-foreground">Report Card: <span className="font-medium">{REPORT_CARD_TEMPLATES[school.reportCardTemplate || 'none']}</span></p>
                  <p className="text-xs text-muted-foreground">Attendance: <span className="font-medium">{ATTENDANCE_TYPES[school.attendanceType || 'monthly']}</span></p>
                  <p className="text-xs text-muted-foreground">Student Report View: 
                    <span className={`font-medium ${school.allowStudentsToViewPublishedReports ? 'text-green-600' : 'text-red-600'}`}>
                      {school.allowStudentsToViewPublishedReports ? ' Enabled' : ' Disabled'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Created: {new Date(school.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(school)} className="w-full sm:w-auto flex-shrink-0">
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                <AlertDialog open={schoolToDelete?._id === school._id} onOpenChange={(open) => !open && setSchoolToDelete(null)}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" onClick={() => setSchoolToDelete(school)} className="w-full sm:w-auto flex-shrink-0">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete the school profile for <span className="font-semibold">{schoolToDelete?.schoolName}</span>. This action cannot be undone and may fail if the school has associated users.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setSchoolToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete School
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))
          ) : (
             <p className="text-muted-foreground text-center py-4">No schools created yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
