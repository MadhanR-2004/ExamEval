import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Exam APIs ────────────────────────────────────────────

export const createExam = (data) => api.post('/exams/', data);
export const getExams = () => api.get('/exams/');
export const getExam = (id) => api.get(`/exams/${id}`);
export const updateExam = (id, data) => api.put(`/exams/${id}`, data);
export const deleteExam = (id) => api.delete(`/exams/${id}`);

// ── Paper APIs ───────────────────────────────────────────

export const uploadPaper = (formData) =>
  api.post('/papers/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getPapersByExam = (examId) => api.get(`/papers/exam/${examId}`);
export const getPaper = (id) => api.get(`/papers/${id}`);
export const deletePaper = (id) => api.delete(`/papers/${id}`);

// ── Evaluation APIs ──────────────────────────────────────

export const triggerEvaluation = (paperId) =>
  api.post(`/evaluations/process/${paperId}`);

export const triggerReEvaluation = (paperId) =>
  api.post(`/evaluations/re-evaluate/${paperId}`);

export const getPaperEvaluations = (paperId) =>
  api.get(`/evaluations/paper/${paperId}`);

export const getExamResults = (examId) =>
  api.get(`/evaluations/results/exam/${examId}`);

export const getDashboardStats = () =>
  api.get('/evaluations/dashboard/stats');

// ── System APIs ──────────────────────────────────────────

export const getSystemStatus = () => api.get('/evaluations/system/status');
export const getAvailableModels = () => api.get('/evaluations/system/models');
export const updateSettings = (data) => api.post('/evaluations/system/settings', data);

export default api;
