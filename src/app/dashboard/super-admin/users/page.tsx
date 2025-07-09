
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Info, Briefcase, BookUser, UserCog } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SuperAdminUserManagementRedirectPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Users className="mr-2 h-6 w-6" /> User Management
          </CardTitle>
          <CardDescription>
            User management is now handled by role. Please select the correct management page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 py-10">
            <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/super-admin/master-admins" className="flex items-center">
                    <UserCog className="mr-2 h-5 w-5"/> Manage Master Admins
                </Link>
            </Button>
            <p className="text-muted-foreground text-sm">To manage School Admins, please log in as a Master Admin.</p>
        </CardContent>
      </Card>
    </div>
  );
}
