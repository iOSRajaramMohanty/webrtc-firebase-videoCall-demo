const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').createServer(app);
const compression = require('compression');



const port = 5300

// const requestIp = require('ip');

app.use(express.static(path.join(__dirname, '../public')));
app.use(compression())
app.use(bodyParser.json());
app.use(express.json())

app.use('/', require('../routes/apis/firebase'));

// console.log(requestIp.address());

// const port = process.env.NODE_ENV;
// console.log(`Your port is ${port}`);
// const dotenv = require('dotenv');
// dotenv.config();
// console.log(`Your port is ${process.env.NODE_ENV}`);

http.listen(process.env.PORT || port, () => {
  console.log(`listening on:${port}`);
});



