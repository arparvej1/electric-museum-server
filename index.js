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

    // Update product - put / update picture
    app.put('/newPicture/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedProduct = req.body;

      const product = {
        $set: {
          ProductImage: updatedProduct.newPicture
        }
      }
      const result = await productCollection.updateOne(filter, product, options);
      res.send(result);
    });

    app.get('/productsCount', async (req, res) => {
      const item = req.query.filterText;
      let searchText = {};

      if (item) {
        searchText = {
          $or: [
            { ProductName: { $regex: item, $options: 'i' } },
            { BrandName: { $regex: item, $options: 'i' } },
            { Category: { $regex: item, $options: 'i' } }
          ]
        };
      }

      // Add brand filter
      const brand = req.query.brand;
      if (brand) {
        searchText.BrandName = brand;
      }

      // Add category filter
      const category = req.query.category;
      if (category) {
        searchText.Category = category;
      }

      // Add price range filter
      const minPrice = parseFloat(req.query.minPrice);
      const maxPrice = parseFloat(req.query.maxPrice);
      if (!isNaN(minPrice) || !isNaN(maxPrice)) {
        searchText.Price = {};
        if (!isNaN(minPrice)) {
          searchText.Price.$gte = minPrice;
        }
        if (!isNaN(maxPrice)) {
          searchText.Price.$lte = maxPrice;
        }
      }

      // const count = productCollection.estimatedDocumentCount();
      const result = await productCollection.find(searchText).toArray();
      const count = result.length;
      res.send({ count });
    });

    app.get('/productsLimit', async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 9;

      // Determine the sorting criteria
      const sortBy = req.query.sortBy || 'Price'; // default to Price
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; // -1 for descending, 1 for ascending

      // Initialize the search filter object
      let searchText = {};

      // Add text search filter
      const item = req.query.filterText;
      if (item) {
        searchText.$or = [
          { ProductName: { $regex: item, $options: 'i' } },
          { BrandName: { $regex: item, $options: 'i' } },
          { Category: { $regex: item, $options: 'i' } }
        ];
      }

      // Add brand filter
      const brand = req.query.brand;
      if (brand) {
        searchText.BrandName = brand;
      }

      // Add category filter
      const category = req.query.category;
      if (category) {
        searchText.Category = category;
      }

      // Add price range filter
      const minPrice = parseFloat(req.query.minPrice);
      const maxPrice = parseFloat(req.query.maxPrice);
      if (!isNaN(minPrice) || !isNaN(maxPrice)) {
        searchText.Price = {};
        if (!isNaN(minPrice)) {
          searchText.Price.$gte = minPrice;
        }
        if (!isNaN(maxPrice)) {
          searchText.Price.$lte = maxPrice;
        }
      }

      try {
        const result = await productCollection.find(searchText)
          .sort({ [sortBy]: sortOrder }) // Apply sorting based on query parameters
          .skip(page * size)
          .limit(size)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });


    app.get('/product/:productId', async (req, res) => {
      const id = req.params.productId;
      const query = { _id: new ObjectId(id) }
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // Get unique brands
    app.get('/brands', async (req, res) => {
      try {
        const brands = await productCollection.aggregate([
          { $group: { _id: "$BrandName" } },
          { $project: { _id: 0, BrandName: "$_id" } }
        ]).toArray();
        res.send(brands.map(item => item.BrandName));
      } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // Get unique categories
    app.get('/categories', async (req, res) => {
      try {
        const categories = await productCollection.aggregate([
          { $group: { _id: "$Category" } }, // Group by the Category field
          { $project: { _id: 0, Category: "$_id" } } // Project the category field
        ]).toArray();
        res.send(categories.map(item => item.Category)); // Send only the category values
      } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
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