# ExamEval - AI-Powered Exam Paper Evaluator

An OCR + LLM based system for automatically evaluating handwritten exam papers. Uses **Ollama** with vision models for OCR (handwriting recognition) and language models (DeepSeek) for intelligent answer evaluation.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   React Frontend│────▶│  FastAPI Backend      │────▶│  Ollama (Local) │
│   (Vite + TW)   │◀────│  (Python)             │◀────│                 │
└─────────────────┘     │                      │     │  ┌───────────┐  │
                        │  ┌────────────────┐  │     │  │ minicpm-v │  │
                        │  │ OCR Service    │──┼────▶│  │ (Vision)  │  │
                        │  │ (Vision Model) │  │     │  └───────────┘  │
                        │  └────────────────┘  │     │                 │
                        │  ┌────────────────┐  │     │  ┌───────────┐  │
                        │  │ LLM Service    │──┼────▶│  │deepseek-r1│  │
                        │  │ (Evaluation)   │  │     │  │ (LLM)     │  │
                        │  └────────────────┘  │     │  └───────────┘  │
                        │  ┌────────────────┐  │     └─────────────────┘
                        │  │ SQLite DB      │  │
                        │  └────────────────┘  │
                        └──────────────────────┘
```

## Features

- **Create Exams** with questions, expected answers, marks, and keywords
- **Upload Handwritten Papers** (images: PNG, JPG, JPEG, WEBP)
- **OCR Extraction** using Ollama vision models (reads handwritten text)
- **AI Evaluation** using DeepSeek/LLM to score answers with detailed feedback
- **Dashboard** with statistics, score distribution charts, and recent results
- **Settings** to switch between Ollama models at runtime
- **Auto-refresh** UI while papers are being processed
- **Re-evaluation** capability (skip OCR, re-run LLM scoring)

## Tech Stack

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Frontend  | React 18 + Vite + TailwindCSS     |
| Backend   | Python + FastAPI + SQLAlchemy      |
| Database  | Mongodb                           |
| OCR       | Ollama Vision Model (minicpm-v)    |
| LLM       | Ollama LLM (deepseek-r1:8b)       |
| Charts    | Recharts                           |

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama** installed and running ([ollama.com](https://ollama.com))

## Setup

### 1. Install Ollama & Pull Models

```bash
# Install Ollama (https://ollama.com/download)

# Start Ollama
ollama serve

# Pull vision model for OCR (handwriting recognition)
ollama pull minicpm-v

# Pull LLM for evaluation
ollama pull deepseek-r1:8b
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python run.py
```

Backend runs at: **http://localhost:8000**  
API docs at: **http://localhost:8000/docs**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: **http://localhost:5173**

## Configuration

Edit `backend/.env` to customize:

```env
# Ollama server URL
OLLAMA_BASE_URL=http://localhost:11434

# Vision model for OCR
OCR_MODEL=minicpm-v

# LLM model for evaluation  
LLM_MODEL=deepseek-r1:8b

# Database path
DATABASE_URL
```

You can also change models at runtime via the Settings page in the UI.

## Usage Flow

1. **Create an Exam** — Define questions with expected answers and marks
2. **Upload Papers** — Upload photos/scans of handwritten exam papers
3. **Auto-Evaluation** — System automatically:
   - Runs OCR to extract handwritten text
   - Parses answers by question number
   - Uses LLM to evaluate each answer against expected answers
   - Calculates scores and generates feedback
4. **View Results** — See per-question scores, AI feedback, extracted text, and grades

## API Endpoints

| Method | Endpoint                              | Description                    |
| ------ | ------------------------------------- | ------------------------------ |
| POST   | `/api/exams/`                         | Create exam with questions     |
| GET    | `/api/exams/`                         | List all exams                 |
| GET    | `/api/exams/{id}`                     | Get exam details               |
| DELETE | `/api/exams/{id}`                     | Delete exam                    |
| POST   | `/api/papers/upload`                  | Upload paper images            |
| GET    | `/api/papers/exam/{exam_id}`          | Get papers for exam            |
| POST   | `/api/evaluations/process/{paper_id}` | Trigger evaluation             |
| POST   | `/api/evaluations/re-evaluate/{id}`   | Re-evaluate paper              |
| GET    | `/api/evaluations/paper/{paper_id}`   | Get detailed evaluation        |
| GET    | `/api/evaluations/dashboard/stats`    | Dashboard statistics           |
| GET    | `/api/evaluations/system/status`      | Check Ollama status            |
| GET    | `/api/evaluations/system/models`      | List available Ollama models   |

## Recommended Ollama Models

### For OCR (Vision/Multimodal):
- `minicpm-v` — Good balance of speed and accuracy
- `llava` — Popular vision model
- `llava-llama3` — Llama 3 based vision model
- `bakllava` — Another vision variant
- `moondream` — Lightweight vision model

### For Evaluation (LLM):
- `deepseek-r1:8b` — DeepSeek reasoning model (recommended)
- `deepseek-r1:14b` — Larger, more accurate
- `llama3` — Meta's Llama 3
- `mistral` — Mistral 7B

## Project Structure

```
ExamEval/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings & env vars
│   │   ├── database.py          # SQLite + SQLAlchemy
│   │   ├── models.py            # DB models (Exam, Question, Paper, Evaluation)
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── routers/
│   │   │   ├── exams.py         # Exam CRUD
│   │   │   ├── papers.py        # Paper upload
│   │   │   └── evaluations.py   # Evaluation & dashboard
│   │   └── services/
│   │       ├── ocr_service.py   # OCR via Ollama vision model
│   │       ├── llm_service.py   # LLM evaluation via Ollama
│   │       └── evaluation_service.py  # Full pipeline orchestration
│   ├── .env                     # Configuration
│   ├── requirements.txt
│   └── run.py                   # Server runner
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── services/api.js      # API client
│   │   ├── components/          # Reusable UI components
│   │   └── pages/               # Page components
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── README.md
```
