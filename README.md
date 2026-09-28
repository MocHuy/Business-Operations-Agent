# Business Procurement Agent

Business Operations Agent demo with a Python/Upstage prototype, a frozen Vanilla JS UX reference, and the React + Vite frontend.

## Browser Applications

Open `demoWeb/login.html` to run the frozen UX/business-rule reference. Demo accounts and workflows are documented in `demoWeb/README.md`; demo password is `123`.

Run the React application from PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Build and run automated component/service checks with `npm run build` and `npm run test` from `frontend/`. The React tests use Vitest and Happy DOM; they do not replace visual verification in a real browser.

The browser applications are local demos backed by `localStorage`. Production authentication and authorization must be enforced again by the backend Harness/API.

## Python Agent Prototype

The Python prototype uses Upstage Solar Pro with application-controlled business tools and local JSON data. Requirements: Python 3.10 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set `UPSTAGE_API_KEY` in the local `.env` file, then run:

```powershell
python main.py
```

The Python flow is `main.py` → `agent.py` → `upstage_client.py` and `tools/tool_registry.py` → local JSON business data. Tool execution and business validation stay in the Python application.