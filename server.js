const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

// Fetch live data from APIs
async function fetchLiveData() {
  const data = {
    intellitrade: { balance: 10215.66, pnl: 215.66, winRate: 71.1, trades: 491 },
    beatmatch: { users: 9, bookings: 2, revenue: 687 },
    intellitradeScanner: { running: false, signals: 0 },
    lastUpdated: new Date().toISOString()
  };

  try {
    const itRes = await fetch("https://intellitradeai-production.up.railway.app/scanner/status", { signal: AbortSignal.timeout(3000) });
    const itData = await itRes.json();
    data.intellitradeScanner = itData;
  } catch(e) {}

  return data;
}

// Inject live data into HTML
function buildPage(liveData) {
  let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  
  // Inject live data as a script tag
  const dataScript = `<script>
    window.LIVE_DATA = ${JSON.stringify(liveData)};
    // Update cards with live data
    document.addEventListener('DOMContentLoaded', function() {
      if (window.LIVE_DATA) {
        // Update scanner status
        const scannerStatus = LIVE_DATA.intellitradeScanner.running ? 'SCANNING' : 'STANDBY';
        console.log('Live data loaded:', LIVE_DATA);
      }
    });
  </script>`;
  
  html = html.replace('</body>', dataScript + '</body>');
  return html;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/live') {
    const data = await fetchLiveData();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(data));
    return;
  }
  
  if (req.url === '/health') {
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  const data = await fetchLiveData();
  const html = buildPage(data);
  res.setHeader("Content-Type", "text/html");
  res.end(html);
});

server.listen(PORT, () => console.log(`Ten/18 Command Center running on port ${PORT}`));
