
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, PlusCircle, Trash2, Loader2, Info, FileUp, Download } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getSubjectsForTeacher, type SubjectForTeacher } from "@/app/actions/marks";
import { createCourseMaterial, getCourseMaterialsForClass, deleteCourseMaterial } from "@/app/actions/courses";
import type { CourseMaterial, CourseMaterialFormData } from "@/types/course";
import { courseMaterialSchema } from "@/types/course";
import type { AuthUser } from "@/types/user";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';
import { getAcademicYears } from "@/app/actions/academicYears";
import type { AcademicYear } from "@/types/academicYear";

type CourseMaterialFormClient = Omit<CourseMaterialFormData, 'schoolId' | 'classId' | 'subjectName' | 'addedById' | 'addedByName'>;

const formClientSchema = courseMaterialSchema.omit({ schoolId: true, classId: true, subjectName: true, addedById: true, addedByName: true });

export default function TeacherCoursesPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<SubjectForTeacher[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialToDelete, setMaterialToDelete] = useState<CourseMaterial | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");

  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSubjectInfo, setSelectedSubjectInfo] = useState<SubjectForTeacher | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<CourseMaterialFormClient>({
    resolver: zodResolver(formClientSchema),
    defaultValues: { title: "", pdfUrl: "" },
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser.role === 'teacher') {
            setAuthUser(parsedUser);
        }
      } catch (e) { console.error("Failed to parse user", e); }
    }
  }, []);

  const fetchAcademicYearsData = useCallback(async () => {
    const result = await getAcademicYears();
    if(result.success && result.academicYears) {
      setAcademicYears(result.academicYears);
      const defaultYear = result.academicYears.find(y => y.isDefault) || result.academicYears[0];
      if (defaultYear) {
        setSelectedAcademicYear(defaultYear.year);
      }
    }
  }, []);

  const fetchSubjectsForYear = useCallback(async () => {
    if (!authUser?.schoolId || !authUser?._id || !selectedAcademicYear) return;
    setIsLoadingSubjects(true);
    const subjectsResult = await getSubjectsForTeacher(authUser._id, authUser.schoolId, selectedAcademicYear);
    setAssignedSubjects(subjectsResult);
    if(subjectsResult.length === 0) setSelectedSubjectInfo(null);
    setIsLoadingSubjects(false);
  }, [authUser, selectedAcademicYear]);


  useEffect(() => { fetchAcademicYearsData(); }, [fetchAcademicYearsData]);
  useEffect(() => { fetchSubjectsForYear(); }, [fetchSubjectsForYear]);


  const fetchMaterialsForClass = useCallback(async (classId: string) => {
    if (!classId || !authUser?.schoolId) {
      setMaterials([]);
      return;
    }
    setIsLoadingMaterials(true);
    const result = await getCourseMaterialsForClass(classId, authUser.schoolId);
    if(result.success && result.materials) {
        setMaterials(result.materials);
    } else {
        toast({variant: 'warning', title: 'Could not load materials', description: result.message});
        setMaterials([]);
    }
    setIsLoadingMaterials(false);
  }, [toast, authUser]);


  useEffect(() => {
    if (selectedSubjectInfo?.classId) {
      fetchMaterialsForClass(selectedSubjectInfo.classId);
    } else {
      setMaterials([]);
    }
  }, [selectedSubjectInfo, fetchMaterialsForClass]);

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

  async function onSubmit(values: CourseMaterialFormClient) {
    if (!authUser?.schoolId || !selectedSubjectInfo || !authUser._id || !authUser.name) {
      toast({variant: "destructive", title: "Error", description: "User or subject selection is missing."});
      return;
    }
    setIsSubmitting(true);
    
    const payload: CourseMaterialFormData = {
        ...values,
        schoolId: authUser.schoolId.toString(),
        classId: selectedSubjectInfo.classId,
        subjectName: selectedSubjectInfo.subjectName,
        addedById: authUser._id.toString(),
        addedByName: authUser.name,
    };

    const result = await createCourseMaterial(payload);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Material Added", description: result.message });
      form.reset({ title: "", pdfUrl: "" });
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if(fileInput) fileInput.value = "";
      fetchMaterialsForClass(selectedSubjectInfo.classId);
    } else {
      toast({ variant: "destructive", title: "Failed to Add", description: result.error || result.message });
    }
  }
  
  const handleDownload = (pdfUrl: string, filename: string) => {
    try {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Download failed:", error);
        toast({
            variant: "destructive",
            title: "Download Failed",
            description: "Could not initiate the file download. Please try again or contact support."
        });
    }
  };

  const handleConfirmDelete = async () => {
    if (!materialToDelete || !authUser?.schoolId) return;
    setIsDeleting(true);
    const result = await deleteCourseMaterial(materialToDelete._id, authUser.schoolId);
    setIsDeleting(false);
    setMaterialToDelete(null);
    if (result.success) {
      toast({ title: "Deleted", description: result.message });
      if(selectedSubjectInfo) fetchMaterialsForClass(selectedSubjectInfo.classId);
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
    }
  };

  const handleSubjectSelection = (value: string) => {
      const subjectInfo = assignedSubjects.find(s => s.value === value);
      setSelectedSubjectInfo(subjectInfo || null);
  }

  if (!authUser) {
      return (
        <Card>
            <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
            <CardContent><p>Please log in as a Teacher.</p></CardContent>
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
            Upload and manage PDF course materials for your assigned subjects.
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
                 <FormItem>
                    <FormLabel>Academic Year</FormLabel>
                    <Select onValueChange={setSelectedAcademicYear} value={selectedAcademicYear} disabled={academicYears.length === 0}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select year"/></SelectTrigger></FormControl>
                        <SelectContent>{academicYears.map(y => <SelectItem key={y._id} value={y.year}>{y.year}</SelectItem>)}</SelectContent>
                    </Select>
                 </FormItem>
                 <FormItem>
                    <FormLabel>Select Subject (and Class)</FormLabel>
                    <Select onValueChange={handleSubjectSelection} value={selectedSubjectInfo?.value || ""} disabled={isLoadingSubjects || assignedSubjects.length === 0}>
                      <FormControl><SelectTrigger><SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : (assignedSubjects.length === 0 ? `No subjects for ${selectedAcademicYear}` : "Select a subject")} /></SelectTrigger></FormControl>
                      <SelectContent>{assignedSubjects.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                 <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title / Topic Name</FormLabel><FormControl><Input placeholder="e.g., Chapter 1: Algebra Basics" {...field} disabled={!selectedSubjectInfo} /></FormControl><FormMessage /></FormItem>)}/>
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
                            disabled={isSubmitting || isUploading || !selectedSubjectInfo}
                            />
                        </FormControl>
                        {isUploading && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Processing file...</div>}
                        <FormMessage />
                        </FormItem>
                    )}
                    />
              </div>
              <Button type="submit" disabled={isSubmitting || isUploading || !selectedSubjectInfo}>
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
                {selectedSubjectInfo ? `Showing materials for ${selectedSubjectInfo.label}.` : `Please select a subject to view materials.`}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMaterials ? (
            <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : materials.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Added On</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.filter(mat => mat.subjectName === selectedSubjectInfo?.subjectName).map(mat => (
                  <TableRow key={mat._id}>
                    <TableCell>{mat.subjectName}</TableCell>
                    <TableCell>{mat.title}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(mat.pdfUrl, `${mat.subjectName}_${mat.title}.pdf`)}>
                        <Download className="mr-2 h-4 w-4"/> PDF
                      </Button>
                    </TableCell>
                    <TableCell>{format(new Date(mat.createdAt), "PP")}</TableCell>
                    <TableCell>{mat.addedByName || 'N/A'}</TableCell>
                    <TableCell>
                      {mat.addedById === authUser?._id && (
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
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <p className="text-center text-muted-foreground py-4">{selectedSubjectInfo ? "No materials uploaded for this subject/class yet." : "Select a subject to see materials."}</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
