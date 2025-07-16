

import type { ObjectId } from 'mongodb';
import { z } from 'zod';

export type UserRole = 'superadmin' | 'masteradmin' | 'admin' | 'teacher' | 'student';

export interface Address {
  houseNo?: string;
  street?: string;
  village?: string;
  mandal?: string;
  district?: string;
  state?: string;
}

export interface User {
  _id: ObjectId | string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  status?: 'active' | 'discontinued';
  schoolId?: ObjectId | string;
  classId?: string; 
  admissionId?: string; 
  avatarUrl?: string;
  phone?: string;
  busRouteLocation?: string; 
  busClassCategory?: string; 
  subjectsTaught?: string[]; 
  
  qualification?: string;

  fatherName?: string;
  motherName?: string;
  dob?: string; 
  section?: string; 
  rollNo?: string;
  examNo?: string;
  aadharNo?: string;
  academicYear?: string;

  dateOfJoining?: string;
  dateOfLeaving?: string;

  // New detailed student form fields
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  caste?: string;
  subcaste?: string;
  identificationMarks?: string;
  presentAddress?: Address;
  permanentAddress?: Address;
  fatherMobile?: string;
  motherMobile?: string;
  fatherAadhar?: string;
  motherAadhar?: string;
  fatherQualification?: string;
  motherQualification?: string;
  fatherOccupation?: string;
  motherOccupation?: string;
  rationCardNumber?: string;
  isTcAttached?: boolean;
  previousSchool?: string;
  childIdNumber?: string;
  motherTongue?: string;

  createdAt: Date | string; 
  updatedAt: Date | string; 
}

export type AuthUser = Pick<User, 'email' | 'name' | 'role' | '_id' | 'schoolId' | 'classId' | 'avatarUrl' | 'admissionId'>;

export const schoolAdminFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }).optional().or(z.literal('')), 
  schoolId: z.string().min(1, { message: "School selection is required." }),
});
export type SchoolAdminFormData = z.infer<typeof schoolAdminFormSchema>;

const addressSchema = z.object({
  houseNo: z.string().optional(),
  street: z.string().optional(),
  village: z.string().optional(),
  mandal: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
}).optional();


const baseSchoolUserFormSchema = z.object({
  // System fields (may be grouped separately in UI)
  admissionId: z.string().optional(),
  email: z.string().email({ message: "A valid email is required." }),
  // password is handled in the extended schemas
  role: z.enum(['teacher', 'student'], { required_error: "Role is required." }),
  
  // Personal Details
  name: z.string().min(2, { message: "Full Name is required." }),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  caste: z.string().optional(),
  subcaste: z.string().optional(),
  aadharNo: z.string().optional().refine(val => !val || /^\d{12}$/.test(val), { message: "Aadhar must be 12 digits." }),
  identificationMarks: z.string().optional(),
  phone: z.string().optional(),
  
  // Address Details
  presentAddress: addressSchema,
  isPermanentSameAsPresent: z.boolean().optional(),
  permanentAddress: addressSchema,
  
  // Parent/Guardian Details
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  fatherMobile: z.string().optional(),
  motherMobile: z.string().optional(),
  fatherAadhar: z.string().optional(),
  motherAadhar: z.string().optional(),
  fatherQualification: z.string().optional(),
  motherQualification: z.string().optional(),
  fatherOccupation: z.string().optional(),
  motherOccupation: z.string().optional(),
  rationCardNumber: z.string().optional(),
  
  // Academic & Other Details
  classId: z.string().optional(),
  academicYear: z.string().optional(),
  previousSchool: z.string().optional(),
  isTcAttached: z.boolean().optional(),
  childIdNumber: z.string().optional(),
  motherTongue: z.string().optional(),
  dateOfJoining: z.string().optional(),
  qualification: z.string().optional(),

  // These are system-managed but part of the base user type
  section: z.string().optional(),
  rollNo: z.string().optional(),
  examNo: z.string().optional(),
  dateOfLeaving: z.string().optional(),
  enableBusTransport: z.boolean().default(false).optional(),
  busRouteLocation: z.string().optional(),
  busClassCategory: z.string().optional(),
});

const schoolUserRefinement = (data: z.infer<typeof baseSchoolUserFormSchema>, ctx: z.RefinementCtx) => {
    if (data.role === 'student') {
        if (!data.admissionId || data.admissionId.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['admissionId'],
                message: 'Admission ID is required for students.',
            });
        }
        if (!data.classId || data.classId.trim() === "") {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['classId'],
                message: 'Class assignment is required for students.',
            });
        }
        if (!data.dob || data.dob.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['dob'],
                message: 'Date of Birth is required for students.',
            });
        }
        if (!data.fatherName || data.fatherName.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['fatherName'],
                message: "Father's Name is required for students.",
            });
        }
        if (!data.motherName || data.motherName.trim() === "") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['motherName'],
                message: "Mother's Name is required for students.",
            });
        }
    }
};

export const createSchoolUserFormSchema = baseSchoolUserFormSchema
  .extend({
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  })
  .superRefine(schoolUserRefinement);

export type CreateSchoolUserFormData = z.infer<typeof createSchoolUserFormSchema>;

export const updateSchoolUserFormSchema = baseSchoolUserFormSchema
  .extend({
    password: z.string().min(6, { message: "New password must be at least 6 characters." }).optional().or(z.literal('')),
  })
  .superRefine(schoolUserRefinement);

export type UpdateSchoolUserFormData = z.infer<typeof updateSchoolUserFormSchema>;

export const updateProfileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  phone: z.string().optional(),
  avatarUrl: z.string().url("Invalid URL format for avatar.").optional().or(z.literal('')),
});
export type UpdateProfileFormData = z.infer<typeof updateProfileFormSchema>;

export const masterAdminFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }).optional().or(z.literal('')),
  schoolId: z.string().min(1, "School assignment is required."),
});
export type MasterAdminFormData = z.infer<typeof masterAdminFormSchema>;
