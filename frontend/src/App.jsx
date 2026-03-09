import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateExam from './pages/CreateExam';
import ExamList from './pages/ExamList';
import ExamDetail from './pages/ExamDetail';
import UploadPapers from './pages/UploadPapers';
import PaperDetail from './pages/PaperDetail';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/exams" element={<ExamList />} />
          <Route path="/exams/new" element={<CreateExam />} />
          <Route path="/exams/:id" element={<ExamDetail />} />
          <Route path="/upload" element={<UploadPapers />} />
          <Route path="/papers/:id" element={<PaperDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
