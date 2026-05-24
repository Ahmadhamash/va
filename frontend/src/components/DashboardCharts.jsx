import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function DashboardCharts({ stats }) {
  // Use dummy data since the current /admin/stats doesn't return time-series data
  const weeklyData = [
    { name: 'Mon', bookings: 4, messages: 24 },
    { name: 'Tue', bookings: 7, messages: 45 },
    { name: 'Wed', bookings: 5, messages: 39 },
    { name: 'Thu', bookings: 12, messages: 82 },
    { name: 'Fri', bookings: 15, messages: 110 },
    { name: 'Sat', bookings: 22, messages: 140 },
    { name: 'Sun', bookings: 18, messages: 95 },
  ];

  const channelData = [
    { name: 'WhatsApp', users: 400 },
    { name: 'Instagram', users: 300 },
    { name: 'Messenger', users: 200 },
    { name: 'Web', users: 150 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-8">
      {/* Activity Over Time */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Weekly Activity</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" dataKey="messages" name="AI Messages" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Channel Distribution */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Channel Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <Tooltip 
                cursor={{ fill: '#F3F4F6' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Bar dataKey="users" name="Active Users" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
