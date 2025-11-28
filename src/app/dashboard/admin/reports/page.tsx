
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChartBig, FileSignature, FileText, UserSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { AuthUser } from "@/types/attendance";


export default function AdminReportsPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

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

    </div>
  );
}

    