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


//Main route
app.get('/', (req, res) => {
    res.send('Hello World!');
});


//Listen
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

