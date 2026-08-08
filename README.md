# 📊 Stock Analyst Agent

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose_Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> An AI-powered equity research and financial analytics agent workspace. Combines real-time market data caching, financial statement analysis, interactive technical charts, and LLM-driven investment consensus ratings.

---

## 🌟 Key Features

- **Interactive Financial Dashboard**: Clean, real-time market dashboard (`/frontend`) featuring live stock price charts, volume flow metrics, and ticker tapes.
- **AI Financial Analyst Consensus**: Interactive analyst rating gauges (`AnalystRatingGauge.jsx`), EPS growth metrics (`EpsMetrics.jsx`), and quarterly fundamentals breakdown (`QuarterlyFundamentals.jsx`).
- **Dynamic LLM Routing**: Intelligently routes financial queries across multiple LLM providers with visible routing status badges (`LlmRouteBadge.jsx`).
- **Daily Market Data Cache**: Automated market caching engine (`/data/market` and `/scripts/update_market_cache.py`) to reduce external API dependency and latency.
- **Production Containerization**: Complete `docker-compose.yml`, `Dockerfile`, `render.yaml`, and Nginx configuration for effortless cloud deployment.

---

## 🏗️ Repository Architecture

```text
stock-analyst-agent/
├── backend/                # FastAPI application & financial analysis routes
├── frontend/               # Vite + React 19 single-page financial dashboard
│   ├── src/
│   │   ├── components/     # UI widgets (PriceChart, AnalystGauge, ChatBox, EpsMetrics)
│   │   ├── hooks/          # Custom hooks (useMarketData, useFundamentals, useChatHistory)
│   │   └── utils/          # Market calculations, formatting, and LLM routing logic
│   └── package.json        # Frontend dependencies
├── data/market/            # Daily cached market datasets & JSON snapshots
├── deploy/                 # Production Nginx reverse-proxy configuration
├── scripts/                # Python data collection and market cache updater scripts
├── docker-compose.yml      # Multi-container service orchestration
├── Dockerfile              # Backend container build script
├── Dockerfile.web          # Frontend container build script
├── DEPLOY.md               # Deployment and cloud hosting instructions
└── SECURITY.md             # Security policies & API key handling guardrails
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0+`
- **Python**: `3.10+`
- **Docker & Docker Compose** *(optional)*

---

### Quick Start with Docker Compose

Run the entire backend and frontend stack with a single command:

```bash
docker-compose up --build
```

Access the financial dashboard at [http://localhost:3000](http://localhost:3000).

---

### Local Development Setup

#### 1. Backend Service (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Create & activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

On Windows, you can also launch the backend via:
```powershell
.\start-backend.ps1
```

#### 2. Frontend Application (Vite + React)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

On Windows, you can also launch the frontend via:
```powershell
.\start-frontend.ps1
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📈 Market Data Pipeline

Refresh daily stock cache manually or schedule automated background sync:

```bash
python scripts/update_market_cache.py
```

---

## 🛠️ Verification & Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` (in `/frontend`) | Starts Vite development server |
| `npm run build` (in `/frontend`) | Compiles production web bundle |
| `npm run preview` (in `/frontend`) | Previews production build locally |

---

*Developed by [ZenzerJs](https://github.com/ZenzerJs)*
