
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminUserManagementPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Users className="mr-2 h-6 w-6" /> School User Management
          </CardTitle>
          <CardDescription>
            Student and Teacher management has been moved to separate pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 py-10">
            <Info className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">This page is no longer used for direct user management.</p>
            <div className="flex gap-4">
                <Button asChild>
                    <Link href="/dashboard/admin/students">Manage Students</Link>
                </Button>
                <Button asChild>
                    <Link href="/dashboard/admin/teachers">Manage Teachers</Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
