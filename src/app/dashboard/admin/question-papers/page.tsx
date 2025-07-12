
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileQuestion, PlusCircle, Trash2, Loader2, Info, FileUp } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getClassesForSchoolAsOptions } from "@/app/actions/classes";
import { createQuestionPaper, getQuestionPapersForClass, deleteQuestionPaper } from "@/app/actions/questionPapers";
import { getSubjects } from "@/app/actions/subjects";
import type { QuestionPaper, QuestionPaperFormData } from "@/types/questionPaper";
import { questionPaperSchema } from "@/types/questionPaper";
import type { Subject } from "@/types/subject";
import type { AuthUser } from "@/types/user";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';

interface ClassOption {
  value: string;
  label: string;
}

export default function AdminQuestionPapersPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [classesInSchool, setClassesInSchool] = useState<ClassOption[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<Subject[]>([]);
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [paperToDelete, setPaperToDelete] = useState<QuestionPaper | null>(null);

  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingPapers, setIsLoadingPapers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<QuestionPaperFormData>({
    resolver: zodResolver(questionPaperSchema),
    defaultValues: { schoolId: "", classId: "", subjectName: "", examName: "", year: new Date().getFullYear(), pdfUrl: "" },
  });

  const selectedClassId = form.watch("classId");

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined") {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'admin' && parsedUser.schoolId) {
            setAuthUser(parsedUser);
            form.setValue("schoolId", parsedUser.schoolId);
        }
      } catch (e) { console.error("Failed to parse user", e); }
    }
  }, [form]);

  const fetchInitialData = useCallback(async () => {
    if (!authUser?.schoolId) return;
    setIsLoadingClasses(true);
    const classesResult = await getClassesForSchoolAsOptions(authUser.schoolId);
    setClassesInSchool(classesResult);
    setIsLoadingClasses(false);

    setIsLoadingSubjects(true);
    const subjectsResult = await getSubjects(authUser.schoolId);
    if (subjectsResult.success && subjectsResult.subjects) {
      setMasterSubjects(subjectsResult.subjects);
    } else {
      toast({ variant: "destructive", title: "Error", description: "Failed to load master subjects." });
    }
    setIsLoadingSubjects(false);
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser?.schoolId) {
      fetchInitialData();
    }
  }, [authUser, fetchInitialData]);

  const fetchPapersForClass = useCallback(async (classId: string) => {
    if (!classId || !authUser?.schoolId) {
      setPapers([]);
      return;
    }
    setIsLoadingPapers(true);
    const result = await getQuestionPapersForClass(classId, authUser.schoolId);
    if(result.success && result.papers) {
        setPapers(result.papers);
    } else {
        toast({variant: 'warning', title: 'Could not load papers', description: result.message});
        setPapers([]);
    }
    setIsLoadingPapers(false);
  }, [toast, authUser]);

  useEffect(() => {
    if (selectedClassId) {
      fetchPapersForClass(selectedClassId);
    } else {
      setPapers([]);
    }
  }, [selectedClassId, fetchPapersForClass]);

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

  async function onSubmit(values: QuestionPaperFormData) {
    if (!authUser?.schoolId) return;
    setIsSubmitting(true);
    // Ensure schoolId from authUser is used, overriding any stale form state
    const payload = { ...values, schoolId: authUser.schoolId };
    const result = await createQuestionPaper(payload);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Paper Added", description: result.message });
      form.reset({ ...values, examName: "", pdfUrl: "", year: new Date().getFullYear() });
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if(fileInput) fileInput.value = "";
      fetchPapersForClass(values.classId);
    } else {
      toast({ variant: "destructive", title: "Failed to Add", description: result.error || result.message });
    }
  }

  const handleConfirmDelete = async () => {
    if (!paperToDelete || !authUser?.schoolId) return;
    setIsDeleting(true);
    const result = await deleteQuestionPaper(paperToDelete._id, authUser.schoolId);
    setIsDeleting(false);
    setPaperToDelete(null);
    if (result.success) {
      toast({ title: "Deleted", description: result.message });
      if(selectedClassId) fetchPapersForClass(selectedClassId);
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <FileQuestion className="mr-2 h-6 w-6" /> Question Papers
          </CardTitle>
          <CardDescription>
            Upload and manage previous years' question papers for students.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add New Question Paper</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                 <FormField control={form.control} name="examName" render={({ field }) => (<FormItem><FormLabel>Exam Name</FormLabel><FormControl><Input placeholder="e.g., Final Term, Mid Term" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" placeholder="e.g., 2023" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/></FormControl><FormMessage /></FormItem>)}/>
                 <FormField
                    control={form.control}
                    name="pdfUrl"
                    render={() => ( // We don't use field here because we have a custom handler
                        <FormItem className="lg:col-span-2">
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
                Add Question Paper
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Uploaded Question Papers</CardTitle>
            <CardDescription>
                {selectedClassId ? `Showing papers for the selected class.` : `Please select a class to view papers.`}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPapers ? (
            <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : papers.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Exam</TableHead><TableHead>Year</TableHead><TableHead>URL</TableHead><TableHead>Added On</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {papers.map(p => (
                  <TableRow key={p._id}>
                    <TableCell>{p.subjectName}</TableCell>
                    <TableCell>{p.examName}</TableCell>
                    <TableCell>{p.year}</TableCell>
                    <TableCell><a href={p.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block max-w-xs">{p.pdfUrl.startsWith('data:') ? 'View Uploaded PDF' : p.pdfUrl}</a></TableCell>
                    <TableCell>{format(new Date(p.createdAt), "PP")}</TableCell>
                    <TableCell>
                      <AlertDialog open={paperToDelete?._id === p._id} onOpenChange={(open) => !open && setPaperToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPaperToDelete(p)}><Trash2 className="h-4 w-4"/></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete this paper?</AlertDialogTitle><AlertDialogDescription>Delete "{p.examName} - {p.subjectName} ({p.year})"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setPaperToDelete(null)}>Cancel</AlertDialogCancel>
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
             <p className="text-center text-muted-foreground py-4">{selectedClassId ? "No question papers uploaded for this class yet." : "Select a class to see papers."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
