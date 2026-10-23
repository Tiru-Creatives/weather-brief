import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const USER_AGENT = 'FlightWxTrainingApp/1.0';

app.use(express.json());

// In-memory caches
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const metarCache = new Map<string, CacheEntry<any>>();
const tafCache = new Map<string, CacheEntry<any>>();
const forecastCache = new Map<string, CacheEntry<any>>();

const METAR_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TAF_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const FORECAST_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Airport dictionary fallback for coordinates and names
const KNOWN_AIRPORTS: Record<string, { name: string; lat: number; lon: number }> = {
  HAAB: { name: 'Addis Ababa Bole Intl', lat: 8.9779, lon: 38.7993 },
  HADR: { name: 'Dire Dawa Intl', lat: 9.6247, lon: 41.8542 },
  HDAM: { name: 'Djibouti Ambouli Intl', lat: 11.5473, lon: 43.1594 },
  HKMO: { name: 'Mombasa Moi Intl', lat: -4.0348, lon: 39.5942 },
  HKJK: { name: 'Nairobi Jomo Kenyatta Intl', lat: -1.3192, lon: 36.9278 },
  EGLL: { name: 'London Heathrow Airport', lat: 51.4700, lon: -0.4543 },
  EGKK: { name: 'London Gatwick Airport', lat: 51.1537, lon: -0.1821 },
  LFQQ: { name: 'Lille Lesquin Airport', lat: 50.5619, lon: 3.0894 },
  LFPO: { name: 'Paris Orly Airport', lat: 48.7262, lon: 2.3652 },
  LFPG: { name: 'Paris Charles de Gaulle', lat: 49.0097, lon: 2.5479 },
  KJFK: { name: 'John F. Kennedy Intl', lat: 40.6413, lon: -73.7781 },
  KLAX: { name: 'Los Angeles Intl', lat: 33.9416, lon: -118.4085 },
  KORD: { name: 'Chicago O\'Hare Intl', lat: 41.9742, lon: -87.9073 },
  EDDF: { name: 'Frankfurt Airport', lat: 50.0379, lon: 8.5622 },
  OMDB: { name: 'Dubai Intl Airport', lat: 25.2532, lon: 55.3657 },
  VHHH: { name: 'Hong Kong Intl Airport', lat: 22.3080, lon: 113.9185 },
  WSSS: { name: 'Singapore Changi Airport', lat: 1.3644, lon: 103.9915 },
  RJTT: { name: 'Tokyo Haneda Airport', lat: 35.5494, lon: 139.7798 },
  YSSY: { name: 'Sydney Kingsford Smith', lat: -33.9399, lon: 151.1753 },
  FAOR: { name: 'O. R. Tambo Intl (Johannesburg)', lat: -26.1367, lon: 28.2411 },
};

// 1. METAR endpoint: /api/metar?ids=ICAO
app.get('/api/metar', async (req, res) => {
  const idsParam = String(req.query.ids || '').trim().toUpperCase();
  if (!idsParam) {
    return res.status(400).json({ error: 'Missing ids parameter' });
  }

  const icaoList = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  const now = Date.now();
  const results: any[] = [];
  const toFetch: string[] = [];

  // Check cache
  for (const icao of icaoList) {
    const cached = metarCache.get(icao);
    if (cached && (now - cached.timestamp < METAR_TTL_MS)) {
      results.push(cached.data);
    } else {
      toFetch.push(icao);
    }
  }

  if (toFetch.length > 0) {
    const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(toFetch.join(','))}&format=json&hours=6`;
    console.log(`[METAR] Requesting upstream: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      console.log(`[METAR] Upstream status code: ${response.status} for URL: ${url}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[METAR] Upstream returned error status ${response.status}: ${errorText}`);
        return res.status(response.status).json({
          error: `Upstream METAR failed with status ${response.status}: ${errorText || response.statusText}`,
          source: 'NOAA Aviation Weather Center',
          fetchedAtUtc: new Date().toISOString(),
          upstreamUrl: url
        });
      }

      const text = await response.text();
      let fetchedData: any[] = [];
      if (text.trim()) {
        try {
          fetchedData = JSON.parse(text);
        } catch (parseErr) {
          console.error(`[METAR] Failed to parse upstream JSON:`, parseErr);
          return res.status(502).json({
            error: `Invalid JSON returned from NOAA METAR upstream`,
            source: 'NOAA Aviation Weather Center',
            fetchedAtUtc: new Date().toISOString(),
            upstreamUrl: url
          });
        }
      }

      if (Array.isArray(fetchedData)) {
        const latestByIcao = new Map<string, any>();
        for (const item of fetchedData) {
          const code = (item.icaoId || '').toUpperCase();
          if (!latestByIcao.has(code)) {
            latestByIcao.set(code, item);
          }
        }

        for (const icao of toFetch) {
          const data = latestByIcao.get(icao);
          if (data) {
            metarCache.set(icao, { data, timestamp: now });
            results.push(data);
          } else {
            console.log(`[METAR] Station ${icao} not reported in upstream response`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[METAR] Upstream request failed for ${url}:`, err);
      return res.status(502).json({
        error: `METAR upstream request failed: ${err.message || String(err)}`,
        source: 'NOAA Aviation Weather Center',
        fetchedAtUtc: new Date().toISOString(),
        upstreamUrl: url
      });
    }
  }

  res.json({
    source: 'NOAA Aviation Weather Center',
    fetchedAtUtc: new Date().toISOString(),
    data: results
  });
});

// 2. TAF endpoint: /api/taf?ids=ICAO
app.get('/api/taf', async (req, res) => {
  const idsParam = String(req.query.ids || '').trim().toUpperCase();
  if (!idsParam) {
    return res.status(400).json({ error: 'Missing ids parameter' });
  }

  const icaoList = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  const now = Date.now();
  const results: any[] = [];
  const toFetch: string[] = [];

  // Check cache
  for (const icao of icaoList) {
    const cached = tafCache.get(icao);
    if (cached && (now - cached.timestamp < TAF_TTL_MS)) {
      results.push(cached.data);
    } else {
      toFetch.push(icao);
    }
  }

  if (toFetch.length > 0) {
    const url = `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(toFetch.join(','))}&format=json`;
    console.log(`[TAF] Requesting upstream: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      console.log(`[TAF] Upstream status code: ${response.status} for URL: ${url}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[TAF] Upstream returned error status ${response.status}: ${errorText}`);
        return res.status(response.status).json({
          error: `Upstream TAF failed with status ${response.status}: ${errorText || response.statusText}`,
          source: 'NOAA Aviation Weather Center',
          fetchedAtUtc: new Date().toISOString(),
          upstreamUrl: url
        });
      }

      const text = await response.text();
      let fetchedData: any[] = [];
      if (text.trim()) {
        try {
          fetchedData = JSON.parse(text);
        } catch (parseErr) {
          console.error(`[TAF] Failed to parse upstream JSON:`, parseErr);
          return res.status(502).json({
            error: `Invalid JSON returned from NOAA TAF upstream`,
            source: 'NOAA Aviation Weather Center',
            fetchedAtUtc: new Date().toISOString(),
            upstreamUrl: url
          });
        }
      }

      if (Array.isArray(fetchedData)) {
        const latestByIcao = new Map<string, any>();
        for (const item of fetchedData) {
          const code = (item.icaoId || '').toUpperCase();
          if (!latestByIcao.has(code)) {
            latestByIcao.set(code, item);
          }
        }

        for (const icao of toFetch) {
          const data = latestByIcao.get(icao);
          if (data) {
            tafCache.set(icao, { data, timestamp: now });
            results.push(data);
          } else {
            console.log(`[TAF] Station ${icao} not reported in upstream response`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[TAF] Upstream request failed for ${url}:`, err);
      return res.status(502).json({
        error: `TAF upstream request failed: ${err.message || String(err)}`,
        source: 'NOAA Aviation Weather Center',
        fetchedAtUtc: new Date().toISOString(),
        upstreamUrl: url
      });
    }
  }

  res.json({
    source: 'NOAA Aviation Weather Center',
    fetchedAtUtc: new Date().toISOString(),
    data: results
  });
});

// 3. Forecast endpoint: /api/forecast?lat=..&lon=..
app.get('/api/forecast', async (req, res) => {
  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;

  if (!latStr || !lonStr) {
    return res.status(400).json({ error: 'Missing lat or lon parameter' });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();

  const cached = forecastCache.get(cacheKey);
  if (cached && (now - cached.timestamp < FORECAST_TTL_MS)) {
    return res.json({
      source: 'Open-Meteo',
      fetchedAtUtc: new Date(cached.timestamp).toISOString(),
      data: cached.data
    });
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,dew_point_2m,relative_humidity_2m,surface_pressure,precipitation&timezone=UTC`;
  console.log(`[FORECAST] Requesting upstream: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });

    console.log(`[FORECAST] Upstream status code: ${response.status} for URL: ${url}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[FORECAST] Upstream returned error status ${response.status}: ${errorText}`);
      return res.status(response.status).json({
        error: `Open-Meteo forecast failed with status ${response.status}: ${errorText || response.statusText}`,
        source: 'Open-Meteo',
        fetchedAtUtc: new Date().toISOString(),
        upstreamUrl: url
      });
    }

    const data = await response.json();
    forecastCache.set(cacheKey, { data, timestamp: now });
    return res.json({
      source: 'Open-Meteo',
      fetchedAtUtc: new Date().toISOString(),
      data
    });
  } catch (err: any) {
    console.error(`[FORECAST] Upstream request failed for ${url}:`, err);
    return res.status(502).json({
      error: `Open-Meteo forecast request failed: ${err.message || String(err)}`,
      source: 'Open-Meteo',
      fetchedAtUtc: new Date().toISOString(),
      upstreamUrl: url
    });
  }
});

// Airport metadata helper
app.get('/api/airport-info', (req, res) => {
  const icao = String(req.query.icao || '').trim().toUpperCase();
  const info = KNOWN_AIRPORTS[icao] || null;
  res.json({ icao, info });
});

// Setup Vite middleware in dev or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files from dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const host = '0.0.0.0';
  app.listen(PORT, host, () => {
    console.log(`Flight Weather Briefing server listening on http://${host}:${PORT}`);
  });
}

startServer();
