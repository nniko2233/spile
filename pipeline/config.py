"""Configurazione SPILE — prototipo limitato al comune di Verbania (VB)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
DATA = ROOT / "data"
CACHE.mkdir(exist_ok=True)
DATA.mkdir(exist_ok=True)

# --- Comune -----------------------------------------------------------------
COMUNE = "Verbania"
OSM_RELATION_ID = 46498          # relation admin_level=8 "Verbania"
ISTAT_CODE = "103072"
CATASTO_CODE = "L746"
CRS_METRIC = "EPSG:32632"        # UTM 32N

# --- Overpass (mirror in ordine di preferenza) ------------------------------
OVERPASS_ENDPOINTS = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
USER_AGENT = "spile-prototype/0.1 (hackathon, vegetation risk)"

# --- Raster -----------------------------------------------------------------
# ESA WorldCover 2021 v200, tile 3x3 gradi, classe 10 = tree cover
WORLDCOVER_URL = ("https://esa-worldcover.s3.eu-central-1.amazonaws.com/"
                  "v200/2021/map/ESA_WorldCover_10m_2021_v200_N45E006_Map.tif")
# Copernicus DEM GLO-30, tile 1x1 grado
COPDEM_URL = ("https://copernicus-dem-30m.s3.amazonaws.com/"
              "Copernicus_DSM_COG_10_N45_00_E008_00_DEM/"
              "Copernicus_DSM_COG_10_N45_00_E008_00_DEM.tif")
# Canopy height: Meta/WRI Global Canopy Height 1 m (Tolan et al. 2024), AWS Open Data.
# Nota: il tile ETH Lang et al. (share.phys.ethz.ch) non e' piu' servito via HTTP
# diretto (redirect a research-collection -> 500), quindi usiamo questo dataset.
CHM_BUCKET = "https://dataforgood-fb-data.s3.amazonaws.com"
CHM_PREFIX = "forests/v1/alsgedi_global_v6_float/chm/"
CHM_QUADKEY_LEVEL = 9
CHM_FALLBACK_HEIGHT = 20.0       # m, usata se il CHM non e' raggiungibile

GRID_RES = 10.0                  # m, griglia di analisi

# --- Parametri del modello -------------------------------------------------
# Fascia di rispetto (semplificazione dichiarata, m dall'asse dell'asset):
#  - AT (>= 30 kV): 15 m   (corridoio di taglio tipico Terna, parametro)
#  - MT (< 30 kV): 10 m
#  - ferrovia: 6 m  (DPR 753/80 art. 52, alberi ad alto fusto)
#  - strada statale/principale: 6 m (DPR 495/92 art. 26, fuori centro abitato)
FASCIA = {"power_hv": 15.0, "power_mv": 10.0, "rail": 6.0, "road": 6.0}

# Peso di criticita' dell'asset (w_asset)
W_ASSET = {"power_hv": 1.0, "power_mv": 0.75, "rail": 0.9,
           "road_trunk": 0.7, "road_primary": 0.6, "road_secondary": 0.5}

IN_FASCIA_FACTOR = 0.7            # rischio residuo per celle dentro fascia (taglio gia' programmato)
HV_VOLTAGE_MIN = 30000           # V: >= 30 kV = alta tensione (classificazione italiana)
BUILDING_RADIUS = 500.0          # m, utenze servite (proxy)
FIRE_FUEL_RADIUS = 100.0         # m, continuita' combustibile
FIRE_IGNITION_RADIUS = 200.0     # m, distanza da innesco (strade, edifici)
HYDRO_WATER_RADIUS = 200.0       # m, bosco entro N m dal corso d'acqua
HYDRO_PLANT_RADIUS = 1500.0      # m, tratto di corso d'acqua a monte dell'impianto
MAX_TREE_HEIGHT = 45.0

# Classi di rischio sul punteggio massimo 0-1
CLASS_HIGH = 0.45
CLASS_MED = 0.20
MIN_ZONE_CELLS = 3
