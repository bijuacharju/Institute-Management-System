const express = require("express");
const app = express();
const cors = require("cors");

// port for server
const PORT = 3001;

//for path directory
global.appRoot = __dirname;

//for request parameter
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());
app.use(cors());

// granting access for upload folder to upon request
app.use('/uploads', express.static('uploads'));

// route admin
const admin_router = require("./routes/admin");

// route student
const student_router = require("./routes/student");

// route teacher
const teacher_router = require("./routes/teacher");

// route common - all signin - student register
const common = require("./routes/common");

// all routes
app.use("/admin", admin_router);
app.use("/student", student_router);
app.use("/teacher", teacher_router);
app.use("/", common);

// listening port
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
