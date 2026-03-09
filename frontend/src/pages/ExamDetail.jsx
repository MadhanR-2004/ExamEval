import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { HiOutlineArrowUpTray, HiOutlineArrowPath } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { getExam, getExamResults, triggerEvaluation } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import ScoreBadge from '../components/ScoreBadge';

export default function ExamDetail() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [examRes, papersRes] = await Promise.all([
        getExam(id),
        getExamResults(id),
      ]);
      setExam(examRes.data);
      setPapers(papersRes.data);
    } catch (err) {
      toast.error('Failed to load exam details');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async (paperId) => {
    try {
      await triggerEvaluation(paperId);
      toast.success('Evaluation started! Refresh to see results.');
      // Reload after a short delay
      setTimeout(loadData, 2000);
    } catch (err) {
      toast.error('Failed to trigger evaluation: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) return <LoadingSpinner text="Loading exam..." />;
  if (!exam) return <p className="text-gray-500">Exam not found</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
          <p className="text-primary-600 font-medium">{exam.subject}</p>
          {exam.description && <p className="text-gray-500 mt-1 text-sm">{exam.description}</p>}
        </div>
        <Link to={`/upload?exam=${exam.id}`} className="btn-primary flex items-center gap-2">
          <HiOutlineArrowUpTray className="w-4 h-4" />
          Upload Papers
        </Link>
      </div>

      {/* Exam Info */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Questions & Answer Key</h2>
        <div className="space-y-3">
          {exam.questions?.map((q) => (
            <div key={q.question_number} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900">Q{q.question_number}</h3>
                <span className="badge-info">{q.max_marks} marks</span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{q.question_text}</p>
              <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
                <p className="text-xs font-medium text-green-700 mb-1">Expected Answer:</p>
                <p className="text-sm text-green-800 whitespace-pre-wrap">{q.expected_answer}</p>
              </div>
              {q.keywords && q.keywords.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {q.keywords.map((kw, i) => (
                    <span key={i} className="badge-gray text-xs">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-500 font-medium">
          Total: {exam.total_marks} marks across {exam.questions?.length} questions
        </p>
      </div>

      {/* Papers & Results */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Submitted Papers ({papers.length})
          </h2>
          <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
            <HiOutlineArrowPath className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {papers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No papers uploaded yet.</p>
            <Link to={`/upload?exam=${exam.id}`} className="mt-3 inline-block btn-primary text-sm">
              Upload Papers
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Student</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Student ID</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Score</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Percentage</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => (
                  <tr key={paper.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{paper.student_name}</td>
                    <td className="py-3 px-2 text-gray-600">{paper.student_id || '—'}</td>
                    <td className="py-3 px-2">
                      <StatusBadge status={paper.status} />
                    </td>
                    <td className="py-3 px-2">
                      {paper.total_score != null ? (
                        <ScoreBadge score={paper.total_score} maxScore={paper.max_score} />
                      ) : '—'}
                    </td>
                    <td className="py-3 px-2">
                      {paper.percentage != null ? (
                        <span className={`font-bold ${paper.percentage >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                          {paper.percentage}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-2 text-right space-x-2">
                      {paper.status === 'uploaded' || paper.status === 'failed' ? (
                        <button
                          onClick={() => handleEvaluate(paper.id)}
                          className="text-primary-600 hover:underline text-xs font-medium"
                        >
                          Evaluate
                        </button>
                      ) : null}
                      <Link
                        to={`/papers/${paper.id}`}
                        className="text-primary-600 hover:underline text-xs font-medium"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
