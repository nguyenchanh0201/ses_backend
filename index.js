const port = require('./src/config/index').port
const db = require('./src/config/db').pool
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')

const express = require('express');

const app = express();

//Middlewares
app.use(express.json());
app.use(morgan('dev'))
app.use(helmet())
app.use(cors())


//Database
const connectDB = async () => {
    const client = await db.connect();
    const result = await client.query('SELECT version()');
    client.release();

    const { version } = result.rows[0];
    console.log(`Database connected : ${version}`)
}




//Main route
app.get('/', (req, res) => {
    res.send('Hello World!');
});





app.listen(port, () => {
    connectDB();
    console.log(`Server is running on http://localhost:${port}`);
});

