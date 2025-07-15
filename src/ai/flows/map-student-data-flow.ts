
'use server';

/**
 * @fileOverview An AI flow for mapping spreadsheet data to a student schema.
 * 
 * - mapStudentData - A function that takes spreadsheet headers and sample data,
 *   and returns a proposed mapping to the database schema.
 * - StudentDataMappingInput - The input type for the mapStudentData function.
 * - StudentDataMappingOutput - The return type for the mapStudentData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const dbSchemaFields = [
    'name', 'email', 'password', 'admissionId', 'classId',
    'fatherName', 'motherName', 'dob', 'section', 'rollNo', 'examNo', 'aadharNo',
    'phone', 'busRouteLocation', 'busClassCategory', 'academicYear', 'dateOfJoining'
];

const StudentDataMappingInputSchema = z.object({
  headers: z.array(z.string()).describe('The header row from the uploaded spreadsheet.'),
  sampleData: z.array(z.array(z.any())).describe('The first few rows of data from the spreadsheet for context.'),
});
export type StudentDataMappingInput = z.infer<typeof StudentDataMappingInputSchema>;


const StudentDataMappingOutputSchema = z.record(
    z.string(), // The key is the original header from the spreadsheet
    z.enum(dbSchemaFields as [string, ...string[]]).nullable().describe(`The corresponding database field. If no match is found, this should be null.`)
).describe('A mapping of spreadsheet headers to database schema fields.');
export type StudentDataMappingOutput = z.infer<typeof StudentDataMappingOutputSchema>;

export async function mapStudentData(input: StudentDataMappingInput): Promise<StudentDataMappingOutput> {
    return mapStudentDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'mapStudentDataPrompt',
  input: { schema: StudentDataMappingInputSchema },
  output: { schema: StudentDataMappingOutputSchema },
  prompt: `You are an expert data mapper. Your task is to map the column headers from an uploaded spreadsheet to a predefined database schema for student information.

Here are the available database fields:
${dbSchemaFields.join(', ')}

Here is the header row from the user's spreadsheet:
{{{json headers}}}

Here are the first few rows of data for context, to help you understand the data in each column:
{{{json sampleData}}}

Please provide a JSON object that maps each header from the user's spreadsheet to the most appropriate database field.
- The keys of the JSON object should be the exact strings from the spreadsheet header row.
- The values should be the corresponding database field name from the provided list.
- If a spreadsheet column does not correspond to any of the database fields, its value in the mapping should be null.
- Be intelligent with the mapping. For example, 'adm_no' or 'Admission Number' should map to 'admissionId'. 'DOB' or 'Date of Birth' should map to 'dob'.
- Do not map columns that are clearly not part of the student schema (e.g., 'Row ID', 'Internal Notes'). Their value should be null.
`,
});

const mapStudentDataFlow = ai.defineFlow(
  {
    name: 'mapStudentDataFlow',
    inputSchema: StudentDataMappingInputSchema,
    outputSchema: StudentDataMappingOutputSchema,
  },
  async (input) => {
    // Add a check for empty headers to avoid sending empty requests
    if (input.headers.length === 0) {
      console.log("mapStudentDataFlow: Received empty headers, returning empty map.");
      return {};
    }
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid mapping.");
    }
    return output;
  }
);
