import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { HiOutlineCloudArrowUp, HiOutlineXMark, HiOutlinePhoto, HiOutlineDocumentText } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { getExams, uploadPaper } from '../services/api';

export default function UploadPapers() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedExam = searchParams.get('exam');

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    exam_id: preselectedExam || '',
    student_name: '',
    student_id: '',
    auto_evaluate: true,
  });
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    setLoading(true);
    try {
      const res = await getExams();
      setExams(res.data);
    } catch (err) {
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const isAcceptedFile = (f) =>
    f.type.startsWith('image/') || f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isAcceptedFile);
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    } else {
      toast.error('Only image or PDF files are accepted');
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.exam_id) {
      toast.error('Please select an exam');
      return;
    }
    if (!formData.student_name.trim()) {
      toast.error('Please enter student name');
      return;
    }
    if (files.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setUploading(true);
    try {
      const data = new FormData();
      data.append('exam_id', formData.exam_id);
      data.append('student_name', formData.student_name);
      if (formData.student_id) data.append('student_id', formData.student_id);
      data.append('auto_evaluate', formData.auto_evaluate);
      files.forEach((file) => data.append('files', file));

      const res = await uploadPaper(data);
      toast.success(
        formData.auto_evaluate
          ? 'Paper uploaded! Evaluation started in background.'
          : 'Paper uploaded successfully!'
      );
      navigate(`/papers/${res.data.id}`);
    } catch (err) {
      toast.error('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Exam Papers</h1>
        <p className="text-gray-500 mt-1">
          Upload scanned/photographed handwritten exam papers or PDFs for AI evaluation
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        {/* Exam & Student Info */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Paper Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Select Exam *</label>
              <select
                className="input-field"
                value={formData.exam_id}
                onChange={(e) => setFormData({ ...formData, exam_id: e.target.value })}
                required
              >
                <option value="">— Select an exam —</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} ({exam.subject}) — {exam.total_marks} marks
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Student Name *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., John Doe"
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Student ID (optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., STU-2024-001"
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Paper Files</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload photos, scans, or PDFs of the handwritten exam paper. PDFs will be automatically converted to images for OCR. For multi-page papers, upload all pages in order.
          </p>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <HiOutlineCloudArrowUp className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              <label className="text-primary-600 font-medium cursor-pointer hover:underline">
                Click to upload
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  onChange={handleFileSelect}
                />
              </label>{' '}
              or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-400">PNG, JPG, JPEG, WEBP, PDF supported</p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">
                {files.length} file{files.length > 1 ? 's' : ''} selected:
              </p>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {file.type === 'application/pdf' ? (
                      <HiOutlineDocumentText className="w-5 h-5 text-red-400" />
                    ) : (
                      <HiOutlinePhoto className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-700">
                      Page {index + 1}: {file.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <HiOutlineXMark className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="card mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.auto_evaluate}
              onChange={(e) => setFormData({ ...formData, auto_evaluate: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-evaluate after upload</p>
              <p className="text-xs text-gray-500">
                Automatically run OCR and LLM evaluation after uploading
              </p>
            </div>
          </label>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={uploading} className="btn-primary">
            {uploading ? 'Uploading...' : 'Upload & Evaluate'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
