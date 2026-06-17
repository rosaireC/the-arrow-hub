const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MONGODB CONNECTION
const uri = process.env.MONGO_URI; 
const client = new MongoClient(uri);
let db;

async function connectDB() {
  try {
    if (!uri) throw new Error("MONGO_URI environment variable is missing!");
    await client.connect();
    db = client.db('captains_log');
    console.log('⚓ Connection to MongoDB Mainframe established.');
  } catch (err) {
    console.error('Database connection failed:', err);
  }
}
connectDB();

async function getFullDB() {
  const users = await db.collection('users').find({}).toArray();
  const races = await db.collection('races').find({}).toArray();
  const news = await db.collection('news').find({}).sort({ _id: -1 }).toArray();
  return { users, races, news };
}

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
    
    if (mutation === 'add_user') {
        await db.collection('users').insertOne(data);
        
    } else if (mutation === 'add_race') {
        await db.collection('races').insertOne(data);
        
    } else if (mutation === 'add_multiple_races') {
        // Handles recurring events by inserting an entire array at once
        await db.collection('races').insertMany(data);
        
    } else if (mutation === 'update_role') {
        // Upgrades a user to Admin
        await db.collection('users').updateOne(
            { username: data.username, vessel: data.vessel },
            { $set: { isAdmin: data.isAdmin } }
        );

    } else if (mutation === 'rsvp') {
        const updatePath = `rsvps.${data.username}`;
        await db.collection('races').updateOne(
            { id: data.raceId },
            { $set: { [updatePath]: data.status } }
        );
        
    } else if (mutation === 'post_news') {
        await db.collection('news').insertOne(data);
        
    } else if (mutation === 'update_settings') {
        await db.collection('users').updateOne(
            { username: data.username, vessel: data.vessel },
            { $set: data }
        );
        
    // --- NEW DELETION MUTATIONS ---

    } else if (mutation === 'delete_news') {
        await db.collection('news').deleteOne({ id: data.id });
        
    } else if (mutation === 'delete_user') {
        // 1. Remove the user from the users collection
        await db.collection('users').deleteOne({ username: data.username, vessel: data.vessel });
        
        // 2. Clean up their RSVPs from the schedule across all races
        const unsetPath = `rsvps.${data.username}`;
        await db.collection('races').updateMany(
            { vessel: data.vessel },
            { $unset: { [unsetPath]: "" } }
        );

    // --- EVENT MANAGEMENT MUTATIONS ---
    
    } else if (mutation === 'delete_race') {
        await db.collection('races').deleteOne({ id: data.id });
        
    } else if (mutation === 'edit_race') {
        // Exclude the _id/id field from the $set operator to avoid MongoDB errors
        const { id, _id, ...updateData } = data; 
        await db.collection('races').updateOne(
            { id: data.id },
            { $set: updateData }
        );
    }
    
    const freshDb = await getFullDB();
    res.json({ status: 'success', db: freshDb });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.toString() });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Captain's Log Server Engine active on port ${PORT}`);
});
