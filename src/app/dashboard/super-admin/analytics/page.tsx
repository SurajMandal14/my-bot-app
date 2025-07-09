
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Construction } from "lucide-react";

export default function SuperAdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <BarChart3 className="mr-2 h-6 w-6" /> Platform Analytics
          </CardTitle>
          <CardDescription>
            View overall platform usage statistics and reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <Construction className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground">
              Analytics Feature Coming Soon
            </h3>
            <p className="text-muted-foreground">
              Detailed platform analytics will be available here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
