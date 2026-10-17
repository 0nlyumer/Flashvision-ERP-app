import React, { useState, useEffect, useRef } from 'react';

const ALL_COLUMNS = [
  { id: 'id', label: 'Emp Code' },
  { id: 'name', label: 'Name' },
  { id: 'designation', label: 'Designation' },
  { id: 'department', label: 'Department' },
  { id: 'status', label: 'Status' },
  { id: 'basicSalary', label: 'Basic Salary' },
  { id: 'joiningDate', label: 'Join Date' },
  { id: 'email', label: 'Email' },
  { id: 'cnic', label: 'CNIC' },
  { id: 'phone', label: 'Primary Number' },
  { id: 'emergencyContact', label: 'Emergency Number' },
  { id: 'gender', label: 'Gender' }
];

import { useApp } from '../../context/AppContext';

export default function HRDirectory({ isMobile }) {
  const { state, setCollection } = useApp();
  const employees = state.hr_employees_list || [];
  const setEmployees = (updater) => {
    const nextList = typeof updater === 'function' ? updater(employees) : updater;
    setCollection('hr_employees_list', nextList);
  };

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [divisionFilter, setDivisionFilter] = useState('ALL');
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
  // Column Management States
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('hr_directory_visible_columns');
    return saved ? JSON.parse(saved) : ['id', 'name', 'designation', 'department', 'status', 'phone', 'basicSalary'];
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('hr_directory_column_order');
    return saved ? JSON.parse(saved) : ['id', 'name', 'designation', 'department', 'status', 'basicSalary', 'joiningDate', 'email', 'cnic', 'phone', 'emergencyContact', 'gender'];
  });

  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('hr_directory_column_widths');
    return saved ? JSON.parse(saved) : {
      id: 110,
      name: 240,
      designation: 190,
      department: 150,
      status: 120,
      basicSalary: 130,
      joiningDate: 130,
      email: 200,
      cnic: 150,
      phone: 160,
      emergencyContact: 160,
      gender: 110
    };
  });

  // Dynamic persistence effects
  useEffect(() => {
    localStorage.setItem('hr_directory_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('hr_directory_column_order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [activeEmployee, setActiveEmployee] = useState(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const [showAllEmployees, setShowAllEmployees] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef(null);

  // Bulk Upload / Template States & Refs
  const fileInputRef = useRef(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  // Form Field State holders
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    designation: '',
    department: '',
    basicSalary: '',
    status: 'Active',
    joiningDate: '',
    email: '',
    cnic: '',
    phone: '',
    emergencyContact: '',
    gender: 'Male'
  });

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowColMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  
  // Distinct Departments for Filter Dropdown
  const departmentsList = React.useMemo(() => {
    const set = new Set();
    employees.forEach(emp => {
      if (emp.department) set.add(emp.department);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [employees]);

  // Distinct Divisions for Filter Dropdown
  const divisionsList = React.useMemo(() => {
    const set = new Set();
    employees.forEach(emp => {
      const div = emp.division || emp.section;
      if (div && (departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter)) {
        set.add(div);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [employees, departmentFilter]);

  // Filtered employees
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || (
      (emp.name || '').toLowerCase().includes(query) ||
      (emp.id || '').toLowerCase().includes(query) ||
      (emp.designation || '').toLowerCase().includes(query) ||
      (emp.department || '').toLowerCase().includes(query) ||
      (emp.email || '').toLowerCase().includes(query) ||
      (emp.phone || '').toLowerCase().includes(query)
    );
    const matchesDept = departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter;
    const matchesDiv = divisionFilter === 'ALL' || !divisionFilter || (emp.division === divisionFilter || emp.section === divisionFilter);
    return matchesSearch && matchesDept && matchesDiv;
  });

  // Padded consecutive sequential ID Generator
  const generateNextId = () => {
    const ids = employees.map(emp => {
      const match = emp.id?.match(/EMP-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxVal = ids.length > 0 ? Math.max(...ids) : 0;
    const nextNum = maxVal + 1;
    return `EMP-${String(nextNum).padStart(3, '0')}`;
  };

  // CSV Template Downloader
  const downloadCSVTemplate = () => {
    const headers = [
      'Full Name',
      'Email Address',
      'Designation',
      'Department',
      'Basic Salary',
      'Date of Joining',
      'CNIC Number',
      'Primary Number',
      'Emergency Contact Number',
      'Gender',
      'Status'
    ];
    const sampleRow = [
      'John Doe',
      'john.doe@company.com',
      'Associate',
      'Operations',
      '75000',
      '2023-10-25',
      '42101-1234567-8',
      '+1 (555) 019-2834',
      '+1 (555) 019-9999',
      'Male',
      'Active'
    ];
    const csvContent = [
      headers.join(','),
      sampleRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "employee_bulk_upload_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Upload & Dynamic Validation Engine
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        // Zero-dependency quotation-aware CSV parser
        const parseCSV = (text) => {
          const lines = [];
          let row = [""];
          let inQuotes = false;

          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                row[row.length - 1] += '"';
                i++; // skip escaped quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              row.push('');
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
              if (char === '\r' && nextChar === '\n') {
                i++; // skip crlf second byte
              }
              lines.push(row);
              row = [""];
            } else {
              row[row.length - 1] += char;
            }
          }
          if (row.length > 1 || row[0] !== '') {
            lines.push(row);
          }
          return lines;
        };

        const lines = parseCSV(text);
        if (lines.length < 2) {
          setUploadErrors([{
            row: 1,
            cell: 'File Content',
            message: 'The uploaded file is empty or does not contain data.'
          }]);
          setShowErrorModal(true);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const headers = lines[0].map(h => h.trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h === 'full name' || h === 'name');
        const salaryIdx = headers.findIndex(h => h === 'basic salary' || h === 'salary');
        const dateIdx = headers.findIndex(h => h === 'date of joining' || h === 'joining date' || h === 'join date');
        const emailIdx = headers.findIndex(h => h === 'email address' || h === 'email');
        const designationIdx = headers.findIndex(h => h === 'designation');
        const deptIdx = headers.findIndex(h => h === 'department');
        const cnicIdx = headers.findIndex(h => h === 'cnic number' || h === 'cnic');
        const phoneIdx = headers.findIndex(h => h === 'primary number' || h === 'primary contact' || h === 'phone');
        const emergencyIdx = headers.findIndex(h => h === 'emergency contact number' || h === 'emergency contact' || h === 'emergency number');
        const genderIdx = headers.findIndex(h => h === 'gender');
        const statusIdx = headers.findIndex(h => h === 'status');

        if (nameIdx === -1 || salaryIdx === -1 || dateIdx === -1) {
          const missing = [];
          if (nameIdx === -1) missing.push("'Full Name'");
          if (salaryIdx === -1) missing.push("'Basic Salary'");
          if (dateIdx === -1) missing.push("'Date of Joining'");
          
          setUploadErrors([{
            row: 1,
            cell: 'Header Row',
            message: `Required columns are missing from the header. Please ensure your CSV contains: ${missing.join(', ')}.`
          }]);
          setShowErrorModal(true);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const errors = [];
        const validEmployees = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          if (row.length === 0 || (row.length === 1 && row[0].trim() === '') || row.every(cell => cell.trim() === '')) {
            continue;
          }

          const rowNum = i + 1; // 1-based line number (header is 1)
          const rawName = row[nameIdx]?.trim() || '';
          const rawSalary = row[salaryIdx]?.trim() || '';
          const rawDate = row[dateIdx]?.trim() || '';

          if (!rawName) {
            errors.push({ row: rowNum, cell: 'Full Name', message: 'Full Name is missing or empty.' });
          }

          if (!rawSalary) {
            errors.push({ row: rowNum, cell: 'Basic Salary', message: 'Basic Salary is missing or empty.' });
          } else {
            const salaryNum = Number(rawSalary);
            if (isNaN(salaryNum) || salaryNum < 0) {
              errors.push({ row: rowNum, cell: 'Basic Salary', message: `Basic Salary is invalid ('${rawSalary}'). Must be a positive number.` });
            }
          }

          if (!rawDate) {
            errors.push({ row: rowNum, cell: 'Date of Joining', message: 'Date of Joining is missing or empty.' });
          } else {
            const parsedDate = Date.parse(rawDate);
            if (isNaN(parsedDate)) {
              errors.push({ row: rowNum, cell: 'Date of Joining', message: `Date of Joining is invalid ('${rawDate}'). Must be a valid date (e.g., YYYY-MM-DD).` });
            }
          }

          if (errors.length === 0) {
            const email = emailIdx !== -1 ? row[emailIdx]?.trim() || '' : '';
            const designation = designationIdx !== -1 ? row[designationIdx]?.trim() || 'Associate' : 'Associate';
            const department = deptIdx !== -1 ? row[deptIdx]?.trim() || 'Not Assigned' : 'Not Assigned';
            const cnic = cnicIdx !== -1 ? row[cnicIdx]?.trim() || '' : '';
            const phone = phoneIdx !== -1 ? row[phoneIdx]?.trim() || '' : '';
            const emergencyContact = emergencyIdx !== -1 ? row[emergencyIdx]?.trim() || '' : '';
            
            let gender = 'Male';
            if (genderIdx !== -1 && row[genderIdx]) {
              const g = row[genderIdx].trim().toLowerCase();
              if (g === 'female' || g === 'f') gender = 'Female';
              else if (g === 'other' || g === 'o') gender = 'Other';
            }

            let status = 'Active';
            if (statusIdx !== -1 && row[statusIdx]) {
              const s = row[statusIdx].trim().toLowerCase();
              if (s === 'inactive' || s === 'i') status = 'Inactive';
            }

            const avatar = gender === 'Female'
              ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuCn3SSz92LFI9hxwIIua341y0Vk9RCfSUb73oEn-VVNj7TmuPAbUpxc5diuDgctbJLGZEYnB2NkxJOGQkAutKroqUzbiiPg5tZ35TZ4mB4deMWmghyInmaR-CKo6JQlhVlzoMcAOpwq474aLc5AN5HgChCuKEeEIRkWuADeVQjNG5dIiWhX8KCrnrGJpB9VnNVqxr4875Cv7-0C-Su2NM0tEUvAefPHo6hN550yGwLI2EfANf0_2TSNathkvq5nm8Z1gOtfXl2HlWA7'
              : 'https://lh3.googleusercontent.com/aida-public/AB6AXuClMLNdCsT5GgLghPen8kRTvtQ6NO8OmGafManVab4n1fSK2cEWQYaPVSZcrCtCNnXryjClCAWxFdcpBDkP77BTwlVEj_EAgY92iVUNIBSEt3YK7L0_6W4MXFCVvFNSWQLhN0wwRPdDrdbjUPxZDfckGiO-dU7o9X7r-iwDAuTbMGxQwE1rcpPjLJdo0hdNqhC7RCEFzkhQwFU3jAymjR_dgRqQryVcgMm7LVk91xP8IgRuDrZUKgwxFEAYGefnEtaIE-xV3X4oHFzg';

            const joiningDate = new Date(Date.parse(rawDate)).toISOString().split('T')[0];

            const defaultAttendance = {
              Mon: { status: 'present', ot: 0, fines: 0, deductions: 0 },
              Tue: { status: 'present', ot: 0, fines: 0, deductions: 0 },
              Wed: { status: 'present', ot: 0, fines: 0, deductions: 0 },
              Thu: { status: 'present', ot: 0, fines: 0, deductions: 0 },
              Fri: { status: 'present', ot: 0, fines: 0, deductions: 0 }
            };

            validEmployees.push({
              name: rawName,
              email,
              designation,
              department,
              basicSalary: Number(rawSalary),
              joiningDate,
              cnic,
              phone,
              emergencyContact,
              gender,
              status,
              avatar,
              attendance: defaultAttendance
            });
          }
        }

        if (errors.length === 0 && validEmployees.length > 0) {
          let nextIdNum = (() => {
            const ids = employees.map(emp => {
              const match = emp.id?.match(/EMP-(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            });
            return ids.length > 0 ? Math.max(...ids) : 0;
          })();

          const newEmployees = validEmployees.map(emp => {
            nextIdNum++;
            const id = `EMP-${String(nextIdNum).padStart(3, '0')}`;
            return { ...emp, id };
          });

          setEmployees(prev => [...newEmployees, ...prev]);
          setSuccessCount(newEmployees.length);
          setShowSuccessModal(true);
        } else if (errors.length > 0) {
          setUploadErrors(errors);
          setShowErrorModal(true);
        }
      } catch (err) {
        setUploadErrors([{
          row: 0,
          cell: 'System Parser',
          message: `Failed to parse file: ${err.message}`
        }]);
        setShowErrorModal(true);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Switch column visibility
  const toggleColumnVisibility = (colId) => {
    setVisibleColumns(prev => {
      if (prev.includes(colId)) {
        // Keep at least Code and Name
        if (colId === 'id' || colId === 'name') return prev;
        return prev.filter(c => c !== colId);
      }
      return [...prev, colId];
    });
  };

  // Drag and Drop horizontal reordering logic
  const [draggingColId, setDraggingColId] = useState(null);
  
  const handleDragStart = (e, colId) => {
    setDraggingColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    if (!draggingColId || draggingColId === colId) return;

    const newOrder = [...columnOrder];
    const dragIdx = newOrder.indexOf(draggingColId);
    const dropIdx = newOrder.indexOf(colId);

    newOrder.splice(dragIdx, 1);
    newOrder.splice(dropIdx, 0, draggingColId);

    setColumnOrder(newOrder);
    setDraggingColId(null);
  };

  // Drag Resizer handler
  const handleResizeStart = (e, colId) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[colId] || 150;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(90, startWidth + deltaX);
      setColumnWidths(prev => {
        const next = { ...prev, [colId]: newWidth };
        localStorage.setItem('hr_directory_column_widths', JSON.stringify(next));
        return next;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Status direct toggler
  const handleStatusToggle = (empId) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === empId) {
        return { ...emp, status: emp.status === 'Active' ? 'Inactive' : 'Active' };
      }
      return emp;
    }));
  };

  // Form actions
  const openAddDialog = () => {
    const nextId = generateNextId();
    setFormData({
      id: nextId,
      name: '',
      designation: '',
      department: '',
      basicSalary: '',
      status: 'Active',
      joiningDate: new Date().toISOString().split('T')[0],
      email: '',
      cnic: '',
      phone: '',
      emergencyContact: '',
      gender: 'Male'
    });
    setShowAddModal(true);
  };

  const openEditDialog = (emp) => {
    setFormData({
      id: emp.id || '',
      name: emp.name || '',
      designation: emp.designation || 'Associate',
      department: emp.department || 'Not Assigned',
      basicSalary: emp.basicSalary || '',
      status: emp.status || 'Active',
      joiningDate: emp.joiningDate || '',
      email: emp.email || '',
      cnic: emp.cnic || '',
      phone: emp.phone || '',
      emergencyContact: emp.emergencyContact || '',
      gender: emp.gender || 'Male'
    });
    setActiveEmployee(emp);
    setShowEditModal(true);
  };

  const saveNewEmployee = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;

    const newEmp = {
      ...formData,
      basicSalary: Number(formData.basicSalary) || 0,
      avatar: formData.gender === 'Female' 
        ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuCn3SSz92LFI9hxwIIua341y0Vk9RCfSUb73oEn-VVNj7TmuPAbUpxc5diuDgctbJLGZEYnB2NkxJOGQkAutKroqUzbiiPg5tZ35TZ4mB4deMWmghyInmaR-CKo6JQlhVlzoMcAOpwq474aLc5AN5HgChCuKEeEIRkWuADeVQjNG5dIiWhX8KCrnrGJpB9VnNVqxr4875Cv7-0C-Su2NM0tEUvAefPHo6hN550yGwLI2EfANf0_2TSNathkvq5nm8Z1gOtfXl2HlWA7'
        : 'https://lh3.googleusercontent.com/aida-public/AB6AXuClMLNdCsT5GgLghPen8kRTvtQ6NO8OmGafManVab4n1fSK2cEWQYaPVSZcrCtCNnXryjClCAWxFdcpBDkP77BTwlVEj_EAgY92iVUNIBSEt3YK7L0_6W4MXFCVvFNSWQLhN0wwRPdDrdbjUPxZDfckGiO-dU7o9X7r-iwDAuTbMGxQwE1rcpPjLJdo0hdNqhC7RCEFzkhQwFU3jAymjR_dgRqQryVcgMm7LVk91xP8IgRuDrZUKgwxFEAYGefnEtaIE-xV3X4oHFzg'
    };

    setEmployees(prev => [newEmp, ...prev]);
    setShowAddModal(false);
  };

  const saveEditedEmployee = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;

    setEmployees(prev => prev.map(emp => {
      if (emp.id === activeEmployee.id) {
        return {
          ...emp,
          ...formData,
          basicSalary: Number(formData.basicSalary) || 0
        };
      }
      return emp;
    }));
    setShowEditModal(false);
    setActiveEmployee(null);
  };

  const openDeleteConfirm = (emp) => {
    setActiveEmployee(emp);
    setShowDeleteConfirm(true);
  };

  const executeDelete = () => {
    setEmployees(prev => prev.filter(emp => emp.id !== activeEmployee.id));
    setShowDeleteConfirm(false);
    setActiveEmployee(null);
  };

  if (isMobile) {
    return renderMobileView();
  }

  return renderDesktopView();

  // ==========================================
  // DESKTOP DIRECTORY VIEW
  // ==========================================
  function renderDesktopView() {
    const activeOrderedColumns = columnOrder.filter(colId => visibleColumns.includes(colId));
    const itemsPerPage = 20;
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
    const displayedEmployees = showAllEmployees 
      ? filteredEmployees 
      : filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    return (
      <div className="bg-surface-container-low rounded-3xl border border-outline-variant/15 shadow-2xl p-6 select-none animate-fade-in flex flex-col w-full h-full min-h-[calc(100vh-5rem)] flex-1 overflow-hidden">
        {/* Top Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-headline text-display-md text-on-surface font-extrabold tracking-tight">Employee Directory</h1>
            <p className="font-body text-xs text-on-surface-variant mt-1">Manage personnel records, salaries, and system configurations.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employees..."
                className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none w-64 font-body transition-all"
              />
            </div>

            {/* Download Template */}
            <button 
              onClick={downloadCSVTemplate}
              className="border border-outline-variant/30 text-on-surface hover:bg-surface-container font-headline font-bold text-xs py-2.5 px-4 rounded-xl transition-all active:scale-[0.97] flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download Template
            </button>

            {/* Bulk Upload */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-secondary text-on-secondary font-headline font-bold text-xs py-2.5 px-4 rounded-xl shadow-[0_8px_16px_rgba(0,0,0,0.05)] hover:bg-secondary/90 transition-all active:scale-[0.97] flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Bulk Upload
            </button>

            {/* Custom CTA Add Employee */}
            <button 
              onClick={openAddDialog}
              className="bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold text-xs py-2.5 px-5 rounded-xl shadow-[0_8px_16px_rgba(0,66,119,0.1)] hover:shadow-[0_12px_24px_rgba(0,66,119,0.15)] transition-all active:scale-[0.97] flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Add Employee
            </button>
          </div>
        </div>

        {/* Dynamic Data Table Container */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] border border-outline-variant/10 flex-1 flex flex-col overflow-hidden relative">
          {/* Header Action Bar */}
          <div className="px-6 py-3 flex justify-between items-center border-b border-surface-container bg-surface/30 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-headline font-extrabold text-on-surface text-xs tracking-tight">All Personnel</span>
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {filteredEmployees.length} Found
              </span>
            </div>
            
            {/* Column Customizer Trigger */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowColMenu(prev => !prev)}
                className="text-outline hover:text-primary transition-colors flex items-center justify-center p-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer border border-outline-variant/10"
                title="Column Settings"
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>

              {/* Column Settings dropdown */}
              {showColMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-xl z-50 animate-scale-up text-on-surface">
                  <div className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface-variant mb-2">Configure Columns</div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {ALL_COLUMNS.map(col => {
                      const isChecked = visibleColumns.includes(col.id);
                      const isProtected = col.id === 'id' || col.id === 'name';
                      
                      return (
                        <label 
                          key={col.id} 
                          className={`flex items-center gap-3 p-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                            isProtected ? 'opacity-50 cursor-not-allowed bg-surface-container-low' : 'hover:bg-surface-container-low'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            disabled={isProtected}
                            onChange={() => toggleColumnVisibility(col.id)}
                            className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                          <span>{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table Canvas Grid */}
          <div 
            style={{ 
              overflowY: 'auto'
            }}
            className="flex-1 overflow-auto smooth-scroll table-gradient-shadow relative h-full min-h-0 w-full"
          >
            <table className="text-left border-collapse w-full" style={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
              <thead className="glass-header sticky top-0 z-30 shadow-[0_2px_10px_rgba(0,0,0,0.015)]">
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-body border-b border-surface-container">
                  {activeOrderedColumns.map(colId => {
                    const col = ALL_COLUMNS.find(c => c.id === colId);
                    const width = columnWidths[colId] || 150;
                    
                    return (
                      <th 
                        key={colId}
                        style={{ width, minWidth: width, maxWidth: width }}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, colId)}
                        onDragOver={(e) => handleDragOver(e, colId)}
                        onDrop={(e) => handleDrop(e, colId)}
                        className={`px-5 py-3.5 relative select-none cursor-grab group hover:bg-surface-container-low transition-colors ${
                          colId === 'id' ? 'sticky left-0 bg-surface-container-lowest shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-surface-container' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{col?.label}</span>
                          <span className="material-symbols-outlined text-[13px] opacity-0 group-hover:opacity-100 text-outline-variant transition-opacity cursor-grab">
                            drag_indicator
                          </span>
                        </div>

                        {/* Persistent Resize handle */}
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, colId)}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary transition-colors z-40"
                        />
                      </th>
                    );
                  })}
                  <th className="px-5 py-3.5 w-28 text-center sticky right-0 bg-surface-container-lowest border-l border-surface-container shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="text-xs font-medium text-on-surface divide-y divide-outline-variant/10">
                {displayedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={activeOrderedColumns.length + 1} className="text-center py-16 text-on-surface-variant font-body text-xs">
                      No matching employee records found.
                    </td>
                  </tr>
                ) : (
                  displayedEmployees.map(emp => {
                    const isInactive = emp.status === 'Inactive';
                    
                    return (
                      <tr 
                        key={emp.id}
                        className={`group hover:bg-surface-container-low/40 transition-colors border-b border-surface-container last:border-0 ${
                          isInactive ? 'bg-surface-container-low/20 opacity-80' : ''
                        }`}
                      >
                        {activeOrderedColumns.map(colId => {
                          const width = columnWidths[colId] || 150;
                          
                          // Format cell content
                          let content = '';
                          if (colId === 'id') {
                            content = <span className="font-mono font-bold text-secondary text-[11px]">{emp.id}</span>;
                          } else if (colId === 'name') {
                            content = (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/15 flex-shrink-0 bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs">
                                  {emp.avatar ? (
                                    <img src={emp.avatar} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    emp.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className={`font-bold text-on-surface truncate ${isInactive ? 'line-through' : ''}`}>{emp.name}</div>
                                  <div className="text-[10px] text-on-surface-variant truncate">{emp.email || 'N/A'}</div>
                                </div>
                              </div>
                            );
                          } else if (colId === 'status') {
                            content = (
                              <button 
                                onClick={() => handleStatusToggle(emp.id)}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border transition-colors cursor-pointer ${
                                  emp.status === 'Active' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20'
                                }`}
                              >
                                {emp.status}
                              </button>
                            );
                          } else if (colId === 'basicSalary') {
                            content = <span className="font-mono text-right font-bold">${Number(emp.basicSalary).toLocaleString()}</span>;
                          } else if (colId === 'joiningDate') {
                            content = <span>{emp.joiningDate || 'N/A'}</span>;
                          } else {
                            content = <span className="truncate block">{emp[colId] || 'N/A'}</span>;
                          }

                          return (
                            <td 
                              key={colId}
                              style={{ width, minWidth: width, maxWidth: width }}
                              className={`px-5 py-3.5 align-middle ${
                                colId === 'id' ? 'sticky left-0 bg-surface-container-lowest group-hover:bg-surface-container-low/40 z-10 border-r border-surface-container shadow-[2px_0_5px_-2px_rgba(0,0,0,0.03)]' : ''
                              }`}
                            >
                              {content}
                            </td>
                          );
                        })}

                        {/* Dynamic actions sticky column */}
                        <td className="px-5 py-3.5 w-28 text-center sticky right-0 bg-surface-container-lowest group-hover:bg-surface-container-low/40 z-10 border-l border-surface-container shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.03)] align-middle">
                          <div className="flex justify-center items-center gap-1.5">
                            <button 
                              onClick={() => openEditDialog(emp)}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-outline-variant hover:bg-surface-container hover:text-primary transition-all cursor-pointer"
                              title="Edit Employee"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button 
                              onClick={() => openDeleteConfirm(emp)}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-outline-variant hover:bg-error-container/20 hover:text-error transition-all cursor-pointer"
                              title="Delete Record"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination & List-view control footer */}
          <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold text-on-surface-variant shrink-0 z-20">
            <div className="flex flex-wrap items-center gap-6">
              <span>Showing <b>{displayedEmployees.length}</b> employees of <b>{filteredEmployees.length}</b> total</span>
              <div className="font-semibold text-primary">
                Active: {employees.filter(e => e.status === 'Active').length} • Inactive: {employees.filter(e => e.status === 'Inactive').length}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Pagination Toggle */}
              <div className="flex items-center gap-2 pr-4 border-r border-outline-variant/20 select-none">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Show All At Once</span>
                <label className="erp-toggle">
                  <input 
                    type="checkbox"
                    checked={showAllEmployees}
                    onChange={() => setShowAllEmployees(!showAllEmployees)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {!showAllEmployees && (
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span>Page {currentPage} of {totalPages || 1}</span>
                  <button 
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1.5 hover:bg-white rounded-lg border border-outline-variant/10 bg-surface-container-lowest transition-colors active:scale-95 cursor-pointer flex items-center justify-center disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modals rendering */}
        {showAddModal && renderAddEditModal(true)}
        {showEditModal && renderAddEditModal(false)}
        {showDeleteConfirm && renderDeleteConfirmModal()}
        {showErrorModal && renderUploadErrorModal()}
        {showSuccessModal && renderUploadSuccessModal()}

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".csv" 
          onChange={handleFileUpload} 
        />
      </div>
    );
  }

  // ==========================================
  // MOBILE DIRECTORY VIEW
  // ==========================================
  function renderMobileView() {
    return (
      <div className="flex flex-col gap-6 select-none animate-fade-in pb-20 w-full h-[calc(100vh-14rem)] overflow-hidden">
        {/* Mobile Welcome Header */}
        <header className="flex flex-col gap-1 shrink-0 px-2">
          <h1 className="font-headline text-2xl font-black text-on-surface tracking-tight leading-tight">Employee Directory</h1>
          <p className="font-body text-[10px] text-on-surface-variant font-bold uppercase tracking-wider text-primary">HR Database Management</p>
        </header>

        {/* Mobile Search and Filter Actions Bar */}
        <div className="flex gap-2.5 shrink-0 px-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search directory..."
              className="w-full bg-surface-container-lowest border border-outline-variant/15 rounded-xl py-2 pl-9 pr-4 text-xs text-on-surface outline-none focus:border-primary/50 transition-all font-body"
            />
          </div>
          <button 
            onClick={openAddDialog}
            className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>

        {/* Mobile Bulk Actions */}
        <div className="flex gap-2 shrink-0 px-2 mt-[-12px]">
          <button 
            onClick={downloadCSVTemplate}
            className="flex-1 py-2 bg-surface-container-lowest border border-outline-variant/15 text-on-surface font-headline font-bold text-[10px] rounded-xl flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            Template
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 bg-secondary text-on-secondary font-headline font-bold text-[10px] rounded-xl flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">upload_file</span>
            Bulk Upload
          </button>
        </div>

        {/* Mobile List area */}
        <div className="flex-1 overflow-y-auto px-2 space-y-3 custom-scrollbar">
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant font-body text-xs">
              No matching employees found.
            </div>
          ) : (
            filteredEmployees.map(emp => {
              const isInactive = emp.status === 'Inactive';
              
              return (
                <div 
                  key={emp.id}
                  className={`bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/10 flex flex-col gap-3 relative transition-all ${
                    isInactive ? 'opacity-70 bg-surface-container-low/30' : ''
                  }`}
                >
                  {/* Top card section */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-outline-variant/15 flex-shrink-0 bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs">
                        {emp.avatar ? (
                          <img src={emp.avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          emp.name.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`font-headline text-xs font-black text-on-surface leading-tight truncate ${isInactive ? 'line-through' : ''}`}>
                          {emp.name}
                        </h3>
                        <p className="font-mono text-[9px] text-primary font-bold mt-0.5">{emp.id}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleStatusToggle(emp.id)}
                      className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border tracking-wider transition-colors cursor-pointer ${
                        emp.status === 'Active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-surface text-on-surface-variant border-outline-variant/20'
                      }`}
                    >
                      {emp.status}
                    </button>
                  </div>

                  {/* Detail grids */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-2.5 bg-surface-container-low/55 rounded-xl text-[10px] font-semibold text-on-surface-variant font-body">
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-outline block">Designation</span>
                      <span className="text-on-surface truncate block">{emp.designation || 'Associate'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-outline block">Department</span>
                      <span className="text-on-surface truncate block">{emp.department || 'Not Assigned'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-outline block">Salary</span>
                      <span className="font-mono text-on-surface font-bold">${Number(emp.basicSalary || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-outline block">Primary Number</span>
                      <span className="text-on-surface truncate block">{emp.phone || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Actions buttons footer */}
                  <div className="flex justify-end gap-2 border-t border-outline-variant/5 pt-2.5">
                    <button 
                      onClick={() => openEditDialog(emp)}
                      className="px-3.5 py-1.5 rounded-lg border border-outline-variant/15 text-[10px] font-bold text-on-surface hover:bg-surface-container flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                      Edit
                    </button>
                    <button 
                      onClick={() => openDeleteConfirm(emp)}
                      className="px-3.5 py-1.5 rounded-lg border border-error-container/20 text-[10px] font-bold text-error bg-error-container/5 hover:bg-error-container/20 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modals rendering */}
        {showAddModal && renderAddEditModal(true)}
        {showEditModal && renderAddEditModal(false)}
        {showDeleteConfirm && renderDeleteConfirmModal()}
        {showErrorModal && renderUploadErrorModal()}
        {showSuccessModal && renderUploadSuccessModal()}

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".csv" 
          onChange={handleFileUpload} 
        />
      </div>
    );
  }

  // ==========================================
  // SHARED FORM DIALOG MODAL (ADD & EDIT)
  // ==========================================
  function renderAddEditModal(isAdd) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-2xl border border-outline-variant/20 shadow-2xl relative animate-scale-up text-on-surface max-h-[90vh] overflow-y-auto custom-scrollbar select-none">
          <header className="flex justify-between items-center mb-5 shrink-0">
            <div>
              <h3 className="font-headline font-black text-md text-on-surface">
                {isAdd ? 'Create Employee Profile' : 'Edit Employee Profile'}
              </h3>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mt-0.5">
                {isAdd ? `Auto-generated ID: ${formData.id}` : `ID: ${formData.id}`}
              </p>
            </div>
            <button 
              onClick={() => { isAdd ? setShowAddModal(false) : setShowEditModal(false); }}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </header>

          <form onSubmit={isAdd ? saveNewEmployee : saveEditedEmployee} className="space-y-4 font-body text-xs">
            {/* Grid fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Full Name *</label>
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. John Doe"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Email Address</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="e.g. john.doe@company.com"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Designation */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Designation</label>
                <input 
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({...formData, designation: e.target.value})}
                  placeholder="e.g. Senior Project Architect"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Department */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Department</label>
                <input 
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  placeholder="e.g. Operations, Marketing"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Basic Salary */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Basic Salary *</label>
                <input 
                  type="number"
                  required
                  value={formData.basicSalary}
                  onChange={(e) => setFormData({...formData, basicSalary: e.target.value})}
                  placeholder="e.g. 75000"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Joining Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Date of Joining</label>
                <input 
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({...formData, joiningDate: e.target.value})}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* CNIC Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">CNIC Number</label>
                <input 
                  type="text"
                  value={formData.cnic}
                  onChange={(e) => setFormData({...formData, cnic: e.target.value})}
                  placeholder="e.g. 42101-1234567-8"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Primary Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Primary Number *</label>
                <input 
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="e.g. +1 (555) 019-2834"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Emergency Contact Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Emergency Contact</label>
                <input 
                  type="tel"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                  placeholder="e.g. +1 (555) 019-9999"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary/50 focus:ring-0 outline-none transition-all"
                />
              </div>

              {/* Gender and Status Dual Columns */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Gender</label>
                  <select 
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:ring-0 outline-none transition-all cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:ring-0 outline-none transition-all cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-5 border-t border-outline-variant/10 shrink-0">
              <button 
                type="button"
                onClick={() => { isAdd ? setShowAddModal(false) : setShowEditModal(false); }}
                className="px-4 py-2.5 border border-outline-variant/20 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container transition-all active:scale-[0.97] cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container transition-all active:scale-[0.97] shadow-md hover:shadow-lg cursor-pointer"
              >
                {isAdd ? 'Create Profile' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // UPLOAD ERROR MODAL
  // ==========================================
  function renderUploadErrorModal() {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-xl border border-error/20 shadow-2xl relative animate-scale-up text-on-surface max-h-[80vh] flex flex-col overflow-hidden select-none">
          <header className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-[28px]">error</span>
              <div>
                <h3 className="font-headline font-black text-md text-error leading-tight">
                  Bulk Upload Validation Failed
                </h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">
                  Transactional Blocked • All-or-Nothing Rule Enforced
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowErrorModal(false)}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </header>

          <div className="bg-error/5 border border-error/10 rounded-2xl p-4 mb-4 text-xs font-body leading-relaxed text-error-container shrink-0">
            <strong>Import aborted.</strong> We found <strong>{uploadErrors.length} validation errors</strong> in your CSV file. Please fix these issues in your spreadsheet and try uploading again. No database changes were saved.
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar border border-outline-variant/10 rounded-2xl divide-y divide-outline-variant/10 bg-surface-container-low/40">
            {uploadErrors.map((err, idx) => (
              <div key={idx} className="p-3.5 flex items-start gap-3 hover:bg-error/5 transition-colors">
                <span className="bg-error/10 text-error font-mono font-black text-[10px] px-2 py-0.5 rounded-md shrink-0 mt-0.5">
                  {err.row > 0 ? `Row ${err.row}` : 'System'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-headline font-bold text-xs text-on-surface">
                    Cell '{err.cell}'
                  </div>
                  <div className="font-body text-xs text-on-surface-variant mt-0.5">
                    {err.message}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-outline-variant/10 mt-4 shrink-0">
            <button 
              onClick={() => setShowErrorModal(false)}
              className="px-5 py-2.5 bg-error text-white font-bold rounded-xl text-xs hover:bg-error/95 transition-all active:scale-[0.97] cursor-pointer shadow-md"
            >
              Dismiss and Fix File
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // UPLOAD SUCCESS MODAL
  // ==========================================
  function renderUploadSuccessModal() {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm border border-emerald-500/20 shadow-2xl relative animate-scale-up text-on-surface select-none">
          <div className="flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-emerald-500 text-[48px] mb-3">check_circle</span>
            <h3 className="font-headline font-black text-md text-on-surface">
              Bulk Upload Successful!
            </h3>
            <p className="font-body text-xs text-on-surface-variant mt-2 mb-6">
              Successfully imported <strong className="text-emerald-600">{successCount}</strong> employee records into the active database. Padded employee IDs and standard schedules have been initialized.
            </p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.97] cursor-pointer shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // SHARED DELETE CONFIRMATION DIALOG MODAL
  // ==========================================
  function renderDeleteConfirmModal() {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-sm border border-outline-variant/20 shadow-2xl relative animate-scale-up text-on-surface select-none">
          <h3 className="font-headline font-black text-md text-on-surface mb-2">Delete Directory Record</h3>
          <p className="font-body text-xs text-on-surface-variant mb-6 leading-relaxed">
            Are you sure you want to permanently delete the profile for <span className="font-bold text-on-surface">{activeEmployee?.name}</span>? All records will be wiped from the active databases.
          </p>
          <div className="flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => { setShowDeleteConfirm(false); setActiveEmployee(null); }}
              className="px-4 py-2 border border-outline-variant/20 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container transition-all active:scale-[0.97] cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={executeDelete}
              className="px-5 py-2 bg-error text-white hover:bg-error/95 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer shadow-md hover:shadow-error/15"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    );
  }
}
