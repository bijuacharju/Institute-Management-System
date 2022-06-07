const mysql = require("mysql");
const dbConfig = require("../config/db.config");

// MySQL database connection
const connection = mysql.createConnection({
  host: dbConfig.HOST,
  user: dbConfig.USER,
  password: dbConfig.PASSWORD,
  database: dbConfig.DB,
  multipleStatements: true,
});

// Open MySQL connection

connection.connect((error) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Database connection established.");
  }
});

module.exports = connection;
