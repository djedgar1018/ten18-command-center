const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

// ── Live data cache ────────────────────────────────────────────────
let cachedData = {
  intellitrade: { balance: 10215.66, pnl: 215.66, winRate: 71.1, trades: 491 },
  intellitradeScanner: { running: false, signals: 0 },
  beatmatch: { users: 9, bookings: 2, revenue: 687 },
  lastUpdated: new Date().toISOString(),
  apiStatus: { intellitrade: 'fallback', beatmatch: 'fallback' }
};

// ── Fetch live data from real APIs ─────────────────────────────────
async function fetchLiveData() {
  const next = { ...cachedData, lastUpdated: new Date().toISOString() };
  next.apiStatus = { intellitrade: 'ok', beatmatch: 'ok' };

  // IntelliTrade scanner status
  try {
    const res = await fetch(
      "https://intellitradeai-production.up.railway.app/scanner/status",
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      next.intellitradeScanner = {
        running: data.running ?? data.scanner_running ?? false,
        signals: data.signals ?? data.active_signals ?? 0,
        ...data
      };
    } else {
      next.apiStatus.intellitrade = `http_${res.status}`;
    }
  } catch (e) {
    next.apiStatus.intellitrade = 'timeout';
  }

  // IntelliTrade performance
  try {
    const res = await fetch(
      "https://intellitradeai-production.up.railway.app/performance",
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      next.intellitrade = {
        balance:  data.balance  ?? data.portfolio_value  ?? cachedData.intellitrade.balance,
        pnl:      data.pnl      ?? data.total_pnl        ?? cachedData.intellitrade.pnl,
        winRate:  data.win_rate ?? data.winRate          ?? cachedData.intellitrade.winRate,
        trades:   data.trades   ?? data.total_trades     ?? cachedData.intellitrade.trades,
      };
    }
  } catch (_) {}

  // Beatmatch bookings (may return 401 — endpoint exists, use cached data)
  try {
    const res = await fetch(
      "https://beat-match-production.up.railway.app/api/bookings",
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      const bookings = Array.isArray(data) ? data : (data.bookings ?? []);
      next.beatmatch = {
        ...cachedData.beatmatch,
        bookings: bookings.length,
      };
      next.apiStatus.beatmatch = 'ok';
    } else if (res.status === 401) {
      next.apiStatus.beatmatch = 'auth_required';
    } else {
      next.apiStatus.beatmatch = `http_${res.status}`;
    }
  } catch (e) {
    next.apiStatus.beatmatch = 'timeout';
  }

  cachedData = next;
  console.log(
    `[${new Date().toISOString()}] Live data refreshed — ` +
    `IT: $${next.intellitrade.balance} | ` +
    `Scanner: ${next.intellitradeScanner.running} | ` +
    `BM: ${next.apiStatus.beatmatch}`
  );
  return next;
}

// Refresh every 30 seconds
fetchLiveData();
setInterval(fetchLiveData, 30000);

// ── HTTP Server ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (url === '/api/live') {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(cachedData));
    return;
  }

  if (url === '/health') {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", lastUpdated: cachedData.lastUpdated }));
    return;
  }

  // Serve index.html for all routes
  try {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(html);
  } catch (e) {
    res.statusCode = 500;
    res.end("Error loading index.html");
  }
});

server.listen(PORT, () => {
  console.log(`TEN/18 Command Center running on http://localhost:${PORT}`);
});
