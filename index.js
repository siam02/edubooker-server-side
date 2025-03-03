const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://edu-booker-client.web.app', 'https://edu-booker-client.firebaseapp.com'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fgzyiou.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded;
        next();
    })
}

async function run() {

    try {
        // await client.connect();

        const bookCollection = client.db('library').collection('books');
        const categoryCollection = client.db('library').collection('categories');
        const borrowedBooksCollection = client.db('library').collection('borrowed_books');

        app.post('/jwt', async (req, res) => {
            const user = req.body;

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });

            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                })
                .send({ success: true })
        })

        app.post('/book', verifyToken, async (req, res) => {
            const newBook = req.body;
            const result = await bookCollection.insertOne(newBook);
            res.send(result);
        })

        app.get('/book', verifyToken, async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);

            const result = await bookCollection.find()
                .skip(page * size)
                .limit(size)
                .toArray();
            res.send(result);
        })

        app.get('/book/search', async (req, res) => {
            const searhQuery = req.query.q;
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            let query;

            if (searhQuery) {
                 query = {
                    $or: [
                      { name: { $regex: searhQuery, $options: 'i' } },
                      { author_name: { $regex: searhQuery, $options: 'i' } },
                      { category: { $regex: searhQuery, $options: 'i' } },
                    ],
                  };
            }else{
                query={};
            }
            
            const result = await bookCollection.find(query)
            .skip(page * size)
            .limit(size)
            .toArray();

            res.json(result);
        })

        app.get('/book-sort-by-rating', async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);

            const sortOrder = "desc";

            const result = await bookCollection.find()
                .skip(page * size)
                .limit(size).sort({ rating: sortOrder })
                .toArray();
            res.send(result);
        })

        app.get('/book-by-category/:name', async (req, res) => {
            const name = req.params.name;
            const query = { category: name }
            const cursor = bookCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/bookCount', async (req, res) => {
            const count = await bookCollection.estimatedDocumentCount();
            res.send({ count });
        })

        app.delete('/book/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/book/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.findOne(query);
            res.send(result);
        })

        app.put('/book/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateBook = req.body;

            const book = {
                $set: {
                    image: updateBook.image,
                    name: updateBook.name,
                    rating: updateBook.rating,
                    author_name: updateBook.author_name,
                    category: updateBook.category
                }
            }

            const result = await bookCollection.updateOne(filter, book, options);
            res.send(result);
        })

        app.put('/update-book-quantity/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateBook = req.body;

            const book = {
                $set: {
                    quantity: updateBook.quantity,
                }
            }

            const result = await bookCollection.updateOne(filter, book, options);
            res.send(result);
        })

        app.post('/category', async (req, res) => {
            const newCategory = req.body;
            const result = await categoryCollection.insertOne(newCategory);
            res.send(result);
        })

        app.get('/category', async (req, res) => {
            const cursor = categoryCollection.find();
            const categories = await cursor.toArray();
            res.send(categories);
        })

        app.get('/category/:name', async (req, res) => {
            const name = req.params.name;
            const query = { name: name }
            const result = await categoryCollection.findOne(query);
            res.send(result);
        })

        app.delete('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await categoryCollection.deleteOne(query);
            res.send(result);
        })

        app.post('/borrowed-book', async (req, res) => {
            const borrowedBook = req.body;
            const result = await borrowedBooksCollection.insertOne(borrowedBook);
            res.send(result);
        })

        app.get('/borrowed-book-count', async (req, res) => {
            const id = req.query.id;
            const email = req.query.email;
            const query = { book_id: id, user_email: email }
            const count = await borrowedBooksCollection.countDocuments(query);
            res.send({ count });
        })

        app.get('/borrowed-book/:email', async (req, res) => {

            const email = req.params.email;
            const query = { user_email: email }
            const cursor = borrowedBooksCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);

        })

        app.delete('/borrowed-book/:id', async (req, res) => {
            const id = req.params.id;
            const query = { book_id: id }
            const result = await borrowedBooksCollection.deleteOne(query);
            res.send(result);
        })


        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Edu Booker server is running')
})

app.listen(port, () => {
    console.log(`Edu Booker Server is running on port: ${port}`)
})