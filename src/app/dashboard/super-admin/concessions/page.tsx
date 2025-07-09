
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoveRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SuperAdminConcessionPageMoved() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            Functionality Moved
          </CardTitle>
          <CardDescription>
            Fee Concession Management has been moved to the Master Admin role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>This feature is now managed by Master Administrators for their assigned schools.</p>
          <Button asChild variant="link" className="px-0">
             <Link href="/dashboard/super-admin">
                 Return to Super Admin Dashboard <MoveRight className="ml-2 h-4 w-4"/>
             </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
