import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineEye } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { getExams, deleteExam } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ExamList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      const res = await getExams();
      setExams(res.data);
    } catch (err) {
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete exam "${title}"? This will also delete all associated papers and evaluations.`)) return;
    try {
      await deleteExam(id);
      toast.success('Exam deleted');
      setExams(exams.filter((e) => e.id !== id));
    } catch (err) {
      toast.error('Failed to delete exam');
    }
  };

  if (loading) return <LoadingSpinner text="Loading exams..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-gray-500 mt-1">Manage your exams and answer keys</p>
        </div>
        <Link to="/exams/new" className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" />
          New Exam
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="card text-center py-16">
          <HiOutlineEye className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No exams yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first exam to start evaluating papers.</p>
          <Link to="/exams/new" className="mt-4 inline-block btn-primary">
            Create Exam
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{exam.title}</h3>
                  <p className="text-sm text-primary-600 font-medium mt-0.5">{exam.subject}</p>
                </div>
                <button
                  onClick={() => handleDelete(exam.id, exam.title)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-gray-900">{exam.question_count}</p>
                  <p className="text-xs text-gray-500">Questions</p>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-gray-900">{exam.total_marks}</p>
                  <p className="text-xs text-gray-500">Marks</p>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className="text-lg font-bold text-gray-900">{exam.paper_count}</p>
                  <p className="text-xs text-gray-500">Papers</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  to={`/exams/${exam.id}`}
                  className="flex-1 text-center btn-secondary text-sm"
                >
                  View Details
                </Link>
                <Link
                  to={`/upload?exam=${exam.id}`}
                  className="flex-1 text-center btn-primary text-sm"
                >
                  Upload Papers
                </Link>
              </div>

              <p className="mt-3 text-xs text-gray-400">
                Created {new Date(exam.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
