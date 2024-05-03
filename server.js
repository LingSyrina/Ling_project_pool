// Load environment variables
require('dotenv').config();

// Require necessary packages
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const app = express();

// Set view engine to EJS
app.set('view engine', 'ejs');

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Configure body-parser for form data
app.use(bodyParser.urlencoded({ extended: true }));

// Configure file upload handling
app.use(fileUpload());

// Configure session management
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
}));

// Initialize Passport and configure session management
app.use(passport.initialize());
app.use(passport.session());

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback'
}, function(accessToken, refreshToken, profile, cb) {
    return cb(null, profile);
}));

// Serialize and deserialize user sessions
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

// Define a simple in-memory "database"
let projectsDatabase = {};

function findOrCreateUserProjects(userId) {
    if (!projectsDatabase[userId]) {
        projectsDatabase[userId] = [];
    }
    return projectsDatabase[userId];
}

// Define routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/home');
  });

app.get('/', (req, res) => {
      res.render('layout', {
          title: 'Welcome Page',
          heading: 'Welcome!',
          body: `
              <p>This is the homepage.</p>
          `
      });
  });

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login Failed', message: 'Login failed. Please try again.' });
});

app.get('/all-projects', (req, res) => {
    // Assuming projectsDatabase is an array of project objects
    allProjects = []
    Object.keys(projectsDatabase).forEach(userId => {
        allProjects = allProjects.concat(projectsDatabase[userId]); // Flatten all user projects into a single array
    });

      res.render('all-projects', {
          title: 'All Projects',
          heading: 'All Projects', // Define the heading variable
          projects: allProjects
      });
});


app.get('/home', (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/google');
    }
    const userProjects = findOrCreateUserProjects(req.user.id);
    res.render('home', {
        title: 'Your Projects',
        user: req.user,
        projects: userProjects
    });
});

app.get('/add-project', (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/google');
    }
    res.render('add-project', {
        title: 'Add Project'
    });
});

app.post('/add-project', (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/google');
    }
    const userProjects = findOrCreateUserProjects(req.user.id);
    const newProject = {
        name: req.body.name,
        description: req.body.description,
        authors: req.body.authors,
        collaboration: req.body.collaboration === 'true',
        keywords: req.body.keywords ? req.body.keywords.split(',') : [],
        status: req.body.status,
        contactEmail: req.body.contactEmail,
        files: []
    };

    if (req.files && req.files.projectFile) {
        const file = req.files.projectFile;
        const uploadPath = `uploads/${file.name}`;
        file.mv(uploadPath, function(err) {
            if (err) {
                return res.status(500).send(err);
            }
            newProject.files.push(uploadPath);
            userProjects.push(newProject);
            res.redirect('/home');
        });
    } else {
        userProjects.push(newProject);
        res.redirect('/home');
    }
});


app.get('/edit-project/:id', (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    const projectId = parseInt(req.params.id, 10);
    const userProjects = findOrCreateUserProjects(req.user.id);
    if (projectId >= 0 && projectId < userProjects.length) {
        res.render('edit-project', {
            title: 'Edit Project',
            project: userProjects[projectId],
            projectId: projectId
        });
    } else {
        res.send('Project not found');
    }
});

app.post('/update-project/:id', async (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    const projectId = parseInt(req.params.id, 10);
    const userProjects = findOrCreateUserProjects(req.user.id);
    if (projectId >= 0 && projectId < userProjects.length) {
        const project = userProjects[projectId];
        project.name = req.body.name;
        project.description = req.body.description;
        project.authors = req.body.authors;
        project.collaboration = req.body.collaboration === 'true';
        project.keywords = req.body.keywords ? req.body.keywords.split(',') : [];
        project.status = req.body.status; // Update status
        project.contactEmail = req.body.contactEmail;
        if (req.files && req.files.projectFile) {
            const file = req.files.projectFile;
            const uploadPath = `uploads/${file.name}`;
            try {
                await file.mv(uploadPath);
                project.files.push(uploadPath);
            } catch (err) {
                return res.status(500).send(err);
            }
        }
        res.redirect('/home');
    } else {
        res.status(404).send('Project not found');
    }
});

app.post('/delete-project/:id', (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    const projectId = parseInt(req.params.id, 10);
    const userProjects = findOrCreateUserProjects(req.user.id);

    // Perform the deletion if the index is valid
    if (projectId >= 0 && projectId < userProjects.length) {
        userProjects.splice(projectId, 1); // Removes the project at the given index
        res.redirect('/home'); // Redirect to the home page after deletion
    } else {
        res.status(404).send('Project not found');
    }
});


app.listen(3000, () => console.log('Server running on port 3000!'));
