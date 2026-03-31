import React from 'react';
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  CreditCard,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Total Students', value: '1,240', icon: Users, color: 'bg-blue-500', trend: '+12%' },
    { label: 'Active Events', value: '4', icon: Calendar, color: 'bg-purple-500', trend: 'Next: Org Day' },
    { label: 'Attendance Rate', value: '88%', icon: CheckSquare, color: 'bg-green-500', trend: '+2.4%' },
    { label: 'Total Collections', value: '₱45,200', icon: CreditCard, color: 'bg-orange-500', trend: 'This Semester' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-xl text-white`}>
                <stat.icon size={24} />
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
                <p className="text-sm text-slate-500 mt-1">{stat.trend}</p>
              </div>
              <div className="flex items-center text-green-500 text-sm font-medium">
                <TrendingUp size={16} className="mr-1" />
                <span>Growth</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Activities</h3>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  {i % 2 === 0 ? <Users size={18} /> : <CreditCard size={18} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {i % 2 === 0 ? 'New student registered: Maria Clara' : 'Payment received from Jose Rizal'}
                  </p>
                  <p className="text-xs text-slate-500">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Upcoming Events</h3>
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="group cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">April {10 + i}, 2026</span>
                  <span className="text-xs text-slate-400">09:00 AM</span>
                </div>
                <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {i === 1 ? 'General Assembly 2026' : 'Leadership Seminar'}
                </h4>
                <p className="text-sm text-slate-500 mt-1">School Auditorium</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
