const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limits for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MONGODB CONNECTION SETUP
const uri = process.env.MONGO_URI; 
const client = new MongoClient(uri);
let db;

async function connectDB() {
  try {
    if (!uri) throw new Error("MONGO_URI environment variable is missing!");
    await client.connect();
    db = client.db('captains_log'); // This will automatically create the database
    console.log('⚓ Connection to MongoDB Mainframe established.');
  } catch (err) {
    console.error('Database connection failed:', err);
  }
}
connectDB();

// HELPER: Fetch the entire fleet state
async function getFullDB() {
  // Pulls fresh data from the 3 distinct database collections
  const users = await db.collection('users').find({}).toArray();
  const races = await db.collection('races').find({}).toArray();
  const news = await db.collection('news').find({}).sort({ _id: -1 }).toArray(); // Sorts newest first
  return { users, races, news };
}

// REST ENDPOINTS
app.get('/api/data', async (req, res) => {
  try {
    const fullData = await getFullDB();
    res.json(fullData);
  } catch (err) {
    res.status(500).json({ users: [], races: [], news: [] });
  }
});

app.post('/api/save', async (req, res) => {
  try {
    const { mutation, data } = req.body;
    
    // SMART DATABASE MUTATIONS
    if (mutation === 'add_user') {
        await db.collection('users').insertOne(data);
        
    } else if (mutation === 'add_race') {
        await db.collection('races').insertOne(data);
        
    } else if (mutation === 'rsvp') {
        // True Atomic Update: Targets the exact race and injects only this user's RSVP
        const updatePath = `rsvps.${data.username}`;
        await db.collection('races').updateOne(
            { id: data.raceId },
            { $set: { [updatePath]: data.status } }
        );
        
    } else if (mutation === 'post_news') {
        await db.collection('news').insertOne(data);
        
    } else if (mutation === 'update_settings') {
        // Targets the specific user and completely updates their profile
        await db.collection('users').updateOne(
            { username: data.username, vessel: data.vessel },
            { $set: data }
        );
    }
    
    // Instantly return the freshly combined Database state to the client
    const freshDb = await getFullDB();
    res.json({ status: 'success', db: freshDb });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.toString() });
  }
});

// SIMULATED AUTOMATED REMINDER ENGINE
setInterval(async () => {
  if (!db) return; // Wait until DB is connected
  
  const today = new Date().toISOString().split('T')[0];
  const todaysRaces = await db.collection('races').find({ startDate: today }).toArray();
  
  for (const race of todaysRaces) {
    // Find all users who belong to the vessel racing today
    const vesselCrew = await db.collection('users').find({ vessel: { $regex: new RegExp(`^${race.vessel}$`, 'i') } }).toArray();
    
    vesselCrew.forEach(crew => {
      const status = race.rsvps ? race.rsvps[crew.username] : null;
      if (crew.prefs && crew.prefs.email) {
        console.log(`[EMAIL SIMULATION] To: ${crew.email} | Subject: Race Today! | Message: Ahoy ${crew.username}, don't forget the ${race.name} today. Current RSVP: ${status || 'None'}`);
      }
    });
  }
}, 60000); 

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Captain's Log Server Engine active on port ${PORT}`);
});
