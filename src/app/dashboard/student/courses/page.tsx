
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Download, Loader2, Info } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/types/user";
import type { CourseMaterial } from "@/types/course";
import { getCourseMaterialsForClass } from "@/app/actions/courses";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";

export default function StudentCoursesPage() {
    const { toast } = useToast();
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [materials, setMaterials] = useState<CourseMaterial[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser && storedUser !== 'undefined') {
            try {
                const parsedUser: AuthUser = JSON.parse(storedUser);
                if(parsedUser.role === 'student') {
                    setAuthUser(parsedUser);
                }
            } catch (e) { console.error(e); }
        }
    }, []);
    
    const fetchMaterials = useCallback(async () => {
        if (!authUser || !authUser.classId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const result = await getCourseMaterialsForClass(authUser.classId);
        if (result.success && result.materials) {
            setMaterials(result.materials);
        } else {
            toast({ variant: 'warning', title: "Could not load materials", description: result.message });
        }
        setIsLoading(false);
    }, [authUser, toast]);

    useEffect(() => {
        if (authUser) {
            fetchMaterials();
        } else {
            setIsLoading(false);
        }
    }, [authUser, fetchMaterials]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <BookOpen className="mr-2 h-6 w-6" /> My Courses
          </CardTitle>
          <CardDescription>
            View course materials and resources uploaded by your school.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>
          ) : !authUser ? (
            <div className="text-center py-6 text-muted-foreground">Please log in to view course materials.</div>
          ) : !authUser.classId ? (
            <div className="text-center py-6 text-muted-foreground">You are not assigned to a class. Course materials cannot be displayed.</div>
          ) : materials.length > 0 ? (
            <Table>
                <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Title</TableHead><TableHead>Uploaded On</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                    {materials.map(mat => (
                        <TableRow key={mat._id}>
                            <TableCell className="font-medium">{mat.subjectName}</TableCell>
                            <TableCell>{mat.title}</TableCell>
                            <TableCell>{format(new Date(mat.createdAt), "PPP")}</TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                    <a href={mat.pdfUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-4 w-4"/> Download PDF
                                    </a>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          ) : (
             <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg">
                <Info className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground">
                No Course Materials Found
                </h3>
                <p className="text-muted-foreground">
                There are no course materials available for your class yet.
                </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
