
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '@/types/user';
import type { MonthlyAttendanceRecord } from '@/types/attendance';
import type { FeePayment } from '@/types/fees';
import type { School, TermFee } from '@/types/school';
import type { FeeConcession } from '@/types/concessions';
import { getStudentMonthlyAttendance } from '@/app/actions/attendance';
import { getFeePaymentsByStudent } from '@/app/actions/fees';
import { getSchoolById } from '@/app/actions/schools';
import { getFeeConcessionsForStudent } from '@/app/actions/concessions';
import { getClassDetailsById } from '@/app/actions/classes';
import { useToast } from '@/hooks/use-toast';

const getCurrentAcademicYear = (): string => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  if (currentMonth >= 5) { 
    return `${currentYear}-${currentYear + 1}`;
  } else {
    return `${currentYear - 1}-${currentYear}`;
  }
};


interface AttendanceSummary {
  present: number;
  total: number;
  percentage: number;
  late: number; // Added for more detail, assuming logic might exist
  absent: number; // Added for more detail
}

interface FeeSummary {
  totalFee: number;
  totalPaid: number;
  totalConcessions: number;
  totalDue: number;
  percentagePaid: number;
}

interface StudentDataContextType {
  authUser: AuthUser | null;
  attendanceSummary: AttendanceSummary;
  feeSummary: FeeSummary | null;
  appliedConcessions: FeeConcession[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => void;
  schoolDetails: School | null;
  activeAcademicYear: string | null; // Expose active academic year
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export const useStudentData = (): StudentDataContextType => {
  const context = useContext(StudentDataContext);
  if (!context) {
    throw new Error('useStudentData must be used within a StudentDataProvider');
  }
  return context;
};

interface StudentDataProviderProps {
  children: ReactNode;
}

export const StudentDataProvider = ({ children }: StudentDataProviderProps) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({
    present: 0, percentage: 0, total: 0, late: 0, absent: 0
  });
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [appliedConcessions, setAppliedConcessions] = useState<FeeConcession[]>([]);
  const [schoolDetails, setSchoolDetails] = useState<School | null>(null);
  const [activeAcademicYear, setActiveAcademicYear] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser && storedUser !== "undefined" && storedUser !== "null") {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.role === 'student' && parsedUser._id && parsedUser.schoolId) {
          setAuthUser(parsedUser);
        } else {
          setAuthUser(null);
          setError("Invalid user session for student data.");
        }
      } catch (e) {
        setAuthUser(null);
        setError("Failed to parse user session.");
        console.error("StudentDataProvider: Failed to parse user from localStorage:", e);
      }
    } else {
      setAuthUser(null);
      setError("No user session found.");
    }
  }, []);

  const calculateAnnualTuitionFee = useCallback((className: string | undefined, schoolConfig: School | null): number => {
    if (!className || !schoolConfig || !schoolConfig.tuitionFees) return 0;
    const classFeeConfig = schoolConfig.tuitionFees.find(cf => cf.className === className);
    if (!classFeeConfig || !classFeeConfig.terms) return 0;
    return classFeeConfig.terms.reduce((sum, term) => sum + (term.amount || 0), 0);
  }, []);

  const fetchAllStudentData = useCallback(async () => {
    if (!authUser || !authUser._id || !authUser.schoolId) {
      setIsLoading(false);
      setError(authUser ? "Missing student ID or School ID." : "User not authenticated for student data.");
      setAttendanceSummary({ present: 0, percentage: 0, total: 0, late: 0, absent: 0 });
      setFeeSummary(null);
      setAppliedConcessions([]);
      setSchoolDetails(null);
      setActiveAcademicYear(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const schoolResult = await getSchoolById(authUser.schoolId.toString());
      
      let schoolActiveYear: string;
      if (schoolResult.success && schoolResult.school) {
        setSchoolDetails(schoolResult.school);
        schoolActiveYear = schoolResult.school.activeAcademicYear || getCurrentAcademicYear();
        setActiveAcademicYear(schoolActiveYear);
      } else {
        toast({ variant: "destructive", title: "School Info Error", description: schoolResult.message || "Could not load school details." });
        setSchoolDetails(null);
        schoolActiveYear = getCurrentAcademicYear(); // Fallback
        setActiveAcademicYear(schoolActiveYear);
      }


      const [attendanceResult, feePaymentsResult, concessionsResult] = await Promise.all([
        getStudentMonthlyAttendance(authUser._id.toString()),
        getFeePaymentsByStudent(authUser._id.toString(), authUser.schoolId.toString()),
        getFeeConcessionsForStudent(authUser._id.toString(), authUser.schoolId.toString(), schoolActiveYear)
      ]);

      
      if (attendanceResult.success && attendanceResult.records) {
        const records = attendanceResult.records;
        const totalWorkingDays = records.reduce((sum, r) => sum + r.totalWorkingDays, 0);
        const totalPresentDays = records.reduce((sum, r) => sum + r.daysPresent, 0);

        if (totalWorkingDays > 0) {
          const percentage = Math.round((totalPresentDays / totalWorkingDays) * 100);
          setAttendanceSummary({ present: totalPresentDays, total: totalWorkingDays, percentage, late: 0, absent: totalWorkingDays - totalPresentDays });
        } else {
          setAttendanceSummary({ present: 0, total: 0, percentage: 0, late: 0, absent: 0 });
        }
      } else {
        toast({ variant: "warning", title: "Attendance Info", description: attendanceResult.message || "Could not fetch attendance data." });
        setAttendanceSummary({ present: 0, total: 0, percentage: 0, late: 0, absent: 0 });
      }

      if (concessionsResult.success && concessionsResult.concessions) {
        setAppliedConcessions(concessionsResult.concessions);
      } else {
        toast({ variant: "info", title: "Concessions", description: concessionsResult.message || "No concessions found or could not load them." });
        setAppliedConcessions([]);
      }

      if (schoolResult.success && schoolResult.school) {
        const currentSchoolDetails = schoolResult.school;
        const studentPayments = feePaymentsResult.success && feePaymentsResult.payments ? feePaymentsResult.payments : [];
        const studentConcessions = concessionsResult.success && concessionsResult.concessions ? concessionsResult.concessions : [];
        
        let studentClassNameForFee: string | undefined = undefined;
        if (authUser.classId) {
            const classDetailsResult = await getClassDetailsById(authUser.classId, authUser.schoolId.toString());
            if (classDetailsResult.success && classDetailsResult.classDetails) {
                studentClassNameForFee = classDetailsResult.classDetails.name;
            } else {
                 toast({ variant: "warning", title: "Class Info Error", description: "Could not find your class details to calculate fees." });
            }
        }
        
        if (studentClassNameForFee) {
            const totalAnnualTuitionFee = calculateAnnualTuitionFee(studentClassNameForFee, currentSchoolDetails);
            const totalPaid = studentPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
            const totalConcessionsAmount = studentConcessions.reduce((sum, concession) => sum + concession.amount, 0);
            const totalDue = Math.max(0, totalAnnualTuitionFee - totalPaid - totalConcessionsAmount);
            
            const netPayable = totalAnnualTuitionFee - totalConcessionsAmount;
            let percentagePaid = 0;
            if (netPayable > 0) {
              percentagePaid = Math.round((totalPaid / netPayable) * 100);
            } else if (netPayable <= 0 && totalPaid >= 0) {
              percentagePaid = 100;
            }
            
            percentagePaid = Math.min(percentagePaid, 100);


            setFeeSummary({ totalFee: totalAnnualTuitionFee, totalPaid, totalConcessions: totalConcessionsAmount, totalDue, percentagePaid });
        } else {
            setFeeSummary({ totalFee: 0, totalPaid: 0, totalConcessions: 0, totalDue: 0, percentagePaid: 0 });
            if (authUser.classId) {
                toast({ variant: "info", title: "Fee Info", description: "Your assigned class could not be found, so fee details cannot be calculated." });
            } else {
                 toast({ variant: "info", title: "Fee Info", description: "You are not assigned to a class, so fee details cannot be calculated." });
            }
        }
      } else {
        setFeeSummary(null);
      }

    } catch (fetchError) {
      console.error("StudentDataProvider: Error fetching dashboard data:", fetchError);
      setError("An unexpected error occurred fetching dashboard data.");
      toast({ variant: "destructive", title: "Dashboard Error", description: "Could not load your information." });
      setAttendanceSummary({ present: 0, total: 0, percentage: 0, late: 0, absent: 0 });
      setFeeSummary(null);
      setAppliedConcessions([]);
      setSchoolDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, toast, calculateAnnualTuitionFee]);
  
  useEffect(() => {
    if (authUser?._id && authUser?.schoolId) {
      fetchAllStudentData();
    } else if (!authUser && localStorage.getItem('loggedInUser') === null) { 
      setIsLoading(false);
    }
  }, [authUser, fetchAllStudentData]);

  const refreshData = useCallback(() => {
    if (authUser?._id && authUser?.schoolId) {
      fetchAllStudentData();
    }
  }, [authUser, fetchAllStudentData]);

  return (
    <StudentDataContext.Provider value={{ 
        authUser, 
        attendanceSummary, 
        feeSummary, 
        appliedConcessions,
        isLoading, 
        error, 
        refreshData,
        schoolDetails,
        activeAcademicYear,
    }}>
      {children}
    </StudentDataContext.Provider>
  );
};
