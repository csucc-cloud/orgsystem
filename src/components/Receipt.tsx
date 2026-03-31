import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '../lib/utils';
import { Payment, Student } from '../types';

interface ReceiptProps {
  payment: Payment;
  student: Student;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ payment, student }, ref) => {
  return (
    <div ref={ref} className="p-12 bg-white text-slate-900 border-[12px] border-double border-[#7c2d12]/20 max-w-md mx-auto font-sans shadow-2xl relative overflow-hidden">
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <span className="font-serif italic font-bold text-[200px] text-[#7c2d12]">S</span>
      </div>

      <div className="flex items-center justify-between mb-10 pb-8 border-b-2 border-[#7c2d12]/10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#7c2d12] rounded-full flex items-center justify-center text-white shadow-lg">
            <span className="font-serif italic font-bold text-2xl">S</span>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none text-[#7c2d12]">School Organization</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 mt-1">Official Acknowledgement Receipt</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold text-[#7c2d12] opacity-40">Serial No.</p>
          <p className="font-mono font-black text-lg text-slate-900">{payment.receipt_number}</p>
        </div>
      </div>

      <div className="space-y-8 relative z-10">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] uppercase font-bold text-[#7c2d12] mb-1 opacity-50">Date of Transaction</p>
            <p className="text-sm font-bold">{format(new Date(payment.date), 'MMMM dd, yyyy')}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-[#7c2d12] mb-1 opacity-50">Payment Method</p>
            <p className="text-sm font-bold">CASH PAYMENT</p>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 shadow-inner">
          <p className="text-[10px] uppercase font-bold text-[#7c2d12] mb-3 opacity-50">Received From (Payor)</p>
          <p className="text-xl font-black text-slate-900 leading-tight">{student.name}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Student ID: {student.student_id}</span>
            <span>Course: {student.course}</span>
            <span>Year: {student.year_level}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Description / Purpose</span>
            <span className="text-sm font-black text-slate-900">{payment.purpose}</span>
          </div>
          <div className="flex justify-between items-center py-6 bg-[#7c2d12]/5 px-4 rounded-lg">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#7c2d12]">Amount Paid</span>
            <span className="text-4xl font-black text-[#7c2d12]">{formatCurrency(payment.amount)}</span>
          </div>
        </div>

        <div className="pt-12 flex flex-col items-center relative">
          <div className="absolute -top-6 right-0 opacity-20 rotate-[-15deg] pointer-events-none">
            <div className="border-[6px] border-[#7c2d12] px-6 py-2 text-4xl font-black uppercase tracking-[0.3em] text-[#7c2d12] rounded-xl">PAID</div>
          </div>
          <div className="w-full border-t-2 border-slate-200 mb-2"></div>
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-400">Authorized Signature</p>
          <p className="text-[9px] italic text-slate-300 mt-1">This is a system-generated receipt.</p>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-slate-100 text-center">
        <p className="text-[9px] text-slate-400 uppercase tracking-[0.2em] font-bold leading-relaxed">
          Thank you for your support. This contribution helps fund our organization's programs and initiatives.
        </p>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';
