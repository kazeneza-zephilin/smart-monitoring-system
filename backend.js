const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' folder

// Store latest measurements
let latestData = {
    angle: 0,
    distance: -1,
    height: 0,
    temperature: 25,
    moisture: 60
};

// API to receive data from ESP8266
app.post('/api/update', (req, res) => {
    const { angle, distance, height, temperature, moisture } = req.body;
    latestData = {
        angle: angle || latestData.angle,
        distance: distance || latestData.distance,
        height: height || latestData.height,
        temperature: temperature || latestData.temperature,
        moisture: moisture || latestData.moisture
    };
    console.log('Data updated:', latestData);
    res.status(200).send('Data received');
});

// API to serve data to frontend
app.get('/api/data', (req, res) => {
    res.json(latestData);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});