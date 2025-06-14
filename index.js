const express = require('express')
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const app = express()
const port = 3000

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.set("view engine", "ejs");


mongoose.connect(process.env.MONGODB_STRING , {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');

app.use(authRoutes);

app.get('/', (req, res) => {
    res.render('splash.ejs')
})

app.get('/signin', (req, res) => {
    res.render("signin.ejs");
});

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('./models/user'); // create a User schema

// For parsing form data
app.use(express.urlencoded({ extended: true }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.log("User not found for email:", email);
            return res.status(401).send("Invalid email or password");
        }

        console.log("Found user:", user.email);
        console.log("Stored hash in DB:", user.password);
        console.log("Password entered by user:", password);


        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).send("Invalid email or password");

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: false, // set to true in production with HTTPS
        });

        res.redirect('/home');
    } catch (err) {
        console.error(err);
        res.status(500).send("Login failed");
    }
});

app.get('/signup', (req, res) => {
    res.render("register.ejs");
});


app.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).send("User already exists");

    const newUser = new User({ name, email, password });
    await newUser.save();

    res.redirect('/signin');
  } catch (err) {
    console.error(err);
    res.status(500).send("Registration failed");
  }
});


app.get('/home', authMiddleware, async (req, res) => {
  try {
    const videos = await Video.find().populate('user', 'name'); // only get name
    res.render("home.ejs", { videos });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching videos');
  }
});


const upload = require('./upload');
const Video = require('./models/video'); 

app.get('/upload', (req, res) => {
    res.render('upload.ejs');
});

app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const url = req.file.path;
    const description = req.body.description;
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await Video.create({
      url,
      description,
      user: decoded.id  // store uploader
    });

    res.redirect('/home');
  } catch (err) {
    console.error(err);
    res.status(500).send('Video upload failed.');
  }
});


app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const videos = await Video.find({ user: user._id });

    res.render('profile', { user, videos });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/delete/:id', authMiddleware, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video || video.user.toString() !== req.user.id) {
      return res.status(403).send('Unauthorized');
    }

    await video.deleteOne();
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send('Could not delete video');
  }
});


app.listen(port, () => {
  console.log(`SignStream app listening on port ${port}`)
})
