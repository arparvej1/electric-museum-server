const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://electric-museum.web.app',
    'https://electric-museum.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());

const uri = `${process.env.MONGODB_EM_CONNECTION}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Get current date and time ------------------- 
const getCurrentDateTime = () => {
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
  ];

  // Get current date and time in local time
  const currentDateTime = new Date();

  // Format date and time
  const day = currentDateTime.getDate().toString().padStart(2, '0');
  const month = months[currentDateTime.getMonth()];
  const year = currentDateTime.getFullYear();
  const time = currentDateTime.toLocaleTimeString('en-US', { hour12: true });

  return `${day}-${month}-${year}, ${time}`;
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const mainDB = client.db('ElectricMuseumDB'); // << ----- main Database here -----
    const userCollection = mainDB.collection('users');
    const productCollection = mainDB.collection('products');

    // All Users ------------------
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // --- received user from client for userRegister
    app.post('/userRegister', async (req, res) => {
      const user = req.body;
      const { name, photo_url, email } = user;

      // Validate email and mobileNumber to prevent duplicates
      const existingUserWithEmail = await userCollection.findOne({ email: email });
      if (existingUserWithEmail) {
        return res.status(400).send({ error: 'Email already exists' });
      }

      const newUser = {
        name,
        photo_url,
        email,
        creationTime: getCurrentDateTime(),
        lastLogInTime: getCurrentDateTime()
      };

      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // --- checkEmail exists -------
    app.get('/checkEmail/:email', async (req, res) => {
      const email = req.params.email;
      try {
        const result = await userCollection.findOne({ email });
        if (result) {
          res.send({ exists: true }); // Email exists
        } else {
          res.send({ exists: false }); // Email does not exist
        }
      } catch (error) {
        console.error('Error checking if email exists:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });


    // --- check User Admin -------
    app.get('/checkAdmin/:email', async (req, res) => {
      const email = req.params.email;
      try {
        const result = await userCollection.findOne({ email });
        if (result.role === "admin") {
          res.send({ admin: true }); // Email exists
        } else {
          res.send({ admin: false }); // Email does not exist
        }
      } catch (error) {
        console.error('Error checking if email exists:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });


    // get all products ------------------
    app.get('/products', async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

// ---------- Server is running .......
app.get('/', (req, res) => {
  res.send('Server is running...')
});

app.listen(port, () => {
  console.log(`Server is running port: ${port}
  Link: http://localhost:${port}`);
});