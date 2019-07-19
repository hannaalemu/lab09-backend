DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations ( 
    id SERIAL PRIMARY KEY, 
    search_query VARCHAR(255), 
    formatted_query VARCHAR(255), 
    latitude NUMERIC(10, 7), 
    longitude NUMERIC(10, 7)
  );

CREATE TABLE weathers ( 
    id SERIAL PRIMARY KEY, 
    forecast VARCHAR(255), 
    time VARCHAR(255), 
    location_id INTEGER NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations (id),
    created_at NUMERIC NOT NULL
  );


CREATE TABLE events ( 
    id SERIAL PRIMARY KEY, 
    link VARCHAR(255),
    name VARCHAR(255),
    time VARCHAR(255), 
    location_id INTEGER NOT NULL,
    summary VARCHAR(255), 
    FOREIGN KEY (location_id) REFERENCES locations (id)
);


