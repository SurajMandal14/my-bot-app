
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Info, Briefcase, BookUser } from "lucide-react";
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
            Select a category below to manage students or teachers for your school.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 py-10">
            <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/admin/students" className="flex items-center">
                    <BookUser className="mr-2 h-5 w-5"/> Manage Students
                </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/admin/teachers" className="flex items-center">
                    <Briefcase className="mr-2 h-5 w-5"/> Manage Teachers
                </Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
