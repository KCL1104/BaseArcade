const express = require('express');
const app = express();

// Import the main application from the built TypeScript
const { app: mainApp } = require('./dist/index.js');

// Use the main application
app.use('/', mainApp);

const port = parseInt(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Base Arcade Backend listening on port ${port}`);
});