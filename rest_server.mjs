import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');

const port = 8000;

let app = express();
app.use(express.json());

/********************************************************************
 ***   DATABASE FUNCTIONS                                         *** 
 ********************************************************************/
// Open SQLite3 database (in read-write mode)
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + path.basename(db_filename));
    }
    else {
        console.log('Now connected to ' + path.basename(db_filename));
    }
});

// Create Promise for SQLite3 database SELECT query 
function dbSelect(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

// Create Promise for SQLite3 database INSERT or DELETE query
function dbRun(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/********************************************************************
 ***   REST REQUEST HANDLERS                                      *** 
 ********************************************************************/
// GET request handler for crime codes
app.get('/codes', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    
    // TODO: Add query param support for ?code=110,700 (2 pts)
    // Split req.query.code by comma, add WHERE code IN (...) to SQL
    
    // get all codes from db
    let query = 'SELECT code, incident_type as type FROM Codes ORDER BY code';
    let params = [];
    if (req.query.code) {
        let codes = req.query.code.split(',').map(code => code.trim());
        let placeholders = codes.map(() => '?').join(',');
        query += ` WHERE code IN (${placeholders})`;
        params = codes;
    }
    query += ' ORDER BY code';
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).type('json').send(rows);
        }
    });
});

// GET request handler for neighborhoods
app.get('/neighborhoods', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    
    // TODO: Add query param support for ?id=11,14 (2 pts)
    // Split req.query.id by comma, add WHERE neighborhood_number IN (...) to SQL
    
    // get all neighborhoods from db
    let query = 'SELECT neighborhood_number as id, neighborhood_name as name FROM Neighborhoods ORDER BY neighborhood_number';
    let params = [];
    if (req.query.id) {
        let ids = req.query.id.split(',').map(id => id.trim());
        let placeholders = ids.map(() => '?').join(',');
        query += ` WHERE neighborhood_number IN (${placeholders})`;
        params = ids;
    }
    query += ' ORDER BY neighborhood_number';
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).type('json').send(rows);
        }
    });
});

// GET request handler for crime incidents
app.get('/incidents', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    
    // TODO: Add query param support (6 pts total):
    // - ?start_date=2019-09-01 (add WHERE date_time >= ?)
    // - ?end_date=2019-10-31 (add WHERE date_time <= ?)
    // - ?code=110,700 (add WHERE code IN (...))
    // - ?grid=38,65 (add WHERE police_grid IN (...))
    // - ?neighborhood=11,14 (add WHERE neighborhood_number IN (...))
    // - ?limit=50 (change LIMIT value, default 1000)
    
    // get last 1000 incidents, split date_time into date and time
    let query = `SELECT case_number, DATE(date_time) as date, TIME(date_time) as time, 
                 code, incident, police_grid, neighborhood_number, block 
                 FROM Incidents ORDER BY date_time DESC LIMIT 1000`;
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).type('json').send(rows);
        }
    });
});

// PUT request handler for new crime incident
app.put('/new-incident', (req, res) => {
    console.log(req.body); // uploaded data
    
    // check if case_number already exists
    let checkQuery = 'SELECT case_number FROM Incidents WHERE case_number = ?';
    db.get(checkQuery, [req.body.case_number], (err, row) => {
        if (err) {
            res.status(500).send(err);
        } else if (row) {
            // case already exists
            res.status(500).type('txt').send('Case number already exists');
        } else {
            // insert new incident
            let insertQuery = `INSERT INTO Incidents (case_number, date_time, code, incident, police_grid, neighborhood_number, block) 
                              VALUES (?, ?, ?, ?, ?, ?, ?)`;
            let datetime = req.body.date + 'T' + req.body.time;
            db.run(insertQuery, [req.body.case_number, datetime, req.body.code, req.body.incident, 
                                req.body.police_grid, req.body.neighborhood_number, req.body.block], (err) => {
                if (err) {
                    res.status(500).send(err);
                } else {
                    res.status(200).type('txt').send('OK');
                }
            });
        }
    });
});

// DELETE request handler for new crime incident
app.delete('/remove-incident', (req, res) => {
    console.log(req.body); // uploaded data
    
    // check if case_number exists before deleting
    let checkQuery = 'SELECT case_number FROM Incidents WHERE case_number = ?';
    db.get(checkQuery, [req.body.case_number], (err, row) => {
        if (err) {
            res.status(500).send(err);
        } else if (!row) {
            // case doesn't exist
            res.status(500).type('txt').send('Case number does not exist');
        } else {
            // delete the incident
            let deleteQuery = 'DELETE FROM Incidents WHERE case_number = ?';
            db.run(deleteQuery, [req.body.case_number], (err) => {
                if (err) {
                    res.status(500).send(err);
                } else {
                    res.status(200).type('txt').send('OK');
                }
            });
        }
    });
});

/********************************************************************
 ***   START SERVER                                               *** 
 ********************************************************************/
// Start server - listen for client connections
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
