const port = require('./src/config/index').port
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')

const express = require('express');

const routes = require('./src/routes/index');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();

//Middlewares
app.use(express.json());
app.use(morgan('dev'));
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})); // Phải được gọi trước routes

// Routes
app.use('/api', routes);

// Error Handler (sau routes)
app.use(errorHandler);


//Listen
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

