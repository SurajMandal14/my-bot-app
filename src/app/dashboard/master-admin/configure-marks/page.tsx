"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Settings } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

// Mock data for display purposes
const mockConfigurations = [
  { id: "1", grade: "Class 10", assessments: 5, scheme: "Standard CBSE", lastUpdated: "2023-10-26" },
  { id: "2", grade: "Class 9", assessments: 5, scheme: "Standard CBSE", lastUpdated: "2023-10-25" },
  { id: "3", grade: "Class 1", assessments: 3, scheme: "Primary Fun-based", lastUpdated: "2023-09-01" },
];

export default function ConfigureMarksPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Settings className="mr-2 h-6 w-6" />
            Configure Report Card
          </CardTitle>
          <CardDescription>
            Set up assessment schemes, grading patterns, and other report card configurations for your school.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Existing Configurations</CardTitle>
            <CardDescription>
              Manage the report card configurations for different classes or grades.
            </CardDescription>
          </div>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Configuration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Configuration</DialogTitle>
                <DialogDescription>
                  This form will allow you to create a new report card configuration for a class. (Functionality coming soon).
                </DialogDescription>
              </DialogHeader>
              {/* Placeholder for form fields */}
              <div className="py-8 text-center text-muted-foreground">
                Configuration form will be here.
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button disabled>Save Configuration</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class/Grade</TableHead>
                <TableHead>Number of Assessments</TableHead>
                <TableHead>Grading Scheme Name</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockConfigurations.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.grade}</TableCell>
                  <TableCell>{config.assessments}</TableCell>
                  <TableCell>{config.scheme}</TableCell>
                  <TableCell>{config.lastUpdated}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
