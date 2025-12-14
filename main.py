
import os
import ee
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from .utils import preprocess_s2, ci_composite, nearest_image_by_date

# Load environment variables
load_dotenv()
EE_SERVICE_ACCOUNT = os.getenv("EE_SERVICE_ACCOUNT")
EE_CREDENTIALS_JSON = os.getenv("EE_CREDENTIALS_JSON")
EE_PROJECT = os.getenv("EE_PROJECT")

# Initialize Earth Engine
if not EE_SERVICE_ACCOUNT or not EE_CREDENTIALS_JSON:
    raise RuntimeError("Missing EE credentials in .env")
credentials = ee.ServiceAccountCredentials(EE_SERVICE_ACCOUNT, EE_CREDENTIALS_JSON)
ee.Initialize(credentials, project=EE_PROJECT)

app = FastAPI(title="Chlorophyll Monitor Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AOI(BaseModel):
    type: str
    coordinates: list

class AnalysisRequest(BaseModel):
    aoi: AOI
    start: str
    end: str
    ci_type: str = "green"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/tiles/ci_composite")
def tiles_ci(req: AnalysisRequest):
    aoi = ee.Geometry.GeoJSON(req.aoi.model_dump())
    col = preprocess_s2(req.start, req.end, aoi, req.ci_type)
    ci = ci_composite(col)
    vis = {'min': -0.1, 'max': 2.5, 'palette': ['#2c7fb8','#41b6c4','#a1dab4','#ffffcc','#fdae61','#f46d43','#d73027']}
    styled = ci.visualize(**vis).reproject(crs='EPSG:3857', scale=10)
    try:
        mapid = styled.getMapId({})
        return {'tileUrl': mapid['tile_fetcher'].url_format}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
