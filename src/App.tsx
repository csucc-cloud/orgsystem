import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  CreditCard, 
  CheckCircle, 
  Search, 
  Plus, 
  X, 
  Printer, 
  Mail, 
  ChevronRight,
  UserCircle,
  LayoutDashboard,
  LogOut,
  QrCode,
  History,
  Filter,
  Menu
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from './lib/supabase';
import { cn, formatCurrency } from './lib/utils';
import { Student, Event, Attendance, Payment } from './types';
import { useReactToPrint } from 'react-to-print';
import { Receipt } from './components/Receipt';
import { format } from 'date-fns';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'events' | 'attendance' | 'finance' | 'scanner'>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState<Event | null>(null);
  const [eventAttendance, setEventAttendance] = useState<Attendance[]>([]);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showEventQr, setShowEventQr] = useState<Event | null>(null);
  const [attendanceFeedback, setAttendanceFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null); // payment id
  const [studentSearch, setStudentSearch] = useState('');
  const [financeFilterStudent, setFinanceFilterStudent] = useState<string>('all');
  
  // Refs for printing
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: studentsData } = await supabase.from('students').select('*').order('name');
      const { data: eventsData } = await supabase.from('events').select('*').order('date', { ascending: false });
      const { data: paymentsData } = await supabase.from('payments').select('*, students(*)').order('date', { ascending: false });
      const { data: attendanceData } = await supabase.from('attendance').select('*, students(*), events(*)').order('timestamp', { ascending: false }).limit(10);
      
      setStudents(studentsData || []);
      setEvents(eventsData || []);
      setPayments(paymentsData || []);
      setRecentAttendance(attendanceData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventAttendance = async (eventId: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, students(*)')
      .eq('event_id', eventId);
    
    if (!error) {
      setEventAttendance(data || []);
    }
  };

  useEffect(() => {
    if (showQrScanner) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [showQrScanner]);

  const [lastScannedStudent, setLastScannedStudent] = useState<Student | null>(null);

  const onScanSuccess = async (decodedText: string) => {
    // Assuming QR code contains student_id
    const student = students.find(s => s.student_id === decodedText);
    if (student) {
      setLastScannedStudent(student);
      if (selectedEventForAttendance) {
        const { error } = await supabase.from('attendance').insert([{
          student_id: student.id,
          event_id: selectedEventForAttendance.id,
          status: 'present',
          timestamp: new Date().toISOString()
        }]);

        if (!error) {
          setAttendanceFeedback({ message: `Marked ${student.name} as Present`, type: 'success' });
          fetchEventAttendance(selectedEventForAttendance.id);
          fetchData();
          // Clear feedback after 3 seconds
          setTimeout(() => setAttendanceFeedback(null), 3000);
        } else {
          setAttendanceFeedback({ message: 'Error: ' + error.message, type: 'error' });
        }
      } else {
        setAttendanceFeedback({ message: `Scanned: ${student.name}`, type: 'success' });
        setTimeout(() => setAttendanceFeedback(null), 3000);
      }
    } else {
      setAttendanceFeedback({ message: 'Student ID not found', type: 'error' });
      setTimeout(() => setAttendanceFeedback(null), 3000);
    }
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const handleBulkAttendance = async (eventId: string, status: 'present' | 'absent' | 'late') => {
    if (!confirm(`Mark all students as ${status} for this event?`)) return;

    const attendanceRecords = students.map(student => ({
      student_id: student.id,
      event_id: eventId,
      status: status,
      timestamp: new Date().toISOString()
    }));

    const { error } = await supabase.from('attendance').insert(attendanceRecords);
    if (!error) {
      alert('Bulk attendance recorded!');
      fetchEventAttendance(eventId);
    } else {
      alert('Error recording bulk attendance: ' + error.message);
    }
  };

  const sendReceiptEmail = async (payment: Payment, student: Student) => {
    if (!student.email) {
      setAttendanceFeedback({ message: 'Error: Student email missing', type: 'error' });
      setTimeout(() => setAttendanceFeedback(null), 3000);
      return;
    }
    
    setSendingEmail(payment.id);
    try {
      const response = await fetch('/api/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: student.email,
          studentName: student.name,
          amount: payment.amount,
          purpose: payment.purpose,
          receiptNumber: payment.receipt_number,
          date: format(new Date(payment.date), 'MMMM dd, yyyy')
        })
      });
      if (response.ok) {
        setAttendanceFeedback({ message: 'Receipt sent to email!', type: 'success' });
        await supabase.from('payments').update({ email_sent: true }).eq('id', payment.id);
        fetchData();
        setTimeout(() => setAttendanceFeedback(null), 3000);
      } else {
        const errorData = await response.json();
        setAttendanceFeedback({ message: 'Error: ' + (errorData.error?.message || errorData.error || 'Unknown error'), type: 'error' });
        setTimeout(() => setAttendanceFeedback(null), 5000);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setAttendanceFeedback({ message: 'Failed to send email. Check connection.', type: 'error' });
      setTimeout(() => setAttendanceFeedback(null), 5000);
    } finally {
      setSendingEmail(null);
    }
  };

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newStudent = {
      student_id: formData.get('student_id') as string,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      course: formData.get('course') as string,
      year_level: formData.get('year_level') as string,
    };

    const { error } = await supabase.from('students').insert([newStudent]);
    if (!error) {
      setShowAddStudent(false);
      fetchData();
    }
  };

  const handleAddEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newEvent = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      date: formData.get('date') as string,
      location: formData.get('location') as string,
    };

    const { error } = await supabase.from('events').insert([newEvent]);
    if (!error) {
      setShowAddEvent(false);
      fetchData();
    }
  };

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPayment = {
      student_id: formData.get('student_id') as string,
      amount: parseFloat(formData.get('amount') as string),
      purpose: formData.get('purpose') as string,
      date: new Date().toISOString(),
      receipt_number: `REC-${Date.now().toString().slice(-6)}`,
      email_sent: false
    };

    const { error } = await supabase.from('payments').insert([newPayment]);
    if (!error) {
      setShowAddPayment(false);
      fetchData();
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.student_id.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Sidebar */}
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#141414] bg-[#E4E3E0] sticky top-0 z-50">
        <h1 className="text-lg font-bold uppercase italic font-serif">School Org</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('scanner')}
            className="p-2 border border-[#141414]"
          >
            <QrCode size={18} />
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 border border-[#141414]"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 md:hidden bg-[#E4E3E0] pt-20"
          >
            <div className="flex flex-col h-full">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'scanner', label: 'Scanner', icon: QrCode },
                { id: 'students', label: 'Students', icon: Users },
                { id: 'events', label: 'Events', icon: Calendar },
                { id: 'attendance', label: 'Attendance', icon: CheckCircle },
                { id: 'finance', label: 'Finance', icon: CreditCard },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-8 py-6 text-sm uppercase tracking-widest transition-all border-b border-[#141414]/10",
                    activeTab === item.id && "bg-[#141414] text-[#E4E3E0]"
                  )}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
              <div className="mt-auto p-8 border-t border-[#141414]">
                <button className="flex items-center gap-2 text-xs uppercase opacity-50">
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed left-0 top-0 h-full w-64 border-r border-[#141414] bg-[#E4E3E0] z-40 hidden md:flex flex-col">
        <div className="p-8 border-b border-[#141414]">
          <h1 className="text-xl font-bold uppercase tracking-tighter italic font-serif">School Org</h1>
          <p className="text-[10px] uppercase opacity-50 tracking-widest mt-1">Management System</p>
        </div>
        
        <div className="flex-1 py-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'scanner', label: 'Scanner', icon: QrCode },
            { id: 'students', label: 'Students', icon: Users },
            { id: 'events', label: 'Events', icon: Calendar },
            { id: 'attendance', label: 'Attendance', icon: CheckCircle },
            { id: 'finance', label: 'Finance', icon: CreditCard },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-4 px-8 py-4 text-sm uppercase tracking-widest transition-all hover:bg-[#141414] hover:text-[#E4E3E0]",
                activeTab === item.id && "bg-[#141414] text-[#E4E3E0]"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-8 border-t border-[#141414]">
          <button className="flex items-center gap-2 text-xs uppercase opacity-50 hover:opacity-100 transition-opacity">
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 p-8 min-h-screen">
        <header className="flex justify-between items-end mb-12 border-b border-[#141414] pb-8">
          <div>
            <h2 className="text-4xl font-serif italic capitalize">{activeTab}</h2>
            <p className="text-xs uppercase opacity-50 tracking-widest mt-2">
              {format(new Date(), 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('scanner')}
              className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
              title="Quick QR Scan"
            >
              <QrCode size={18} />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
              <input 
                type="text" 
                placeholder="SEARCH..."
                className="bg-transparent border border-[#141414] pl-10 pr-4 py-2 text-xs uppercase tracking-widest focus:outline-none focus:bg-[#141414] focus:text-[#E4E3E0] transition-all w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {activeTab === 'students' && (
              <button onClick={() => setShowAddStudent(true)} className="bg-[#141414] text-[#E4E3E0] px-6 py-2 text-xs uppercase tracking-widest hover:bg-opacity-80 transition-all flex items-center gap-2">
                <Plus size={14} /> Add Student
              </button>
            )}
            {activeTab === 'events' && (
              <button onClick={() => setShowAddEvent(true)} className="bg-[#141414] text-[#E4E3E0] px-6 py-2 text-xs uppercase tracking-widest hover:bg-opacity-80 transition-all flex items-center gap-2">
                <Plus size={14} /> Add Event
              </button>
            )}
            {activeTab === 'finance' && (
              <button onClick={() => setShowAddPayment(true)} className="bg-[#141414] text-[#E4E3E0] px-6 py-2 text-xs uppercase tracking-widest hover:bg-opacity-80 transition-all flex items-center gap-2">
                <Plus size={14} /> Record Payment
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#141414]"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                <div className="border border-[#141414] p-8">
                  <p className="text-[10px] uppercase opacity-50 tracking-widest mb-4">Total Students</p>
                  <p className="text-6xl font-serif italic">{students.length}</p>
                </div>
                <div className="border border-[#141414] p-8">
                  <p className="text-[10px] uppercase opacity-50 tracking-widest mb-4">Upcoming Events</p>
                  <p className="text-6xl font-serif italic">{events.length}</p>
                </div>
                <div className="border border-[#141414] p-8">
                  <p className="text-[10px] uppercase opacity-50 tracking-widest mb-4">Total Revenue</p>
                  <p className="text-6xl font-serif italic">
                    {formatCurrency(payments.reduce((acc, curr) => acc + curr.amount, 0))}
                  </p>
                </div>

                {/* Quick Scan Section */}
                <div className="md:col-span-3 border border-[#141414] p-12 bg-[#141414] text-[#E4E3E0] flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="text-center md:text-left">
                    <h3 className="text-3xl font-serif italic mb-2">Ready to Scan?</h3>
                    <p className="text-xs uppercase tracking-widest opacity-50">Quickly record attendance for your events using QR codes.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('scanner')}
                    className="bg-[#E4E3E0] text-[#141414] px-12 py-4 text-sm uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-3"
                  >
                    <QrCode size={20} /> Open Scanner
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'scanner' && (
              <motion.div 
                key="scanner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="border border-[#141414] p-12 bg-white/50">
                  <div className="text-center mb-12">
                    <QrCode size={48} className="mx-auto mb-6 opacity-20" />
                    <h3 className="text-3xl font-serif italic mb-2">QR Attendance Scanner</h3>
                    <p className="text-xs uppercase tracking-widest opacity-50">Select an event below to start scanning student IDs.</p>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest opacity-50">Active Event</label>
                      <select 
                        className="w-full bg-transparent border-b border-[#141414] py-4 text-xl font-serif italic focus:outline-none"
                        value={selectedEventForAttendance?.id || ''}
                        onChange={(e) => {
                          const event = events.find(ev => ev.id === e.target.value);
                          if (event) {
                            setSelectedEventForAttendance(event);
                            fetchEventAttendance(event.id);
                          } else {
                            setSelectedEventForAttendance(null);
                          }
                        }}
                      >
                        <option value="">Select Event...</option>
                        {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </select>
                    </div>

                    {selectedEventForAttendance ? (
                      <div className="space-y-6 pt-8">
                        <div className="p-24 border-2 border-dashed border-[#141414]/20 flex flex-col items-center justify-center text-center relative overflow-hidden bg-white">
                          <QrCode size={64} className="opacity-10 mb-6" />
                          <p className="text-xs uppercase tracking-widest font-bold mb-8">Camera Ready</p>
                          <button 
                            onClick={() => setShowQrScanner(true)}
                            className="bg-[#141414] text-[#E4E3E0] px-12 py-4 text-xs uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
                          >
                            Launch Scanner
                          </button>
                        </div>

                        <div className="pt-6">
                          <label className="text-[10px] uppercase tracking-widest opacity-50 mb-2 block">Manual ID Entry</label>
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              const input = e.currentTarget.elements.namedItem('manual_id') as HTMLInputElement;
                              if (input.value) {
                                onScanSuccess(input.value);
                                input.value = '';
                              }
                            }}
                            className="flex gap-2"
                          >
                            <input 
                              name="manual_id"
                              type="text" 
                              placeholder="TYPE ID NUMBER..."
                              className="flex-1 bg-transparent border border-[#141414] px-4 py-2 text-xs uppercase tracking-widest focus:outline-none focus:bg-[#141414] focus:text-[#E4E3E0] transition-all"
                            />
                            <button type="submit" className="bg-[#141414] text-[#E4E3E0] px-6 py-2 text-xs uppercase tracking-widest">Enter</button>
                          </form>
                        </div>
                        
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest opacity-50">
                          <span>Scanning for: {selectedEventForAttendance.title}</span>
                          <button onClick={() => setActiveTab('attendance')} className="underline">View Full List</button>
                        </div>

                        {/* Recent Scans in this tab */}
                        <div className="pt-8 border-t border-[#141414]/10">
                          {lastScannedStudent && (
                            <div className="mb-8 p-6 bg-[#141414] text-[#E4E3E0] border border-[#141414]">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest opacity-50">Last Scanned</p>
                                  <h4 className="text-xl font-serif italic">{lastScannedStudent.name}</h4>
                                  <p className="text-[10px] font-mono opacity-50">{lastScannedStudent.student_id}</p>
                                </div>
                                <button onClick={() => setLastScannedStudent(null)}><X size={14} /></button>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setFinanceFilterStudent(lastScannedStudent.student_id);
                                    setActiveTab('finance');
                                  }}
                                  className="flex-1 bg-[#E4E3E0] text-[#141414] py-2 text-[10px] uppercase tracking-widest font-bold"
                                >
                                  Record Payment
                                </button>
                                <button 
                                  onClick={() => {
                                    setStudentSearch(lastScannedStudent.student_id);
                                    setActiveTab('students');
                                  }}
                                  className="flex-1 border border-[#E4E3E0] py-2 text-[10px] uppercase tracking-widest"
                                >
                                  View Profile
                                </button>
                              </div>
                            </div>
                          )}

                          <h4 className="text-[10px] uppercase tracking-widest font-bold mb-4">Recent Scans</h4>
                          <div className="space-y-2">
                            {eventAttendance.slice(0, 5).map(att => (
                              <div key={att.id} className="flex justify-between items-center p-3 bg-white border border-[#141414]/10 text-xs">
                                <span className="font-bold">{att.students?.name}</span>
                                <span className="opacity-50 font-mono">{format(new Date(att.timestamp), 'HH:mm:ss')}</span>
                              </div>
                            ))}
                            {eventAttendance.length === 0 && (
                              <p className="text-center py-4 text-[10px] uppercase opacity-30">No scans yet</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-12 bg-[#141414]/5 text-center">
                        <p className="text-xs uppercase tracking-widest opacity-30 italic">Please select an event to enable scanning.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div 
                key="students"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border border-[#141414]"
              >
                <div className="grid grid-cols-[80px_1.5fr_1fr_1fr_1fr] p-4 border-b border-[#141414] bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest">
                  <div>ID</div>
                  <div>Name</div>
                  <div>Course</div>
                  <div>Year</div>
                  <div>Actions</div>
                </div>
                {filteredStudents.map((student) => (
                  <div 
                    key={student.id} 
                    className="grid grid-cols-[80px_1.5fr_1fr_1fr_1fr] p-4 border-b border-[#141414] last:border-0 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group cursor-pointer"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="font-mono text-xs">{student.student_id}</div>
                    <div className="font-bold">{student.name}</div>
                    <div className="text-xs opacity-70 group-hover:opacity-100">{student.course}</div>
                    <div className="text-xs opacity-70 group-hover:opacity-100">{student.year_level}</div>
                    <div className="flex gap-2">
                      <button className="text-[10px] uppercase underline tracking-tighter">Profile</button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'events' && (
              <motion.div 
                key="events"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                {events.map((event) => (
                  <div key={event.id} className="border border-[#141414] p-8 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="text-2xl font-serif italic">{event.title}</h3>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-100">
                        {format(new Date(event.date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <p className="text-sm opacity-70 group-hover:opacity-100 mb-8 leading-relaxed">
                      {event.description}
                    </p>
                    <div className="flex justify-between items-center pt-4 border-t border-[#141414] group-hover:border-[#E4E3E0]">
                      <span className="text-[10px] uppercase tracking-widest">{event.location}</span>
                      <button 
                        onClick={() => {
                          setSelectedEventForAttendance(event);
                          fetchEventAttendance(event.id);
                        }}
                        className="text-[10px] uppercase underline tracking-tighter"
                      >
                        View Attendance
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'attendance' && (
              <motion.div 
                key="attendance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="border border-[#141414] p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase tracking-widest opacity-50 mb-2 block">Select Event to Start Attendance</label>
                      <select 
                        name="event_id" 
                        required 
                        className="w-full bg-transparent border-b border-[#141414] py-4 text-2xl font-serif italic focus:outline-none"
                        value={selectedEventForAttendance?.id || ''}
                        onChange={(e) => {
                          const event = events.find(ev => ev.id === e.target.value);
                          if (event) {
                            setSelectedEventForAttendance(event);
                            fetchEventAttendance(event.id);
                          } else {
                            setSelectedEventForAttendance(null);
                            setEventAttendance([]);
                          }
                        }}
                      >
                        <option value="">Select Event...</option>
                        {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </select>
                    </div>
                    {selectedEventForAttendance && (
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowEventQr(selectedEventForAttendance)}
                          className="px-6 py-2 border border-[#141414] text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all flex items-center gap-2"
                        >
                          <QrCode size={14} />
                          Event QR
                        </button>
                        <button 
                          onClick={() => handleBulkAttendance(selectedEventForAttendance.id, 'present')}
                          className="px-6 py-2 border border-[#141414] text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                        >
                          Mark All Present
                        </button>
                        <button 
                          onClick={() => handleBulkAttendance(selectedEventForAttendance.id, 'absent')}
                          className="px-6 py-2 border border-[#141414] text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                        >
                          Mark All Absent
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {selectedEventForAttendance ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 space-y-8">
                      {/* Scanner Card */}
                      <div className="border border-[#141414] p-8 bg-white/50">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-serif italic">Scanner</h3>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setShowQrScanner(true)}
                              className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                              title="Open QR Scanner"
                            >
                              <QrCode size={18} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                          <div className="p-12 border-2 border-dashed border-[#141414]/20 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <QrCode size={48} className="opacity-10 mb-4" />
                            <p className="text-[10px] uppercase tracking-widest opacity-50">Ready to Scan</p>
                            <button 
                              onClick={() => setShowQrScanner(true)}
                              className="mt-4 text-xs underline uppercase tracking-widest font-bold hover:opacity-70 transition-opacity"
                            >
                              Launch Camera
                            </button>
                          </div>

                          <div className="pt-6 border-t border-[#141414]/10">
                            <label className="text-[10px] uppercase tracking-widest opacity-50 mb-2 block">Manual Student ID Input</label>
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                const input = e.currentTarget.elements.namedItem('manual_id') as HTMLInputElement;
                                if (input.value) {
                                  onScanSuccess(input.value);
                                  input.value = '';
                                }
                              }}
                              className="flex gap-2"
                            >
                              <input 
                                name="manual_id"
                                type="text" 
                                placeholder="TYPE ID NUMBER..."
                                className="flex-1 bg-transparent border border-[#141414] px-4 py-2 text-xs uppercase tracking-widest focus:outline-none focus:bg-[#141414] focus:text-[#E4E3E0] transition-all"
                              />
                              <button type="submit" className="bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs uppercase tracking-widest">Enter</button>
                            </form>
                          </div>
                        </div>
                      </div>

                      {/* Manual Selection Card */}
                      <div className="border border-[#141414] p-8">
                        <h3 className="text-xl font-serif italic mb-6">Manual Selection</h3>
                        <div className="mb-4">
                          <input 
                            type="text" 
                            placeholder="SEARCH STUDENT..."
                            className="w-full bg-transparent border border-[#141414] px-4 py-2 text-[10px] uppercase tracking-widest focus:outline-none"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                          />
                        </div>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const { error } = await supabase.from('attendance').insert([{
                            student_id: formData.get('student_id'),
                            event_id: selectedEventForAttendance.id,
                            status: formData.get('status'),
                            timestamp: new Date().toISOString()
                          }]);
                          if (!error) {
                            setAttendanceFeedback({ message: 'Attendance recorded!', type: 'success' });
                            fetchEventAttendance(selectedEventForAttendance.id);
                            fetchData();
                            setStudentSearch('');
                            setTimeout(() => setAttendanceFeedback(null), 3000);
                          } else {
                            setAttendanceFeedback({ message: 'Error: ' + error.message, type: 'error' });
                          }
                        }} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest opacity-50">Student</label>
                            <select name="student_id" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none text-xs">
                              <option value="">Select Student...</option>
                              {students
                                .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.student_id.includes(studentSearch))
                                .map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_id})</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-widest opacity-50">Status</label>
                            <select name="status" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none">
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="late">Late</option>
                            </select>
                          </div>
                          <button type="submit" className="w-full bg-[#141414] text-[#E4E3E0] py-4 text-xs uppercase tracking-widest mt-4">Record</button>
                        </form>
                      </div>
                    </div>
                    
                    <div className="md:col-span-2 border border-[#141414]">
                      <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-[10px] uppercase tracking-widest opacity-50">Participants List</h4>
                          <span className="text-[10px] uppercase tracking-widest opacity-50">{eventAttendance.length} Recorded</span>
                        </div>
                        
                        <div className="border border-[#141414]">
                          <div className="grid grid-cols-[1.5fr_1fr_1fr] p-4 border-b border-[#141414] bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest">
                            <div>Student</div>
                            <div>Status</div>
                            <div>Time</div>
                          </div>
                          {eventAttendance.length > 0 ? (
                            eventAttendance.map((att) => (
                              <div key={att.id} className="grid grid-cols-[1.5fr_1fr_1fr] p-4 border-b border-[#141414] last:border-0 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group">
                                <div className="font-bold">{att.students?.name}</div>
                                <div className="capitalize text-xs">{att.status}</div>
                                <div className="font-mono text-[10px] opacity-50 group-hover:opacity-100">{format(new Date(att.timestamp), 'HH:mm:ss')}</div>
                              </div>
                            ))
                          ) : (
                            <div className="p-12 text-center opacity-30 text-xs uppercase tracking-widest">
                              No attendance records found for this event.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-[#141414] p-24 text-center">
                    <Calendar size={48} className="mx-auto opacity-10 mb-6" />
                    <h3 className="text-2xl font-serif italic mb-2">No Event Selected</h3>
                    <p className="text-xs uppercase tracking-widest opacity-50">Please select an event from the dropdown above to manage attendance.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'finance' && (
              <motion.div 
                key="finance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-4">
                  <Filter size={14} className="opacity-50" />
                  <select 
                    className="bg-transparent border-b border-[#141414] py-1 text-xs uppercase tracking-widest focus:outline-none"
                    value={financeFilterStudent}
                    onChange={(e) => setFinanceFilterStudent(e.target.value)}
                  >
                    <option value="all">All Students (History)</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {financeFilterStudent !== 'all' && (
                  <div className="mb-6 p-6 border border-[#141414] bg-[#141414] text-[#E4E3E0]">
                    <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Total Paid by {students.find(s => s.id === financeFilterStudent)?.name}</p>
                    <p className="text-3xl font-serif italic">
                      {formatCurrency(payments
                        .filter(p => p.student_id === financeFilterStudent)
                        .reduce((sum, p) => sum + p.amount, 0))}
                    </p>
                  </div>
                )}

                <div className="border border-[#141414] overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-[120px_1.5fr_1fr_1fr_1fr] p-4 border-b border-[#141414] bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest">
                      <div>Receipt #</div>
                      <div>Student</div>
                      <div>Amount</div>
                      <div>Purpose</div>
                      <div>Actions</div>
                    </div>
                    {payments
                      .filter(p => financeFilterStudent === 'all' || p.student_id === financeFilterStudent)
                      .map((payment) => (
                    <div 
                      key={payment.id} 
                      className="grid grid-cols-[120px_1.5fr_1fr_1fr_1fr] p-4 border-b border-[#141414] last:border-0 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group"
                    >
                      <div className="font-mono text-xs flex items-center">{payment.receipt_number}</div>
                      <div className="font-bold flex items-center">{payment.students?.name || 'Unknown Student'}</div>
                      <div className="font-mono flex items-center">{formatCurrency(payment.amount)}</div>
                      <div className="text-xs opacity-70 group-hover:opacity-100 flex items-center">{payment.purpose}</div>
                      <div className="flex gap-4 items-center">
                        <button 
                          onClick={() => setSelectedPayment(payment)}
                          className="text-[10px] uppercase underline tracking-tighter flex items-center gap-1 p-2 -m-2 hover:opacity-70 transition-all"
                        >
                          <Printer size={10} /> Preview
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (payment.students) {
                              sendReceiptEmail(payment, payment.students);
                            } else {
                              setAttendanceFeedback({ message: 'Error: Student data missing', type: 'error' });
                              setTimeout(() => setAttendanceFeedback(null), 3000);
                            }
                          }}
                          disabled={sendingEmail === payment.id}
                          className={cn(
                            "text-[10px] uppercase underline tracking-tighter flex items-center gap-1 p-2 -m-2 transition-all",
                            (payment.email_sent || sendingEmail === payment.id) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {sendingEmail === payment.id ? (
                            <div className="animate-spin h-2 w-2 border-b border-current rounded-full" />
                          ) : (
                            <Mail size={10} />
                          )}
                          {sendingEmail === payment.id ? 'Sending...' : payment.email_sent ? 'Sent' : 'Email'}
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Global Feedback Toast */}
      <AnimatePresence>
        {attendanceFeedback && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 right-8 z-[100]"
          >
            <div className={cn(
              "px-8 py-4 shadow-2xl border border-[#141414] flex items-center gap-4 min-w-[300px]",
              attendanceFeedback.type === 'success' ? "bg-[#141414] text-[#E4E3E0]" : "bg-red-500 text-white"
            )}>
              {attendanceFeedback.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
              <div className="flex flex-col">
                <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">System Notification</p>
                <p className="text-sm font-serif italic">{attendanceFeedback.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {/* Student Profile Modal */}
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-2xl p-12 relative"
            >
              <button onClick={() => setSelectedStudent(null)} className="absolute right-8 top-8 hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
              
              <div className="flex gap-12">
                <div className="w-48 h-48 border border-[#141414] flex items-center justify-center bg-white/50">
                  <UserCircle size={80} className="opacity-20" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Student Profile</p>
                  <h3 className="text-4xl font-serif italic mb-6">{selectedStudent.name}</h3>
                  
                  <div className="grid grid-cols-2 gap-8 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">ID Number</p>
                      <p className="font-mono">{selectedStudent.student_id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Email</p>
                      <p>{selectedStudent.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Course</p>
                      <p>{selectedStudent.course}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Year Level</p>
                      <p>{selectedStudent.year_level}</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-[#141414] flex items-center gap-6">
                    <div className="bg-white p-2 border border-[#141414]">
                      <QRCodeSVG value={selectedStudent.student_id} size={100} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold">Student QR ID</p>
                      <p className="text-[10px] opacity-50 max-w-[200px] mt-1">
                        Use this code for quick attendance marking via the scanner.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Event Modal */}
        {showAddEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-12 relative"
            >
              <button onClick={() => setShowAddEvent(false)} className="absolute right-8 top-8"><X size={20} /></button>
              <h3 className="text-2xl font-serif italic mb-8">Create New Event</h3>
              <form onSubmit={handleAddEvent} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Event Title</label>
                  <input name="title" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Description</label>
                  <textarea name="description" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none min-h-[100px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest opacity-50">Date</label>
                    <input name="date" type="date" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest opacity-50">Location</label>
                    <input name="location" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-[#141414] text-[#E4E3E0] py-4 text-xs uppercase tracking-widest mt-8">Create Event</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Add Student Modal */}
        {showAddStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-12 relative"
            >
              <button onClick={() => setShowAddStudent(false)} className="absolute right-8 top-8"><X size={20} /></button>
              <h3 className="text-2xl font-serif italic mb-8">Add New Student</h3>
              <form onSubmit={handleAddStudent} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Student ID</label>
                  <input name="student_id" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Full Name</label>
                  <input name="name" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Email</label>
                  <input name="email" type="email" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest opacity-50">Course</label>
                    <input name="course" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest opacity-50">Year</label>
                    <input name="year_level" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-[#141414] text-[#E4E3E0] py-4 text-xs uppercase tracking-widest mt-8">Save Student</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Receipt Preview Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-xl p-12 relative overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setSelectedPayment(null)} className="absolute right-8 top-8"><X size={20} /></button>
              <h3 className="text-2xl font-serif italic mb-8">Receipt Preview</h3>
              
              <div className="bg-white p-4 mb-8">
                <Receipt 
                  ref={receiptRef} 
                  payment={selectedPayment} 
                  student={selectedPayment.students as Student} 
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => handlePrint()}
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Printer size={14} /> Print Receipt
                </button>
                <button 
                  onClick={() => selectedPayment.students && sendReceiptEmail(selectedPayment, selectedPayment.students as Student)}
                  disabled={sendingEmail === selectedPayment.id}
                  className={cn(
                    "flex-1 border border-[#141414] py-4 text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                    sendingEmail === selectedPayment.id && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {sendingEmail === selectedPayment.id ? (
                    <div className="animate-spin h-4 w-4 border-b-2 border-[#141414] rounded-full" />
                  ) : (
                    <Mail size={14} />
                  )}
                  {sendingEmail === selectedPayment.id ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Record Payment Modal */}
        {showAddPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-12 relative"
            >
              <button onClick={() => setShowAddPayment(false)} className="absolute right-8 top-8"><X size={20} /></button>
              <h3 className="text-2xl font-serif italic mb-8">Record Payment</h3>
              <form onSubmit={handleAddPayment} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Select Student</label>
                  <select name="student_id" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none">
                    <option value="">Select...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.student_id})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Amount (PHP)</label>
                  <input name="amount" type="number" step="0.01" required className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest opacity-50">Purpose</label>
                  <input name="purpose" required placeholder="e.g. Org Fee, Event Fee" className="w-full bg-transparent border-b border-[#141414] py-2 focus:outline-none" />
                </div>
                <button type="submit" className="w-full bg-[#141414] text-[#E4E3E0] py-4 text-xs uppercase tracking-widest mt-8">Record & Generate Receipt</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Event Attendance Modal */}
        {selectedEventForAttendance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-3xl p-12 relative overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setSelectedEventForAttendance(null)} className="absolute right-8 top-8"><X size={20} /></button>
              <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Event Attendance</p>
              <h3 className="text-4xl font-serif italic mb-8">{selectedEventForAttendance.title}</h3>
              
              <div className="border border-[#141414]">
                <div className="grid grid-cols-[1.5fr_1fr_1fr] p-4 border-b border-[#141414] bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest">
                  <div>Student</div>
                  <div>Status</div>
                  <div>Time</div>
                </div>
                {eventAttendance.length > 0 ? (
                  eventAttendance.map((att) => (
                    <div key={att.id} className="grid grid-cols-[1.5fr_1fr_1fr] p-4 border-b border-[#141414] last:border-0 text-sm">
                      <div className="font-bold">{att.students?.name}</div>
                      <div className="capitalize">{att.status}</div>
                      <div className="font-mono text-xs opacity-50">{format(new Date(att.timestamp), 'HH:mm:ss')}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center opacity-30 text-xs uppercase tracking-widest">
                    No attendance records found for this event.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Event QR Modal */}
        {showEventQr && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] border border-[#141414] p-12 max-w-md w-full text-center"
            >
              <h2 className="text-3xl font-serif italic mb-2">{showEventQr.title}</h2>
              <p className="text-[10px] uppercase tracking-widest opacity-50 mb-8">Scan to Check-in</p>
              
              <div className="bg-white p-8 border border-[#141414] inline-block mb-8">
                <QRCodeSVG value={showEventQr.id} size={200} />
              </div>
              
              <p className="text-xs font-mono opacity-50 mb-8">Event ID: {showEventQr.id}</p>
              
              <button 
                onClick={() => setShowEventQr(null)}
                className="w-full bg-[#141414] text-[#E4E3E0] py-4 text-xs uppercase tracking-widest"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}

        {/* QR Scanner Modal */}
        {showQrScanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-[#E4E3E0] border border-[#141414] w-full max-w-md p-12 relative"
            >
              <button onClick={() => setShowQrScanner(false)} className="absolute right-8 top-8"><X size={20} /></button>
              <h3 className="text-2xl font-serif italic mb-8">Scan QR Code</h3>
              <p className="text-xs opacity-50 mb-6 uppercase tracking-widest">
                Position the student's ID QR code within the frame.
              </p>
              <div id="qr-reader" className="w-full overflow-hidden border border-[#141414]"></div>
              
              {selectedEventForAttendance && (
                <div className="mt-6 p-4 border border-[#141414] bg-white/50">
                  <p className="text-[10px] uppercase tracking-widest opacity-50">Recording for:</p>
                  <p className="font-serif italic">{selectedEventForAttendance.title}</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
