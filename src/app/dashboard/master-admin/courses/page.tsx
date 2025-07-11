
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { School, BookCopy, PlusCircle, Trash2, Loader2, Info, FileUp } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { createCourseMaterial, getCourseMaterialsForClass, deleteCourseMaterial } from "@/app/actions/courses";
import { getSubjects } from "@/app/actions/subjects";
import type { CourseMaterial, CourseMaterialFormData } from "@/types/course";
import { courseMaterialSchema } from "@/types/course";
import type { Subject } from "@/types/subject";
import type { AuthUser } from "@/types/user";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';

interface ClassOption {
  value: string;
  label: string;
}

export default function MasterAdminCoursesPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [classesInSchool, setClassesInSchool] = useState<ClassOption[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialToDelete, setMaterialToDelete] = useState<CourseMaterial | null>(null);

  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<CourseMaterialFormData>({
    resolver: zodResolver(courseMaterialSchema),
    defaultValues: { schoolId: "", classId: "", subjectName: "", title: "", pdfUrl: "" },
  });

  const selectedClassId = form.watch("classId");

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser.role === 'masteradmin' && parsedUser.schoolId) {
            setAuthUser(parsedUser);
            form.setValue("schoolId", parsedUser.schoolId.toString());
        }
      } catch (e) { console.error("Failed to parse user", e); }
    }
  }, [form]);

  const fetchInitialData = useCallback(async (schoolId: string) => {
    setIsLoadingClasses(true);
    const classesResult = await getClassesForSchoolAsOptions(schoolId);
    setClassesInSchool(classesResult);
    setIsLoadingClasses(false);

    setIsLoadingSubjects(true);
    const subjectsResult = await getSubjects(schoolId);
    if (subjectsResult.success && subjectsResult.subjects) {
      setMasterSubjects(subjectsResult.subjects);
    } else {
      toast({ variant: "destructive", title: "Error", description: "Failed to load master subjects." });
    }
    setIsLoadingSubjects(false);

  }, [toast]);

  useEffect(() => {
    if (authUser?.schoolId) {
      fetchInitialData(authUser.schoolId.toString());
    }
  }, [authUser, fetchInitialData]);

  const fetchMaterialsForClass = useCallback(async (classId: string) => {
    if (!classId || !authUser?.schoolId) {
      setMaterials([]);
      return;
    }
    setIsLoadingMaterials(true);
    const result = await getCourseMaterialsForClass(classId, authUser.schoolId.toString());
    if(result.success && result.materials) {
        setMaterials(result.materials);
    } else {
        toast({variant: 'warning', title: 'Could not load materials', description: result.message});
        setMaterials([]);
    }
    setIsLoadingMaterials(false);
  }, [toast, authUser]);


  useEffect(() => {
    if (selectedClassId) {
      fetchMaterialsForClass(selectedClassId);
    } else {
      setMaterials([]);
    }
  }, [selectedClassId, fetchMaterialsForClass]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      form.setValue("pdfUrl", "");
      return;
    }
    if (file.type !== "application/pdf") {
      toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a PDF file." });
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({ variant: "destructive", title: "File Too Large", description: "Please upload a file smaller than 5MB." });
      e.target.value = "";
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        form.setValue("pdfUrl", reader.result, { shouldValidate: true });
        toast({ title: "File Ready", description: `${file.name} is ready to be saved.` });
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "File Error", description: "Could not read the selected file." });
      setIsUploading(false);
    };
  };

  async function onSubmit(values: CourseMaterialFormData) {
    if (!authUser?.schoolId) return;
    setIsSubmitting(true);
    const result = await createCourseMaterial(values);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Material Added", description: result.message });
      form.reset({ ...values, title: "", pdfUrl: "" });
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if(fileInput) fileInput.value = "";
      fetchMaterialsForClass(values.classId);
    } else {
      toast({ variant: "destructive", title: "Failed to Add", description: result.error || result.message });
    }
  }

  const handleConfirmDelete = async () => {
    if (!materialToDelete || !authUser?.schoolId) return;
    setIsDeleting(true);
    const result = await deleteCourseMaterial(materialToDelete._id, authUser.schoolId.toString());
    setIsDeleting(false);
    setMaterialToDelete(null);
    if (result.success) {
      toast({ title: "Deleted", description: result.message });
      if(selectedClassId) fetchMaterialsForClass(selectedClassId);
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
    }
  };

  if (!authUser) {
      return (
        <Card>
            <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
            <CardContent><p>Please log in as a Master Admin.</p></CardContent>
        </Card>
      )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileUp className="mr-2 h-6 w-6" /> Course Materials
          </CardTitle>
          <CardDescription>
            Upload and manage PDF links for class subjects, which will be visible to students.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Course Material</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="classId" render={({ field }) => (
                  <FormItem><FormLabel>Class</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingClasses}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger></FormControl>
                      <SelectContent>{classesInSchool.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="subjectName" render={({ field }) => (
                  <FormItem><FormLabel>Subject</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingSubjects}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger></FormControl>
                      <SelectContent>{masterSubjects.map(sub => <SelectItem key={sub._id} value={sub.name}>{sub.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title / Topic Name</FormLabel><FormControl><Input placeholder="e.g., Chapter 1: Algebra Basics" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField
                    control={form.control}
                    name="pdfUrl"
                    render={() => (
                        <FormItem className="md:col-span-2">
                        <FormLabel>Upload PDF</FormLabel>
                        <FormControl>
                            <Input
                            id="pdf-upload"
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            disabled={isSubmitting || isUploading}
                            />
                        </FormControl>
                        {isUploading && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Processing file...</div>}
                        <FormMessage />
                        </FormItem>
                    )}
                    />
              </div>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                Add Material
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Uploaded Materials</CardTitle>
            <CardDescription>
                {selectedClassId ? `Showing materials for the selected class.` : `Please select a class to view materials.`}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMaterials ? (
            <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : materials.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Title</TableHead><TableHead>URL</TableHead><TableHead>Added On</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {materials.map(mat => (
                  <TableRow key={mat._id}>
                    <TableCell>{mat.subjectName}</TableCell>
                    <TableCell>{mat.title}</TableCell>
                    <TableCell><a href={mat.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block max-w-xs">{mat.pdfUrl.startsWith('data:') ? 'View Uploaded PDF' : mat.pdfUrl}</a></TableCell>
                    <TableCell>{format(new Date(mat.createdAt), "PP")}</TableCell>
                    <TableCell>
                      <AlertDialog open={materialToDelete?._id === mat._id} onOpenChange={(open) => !open && setMaterialToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setMaterialToDelete(mat)}><Trash2 className="h-4 w-4"/></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete this material?</AlertDialogTitle><AlertDialogDescription>Delete "{materialToDelete?.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setMaterialToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive">{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <p className="text-center text-muted-foreground py-4">{selectedClassId ? "No materials uploaded for this class yet." : "Select a class to see materials."}</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
