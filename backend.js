const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'smart_crop_monitoring'
};

let latestData = {
    crop: 'Maize',
    plantingDate: null,
    timeElapsed: 0,
    angle: 0,
    distance: -1,
    height: 0,
    temperature: 25,
    moisture: 60,
    problem: 'Unknown',
    recommendation: 'Gathering data...',
    idealHeight: '50-100 cm',
    idealTemp: '20-30°C',
    idealMoisture: '50-70%'
};

const cropReference = {
    'Maize': { idealHeight: '50-100 cm', idealTemp: '20-30°C', idealMoisture: '50-70%' },
    'Wheat': { idealHeight: '40-80 cm', idealTemp: '15-25°C', idealMoisture: '40-60%' },
    'Rice': { idealHeight: '30-60 cm', idealTemp: '25-35°C', idealMoisture: '70-90%' },
    'Soybean': { idealHeight: '30-70 cm', idealTemp: '20-30°C', idealMoisture: '40-60%' }
};

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [existing] = await connection.execute('SELECT username FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            await connection.end();
            return res.status(400).json({ message: 'Username already exists' });
        }
        await connection.execute('INSERT INTO users (username, password, role, profile_complete) VALUES (?, ?, ?, ?)', [username, password, role, false]);
        await connection.end();
        res.status(200).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        await connection.end();
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = rows[0];
        res.status(200).json({ role: user.role, username: user.username, profile_complete: user.profile_complete });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update sensor data
app.post('/api/update', (req, res) => {
    const { angle, distance, height, temperature, moisture } = req.body;
    latestData.angle = angle || latestData.angle;
    latestData.distance = distance || latestData.distance;
    latestData.height = height || latestData.height;
    latestData.temperature = temperature || latestData.temperature;
    latestData.moisture = moisture || latestData.moisture;

    if (latestData.plantingDate) {
        latestData.timeElapsed = Math.floor((Date.now() - new Date(latestData.plantingDate)) / (1000 * 60 * 60 * 24));
    }

    latestData.problem = 'Data updated';
    latestData.recommendation = 'No prediction available';
    res.status(200).send('Data received');
});

// Set crop and planting date
app.post('/api/set-crop', (req, res) => {
    const { crop, plantingDate } = req.body;
    latestData.crop = crop || latestData.crop;
    latestData.plantingDate = plantingDate || latestData.plantingDate;
    latestData.idealHeight = cropReference[latestData.crop].idealHeight;
    latestData.idealTemp = cropReference[latestData.crop].idealTemp;
    latestData.idealMoisture = cropReference[latestData.crop].idealMoisture;
    latestData.timeElapsed = Math.floor((Date.now() - new Date(latestData.plantingDate)) / (1000 * 60 * 60 * 24));
    res.status(200).send('Crop and planting date updated');
});

app.get('/api/data', (req, res) => {
    res.json(latestData);
});

// Update agronomist profile with professional job
app.post('/api/update-profile', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'cv', maxCount: 1 }]), async (req, res) => {
    const { username, name, email, phone, professional_job } = req.body;
    const photo = req.files['photo'] ? req.files['photo'][0].filename : null;
    const cv = req.files['cv'] ? req.files['cv'][0].filename : null;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT id, profile_complete FROM users WHERE username = ? AND role = "agronomist"', [username]);
        if (users.length === 0) {
            await connection.end();
            return res.status(403).json({ message: 'Unauthorized' });
        }
        const userId = users[0].id;
        if (users[0].profile_complete) {
            await connection.end();
            return res.status(403).json({ message: 'Profile already completed' });
        }
        await connection.execute(
            'INSERT INTO agronomist_profiles (user_id, name, email, phone, cv_path, photo_path, professional_job) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, email = ?, phone = ?, cv_path = ?, photo_path = ?, professional_job = ?',
            [userId, name, email, phone, cv, photo, professional_job, name, email, phone, cv, photo, professional_job]
        );
        await connection.execute('UPDATE users SET profile_complete = TRUE WHERE id = ?', [userId]);
        await connection.end();
        res.status(200).json({ message: 'Profile updated', profile: { name, email, phone, cv, photo, professional_job } });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/profile', async (req, res) => {
    const { username } = req.query;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT id, profile_complete FROM users WHERE username = ? AND role = "agronomist"', [username]);
        if (users.length === 0) {
            await connection.end();
            return res.status(403).json({ message: 'Unauthorized' });
        }
        const userId = users[0].id;
        const [profiles] = await connection.execute('SELECT name, email, phone, cv_path, photo_path, professional_job FROM agronomist_profiles WHERE user_id = ?', [userId]);
        await connection.end();
        res.status(200).json({ ...(profiles[0] || {}), profile_complete: users[0].profile_complete });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch all agronomists
app.get('/api/agronomists', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [agronomists] = await connection.execute(`
            SELECT u.username, ap.name, ap.email, ap.phone, ap.cv_path, ap.photo_path, ap.professional_job 
            FROM users u 
            LEFT JOIN agronomist_profiles ap ON u.id = ap.user_id 
            WHERE u.role = 'agronomist'
        `);
        await connection.end();
        res.status(200).json(agronomists);
    } catch (err) {
        console.error('Error fetching agronomists:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
});