/**
 * Centralized Duty Hours and Calculation Utilities
 * Ensures exact cross-module synchronization between HR Settings,
 * Attendance, Salary Generation, and Payslip Vouchers.
 */

export function getEffectiveDutyHours(emp, dutySettings = {}) {
  if (!emp) return { hours: Number(dutySettings?.standardHours) || 8, source: 'Global Standard', type: 'standard' };

  // 1. Employee-specific custom override from HR Settings
  if (dutySettings?.employeeDutyHours) {
    if (emp.id && Number(dutySettings.employeeDutyHours[emp.id]) > 0) {
      return { hours: Number(dutySettings.employeeDutyHours[emp.id]), source: 'Custom Employee Override', type: 'custom' };
    }
    if (emp.employeeCode && Number(dutySettings.employeeDutyHours[emp.employeeCode]) > 0) {
      return { hours: Number(dutySettings.employeeDutyHours[emp.employeeCode]), source: 'Custom Employee Override', type: 'custom' };
    }
    if (emp.employeeId && Number(dutySettings.employeeDutyHours[emp.employeeId]) > 0) {
      return { hours: Number(dutySettings.employeeDutyHours[emp.employeeId]), source: 'Custom Employee Override', type: 'custom' };
    }
  }

  // 2. Direct employee profile duty hours
  if (emp.dutyHours && Number(emp.dutyHours) > 0) {
    return { hours: Number(emp.dutyHours), source: 'Profile Duty Hours', type: 'custom' };
  }
  if (emp.dailyHours && Number(emp.dailyHours) > 0) {
    return { hours: Number(emp.dailyHours), source: 'Profile Daily Hours', type: 'custom' };
  }

  // 3. Department override
  if (emp.department && dutySettings?.departmentDutyHours?.[emp.department] && Number(dutySettings.departmentDutyHours[emp.department]) > 0) {
    return { hours: Number(dutySettings.departmentDutyHours[emp.department]), source: 'Dept Default (' + emp.department + ')', type: 'department' };
  }

  // 4. Division override
  const div = emp.division || emp.section;
  if (div && dutySettings?.divisionDutyHours?.[div] && Number(dutySettings.divisionDutyHours[div]) > 0) {
    return { hours: Number(dutySettings.divisionDutyHours[div]), source: 'Division Default (' + div + ')', type: 'division' };
  }

  // 5. Shift override
  if (emp.shift) {
    const sObj = (dutySettings?.shifts || []).find(s => s.name?.toLowerCase() === emp.shift?.toLowerCase());
    if (sObj?.hours && Number(sObj.hours) > 0) return { hours: Number(sObj.hours), source: 'Shift (' + sObj.name + ')', type: 'shift' };
  }

  // 6. Global standard
  return { hours: Number(dutySettings?.standardHours) || 8, source: 'Global Standard', type: 'standard' };
}

/**
 * Returns effective Overtime Multiplier for an employee.
 * Strict default is 1.0 (Multiply by 1).
 * Supports individual custom overrides per employee.
 */
export function getEffectiveOvertimeMultiplier(emp, dutySettings = {}) {
  if (!emp) return 1.0;

  // 1. Employee-specific custom override from HR Settings
  if (dutySettings?.employeeOvertimeMultipliers) {
    if (emp.id !== undefined && emp.id !== null) {
      const idVal = Number(dutySettings.employeeOvertimeMultipliers[emp.id]);
      if (!isNaN(idVal) && idVal > 0) return idVal;
    }
    if (emp.employeeCode !== undefined && emp.employeeCode !== null) {
      const codeVal = Number(dutySettings.employeeOvertimeMultipliers[emp.employeeCode]);
      if (!isNaN(codeVal) && codeVal > 0) return codeVal;
    }
    if (emp.employeeId !== undefined && emp.employeeId !== null) {
      const empIdVal = Number(dutySettings.employeeOvertimeMultipliers[emp.employeeId]);
      if (!isNaN(empIdVal) && empIdVal > 0) return empIdVal;
    }
  }

  // 2. Direct employee profile multiplier
  if (emp.overtimeMultiplier !== undefined && emp.overtimeMultiplier !== null) {
    const val = Number(emp.overtimeMultiplier);
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. Explicitly configured dutySettings multiplier if different from legacy 1.5
  if (dutySettings?.overtimeCalculation?.rateMultiplier !== undefined && dutySettings?.overtimeCalculation?.rateMultiplier !== null) {
    const m = Number(dutySettings.overtimeCalculation.rateMultiplier);
    if (!isNaN(m) && m > 0) return m;
  }
  if (dutySettings?.overtimeMultiplier !== undefined && dutySettings?.overtimeMultiplier !== null) {
    const m = Number(dutySettings.overtimeMultiplier);
    if (!isNaN(m) && m > 0) return m;
  }

  // 4. Default: strictly 1.0 (multiply by 1)
  return 1.0;
}
