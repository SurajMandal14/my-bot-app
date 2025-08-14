

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, File, Loader2, ArrowRight, Wand2, Info, CheckCircle, AlertCircle, Database, Send, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { mapStudentData, type StudentDataMappingOutput } from '@/ai/flows/map-student-data-flow';
import { bulkCreateSchoolUsers } from '@/app/actions/schoolUsers';
import type { AuthUser, User } from '@/types/user';
import { dbSchemaFields } from '@/types/student-import-schema';
import Link from 'next/link';

type ProcessedStudent = Partial<User>;

function excelSerialDateToJSDate(serial: number) {
  if (typeof serial !== 'number' || isNaN(serial)) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + tzOffset);
}

function formatDateToMMDDYYYY(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}


export default function StudentImportPage() {
    const { toast } = useToast();
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [fullData, setFullData] = useState<any[][]>([]);
    
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    
    const [isMapping, setIsMapping] = useState(false);
    const [mappedData, setMappedData] = useState<StudentDataMappingOutput | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [processedStudents, setProcessedStudents] = useState<ProcessedStudent[]>([]);
    
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser && storedUser !== "undefined") {
            try {
                const parsedUser: AuthUser = JSON.parse(storedUser);
                if (parsedUser.role === 'admin' && parsedUser.schoolId) {
                    setAuthUser(parsedUser);
                }
            } catch (e) { console.error(e); }
        }
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsLoadingFile(true);
        const selectedFile = event.target.files?.[0];

        if (!selectedFile) {
            setIsLoadingFile(false);
            return;
        }

        const allowedTypes = ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"];
        if (!allowedTypes.includes(selectedFile.type)) {
            toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload an Excel (.xls, .xlsx) or CSV file.' });
            event.target.value = '';
            setFile(null); setFileName('');
            setIsLoadingFile(false);
            return;
        }

        setFile(selectedFile);
        setFileName(selectedFile.name);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                const rawJsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

                if (!rawJsonData || rawJsonData.length < 2) {
                     toast({ variant: 'destructive', title: 'Empty Sheet', description: 'The selected file sheet is empty or has no data.' });
                     setHeaders([]); setFullData([]);
                     setIsLoadingFile(false);
                     return;
                }

                const originalHeaders = rawJsonData[0].map(h => String(h || '').trim());
                const dataRows = rawJsonData.slice(1);
                
                const validHeaderIndices: number[] = [];
                const finalHeaders: string[] = [];
                const dateColumns: boolean[] = [];

                originalHeaders.forEach((header, index) => {
                    if (header !== '') {
                        validHeaderIndices.push(index);
                        finalHeaders.push(header);
                        
                        const headerStr = header.toLowerCase();
                        dateColumns.push(headerStr.includes('date') || headerStr.includes('dob') || headerStr.includes('d.o.b') || headerStr.includes('d.o.a'));
                    }
                });

                const alignedDataRows = dataRows.map(row => 
                    validHeaderIndices.map((validIndex, colIndex) => {
                        const cellValue = row[validIndex];
                        if (dateColumns[colIndex] && typeof cellValue === 'number' && cellValue > 1) {
                            const jsDate = excelSerialDateToJSDate(cellValue);
                            return jsDate ? formatDateToMMDDYYYY(jsDate) : cellValue;
                        }
                        return cellValue ?? '';
                    })
                );

                setHeaders(finalHeaders);
                setFullData(alignedDataRows);
                setMappedData(null);
                setProcessedStudents([]);
                
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error Reading File', description: 'There was a problem processing your file.' });
            } finally {
                setIsLoadingFile(false);
            }
        };
        reader.onerror = () => {
             toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read the selected file.' });
             setIsLoadingFile(false);
        }
        reader.readAsArrayBuffer(selectedFile);
    };

    const handleMapData = async () => {
        if (!headers.length) {
            toast({ variant: 'warning', title: 'No Data', description: 'Please upload a valid file first.' });
            return;
        }
        setIsMapping(true);
        try {
            const sampleData = fullData.slice(0, 5);
            const result = await mapStudentData({ headers, sampleData });
            setMappedData(result);
            toast({ title: "AI Mapping Complete", description: "Please review the proposed mappings." });
        } catch (error) {
            console.error("AI Mapping Error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'AI Mapping Failed', description: errorMessage });
            setMappedData(null);
        } finally {
            setIsMapping(false);
        }
    };
    
    const handleMappingChange = (header: string, newDbField: string | null) => {
        setMappedData(prev => {
            if (!prev) return null;
            const newMap = { ...prev };
            newMap[header] = newDbField === "null" ? null : newDbField;
            return newMap;
        });
    };

    const handleProcessData = () => {
        if (!mappedData || !fullData.length) {
            toast({ variant: "destructive", title: "Cannot Process", description: "Please run AI mapping on a valid file first."});
            return;
        }
        setIsProcessing(true);
        const dbFieldToHeaderIndex: Record<string, number> = {};
        Object.entries(mappedData).forEach(([header, dbField]) => {
            if (dbField) {
                const headerIndex = headers.indexOf(header);
                if (headerIndex !== -1) dbFieldToHeaderIndex[dbField] = headerIndex;
            }
        });

        const newProcessedStudents: ProcessedStudent[] = fullData.map(row => {
            const student: ProcessedStudent = {};
            Object.keys(dbFieldToHeaderIndex).forEach(dbField => {
                const index = dbFieldToHeaderIndex[dbField];
                if (row[index] !== undefined && row[index] !== null && String(row[index]).trim() !== '') {
                    (student as any)[dbField] = String(row[index]);
                }
            });
            return student;
        }).filter(student => student.name || student.email || student.admissionId);

        setProcessedStudents(newProcessedStudents);
        toast({ title: "Data Processed", description: `${newProcessedStudents.length} student records are ready for final import.`});
        setIsProcessing(false);
    };
    
    const handleImportData = async () => {
        if (!authUser?.schoolId) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: "Could not identify your school. Please re-login." });
            return;
        }
        if (processedStudents.length === 0) {
            toast({ variant: 'warning', title: 'No Data', description: "No processed students to import." });
            return;
        }
        setIsImporting(true);
        setImportResult(null);

        const result = await bulkCreateSchoolUsers(processedStudents, authUser.schoolId);

        if(result.success) {
            toast({ title: "Import Complete", description: result.message, duration: 8000 });
            setImportResult({ imported: result.importedCount || 0, skipped: result.skippedCount || 0 });
        } else {
            toast({ variant: 'destructive', title: "Import Failed", description: result.error || result.message, duration: 8000 });
        }
        setIsImporting(false);
    }

    const finalPreviewHeaders = useMemo(() => {
        if (processedStudents.length === 0) return [];
        const headerSet = new Set<string>();
        processedStudents.forEach(student => {
            Object.keys(student).forEach(key => headerSet.add(key));
        });
        const prioritized = ['name', 'admissionId', 'classId', 'section', 'academicYear', 'dob', 'fatherName', 'motherName', 'phone', 'dateOfJoining'];
        const sortedHeaders = Array.from(headerSet).sort((a, b) => {
            const aIndex = prioritized.indexOf(a);
            const bIndex = prioritized.indexOf(b);
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return a.localeCompare(b);
        });
        return sortedHeaders;
    }, [processedStudents]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-headline flex items-center"><UploadCloud className="mr-2 h-6 w-6" /> Import Students from File</CardTitle>
                    <CardDescription>Upload an Excel/CSV file, map columns using AI, and import student data. Class, Section, and Academic Year will be detected from the file.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Step 1: Get Template & Upload</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <a href="https://docs.google.com/spreadsheets/d/1Xg3_g44L2jqBIMqGETsxGzV0kIlW4E-XoYJjY8Vb7rI/export?format=xlsx" download="student_import_template_v2.xlsx">
                                <Button variant="outline" className="w-full">
                                    <Download className="mr-2 h-4 w-4"/> Download Template
                                </Button>
                            </a>
                            <div className="space-y-2 pt-2">
                                <Label htmlFor="file-upload">Upload Completed File</Label>
                                <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls, .csv" disabled={isLoadingFile || isMapping}/>
                            </div>
                            {isLoadingFile && <div className="mt-2 flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Processing file...</div>}
                            {fileName && !isLoadingFile && <div className="mt-2 flex items-center text-sm text-green-600"><File className="mr-2 h-4 w-4"/>{fileName} ready.</div>}
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle>Step 2: Map & Process Data</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <Button onClick={handleMapData} disabled={isMapping || isLoadingFile || headers.length === 0} className="w-full">
                                {isMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>} Run AI Mapping
                            </Button>
                            <Button onClick={handleProcessData} disabled={isProcessing || isMapping || !mappedData} className="w-full">
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Database className="mr-2 h-4 w-4"/>} Process Data
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Step 3: Final Import</CardTitle></CardHeader>
                        <CardContent>
                             <Button onClick={handleImportData} disabled={isImporting || processedStudents.length === 0} className="w-full">
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>} Import {processedStudents.length > 0 ? `(${processedStudents.length})` : ''} Students
                            </Button>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>File Preview & Mapping</CardTitle><CardDescription>{headers.length > 0 ? "Review your data and AI mapping." : "Upload a file to see a preview."}</CardDescription></CardHeader>
                        <CardContent>
                            {headers.length > 0 ? (
                                <div className="space-y-4">
                                     <div className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.map(header => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{fullData.slice(0, 5).map((row, rowIndex) => (<TableRow key={rowIndex}>{headers.map((_, colIndex) => (<TableCell key={colIndex}>{String(row[colIndex] ?? '')}</TableCell>))}</TableRow>))}</TableBody></Table></div>
                                    <p className="text-xs text-muted-foreground">Showing first {Math.min(5, fullData.length)} of {fullData.length} data rows.</p>
                                </div>
                            ) : (<div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg text-center p-4"><Info className="h-10 w-10 text-muted-foreground mb-2"/><p className="text-muted-foreground">Your file preview will appear here.</p></div>)}

                            {isMapping && <div className="mt-4 flex justify-center items-center h-32"><Loader2 className="mr-2 h-6 w-6 animate-spin"/> Mapping columns...</div>}
                            {mappedData && !isMapping && (
                                <div className="mt-6">
                                    <h3 className="font-semibold text-lg mb-2">Review Mapping</h3>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Spreadsheet Column</TableHead>
                                                    <TableHead>Database Field</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {Object.entries(mappedData).map(([header, dbField]) => (
                                                    <TableRow key={header}>
                                                        <TableCell>{header}</TableCell>
                                                        <TableCell className="flex items-center gap-2">
                                                            <ArrowRight className="h-4 w-4 text-muted-foreground"/>
                                                            <Select onValueChange={(value) => handleMappingChange(header, value)} value={dbField || "null"}>
                                                                <SelectTrigger className="w-[250px]">
                                                                    <SelectValue placeholder="Select database field..."/>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="null">-- Ignore this column --</SelectItem>
                                                                    {dbSchemaFields.map(field => (
                                                                        <SelectItem key={field} value={field}>{field}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <Alert className="mt-4 border-amber-500 text-amber-900 dark:border-amber-600 dark:text-amber-300 [&>svg]:text-amber-500"><AlertCircle className="h-4 w-4" /><AlertTitle>Review Carefully</AlertTitle><AlertDescription>Correct any AI mapping errors using the dropdowns before processing the data.</AlertDescription></Alert>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    
                    {processedStudents.length > 0 && !isProcessing && (
                         <Card>
                            <CardHeader><CardTitle>Final Import Preview</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">Review the structured data below. This is how it will be imported. Existing students with the same Admission ID will be skipped.</p>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        {finalPreviewHeaders.map(header => (
                                          <TableHead key={header} className="capitalize">{header.replace(/([A-Z])/g, ' $1')}</TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {processedStudents.slice(0, 10).map((student, index) => (
                                        <TableRow key={index}>
                                          {finalPreviewHeaders.map(header => (
                                            <TableCell key={`${index}-${header}`}>{(student as any)[header] || 'N/A'}</TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                {processedStudents.length > 10 && <p className="text-xs text-muted-foreground mt-2">Showing first 10 of {processedStudents.length} records.</p>}
                                {importResult && (
                                    <Alert className="mt-4" variant={importResult.imported > 0 ? "default" : "destructive"}>
                                        <CheckCircle className="h-4 w-4" />
                                        <AlertTitle>Import Complete</AlertTitle>
                                        <AlertDescription>
                                            Successfully imported: {importResult.imported} student(s).<br/>
                                            Skipped (already exist or invalid data): {importResult.skipped} student(s).
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
