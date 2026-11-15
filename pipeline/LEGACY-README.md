# SPILE — prototipo di analisi del rischio vegetazionale (Verbania, VB)

Dashboard da sala controllo che mostra, sul comune di Verbania, le zone in cui
alberi **la cui altezza supera la distanza dall'asset** possono cadere su linee
elettriche, ferrovia e strade, oppure alimentare incendi o intasare prese
idroelettriche. Distingue le celle **dentro** la fascia di rispetto (già soggette
a taglio programmato) da quelle **fuori** fascia ma in zona di caduta: le seconde
sono il valore del prodotto.

```
spile/
├── pipeline/        Python: scarica, ritaglia, calcola, esporta
│   ├── config.py        parametri (fasce, pesi, soglie, URL)
│   ├── fetch_osm.py     OpenStreetMap via Overpass (confine + reti + edifici)
│   ├── fetch_rasters.py WorldCover, Copernicus DEM, canopy height (letture a finestra)
│   ├── compute_risk.py  modello di rischio su griglia 10 m -> zones/assets/stats/top50
│   ├── enrich_catasto.py particelle catastali via WMS AdE (top 120 zone)
│   ├── export_bundle.py impacchetta data/* in data/bundle.js (apertura da file://)
│   └── run_all.py       tutto in sequenza
├── data/            output della pipeline (già prodotto: la dashboard si apre senza rieseguire)
│   ├── zones.geojson, assets.geojson, boundary.geojson, stats.json, top50.csv, bundle.js
├── dashboard/       index.html + style.css + app.js (MapLibre GL JS, nessun framework)
└── cache/           download grezzi e griglie intermedie (rigenerabili)
```

## Avvio

Dashboard: aprire `dashboard/index.html` a schermo intero (F11), oppure
`python -m http.server 8765 --directory spile` e andare su
`http://localhost:8765/dashboard/`. Il pannello va tenuto visibile: in un tab in
background MapLibre sospende il rendering. Legge
`data/bundle.js`, quindi funziona anche da `file://`. Servono solo internet per
le tile CARTO / terreno AWS e i font.

Pipeline (Python 3.11+):

```bash
pip install geopandas rasterio shapely numpy scipy requests pyproj
cd pipeline
python run_all.py            # usa la cache se c'è
python run_all.py --force    # riscarica tutto (~3-5 min)
python run_all.py --no-catasto
```

## Fonti dati (tutte gratuite, senza API key)

| Fonte | Uso | Stato / note |
|---|---|---|
| OpenStreetMap via Overpass (`lz4.overpass-api.de`, `z.`, `overpass.osm.ch`) | confine comunale (relation 46498), power=line/minor_line/substation/plant/generator, railway, highway, waterway, building | il nodo principale `overpass-api.de` era saturo (502): usati i mirror con fallback automatico |
| ESA WorldCover 2021 v200 (tile N45E006, S3 eu-central-1) | classe 10 = tree cover | OK |
| Copernicus DEM GLO-30 (tile N45 E008, S3) | pendenza, esposizione, "a monte" per l'idro | OK |
| Canopy height | altezza chioma per cella | **Il tile ETH Lang et al. (`share.phys.ethz.ch/.../3deg_cogs`) non è più servito** (redirect a research-collection -> HTTP 500). Usato il **Meta/WRI Global Canopy Height 1 m** (Tolan et al. 2024, `s3://dataforgood-fb-data`, AWS Open Data): letto a ~2.5 m dalle overview del COG e aggregato con il **massimo** su 10 m. Fallback a 20 m costanti se irraggiungibile, segnalato in dashboard. |
| Catasto Agenzia delle Entrate | foglio/particella della zona | Download massivo GML (ATOM/WFS) **non raggiungibile** (HTTP 500 / SOAP fault). Usato il **WMS INSPIRE** con `GetFeatureInfo` su `CP.CadastralParcel` nel centroide delle prime 120 zone (una chiamata ogni 0,35 s). Il WMS a volte risponde con una feature vuota: tre tentativi per zona. |
| Terreno 3D / basemap | AWS Terrain Tiles (terrarium) + **OpenFreeMap `dark`** (vettoriale, senza key) | I raster CARTO Dark Matter restituiscono oggi tile "API KEY REQUIRED": sostituiti con OpenFreeMap. Se OpenFreeMap non risponde entro 8 s la dashboard parte con sfondo nero + hillshade. |
| Sentinel-2 NDVI/NDWI | opzionale | non integrato (semaforo rosso) |

**Limite dichiarato:** a Verbania OSM non contiene la rete MT di e-distribuzione
(solo le linee AT 132/220 kV di Terna e due linee a 50 kV). Il conteggio "Linee
MT" è quindi zero ed è segnalato come "non in OSM". Le gallerie
(`tunnel=yes`) sono escluse dall'analisi di caduta.

## Modello di calcolo

1. Griglia 10 m in UTM 32N (EPSG:32632) sul bbox del comune, ritaglio sul confine.
2. Celle arboree = WorldCover classe 10 dentro Verbania; `h` = canopy height
   (max su 10 m, min 3 m sulle celle bosco, cap 45 m); `s`, `a` dal DEM.
3. Asset lineari spezzati in segmenti da 25 m, rasterizzati con id; distanza
   `d` e segmento più vicino per cella via EDT (cella attraversata dall'asset: d = 5 m).
4. Zona di caduta: `d <= h`.
   `R_caduta = max(0,(h-d)/h) · (1 + s/45) · w_asset`,
   `w_asset` = AT 1.0, MT 0.75, ferrovia 0.9, trunk 0.7, primary 0.6, secondary 0.5.
   Per l'elettrico si moltiplica per `0.6 + 0.4·densità edifici entro 500 m` (proxy utenze).
   Dentro fascia di rispetto il rischio è moltiplicato per 0.7 (taglio già programmato).
5. Fascia di rispetto (semplificazione, parametri in `config.py`): AT 15 m, MT 10 m,
   ferrovia 6 m (DPR 753/80 art. 52), strade 6 m (DPR 495/92 art. 26).
6. `R_incendio` = 0.30·continuità combustibile (raggio 100 m) + 0.20·pendenza +
   0.15·esposizione sud + 0.15·prossimità innesco (strade/edifici ≤ 200 m) +
   0.20·prossimità bersaglio (interfaccia bosco-urbano ≤ 300 m), normalizzato per
   rango sulle celle bosco, elevato all'8ª potenza (solo la coda alta è critica) e
   scalato a 0.9, così una caduta certa supera sempre un incendio probabile.
7. `R_idro` = 0.9 · (1 − d_acqua/200) · min(h/25, 1) · (0.35 + 0.65·pendenza) sulle
   celle bosco entro 200 m da corsi d'acqua a ≤ 1,5 km da un impianto idro e a
   quota ≥ impianto.
8. Classi sul rischio massimo: alto ≥ 0.45, medio ≥ 0.20. Le zone sono componenti
   connesse (8-conn) di celle critiche con lo stesso tipo dominante, spezzate su
   tessere di 250 m; ogni zona porta la lista di tutti i tipi presenti, l'asset
   minacciato, DENTRO/FUORI fascia (maggioranza delle celle in caduta) e la particella.

I pesi sono scelte di prototipo, non calibrazioni: sono tutti in `config.py`.

## Dashboard

Layout fisso senza scroll (progettato per 1920×1080, regge 1366×768): barra
superiore con ticker e orologio, mappa 3D (pitch 56°, esagerazione 1.5) con
contorno comunale, reti con glow, tratteggio animato sulle linee elettriche,
zone rosse/ambra (tratteggiate se DENTRO fascia, piene se FUORI), pin e
pannello di dettaglio al click. Interruttori per tipo di rischio: spegnendo un
tipo le zone vengono riclassificate sui tipi rimasti. Colonna destra: zone
critiche, asset esposti, alberi fuori fascia (ciambella). Striscia inferiore:
copertura, rischio per tipo, top 10 segmenti (cliccabili), pendenza, stato fonti.
