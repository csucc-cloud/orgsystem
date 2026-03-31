export interface Student {
  id: string;
  student_id: string;
  name: string;
  email: string;
  course: string;
  year_level: string;
  profile_image_url?: string;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  event_id: string;
  status: 'present' | 'absent' | 'late';
  timestamp: string;
  students?: Student;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  purpose: string;
  date: string;
  receipt_number: string;
  email_sent: boolean;
  students?: Student;
}
