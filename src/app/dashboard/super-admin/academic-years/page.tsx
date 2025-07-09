
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { CalendarFold, PlusCircle, Edit3, Trash2, Loader2, XCircle, Info, Star } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createAcademicYear, getAcademicYears, updateAcademicYear, deleteAcademicYear, setDefaultAcademicYear } from "@/app/actions/academicYears";
import type { AcademicYear, AcademicYearFormData } from "@/types/academicYear";
import { academicYearSchema } from "@/types/academicYear";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';

export default function SuperAdminAcademicYearsPage() {
  const { toast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearToDelete, setYearToDelete] = useState<AcademicYear | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<AcademicYearFormData>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: { year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, isDefault: false },
  });

  const fetchAcademicYears = useCallback(async () => {
    setIsLoading(true);
    const result = await getAcademicYears();
    if (result.success && result.academicYears) {
      setAcademicYears(result.academicYears);
    } else {
      toast({ variant: "destructive", title: "Failed to load years", description: result.message });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAcademicYears();
  }, [fetchAcademicYears]);

  useEffect(() => {
    if (editingYear) {
      form.reset({ year: editingYear.year, isDefault: editingYear.isDefault });
    } else {
      form.reset({ year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, isDefault: false });
    }
  }, [editingYear, form]);

  async function onSubmit(values: AcademicYearFormData) {
    setIsSubmitting(true);
    const result = editingYear
      ? await updateAcademicYear(editingYear._id, values)
      : await createAcademicYear(values);
    
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: editingYear ? "Year Updated" : "Year Created", description: result.message });
      setEditingYear(null);
      fetchAcademicYears();
    } else {
      toast({ variant: "destructive", title: `Error`, description: result.message });
    }
  }

  const handleConfirmDelete = async () => {
    if (!yearToDelete) return;
    setIsDeleting(true);
    const result = await deleteAcademicYear(yearToDelete._id);
    setIsDeleting(false);
    if (result.success) {
      toast({ title: "Deleted", description: result.message });
      fetchAcademicYears();
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.message });
    }
    setYearToDelete(null);
  };
  
   const handleSetDefault = async (id: string, isCurrentlyDefault: boolean) => {
    if(isCurrentlyDefault) return; // Already the default
    setIsLoading(true);
    const result = await setDefaultAcademicYear(id);
    if(result.success) {
      toast({title: "Default Year Updated", description: result.message});
      fetchAcademicYears();
    } else {
      toast({variant: "destructive", title: "Update Failed", description: result.message});
    }
     setIsLoading(false); // Should be outside the if/else to stop loading in any case
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CalendarFold className="mr-2 h-6 w-6" /> Academic Year Management
          </CardTitle>
          <CardDescription>Manage the global academic years available across the platform.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingYear ? `Edit Year: ${editingYear.year}` : "Add New Academic Year"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Year (YYYY-YYYY)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2024-2025" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="isDefault" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5"><FormLabel>Set as Default</FormLabel></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )}/>
                <div className="flex gap-2 items-center">
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingYear ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {editingYear ? "Update" : "Create"}
                    </Button>
                    {editingYear && (
                    <Button type="button" variant="outline" onClick={() => setEditingYear(null)} disabled={isSubmitting}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Academic Years</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading...</p></div>
          ) : academicYears.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Default</TableHead><TableHead>Date Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {academicYears.map((year) => (
                  <TableRow key={year._id}>
                    <TableCell className="font-medium">{year.year}</TableCell>
                    <TableCell>
                        <Button 
                            variant={year.isDefault ? "default" : "outline"} 
                            size="sm"
                            onClick={() => handleSetDefault(year._id, year.isDefault)}
                            disabled={year.isDefault || isLoading}
                            className={`w-24 ${year.isDefault ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        >
                           <Star className={`mr-2 h-4 w-4 ${year.isDefault ? "text-yellow-400" : ""}`} />
                           {year.isDefault ? "Default" : "Set Default"}
                        </Button>
                    </TableCell>
                    <TableCell>{format(new Date(year.createdAt), "PP")}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingYear(year)} disabled={isSubmitting || isDeleting || isLoading}><Edit3 className="h-4 w-4" /></Button>
                      <AlertDialog open={yearToDelete?._id === year._id} onOpenChange={(open) => !open && setYearToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setYearToDelete(year)} disabled={isSubmitting || isDeleting || isLoading}><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete the academic year <span className="font-semibold">{yearToDelete?.year}</span>.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setYearToDelete(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6">
                <Info className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">No academic years found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
