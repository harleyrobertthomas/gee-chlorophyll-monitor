
# Earth Engine Dashboard (Frontend)

A static web dashboard (HTML/CSS/JS) that talks to your FastAPI + Google Earth Engine backend.

## Files
- `index.html` – dashboard UI
- `style.css` – styles
- `config.js` – set `API_BASE` and (optional) `GOOGLE_CLIENT_ID`
- `script.js` – map, AOI drawing, API calls, charts

## Run locally
1. Start your backend (FastAPI): `uvicorn app.main:app --reload`
2. Serve the frontend (any static server):
   ```bash
   python -m http.server 8081
   ```
3. Open `http://localhost:8081/index.html` and set `API_BASE` in `config.js` to your backend URL (e.g. `http://localhost:8000`).

## Deploy on GitHub Pages
1. Push these files to your repo root or `/docs`.
2. In **Settings → Pages**:
   - Source: `Deploy from a branch`
   - Branch: `main` and `/(root)` (or `/docs` if you used that folder)
3. Wait ~1–2 minutes. Your site will be available at:
   `https://<your-username>.github.io/<repo>/`
4. Update `config.js` → `API_BASE` to your Cloud Run backend URL.

## Notes
- Ensure CORS is enabled on the backend to allow your GitHub Pages origin.
- No secrets are stored in the frontend;  configure OAuth Client ID only if you use Google sign‑in.
