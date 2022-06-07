const express = require("express");
const router = express.Router();

// mysql database
const db = require("../database/db");

// email handler
const nodemailer = require("nodemailer");

// unique string
const { v4: uuidv4 } = require("uuid");

// env variables
require("dotenv").config();

// encryption
const bcrypt = require("bcrypt");
const saltRounds = 10;

// path for static verified page
const path = require("path");

// nodemailer stuff
let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    },
});

// testing success
transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
});

// student register
router.post("/student_register", async (req, res) => {
    try {
        // student details
        let { name, email, phone, address, password, createdDate, verified } =
            req.body;
        let description = `A new student ${name} with email address of ${email} has been registred in the system.`;
        let userID = 0;
        let userType = "admin";
        let type = "Registration";
        let title = "New Student Registered";
        // validation and register
        if (
            name == "" ||
            email == "" ||
            password == "" ||
            phone == "" ||
            address == ""
        ) {
            res.json({
                status: "FAILED",
                message: "Empty input fields!",
            });
        } else if (!/^[a-zA-Z ]*$/.test(name)) {
            res.json({
                status: "FAILED",
                message: "Invalid name entered!",
            });
        } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            res.json({
                status: "FAILED",
                message: "Invalid email entered!",
            });
        } else if (
            !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(phone)
        ) {
            res.json({
                status: "FAILED",
                message: "Invalid phone entered!",
            });
        } else if (password.length < 8) {
            res.json({
                status: "FAILED",
                message: "Password is too short!",
            });
        } else {
            db.query(
                "SELECT * FROM student WHERE email = ?",
                [email],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while checking for existing user account!",
                        });
                    } else if (result.length) {
                        res.json({
                            status: "FAILED",
                            message: "User with this email already exists!",
                        });
                    } else {
                        bcrypt
                            .hash(password, saltRounds)
                            .then((hashedPassword) => {
                                db.query(
                                    "INSERT INTO student (name, email, phone, address, password, createdDate, verified) VALUES (?,?,?,?,?,?,?)",
                                    [
                                        name,
                                        email,
                                        phone,
                                        address,
                                        hashedPassword,
                                        createdDate,
                                        verified,
                                    ],
                                    (err, result) => {
                                        if (err) {
                                            res.json({
                                                status: "FAILED",
                                                message:
                                                    "An error occured while saving account!",
                                                error: err,
                                            });
                                        } else {
                                            db.query(
                                                `SELECT * FROM student WHERE email=?`,
                                                [email],
                                                (err, result) => {
                                                    if (err) {
                                                        res.json({
                                                            status: "FAILED",
                                                            message:
                                                                "An error occured while extracting data from!",
                                                            error: err,
                                                        });
                                                    } else if (result.length) {
                                                        // handle email verification
                                                        sendVerificationEmail(
                                                            result[0],
                                                            res
                                                        );
                                                        db.query(
                                                            `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                                                            [
                                                                userID,
                                                                userType,
                                                                title,
                                                                description,
                                                                createdDate,
                                                                type,
                                                            ],
                                                            (err, output) => {
                                                                if (err) {
                                                                    console.log(
                                                                        err
                                                                    );
                                                                } else {
                                                                    console.log(
                                                                        "Student has been registered and notification has been generated."
                                                                    );
                                                                }
                                                            }
                                                        );
                                                    }
                                                }
                                            );
                                        }
                                    }
                                );
                            })
                            .catch((err) => {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occuured while hasing password!",
                                });
                            });
                    }
                }
            );
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// send verification message
const sendVerificationEmail = ({ studentID, email }, res) => {
    try {
        // url to be used in the email
        const currentUrl = "http://localhost:3001/";
        const uniqueString = uuidv4() + studentID;

        // mail options
        const mailOptions = {
            from: process.env.AUTH_EMAIL,
            to: email,
            subject: "Verify Your Email",
            html: `<p>Verify your email address to complete the register and login into your account.</p><p>This link <b>expires in 6 hours</b>.</p><p>Press <a href=${
                currentUrl + "verify/" + studentID + "/" + uniqueString
            }>here</a> to proceed.</p>`,
        };
        bcrypt
            .hash(uniqueString, saltRounds)
            .then((hashedUniqueString) => {
                const createdAt = Date.now();
                const expiresAt = Date.now() + 21600000;

                // email send and verification record saved
                db.query(
                    `INSERT INTO student_verification (studentID, uniqueString, createdAt, expiresAt) VALUES (?,?,?,?)`,
                    [studentID, hashedUniqueString, createdAt, expiresAt],
                    (err, output) => {
                        if (err) {
                            res.json({
                                status: "FAILED",
                                message:
                                    "An error occured while saving verification account",
                            });
                        } else {
                            // email send and verification record saved
                            transporter
                                .sendMail(mailOptions)
                                .then(() => {
                                    res.json({
                                        status: "PENDING",
                                        message: "Verification email sent",
                                    });
                                })
                                .catch((error) => {
                                    res.json({
                                        status: "FAILED",
                                        message:
                                            "Please enter valid email address.",
                                    });
                                });
                        }
                    }
                );
            })
            .catch((error) => {
                console.log(error);
                res.json({
                    status: "FAILED",
                    message: "An error occured while hashing email data",
                });
            });
    } catch (err) {
        res.json({
            message: err,
        });
    }
};

// verify email
router.get("/verify/:studentID/:uniqueString", async (req, res) => {
    try {
        let { studentID, uniqueString } = req.params;
        db.query(
            `SELECT * FROM student_verification WHERE studentID=?`,
            [studentID],
            (err, result) => {
                if (err) {
                    res.sendFile(
                        path.join(
                            __dirname,
                            "./../views/somethingwentwrong.html"
                        )
                    );
                } else if (result.length) {
                    const { expiresAt } = result[0];
                    const hashedUniqueString = result[0].uniqueString;
                    // check for expired unique string
                    if (expiresAt < Date.now()) {
                        db.query(
                            "DELETE FROM student_verification WHERE studentID = ?",
                            [studentID],
                            (err, result) => {
                                if (err) {
                                    res.sendFile(
                                        path.join(
                                            __dirname,
                                            "./../views/somethingwentwrong.html"
                                        )
                                    );
                                } else {
                                    db.query(
                                        "DELETE FROM student WHERE studentID = ?",
                                        [studentID],
                                        (err, result) => {
                                            if (err) {
                                                res.sendFile(
                                                    path.join(
                                                        __dirname,
                                                        "./../views/somethingwentwrong.html"
                                                    )
                                                );
                                            } else {
                                                res.sendFile(
                                                    path.join(
                                                        __dirname,
                                                        "./../views/expired.html"
                                                    )
                                                );
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    } else {
                        bcrypt
                            .compare(uniqueString, hashedUniqueString)
                            .then((result) => {
                                if (result) {
                                    db.query(
                                        `UPDATE student SET verified="true" WHERE studentID=?`,
                                        [studentID],
                                        (err, result) => {
                                            if (err) {
                                                res.sendFile(
                                                    path.join(
                                                        __dirname,
                                                        "./../views/somethingwentwrong.html"
                                                    )
                                                );
                                            } else {
                                                db.query(
                                                    "DELETE FROM student_verification WHERE studentID = ?",
                                                    [studentID],
                                                    (err, result) => {
                                                        if (err) {
                                                            res.sendFile(
                                                                path.join(
                                                                    __dirname,
                                                                    "./../views/somethingwentwrong.html"
                                                                )
                                                            );
                                                        } else {
                                                            res.sendFile(
                                                                path.join(
                                                                    __dirname,
                                                                    "./../views/verified.html"
                                                                )
                                                            );
                                                        }
                                                    }
                                                );
                                            }
                                        }
                                    );
                                } else {
                                    res.sendFile(
                                        path.join(
                                            __dirname,
                                            "./../views/somethingwentwrong.html"
                                        )
                                    );
                                }
                            })
                            .catch((error) => {
                                res.sendFile(
                                    path.join(
                                        __dirname,
                                        "./../views/somethingwentwrong.html"
                                    )
                                );
                            });
                    }
                } else {
                    res.sendFile(
                        path.join(
                            __dirname,
                            "./../views/somethingwentwrong.html"
                        )
                    );
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// student signin
router.post("/student_signin", async (req, res) => {
    try {
        // student details
        let { email, password } = req.body;

        // validation and register
        if (email == "" || password == "") {
            res.json({
                status: "FAILED",
                message: "Empty credentials supplied!",
            });
        } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            res.json({
                status: "FAILED",
                message: "Invalid email entered!",
            });
        } else if (password.length < 8) {
            res.json({
                status: "FAILED",
                message: "Password is too short!",
            });
        } else {
            db.query(
                "SELECT * FROM student WHERE email = ?",
                [email],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while checking for user account!",
                        });
                    } else if (result.length) {
                        if (result[0].verified === "false") {
                            res.json({
                                status: "FAILED",
                                message:
                                    "Email has not been verified yet. Check your inbox.",
                            });
                        } else {
                            const hashedPassword = result[0].password;
                            bcrypt
                                .compare(password, hashedPassword)
                                .then((output) => {
                                    if (output) {
                                        data = {
                                            studentID: result[0].studentID,
                                            name: result[0].name,
                                            email: result[0].email,
                                            phone: result[0].phone,
                                            address: result[0].address,
                                            password: result[0].password,
                                            image: result[0].image,
                                            createdDate: result[0].createdDate,
                                            verified: result[0].verified,
                                            userType: "student",
                                        };
                                        res.json({
                                            status: "SUCCESS",
                                            message: "Signin Successful.",
                                            data: data,
                                        });
                                    } else {
                                        res.json({
                                            status: "FAILED",
                                            message:
                                                "Invalid password entered!",
                                        });
                                    }
                                })
                                .catch((err) => {
                                    res.json({
                                        status: "FAILED",
                                        message:
                                            "An error occuured while hasing password!",
                                    });
                                });
                        }
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "No such email exists!",
                        });
                    }
                }
            );
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// admin signin
router.post("/admin_signin", async (req, res) => {
    try {
        // admin details
        let { email, password } = req.body;

        // validation and register
        if (email == "" || password == "") {
            res.json({
                status: "FAILED",
                message: "Empty credentials supplied!",
            });
        } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            res.json({
                status: "FAILED",
                message: "Invalid email entered!",
            });
        } else if (password.length < 8) {
            res.json({
                status: "FAILED",
                message: "Password is too short!",
            });
        } else {
            db.query(
                "SELECT * FROM admin WHERE email = ?",
                [email],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while checking for user account!",
                        });
                    } else if (result.length) {
                        const hashedPassword = result[0].password;
                        bcrypt
                            .compare(password, hashedPassword)
                            .then((output) => {
                                if (output) {
                                    data = {
                                        adminID: result[0].adminID,
                                        name: result[0].name,
                                        email: result[0].email,
                                        phone: result[0].phone,
                                        address: result[0].address,
                                        password: result[0].password,
                                        image: result[0].image,
                                        createdDate: result[0].createdDate,
                                        userType: "admin",
                                    };
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Signin Successful.",
                                        data: data,
                                    });
                                } else {
                                    res.json({
                                        status: "FAILED",
                                        message: "Invalid password entered!",
                                    });
                                }
                            })
                            .catch((err) => {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occuured while hasing password!",
                                });
                            });
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "No such email exists!",
                        });
                    }
                }
            );
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// teacher signin
router.post("/teacher_signin", async (req, res) => {
    try {
        // teacher details
        let { email, password } = req.body;

        // validation and register
        if (email == "" || password == "") {
            res.json({
                status: "FAILED",
                message: "Empty credentials supplied!",
            });
        } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            res.json({
                status: "FAILED",
                message: "Invalid email entered!",
            });
        } else if (password.length < 8) {
            res.json({
                status: "FAILED",
                message: "Password is too short!",
            });
        } else {
            db.query(
                "SELECT * FROM teacher WHERE email = ?",
                [email],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while checking for user account!",
                        });
                    } else if (result.length) {
                        const hashedPassword = result[0].password;
                        bcrypt
                            .compare(password, hashedPassword)
                            .then((output) => {
                                if (output) {
                                    data = {
                                        teacherID: result[0].teacherID,
                                        name: result[0].name,
                                        email: result[0].email,
                                        phone: result[0].phone,
                                        address: result[0].address,
                                        password: result[0].password,
                                        image: result[0].image,
                                        createdDate: result[0].createdDate,
                                        hiredDate: result[0].hiredDate,
                                        userType: "teacher",
                                    };
                                    res.json({
                                        status: "SUCCESS",
                                        message: "Signin Successful.",
                                        data: data,
                                    });
                                } else {
                                    res.json({
                                        status: "FAILED",
                                        message: "Invalid password entered!",
                                    });
                                }
                            })
                            .catch((err) => {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occuured while hasing password!",
                                });
                            });
                    } else {
                        res.json({
                            status: "FAILED",
                            message: "No such email exists!",
                        });
                    }
                }
            );
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// get all courses
router.get("/all_courses", async (req, res) => {
    try {
        db.query(
            "SELECT course.courseID, course.name, course.description, course.batch, course.price, course.duration, course.status, course.createdDate, course.teacherID, course.classID, teacher.name AS teacherName, class.name AS className FROM course LEFT JOIN teacher ON course.teacherID = teacher.teacherID LEFT JOIN class ON course.classID = class.classID ORDER BY course.courseID DESC",
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data from database",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        courses: result,
                    });
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// get all class
router.get("/all_class", async (req, res) => {
    try {
        db.query("SELECT * FROM class ORDER BY classID DESC", (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message:
                        "An error occured while extracting data from database",
                });
            } else {
                res.json({
                    status: "SUCCESS",
                    classes: result,
                });
            }
        });
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// get all students
router.get("/all_students", async (req, res) => {
    try {
        db.query(
            "SELECT * FROM student ORDER BY studentID DESC",
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data from database",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        students: result,
                    });
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// get all teachers
router.get("/all_teachers", async (req, res) => {
    try {
        db.query(
            "SELECT * FROM teacher ORDER BY teacherID DESC",
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data from database",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        teachers: result,
                    });
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// get all events
router.get("/all_events", async (req, res) => {
    try {
        db.query("SELECT * FROM event ORDER BY eventID DESC", (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message:
                        "An error occured while extracting data from database",
                });
            } else {
                res.json({
                    status: "SUCCESS",
                    events: result,
                });
            }
        });
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// send message
router.post("/send_message", (req, res) => {
    try {
        let details = req.body;
        let { subject, name } = req.body;
        let description = `You have received a guest message from ${name}.`;
        let userID = 0;
        let userType = "admin";
        let type = "Guest Message";
        let createdDate = Date.now().toString();

        db.query(
            "INSERT INTO guest_message SET ?",
            [details],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while saving class",
                    });
                } else {
                    db.query(
                        `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                        [
                            userID,
                            userType,
                            subject,
                            description,
                            createdDate,
                            type,
                        ],
                        (err, output) => {
                            if (err) {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occured while generating notification",
                                });
                            } else {
                                res.json({
                                    status: "SUCCESS",
                                    message: "Message sucessfully sent.",
                                });
                            }
                        }
                    );
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

module.exports = router;
