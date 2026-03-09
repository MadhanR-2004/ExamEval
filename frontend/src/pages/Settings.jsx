import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getSystemStatus, getAvailableModels, updateSettings } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrModel, setOcrModel] = useState('');
  const [llmModel, setLlmModel] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const statusRes = await getSystemStatus();
      setStatus(statusRes.data);

      if (statusRes.data.ollama_connected) {
        const modelsRes = await getAvailableModels();
        setModels(modelsRes.data);

        // Set current model selections — ensure they match available models
        const modelNames = modelsRes.data.map((m) => m.name);
        setOcrModel(
          modelNames.includes(statusRes.data.ocr_model)
            ? statusRes.data.ocr_model
            : modelsRes.data[0]?.name || statusRes.data.ocr_model
        );
        setLlmModel(
          modelNames.includes(statusRes.data.llm_model)
            ? statusRes.data.llm_model
            : modelsRes.data[0]?.name || statusRes.data.llm_model
        );
      } else {
        setOcrModel(statusRes.data.ocr_model);
        setLlmModel(statusRes.data.llm_model);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ ocr_model: ocrModel, llm_model: llmModel });
      toast.success('Settings updated!');
      loadData();
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading settings..." />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure Ollama models and system settings</p>
      </div>

      {/* Connection Status */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ollama Connection</h2>
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              status?.ollama_connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="font-medium">
            {status?.ollama_connected ? 'Connected' : 'Not Connected'}
          </span>
          <span className="text-sm text-gray-500">{status?.ollama_url}</span>
        </div>
        {!status?.ollama_connected && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium">Ollama is not running</p>
            <p className="text-sm text-red-700 mt-1">
              Please start Ollama and pull the required models:
            </p>
            <div className="mt-2 bg-gray-900 text-green-400 text-sm rounded-lg p-3 font-mono">
              <p># Start Ollama</p>
              <p>ollama serve</p>
              <p className="mt-2"># Pull vision model for OCR</p>
              <p>ollama pull minicpm-v</p>
              <p className="mt-2"># Pull LLM for evaluation</p>
              <p>ollama pull deepseek-r1:8b</p>
            </div>
          </div>
        )}
      </div>

      {/* Model Settings */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">OCR Model (Vision)</label>
            <p className="text-xs text-gray-500 mb-2">
              Vision-capable model for reading handwritten text from images
            </p>
            {models.length > 0 ? (
              <select
                className="input-field"
                value={ocrModel}
                onChange={(e) => setOcrModel(e.target.value)}
              >
                {!models.some((m) => m.name === ocrModel) && ocrModel && (
                  <option value={ocrModel}>{ocrModel} (not installed)</option>
                )}
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input-field"
                value={ocrModel}
                onChange={(e) => setOcrModel(e.target.value)}
                placeholder="e.g., minicpm-v"
              />
            )}
            <p className="mt-1 text-xs text-gray-400">
              Recommended: minicpm-v, llava, llava-llama3, bakllava
            </p>
          </div>

          <div>
            <label className="label">LLM Model (Evaluation)</label>
            <p className="text-xs text-gray-500 mb-2">
              Language model for evaluating and scoring answers
            </p>
            {models.length > 0 ? (
              <select
                className="input-field"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
              >
                {!models.some((m) => m.name === llmModel) && llmModel && (
                  <option value={llmModel}>{llmModel} (not installed)</option>
                )}
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input-field"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="e.g., deepseek-r1:8b"
              />
            )}
            <p className="mt-1 text-xs text-gray-400">
              Recommended: deepseek-r1:8b, deepseek-r1:14b, llama3, mistral
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Available Models */}
      {models.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Ollama Models ({models.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Model</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Size</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Modified</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.name} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-medium text-gray-900">{model.name}</td>
                    <td className="py-2 px-2 text-gray-600">
                      {model.size
                        ? `${(parseInt(model.size) / 1073741824).toFixed(1)} GB`
                        : '—'}
                    </td>
                    <td className="py-2 px-2 text-gray-600">
                      {model.modified_at
                        ? new Date(model.modified_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How ExamEval Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm mb-2">
              1
            </div>
            <h3 className="font-semibold text-gray-900">OCR Extraction</h3>
            <p className="text-sm text-gray-600 mt-1">
              Vision model reads handwritten text from uploaded exam paper images and extracts
              question-wise answers.
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm mb-2">
              2
            </div>
            <h3 className="font-semibold text-gray-900">LLM Evaluation</h3>
            <p className="text-sm text-gray-600 mt-1">
              AI evaluates each extracted answer against the expected answer, checking for
              correctness, keywords, and conceptual understanding.
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm mb-2">
              3
            </div>
            <h3 className="font-semibold text-gray-900">Score & Feedback</h3>
            <p className="text-sm text-gray-600 mt-1">
              Get detailed scores per question with AI-generated feedback explaining what was
              correct, what was missed, and suggestions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
