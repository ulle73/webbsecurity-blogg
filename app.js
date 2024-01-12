const express = require('express')
const session = require('express-session')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')

dotenv.config()

const app = express()
const PORT =  3000

app.use(express.static('public'))

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: true }))


app.use(session({
  secret: process.env.SESSION_SECRET, 
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 15 },
}))

// MongoDB server
mongoose.connect('mongodb://localhost/blog', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

const db = mongoose.connection

db.once('connection', (stream) => {
  console.log('Working!');
});

// Schema för skapa användare + inlägg
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
})

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  userId: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  signature: String,
})

const User = mongoose.model('User', userSchema)
const Post = mongoose.model('Post', postSchema)

// Dörrvakt för inlogg
const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next()
  }
  res.redirect('/login')
}

////////////////////////////////////////////



// Routes
app.get('/', (req, res) => {
  res.redirect('/login')
})

app.get('/login', (req, res) => {
  res.render('login')
})

app.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await User.findOne({ username })

  // Kolla att inmatat lösen === bcrypt 
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.userId = user.id

    //Extra säkerhet för att skydda mot bruteforce
    setTimeout(() => {
      res.redirect('/dashboard')
    }, 2000)
  } else {
    res.redirect('/login')
  }
})

app.get('/register', (req, res) => {
  res.render('register')
})


app.post('/register', async (req, res) => {
  const { username, password } = req.body

  // Dörrvakt för lika användarnamn
  const existingUser = await User.findOne({ username })

  if (existingUser) {
    setTimeout(()=>{
      res.render('register', { message: 'Username already taken.' })},2000)
  } else {

    // Hasha med random salt
    const startSalt = 10
    const salt = await bcrypt.genSalt(startSalt)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Spara användare
    const newUser = new User({ username, password: hashedPassword })
    await newUser.save()

    setTimeout(()=>{
      res.render('login', {message: 'Registration ok'})},2000)
  }
});



app.get('/dashboard', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)

    if (!user) {
      req.session.destroy()
      return res.redirect('/login')
    }

    const posts = await Post.find({ userId: req.session.userId })
    res.render('dashboard', { user, posts })
  } catch (error) {
    console.error(error)
    res.status(500).send()
  }
})

app.get('/newpost', isLoggedIn, (req, res) => {
  res.render('newpost')
})

app.post('/newpost', isLoggedIn, async (req, res) => {
  const { title, content } = req.body

  try {
    const user = await User.findById(req.session.userId)

    if (user) {
      const post = new Post({
        title,
        content,
        userId: req.session.userId,
        signature: user.username,
      })

      
        await post.save()

      //Extra skydd mot överbelastning
      setTimeout(async ()=>{
        res.redirect('/dashboard')},2000)
    } else {
      res.status(404).send()
    }
  } catch (error) {
    console.error(error)
    res.status(500).send()
  }
})


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err)
      res.status(500).send()
    } else {
      res.redirect('/login')
    }
  })
})


app.post('/deletepost/:postId', isLoggedIn, async (req, res) => {
  const postId = req.params.postId

  try {
    
    await Post.findOneAndDelete({ _id: postId, userId: req.session.userId })

    res.redirect('/dashboard')
  } catch (error) {
    console.error(error)
    res.status(500).send()
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
