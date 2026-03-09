import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { createExam } from '../services/api';

export default function CreateExam() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState({
    title: '',
    subject: '',
    description: '',
  });
  const [questions, setQuestions] = useState([
    { question_number: 1, question_text: '', expected_answer: '', max_marks: 10, keywords: '' },
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_number: questions.length + 1,
        question_text: '',
        expected_answer: '',
        max_marks: 10,
        keywords: '',
      },
    ]);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((_, i) => i !== index).map((q, i) => ({
      ...q,
      question_number: i + 1,
    }));
    setQuestions(updated);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const totalMarks = questions.reduce((sum, q) => sum + (parseFloat(q.max_marks) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!exam.title.trim() || !exam.subject.trim()) {
      toast.error('Please fill in exam title and subject');
      return;
    }

    for (const q of questions) {
      if (!q.question_text.trim() || !q.expected_answer.trim()) {
        toast.error(`Please fill in all fields for Question ${q.question_number}`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        ...exam,
        questions: questions.map((q) => ({
          ...q,
          max_marks: parseFloat(q.max_marks) || 0,
          keywords: q.keywords
            ? q.keywords.split(',').map((k) => k.trim()).filter(Boolean)
            : null,
        })),
      };

      const res = await createExam(payload);
      toast.success('Exam created successfully!');
      navigate(`/exams/${res.data.id}`);
    } catch (err) {
      toast.error('Failed to create exam: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Exam</h1>
        <p className="text-gray-500 mt-1">Define questions and expected answers for evaluation</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Exam Details */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Exam Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Exam Title *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., Midterm Exam - Computer Science"
                value={exam.title}
                onChange={(e) => setExam({ ...exam, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Subject *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., Computer Science"
                value={exam.subject}
                onChange={(e) => setExam({ ...exam, subject: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Description (optional)</label>
            <textarea
              className="textarea-field"
              placeholder="Brief description of the exam..."
              value={exam.description}
              onChange={(e) => setExam({ ...exam, description: e.target.value })}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Questions ({questions.length})
              </h2>
              <p className="text-sm text-gray-500">Total Marks: {totalMarks}</p>
            </div>
            <button type="button" onClick={addQuestion} className="btn-secondary flex items-center gap-2">
              <HiOutlinePlus className="w-4 h-4" />
              Add Question
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, index) => (
              <div key={index} className="card border-l-4 border-l-primary-500">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    Question {q.question_number}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500">Marks:</label>
                      <input
                        type="number"
                        className="input-field w-20"
                        min="1"
                        value={q.max_marks}
                        onChange={(e) => updateQuestion(index, 'max_marks', e.target.value)}
                      />
                    </div>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="label">Question Text *</label>
                    <textarea
                      className="textarea-field"
                      placeholder="Enter the question..."
                      value={q.question_text}
                      onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Expected Answer (Model Answer) *</label>
                    <textarea
                      className="textarea-field min-h-[120px]"
                      placeholder="Enter the expected/model answer that student answers will be compared against..."
                      value={q.expected_answer}
                      onChange={(e) => updateQuestion(index, 'expected_answer', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Keywords (optional, comma-separated)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g., algorithm, complexity, O(n), recursion"
                      value={q.keywords}
                      onChange={(e) => updateQuestion(index, 'keywords', e.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Important keywords the evaluator should check for in answers
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between card">
          <p className="text-sm text-gray-500">
            {questions.length} question{questions.length > 1 ? 's' : ''} — Total: {totalMarks} marks
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/exams')} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creating...' : 'Create Exam'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
