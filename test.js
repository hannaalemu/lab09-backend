
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('hitting route');
});

app.listen(3000, () => {
  console.log('app running');
});
