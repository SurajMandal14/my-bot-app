
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Construction } from "lucide-react";

export default function TeacherSchedulePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <CalendarDays className="mr-2 h-6 w-6" /> Class Schedule
          </CardTitle>
          <CardDescription>
            View your daily and weekly teaching schedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <Construction className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground">
              Schedule Feature Coming Soon
            </h3>
            <p className="text-muted-foreground">
              Your teaching schedule will be displayed here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
