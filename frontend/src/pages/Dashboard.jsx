import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineDocumentText,
  HiOutlineDocumentCheck,
  HiOutlineAcademicCap,
  HiOutlineChartBar,
} from 'react-icons/hi2';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getDashboardStats, getSystemStatus } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, statusRes] = await Promise.all([
        getDashboardStats(),
        getSystemStatus(),
      ]);
      setStats(statsRes.data);
      setSystemStatus(statusRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;

  const statCards = [
    {
      label: 'Total Exams',
      value: stats?.total_exams ?? 0,
      icon: HiOutlineDocumentText,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Total Papers',
      value: stats?.total_papers ?? 0,
      icon: HiOutlineAcademicCap,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Evaluated',
      value: stats?.total_evaluated ?? 0,
      icon: HiOutlineDocumentCheck,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Avg Score',
      value: stats?.average_score != null ? `${stats.average_score}%` : 'N/A',
      icon: HiOutlineChartBar,
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  const scoreDistribution = [];
  if (stats?.recent_evaluations?.length > 0) {
    const ranges = { 'A (80-100)': 0, 'B (60-79)': 0, 'C (40-59)': 0, 'F (0-39)': 0 };
    stats.recent_evaluations.forEach((p) => {
      if (p.percentage == null) return;
      if (p.percentage >= 80) ranges['A (80-100)']++;
      else if (p.percentage >= 60) ranges['B (60-79)']++;
      else if (p.percentage >= 40) ranges['C (40-59)']++;
      else ranges['F (0-39)']++;
    });
    Object.entries(ranges).forEach(([name, value]) => {
      scoreDistribution.push({ name, value });
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your exam evaluation system</p>
      </div>

      {/* System Status Banner */}
      {systemStatus && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg flex items-center justify-between ${
            systemStatus.ollama_connected
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                systemStatus.ollama_connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium">
              {systemStatus.ollama_connected
                ? `Ollama Connected — OCR: ${systemStatus.ocr_model} | LLM: ${systemStatus.llm_model}`
                : 'Ollama Not Connected — Please start Ollama to use OCR/LLM features'}
            </span>
          </div>
          <Link to="/settings" className="text-sm text-primary-600 hover:underline">
            Settings
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Score Distribution Chart */}
        {scoreDistribution.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={scoreDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {scoreDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Scores Bar Chart */}
        {stats?.recent_evaluations?.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Scores</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={stats.recent_evaluations
                  .filter((p) => p.percentage != null)
                  .slice(0, 8)
                  .map((p) => ({
                    name: p.student_name.length > 10 ? p.student_name.slice(0, 10) + '...' : p.student_name,
                    score: p.percentage,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(val) => `${val}%`} />
                <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Evaluations Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Evaluations</h2>
          <Link to="/exams" className="text-sm text-primary-600 hover:underline">
            View All Exams
          </Link>
        </div>
        {stats?.recent_evaluations?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Student</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Score</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Percentage</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_evaluations.map((paper) => (
                  <tr key={paper.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{paper.student_name}</td>
                    <td className="py-3 px-2">
                      <StatusBadge status={paper.status} />
                    </td>
                    <td className="py-3 px-2">
                      {paper.total_score != null
                        ? `${paper.total_score}/${paper.max_score}`
                        : '—'}
                    </td>
                    <td className="py-3 px-2">
                      {paper.percentage != null ? (
                        <span
                          className={`font-semibold ${
                            paper.percentage >= 60 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {paper.percentage}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Link
                        to={`/papers/${paper.id}`}
                        className="text-primary-600 hover:underline text-xs font-medium"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <HiOutlineDocumentText className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No evaluations yet</p>
            <Link to="/exams/new" className="mt-4 inline-block btn-primary text-sm">
              Create Your First Exam
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
