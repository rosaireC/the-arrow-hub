const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Baseline Database Presets
const defaultData = {
  users: [
    { email: "rosaire@torontoadventures.ca", username: "rosaire", password: "july1988", isAdmin: true },
    { email: "crew1@arrow.com", username: "alex", password: "password123", isAdmin: false }
  ],
  races: [
    {
      id: "race-1",
      name: "Lake Ontario Summer Opener",
      startDate: "2026-06-20",
      startTime: "08:00",
      endDate: "2026-06-22",
      endTime: "17:00",
      startLoc: "Toronto Harbour",
      endLoc: "Niagara-on-the-Lake",
      spaces: 10,
      notes: "High speed downwind leg anticipated. Bring drysuits.",
      rsvps: { "alex": "going" }
    }
  ]
};

// Database Initialization Safety Check
function readDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE);
    return JSON.parse(raw);
  } catch (e) {
    return defaultData;
  }
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// REST API ENDPOINTS
app.get('/api/data', (req, res) => {
  res.json(readDatabase());
});

app.post('/api/save', (req, res) => {
  try {
    const incomingData = req.body;
    const currentDb = readDatabase();
    
    if (incomingData.users) currentDb.users = incomingData.users;
    if (incomingData.races) currentDb.races = incomingData.races;
    
    writeDatabase(currentDb);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.toString() });
  }
});

// Fallback Route redirects to Frontend interface 
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`The Arrow Tactical Engine running smoothly on port ${PORT}`);
});