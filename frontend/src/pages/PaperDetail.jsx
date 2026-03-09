import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { HiOutlineArrowPath, HiOutlineArrowLeft, HiOutlineTrash } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { getPaperEvaluations, triggerEvaluation, triggerReEvaluation, deletePaper } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import ScoreBadge from '../components/ScoreBadge';

export default function PaperDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPaper();
  }, [id]);

  // Auto-refresh while processing
  useEffect(() => {
    if (!paper) return;
    const processing = ['ocr_processing', 'evaluating', 'uploaded'].includes(paper.status);
    if (!processing) return;

    const interval = setInterval(loadPaper, 15000);
    return () => clearInterval(interval);
  }, [paper?.status]);

  const loadPaper = async () => {
    try {
      const res = await getPaperEvaluations(id);
      setPaper(res.data);
    } catch (err) {
      toast.error('Failed to load paper details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleEvaluate = async () => {
    try {
      await triggerEvaluation(id);
      toast.success('Evaluation started!');
      setRefreshing(true);
      setTimeout(loadPaper, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start evaluation');
    }
  };

  const handleReEvaluate = async () => {
    if (!confirm('Re-evaluate this paper? This will re-run the LLM evaluation.')) return;
    try {
      await triggerReEvaluation(id);
      toast.success('Re-evaluation started!');
      setRefreshing(true);
      setTimeout(loadPaper, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start re-evaluation');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPaper();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this paper? This will remove all evaluations and uploaded images.')) return;
    try {
      await deletePaper(id);
      toast.success('Paper deleted');
      navigate(paper?.exam ? `/exams/${paper.exam_id}` : '/exams');
    } catch (err) {
      toast.error('Failed to delete paper: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) return <LoadingSpinner text="Loading paper details..." />;
  if (!paper) return <p className="text-gray-500">Paper not found</p>;

  const isProcessing = ['ocr_processing', 'evaluating'].includes(paper.status);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            to={paper.exam ? `/exams/${paper.exam_id}` : '/exams'}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <HiOutlineArrowLeft className="w-4 h-4" />
            Back to Exam
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{paper.student_name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {paper.student_id && (
              <span className="text-sm text-gray-500">ID: {paper.student_id}</span>
            )}
            <StatusBadge status={paper.status} />
            {isProcessing && (
              <span className="text-xs text-blue-600 animate-pulse">Processing...</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2 text-sm">
            <HiOutlineArrowPath className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {paper.status === 'uploaded' || paper.status === 'failed' ? (
            <button onClick={handleEvaluate} className="btn-primary text-sm">
              Start Evaluation
            </button>
          ) : paper.status === 'evaluated' ? (
            <button onClick={handleReEvaluate} className="btn-secondary text-sm">
              Re-Evaluate
            </button>
          ) : null}
          <button
            onClick={handleDelete}
            className="btn-secondary text-sm text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
          >
            <HiOutlineTrash className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Score Summary */}
      {paper.total_score != null && (
        <div className="card mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Score</p>
              <p className="text-4xl font-bold text-gray-900 mt-1">
                {paper.total_score} / {paper.max_score}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 font-medium">Percentage</p>
              <p
                className={`text-4xl font-bold mt-1 ${
                  paper.percentage >= 60 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {paper.percentage}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 font-medium">Grade</p>
              <p className="text-4xl font-bold mt-1">
                {paper.percentage >= 90
                  ? 'A+'
                  : paper.percentage >= 80
                  ? 'A'
                  : paper.percentage >= 70
                  ? 'B'
                  : paper.percentage >= 60
                  ? 'C'
                  : paper.percentage >= 50
                  ? 'D'
                  : 'F'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Question-wise Evaluation */}
      {paper.evaluations?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Question-wise Evaluation</h2>
          <div className="space-y-4">
            {paper.evaluations.map((evaluation, index) => (
              <div key={evaluation.id} className="card border-l-4 border-l-primary-400">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Question {evaluation.question_number || index + 1}
                    </h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {evaluation.question_text}
                    </p>
                  </div>
                  <ScoreBadge score={evaluation.score} maxScore={evaluation.max_score} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                  {/* Expected Answer */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">Expected Answer</p>
                    <p className="text-sm text-green-900 whitespace-pre-wrap">
                      {evaluation.expected_answer}
                    </p>
                  </div>

                  {/* Student's Answer */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Student's Answer (OCR)</p>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">
                      {evaluation.extracted_answer || '[No answer detected]'}
                    </p>
                  </div>
                </div>

                {/* Feedback */}
                {evaluation.feedback && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">AI Feedback</p>
                    <p className="text-sm text-yellow-900 whitespace-pre-wrap">
                      {evaluation.feedback}
                    </p>
                  </div>
                )}

                {/* Score bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Score</span>
                    <span>
                      {evaluation.score}/{evaluation.max_score} (
                      {((evaluation.score / evaluation.max_score) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        evaluation.score / evaluation.max_score >= 0.6
                          ? 'bg-green-500'
                          : evaluation.score / evaluation.max_score >= 0.4
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: `${Math.min((evaluation.score / evaluation.max_score) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OCR Extracted Text */}
      {paper.extracted_text && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Raw OCR Extracted Text</h2>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
            {paper.extracted_text}
          </pre>
        </div>
      )}

      {/* Paper Info */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Paper Info</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Uploaded</p>
            <p className="font-medium">{new Date(paper.uploaded_at).toLocaleString()}</p>
          </div>
          {paper.evaluated_at && (
            <div>
              <p className="text-gray-500">Evaluated</p>
              <p className="font-medium">{new Date(paper.evaluated_at).toLocaleString()}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Pages</p>
            <p className="font-medium">{Array.isArray(paper.image_paths) ? paper.image_paths.length : 0}</p>
          </div>
          {paper.exam && (
            <div>
              <p className="text-gray-500">Exam</p>
              <Link to={`/exams/${paper.exam_id}`} className="font-medium text-primary-600 hover:underline">
                {paper.exam.title}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
