'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

// Application Setup
const PORT = process.env.PORT || 3000;
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));



const app = express();
app.use(cors());


// API Routes (handlers)
app.get('/', (req, res) => {
  console.log('slash route');
  res.send('slash route');
});

app.get('/location', getLocation);

app.get('/weather', getWeather);

app.get('/events', getEvents);

function handleError(err, res) {
  if(res) res.status(500).send('Sorry something went wrong');
}
function lookup(options) {
  const SQL = `SELECT * FROM ${options.tableName} WHERE location_id = $1;`;
  const values = [options.location];

  client.query(SQL, values)
    .then(result => {
      if(result.rowCount > 0) {
        options.cacheHit(result);
      } else{
        options.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

function deleteByLocationId(table, city) {
  const SQL = `DELETE FROM ${table} WHERE location_id = ${city};`;
  return client.query(SQL);
}

const timeOuts = {
  weathers: 15 * 1000
}
// Helper Functions and handlers

//location:
function getLocation(request,response) {
  console.log('request getting hit');

  const locationHandler = {

    query: request.query.data,

    cacheHit: results => {
      console.log('Got data from SQL');
      response.send(results.rows[0]);
    },

    cacheMiss: () => {
      Location.fetchLocation(request.query.data)
        .then(data => response.send(data));
    }
  };

  Location.lookupLocation(locationHandler);

}

//Location Constructor
function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.formatted_address;
  this.latitude = res.geometry.location.lat;
  this.longitude = res.geometry.location.lng;
}

Location.fetchLocation = query => {
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(_URL)
    .then( data => {
      console.log('Got data from API');
      if (!data.body.results.length ) {throw 'No Data';}
      else {
        // Create an instance and save it
        let location = new Location(query, data.body.results[0]);
        return location.save()
          .then( result => {
            location.id = result.rows[0].id;
            return location;
          });
        return location;
      }
    });
};

Location.lookupLocation = (handler) => {

  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query( SQL, values )
    .then( results => {
      if( results.rowCount > 0 ) {
        handler.cacheHit(results);
      }
      else {
        handler.cacheMiss();
      }
    })
    .catch( console.error );

};

//saving locations to database
Location.prototype.save = function() {
  let SQL = `INSERT INTO locations(search_query, formatted_query, latitude, longitude)VALUES($1,$2,$3,$4)RETURNING id`;
  let values = Object.values(this);
  return client.query(SQL,values);
};



//events and weather - deal with later


function getWeather(request, response) {
  Weather.lookup({
    tableName : Weather.tableName,
    location: request.query.data.id,

    cacheHit : function (result) {
      let ageOfResults = (Date.now() - result.rows[0].created_at);
      if (ageOfResults > timeOuts.weathers) {
        Weather.deleteByLocationId(Weather.tableName, request.query.data.id);
        this.cacheMiss();
      }else{
        response.send(result.rows);
      }
    },

    cacheMiss: function() {
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`

      superagent.get(url)
        .then(res => {
          const weatherEntries = res.body.daily.data.map(day => {
            const summary = new Weather(day);
            summary.save(request.query.data.id);
            return summary;
          });
          response.send(weatherEntries);
          // return weatherEntries;
        })
        .catch(error => response.send(error));
    }
  });
}

function Weather(day) {
  this.tableName = 'weathers';
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
}
Weather.tableName = 'weathers';
Weather.lookup = lookup;
Weather.deleteByLocationId = deleteByLocationId;

Weather.prototype.save = function (ID) {
  const SQL = `INSERT INTO weathers(forecast, time, location_ID, created_at) VALUES($1,$2,$3,$4)RETURNING id`;
  const values = [this.forecast, this.time, ID, this.created_at];
  client.query(SQL, values);
};




function getEvents(request, response) {
  const url = `https://www.eventbriteapi.com/v3/events/search?location.latitude=${request.query.data.latitude}&location.longitude=${request.query.data.longitude}&token=${process.env.EVENTBRITE_API_KEY}`

  return superagent.get(url)
    .then(res => {
      const eventEntries = res.body.events.map(eventObj => {
        return new Event(eventObj);
      })
      response.send(eventEntries);
    })
    .catch(err => {
      response.send(err);
    });
}
function Event(eventObj) {
  this.link = eventObj.url;
  this.name = eventObj.name.text;
  this.event_date = Date(eventObj.start.local).split(' ').slice(0, 4).join(' ');
  this.summary = eventObj.summary;
}

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`City Explorer is up on ${PORT}`));