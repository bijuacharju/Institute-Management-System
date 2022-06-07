const express = require("express");
const router = express.Router();

// mysql database
const db = require("../database/db");

// encryption
const bcrypt = require("bcrypt");
const saltRounds = 10;

// file handler
const multer = require("multer");
const fs = require("fs");

// email handler
const nodemailer = require("nodemailer");

// env variables
require("dotenv").config();

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

// saving profile picture
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/images/");
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${getExt(file.mimetype)}`);
    },
});

const getExt = (mimetype) => {
    switch (mimetype) {
        case "image/png":
            return ".png";
        case "image/jpeg":
            return ".jpeg";
        case "image/jpg":
            return ".jpg";
    }
};

const filefilter = (req, file, cb) => {
    if (
        file.mimetype == "image/jpeg" ||
        file.mimetype == "image/png" ||
        file.mimetype == "image/jpg"
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const upload = multer({ storage: storage, fileFilter: filefilter });

router.put("/updateProfilePicture", upload.single("image"), (req, res) => {
    try {
        let path = req.file.destination + req.file.filename;
        let { email } = req.body;
        db.query(
            `SELECT image FROM admin WHERE email=?`,
            [email],
            (err, result) => {
                let { image } = result[0];
                if (image) {
                    try {
                        fs.unlinkSync(image);
                    } catch (err) {
                        console.log(err);
                    }
                }
                db.query(
                    `UPDATE admin SET image=? WHERE email=?`,
                    [path, email],
                    (err, result) => {
                        if (err) {
                            res.send(err);
                            res.json({
                                status: "FAILED",
                                message:
                                    "An error occured while updating user profile picture!",
                            });
                        } else {
                            db.query(
                                `SELECT * FROM admin WHERE email = ?`,
                                [email],
                                (err, result) => {
                                    if (err) {
                                        res.json({
                                            status: "FAILED",
                                            message:
                                                "An error occured while checking for user account!",
                                        });
                                    } else {
                                        if (result.length) {
                                            data = {
                                                studentID: result[0].studentID,
                                                name: result[0].name,
                                                email: result[0].email,
                                                phone: result[0].phone,
                                                address: result[0].address,
                                                password: result[0].password,
                                                image: result[0].image,
                                                createdDate:
                                                    result[0].createdDate,
                                                verified: result[0].verified,
                                                userType: "admin",
                                            };
                                            res.json({
                                                status: "SUCCESS",
                                                message:
                                                    "Profile has been successfully updated.",
                                                data: data,
                                            });
                                        }
                                    }
                                }
                            );
                        }
                    }
                );
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// add class
router.post("/add_class", (req, res) => {
    try {
        let details = req.body;
        db.query("INSERT INTO class SET ?", [details], (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message: "An error occured while saving class",
                });
            } else {
                res.json({
                    status: "SUCCESS",
                    message: "Class sucessfully added.",
                });
            }
        });
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// update class details
router.put("/update_class", async (req, res) => {
    try {
        // verification details
        let { name, classID } = req.body;
        db.query(
            "UPDATE class SET name=? WHERE classID=?",
            [name, classID],
            (err, result) => {
                if (err) {
                    res.send(err);
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while updating class details!",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        message: "Class successfully updated",
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

// delete class
router.delete("/delete_class/:classID", (req, res) => {
    try {
        let classID = req.params.classID;
        db.query(
            "DELETE FROM class WHERE classID = ?",
            classID,
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while deleting class",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
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

// add event
router.post("/add_event", async (req, res) => {
    try {
        let details = req.body;
        let { createdDate, title, description } = req.body;
        let type = "New Event";
        let userID = 0;
        let userType = "all";
        db.query("INSERT INTO event SET ?", details, (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message: "An error occured while saving event",
                });
            } else {
                db.query(
                    `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                    [userID, userType, title, description, createdDate, type],
                    (err, output) => {
                        if (err) {
                            res.json({
                                status: "FAILED",
                                message:
                                    "An error occured while generating notification",
                            });
                        } else {
                            // sending mail
                            db.query(
                                `SELECT email FROM student`,
                                (err, result) => {
                                    if (err) {
                                        res.json({
                                            status: "FAILED",
                                            message:
                                                "An error occured while extracting data from database",
                                        });
                                    } else {
                                        if (result.length) {
                                            for (
                                                let i = 0;
                                                i < result.length;
                                                i++
                                            ) {
                                                transporter
                                                    .sendMail({
                                                        from: process.env
                                                            .AUTH_EMAIL,
                                                        to: result[i].email,
                                                        subject: `New Event - ${title}`,
                                                        html: `<p>${description}</p><p>Regards,<br /><b>Career Technical Academy</b><br />Dharan-6, Panbari, Sunsari</p>`,
                                                    })
                                                    .then(() => {
                                                        console.log(
                                                            "Email sent successfully"
                                                        );
                                                    })
                                                    .catch((err) => {
                                                        console.log(
                                                            "Please enter valid email address."
                                                        );
                                                    });
                                            }
                                        }
                                    }
                                }
                            );
                            // sending mail
                            db.query(
                                `SELECT email FROM teacher`,
                                (err, result) => {
                                    if (err) {
                                        res.json({
                                            status: "FAILED",
                                            message:
                                                "An error occured while extracting data from database",
                                        });
                                    } else {
                                        if (result.length) {
                                            for (
                                                let i = 0;
                                                i < result.length;
                                                i++
                                            ) {
                                                transporter
                                                    .sendMail({
                                                        from: process.env
                                                            .AUTH_EMAIL,
                                                        to: result[i].email,
                                                        subject: `New Event - ${title}`,
                                                        html: `<p>${description}</p><p>Regards,<br /><b>Career Technical Academy</b><br />Dharan-6, Panbari, Sunsari</p>`,
                                                    })
                                                    .then(() => {
                                                        console.log(
                                                            "Email sent successfully"
                                                        );
                                                    })
                                                    .catch((err) => {
                                                        console.log(
                                                            "Please enter valid email address."
                                                        );
                                                    });
                                            }
                                        }
                                    }
                                }
                            );
                            // send response to front-end
                            res.json({
                                status: "SUCCESS",
                                message: "Event sucessfully added.",
                            });
                        }
                    }
                );
            }
        });
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// update event details
router.put("/update_event", async (req, res) => {
    try {
        let { title, description, eventID } = req.body;
        db.query(
            "UPDATE event SET title=?, description=? WHERE eventID=?",
            [title, description, eventID],
            (err, result) => {
                if (err) {
                    res.send(err);
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while updating event details!",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        message: "Event successfully updated",
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

// delete event
router.delete("/delete_event/:eventID", (req, res) => {
    try {
        let eventID = req.params.eventID;
        db.query(
            "DELETE FROM event WHERE eventID = ?",
            eventID,
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while deleting event",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
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

// add course
router.post("/add_course", (req, res) => {
    try {
        let details = req.body;
        let {
            name,
            description,
            batch,
            price,
            duration,
            status,
            teacherID,
            classID,
            createdDate,
        } = req.body;

        let type = "New Course Available";
        let userID = 0;
        let userType = "all";

        if (teacherID === "" && classID === "") {
            db.query(
                "INSERT INTO course (name, description, batch, price, duration, status, createdDate) VALUES (?,?,?,?,?,?,?)",
                [
                    name,
                    description,
                    batch,
                    price,
                    duration,
                    status,
                    createdDate,
                ],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving course.",
                            error: err,
                        });
                    } else {
                        db.query(
                            `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                            [
                                userID,
                                userType,
                                name,
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
                                    // sending mail
                                    db.query(
                                        `SELECT email FROM student`,
                                        (err, result) => {
                                            if (err) {
                                                res.json({
                                                    status: "FAILED",
                                                    message:
                                                        "An error occured while extracting data from database",
                                                });
                                            } else {
                                                if (result.length) {
                                                    for (
                                                        let i = 0;
                                                        i < result.length;
                                                        i++
                                                    ) {
                                                        transporter
                                                            .sendMail({
                                                                from: process
                                                                    .env
                                                                    .AUTH_EMAIL,
                                                                to: result[i]
                                                                    .email,
                                                                subject: `New Course - ${name}`,
                                                                html: `<p>${description}</p><p>Regards,<br /><b>Career Technical Academy</b><br />Dharan-6, Panbari, Sunsari</p>`,
                                                            })
                                                            .then(() => {
                                                                console.log(
                                                                    "Email sent successfully"
                                                                );
                                                            })
                                                            .catch((err) => {
                                                                console.log(
                                                                    "Please enter valid email address."
                                                                );
                                                            });
                                                    }
                                                }
                                                // send response to front-end
                                                res.json({
                                                    status: "SUCCESS",
                                                    message:
                                                        "Course sucessfully added.",
                                                });
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    }
                }
            );
        } else if (teacherID === "") {
            db.query(
                "INSERT INTO course (name, description, batch, price, duration, status, createdDate, classID) VALUES (?,?,?,?,?,?,?,?)",
                [
                    name,
                    description,
                    batch,
                    price,
                    duration,
                    status,
                    createdDate,
                    classID,
                ],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving course.",
                            error: err,
                        });
                    } else {
                        db.query(
                            `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                            [
                                userID,
                                userType,
                                name,
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
                                    // sending mail
                                    db.query(
                                        `SELECT email FROM student`,
                                        (err, result) => {
                                            if (err) {
                                                res.json({
                                                    status: "FAILED",
                                                    message:
                                                        "An error occured while extracting data from database",
                                                });
                                            } else {
                                                if (result.length) {
                                                    for (
                                                        let i = 0;
                                                        i < result.length;
                                                        i++
                                                    ) {
                                                        transporter
                                                            .sendMail({
                                                                from: process
                                                                    .env
                                                                    .AUTH_EMAIL,
                                                                to: result[i]
                                                                    .email,
                                                                subject: `New Course - ${name}`,
                                                                html: `<p>${description}</p><p>Regards,<br /><b>Career Technical Academy</b><br />Dharan-6, Panbari, Sunsari</p>`,
                                                            })
                                                            .then(() => {
                                                                console.log(
                                                                    "Email sent successfully"
                                                                );
                                                            })
                                                            .catch((err) => {
                                                                console.log(
                                                                    "Please enter valid email address."
                                                                );
                                                            });
                                                    }
                                                }
                                                // send response to front-end
                                                res.json({
                                                    status: "SUCCESS",
                                                    message:
                                                        "Course sucessfully added.",
                                                });
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    }
                }
            );
        } else if (classID === "") {
            db.query(
                "INSERT INTO course (name, description, batch, price, duration, status, createdDate, teacherID) VALUES (?,?,?,?,?,?,?,?)",
                [
                    name,
                    description,
                    batch,
                    price,
                    duration,
                    status,
                    createdDate,
                    teacherID,
                ],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving course.",
                            error: err,
                        });
                    } else {
                        db.query(
                            `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                            [
                                userID,
                                userType,
                                name,
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
                                    // sending mail
                                    db.query(
                                        `SELECT email FROM student`,
                                        (err, result) => {
                                            if (err) {
                                                res.json({
                                                    status: "FAILED",
                                                    message:
                                                        "An error occured while extracting data from database",
                                                });
                                            } else {
                                                if (result.length) {
                                                    for (
                                                        let i = 0;
                                                        i < result.length;
                                                        i++
                                                    ) {
                                                        transporter
                                                            .sendMail({
                                                                from: process
                                                                    .env
                                                                    .AUTH_EMAIL,
                                                                to: result[i]
                                                                    .email,
                                                                subject: `New Course - ${name}`,
                                                                html: `<p>${description}</p><p>Regards,<br /><b>Career Technical Academy</b><br />Dharan-6, Panbari, Sunsari</p>`,
                                                            })
                                                            .then(() => {
                                                                console.log(
                                                                    "Email sent successfully"
                                                                );
                                                            })
                                                            .catch((err) => {
                                                                console.log(
                                                                    "Please enter valid email address."
                                                                );
                                                            });
                                                    }
                                                }
                                                // send response to front-end
                                                res.json({
                                                    status: "SUCCESS",
                                                    message:
                                                        "Course sucessfully added.",
                                                });
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    }
                }
            );
        } else {
            db.query("INSERT INTO course SET ?", details, (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while saving course.",
                        error: err,
                    });
                } else {
                    db.query(
                        `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                        [
                            userID,
                            userType,
                            name,
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
                                // sending mail
                                db.query(
                                    `SELECT email FROM student`,
                                    (err, result) => {
                                        if (err) {
                                            res.json({
                                                status: "FAILED",
                                                message:
                                                    "An error occured while extracting data from database",
                                            });
                                        } else {
                                            if (result.length) {
                                                for (
                                                    let i = 0;
                                                    i < result.length;
                                                    i++
                                                ) {
                                                    transporter
                                                        .sendMail({
                                                            from: process.env
                                                                .AUTH_EMAIL,
                                                            to: result[i].email,
                                                            subject: `New Course - ${name}`,
                                                            html: `<p>${description}</p><p>Regards,<br /><b>Career Technical Academy</b><br />Dharan-6, Panbari, Sunsari</p>`,
                                                        })
                                                        .then(() => {
                                                            console.log(
                                                                "Email sent successfully"
                                                            );
                                                        })
                                                        .catch((err) => {
                                                            console.log(
                                                                "Please enter valid email address."
                                                            );
                                                        });
                                                }
                                            }
                                            // send response to front-end
                                            res.json({
                                                status: "SUCCESS",
                                                message:
                                                    "Course sucessfully added.",
                                            });
                                        }
                                    }
                                );
                            }
                        }
                    );
                }
            });
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// update course
router.put("/update_course", (req, res) => {
    try {
        let {
            courseID,
            name,
            description,
            batch,
            price,
            duration,
            teacherID,
            classID,
        } = req.body;

        if (teacherID === "" && classID === "") {
            db.query(
                "UPDATE course SET name=?, description=?, batch=?, price=?, duration=?, teacherID=null, classID=null WHERE courseID=?",
                [name, description, batch, price, duration, courseID],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving course.",
                            error: err,
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            message: "Course sucessfully added.",
                        });
                    }
                }
            );
        } else if (teacherID === "") {
            db.query(
                "UPDATE course SET name=?, description=?, batch=?, price=?, duration=?, teacherID=null, classID=? WHERE courseID=?",
                [name, description, batch, price, duration, classID, courseID],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving course.",
                            error: err,
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            message: "Course sucessfully added.",
                        });
                    }
                }
            );
        } else if (classID === "") {
            db.query(
                "UPDATE course SET name=?, description=?, batch=?, price=?, duration=?, teacherID=?, classID=null WHERE courseID=?",
                [
                    name,
                    description,
                    batch,
                    price,
                    duration,
                    teacherID,
                    courseID,
                ],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving course.",
                            error: err,
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            message: "Course sucessfully added.",
                        });
                    }
                }
            );
        } else {
            db.query(
                "UPDATE course SET name=?, description=?, batch=?, price=?, duration=?, teacherID=?, classID=? WHERE courseID=?",
                [
                    name,
                    description,
                    batch,
                    price,
                    duration,
                    teacherID,
                    classID,
                    courseID,
                ],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while saving course.",
                            error: err,
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            message: "Course sucessfully added.",
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

// delete course
router.delete("/delete_course/:courseID", (req, res) => {
    try {
        let courseID = req.params.courseID;
        db.query(
            "DELETE FROM course WHERE courseID = ?",
            courseID,
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while deleting course",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
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

// get all teachers data for table
router.get("/teacher_detail", async (req, res) => {
    try {
        db.query("SELECT teacherID as id, name FROM teacher", (err, result) => {
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
        });
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// get all class data for table
router.get("/class_detail", async (req, res) => {
    try {
        db.query("SELECT classID as id, name FROM class", (err, result) => {
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

// get notification
router.post("/notification", (req, res) => {
    try {
        const userID = req.body.userID;
        if (userID) {
            db.query(
                `SELECT * FROM notification WHERE notification.userType = "admin" OR notification.userType = "all" ORDER BY createdDate DESC`,
                [userID],
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
                            notifications: result,
                        });
                    }
                }
            );
        } else {
            res.json({
                status: "FAILED",
                message: "user id not found",
            });
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// delete notification
router.delete("/delete_notification/:notificationID", (req, res) => {
    try {
        let notificationID = req.params.notificationID;
        db.query(
            "DELETE FROM notification WHERE notificationID = ?",
            notificationID,
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while deleting notification.",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
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

// get all payments
router.get("/all_payments", async (req, res) => {
    try {
        db.query(
            "SELECT payment.paymentID, payment.studentID, payment.courseID, payment.amount, payment.createdDate, course.name AS courseName, course.batch, student.name AS studentName FROM payment LEFT JOIN student ON payment.studentID = student.studentID LEFT JOIN course ON payment.courseID = course.courseID ORDER BY payment.createdDate DESC",
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
                        payments: result,
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

// add payment
router.post("/add_payment", (req, res) => {
    try {
        let studentName = null;
        let courseName = null;
        let { createdDate, amount, studentID, courseID, userID } = req.body;
        let title = "Payment Recieved";
        let description = "";
        let type = "Payment";
        let userType = "admin";
        db.query(
            "SELECT name, email FROM student WHERE studentID=?",
            [studentID],
            (err, output) => {
                if (err) {
                    console.log(err);
                } else {
                    studentName = output[0].name;
                    db.query(
                        "SELECT name FROM course WHERE courseID=?",
                        [courseID],
                        (err, data) => {
                            if (err) {
                                console.log(err);
                            } else {
                                courseName = data[0].name;
                                db.query(
                                    "INSERT INTO payment (studentID, courseID, amount, createdDate) VALUES (?,?,?,?)",
                                    [studentID, courseID, amount, createdDate],
                                    (err, result) => {
                                        if (err) {
                                            res.json({
                                                status: "FAILED",
                                                message:
                                                    "An error occured while saving payment",
                                            });
                                        } else {
                                            description = `Student ${studentName} has made payment of amount ${amount} for course ${courseName}.`;
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
                                                (err, data) => {
                                                    if (err) {
                                                        res.json({
                                                            status: "FAILED",
                                                            message:
                                                                "An error occured while generating notification",
                                                        });
                                                    } else {
                                                        userType = "student";
                                                        db.query(
                                                            `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                                                            [
                                                                studentID,
                                                                userType,
                                                                title,
                                                                description,
                                                                createdDate,
                                                                type,
                                                            ],
                                                            (err, data) => {
                                                                if (err) {
                                                                    res.json({
                                                                        status: "FAILED",
                                                                        message:
                                                                            "An error occured while generating notification",
                                                                    });
                                                                } else {
                                                                    // sending mail
                                                                    description = `Thank you, student ${studentName} for making payment of amount Rs.${amount} for course ${courseName}.`;
                                                                    transporter
                                                                        .sendMail(
                                                                            {
                                                                                from: process
                                                                                    .env
                                                                                    .AUTH_EMAIL,
                                                                                to: output[0]
                                                                                    .email,
                                                                                subject: `${title}`,
                                                                                html: `<p>${description}</p><p>Regards,<br /><b>Career Technical Academy</b><br />Dharan-6, Panbari, Sunsari</p>`,
                                                                            }
                                                                        )
                                                                        .then(
                                                                            () => {
                                                                                console.log(
                                                                                    "Email sent successfully"
                                                                                );
                                                                            }
                                                                        )
                                                                        .catch(
                                                                            (
                                                                                err
                                                                            ) => {
                                                                                console.log(
                                                                                    "Please enter valid email address."
                                                                                );
                                                                            }
                                                                        );
                                                                    // send response to front-end
                                                                    res.json({
                                                                        status: "SUCCESS",
                                                                        message:
                                                                            "Course sucessfully added.",
                                                                    });
                                                                }
                                                            }
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
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// update payment details
router.put("/update_payment", async (req, res) => {
    try {
        let { studentID, courseID, amount, paymentID } = req.body;
        db.query(
            "UPDATE payment SET studentID=?, courseID=?, amount=? WHERE paymentID=?",
            [studentID, courseID, amount, paymentID],
            (err, result) => {
                if (err) {
                    res.send(err);
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while updating payment details!",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        message: "Payment successfully updated",
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

// get all student data for table
router.get("/student_detail", async (req, res) => {
    try {
        db.query(
            "SELECT student_course.studentID as id, student.name FROM student_course LEFT JOIN student ON student_course.studentID = student.studentID",
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

// get all course data for table
router.get("/course_detail", async (req, res) => {
    try {
        db.query(
            "SELECT student_course.courseID as id, course.name, course.batch FROM student_course LEFT JOIN course ON student_course.courseID = course.courseID",
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

// add teacher
router.post("/add_teacher", async (req, res) => {
    try {
        // teacher details
        let { name, email, password, phone, address, hiredDate, createdDate } =
            req.body;

        // validation and register
        if (
            name == "" ||
            email == "" ||
            password == "" ||
            phone == "" ||
            address == "" ||
            hiredDate == "" ||
            createdDate == ""
        ) {
            res.json({
                status: "FAILED",
                message: "Empty input fields!",
            });
        } else if (!/^[a-zA-Z ]*$/.test(name)) {
            res.json({
                status: "FAILED",
                message: "Invalid name entered !",
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
                "SELECT * FROM teacher WHERE email = ?",
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
                                    "INSERT INTO teacher (name, email, password, phone, address, hiredDate, createdDate) VALUES (?,?,?,?,?,?,?)",
                                    [
                                        name,
                                        email,
                                        hashedPassword,
                                        phone,
                                        address,
                                        hiredDate,
                                        createdDate,
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
                                            res.json({
                                                status: "SUCCESS",
                                                message: "Signup Successful.",
                                            });
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

// update teacher
router.put("/update_teacher", async (req, res) => {
    try {
        // teacher details
        let { teacherID, name, phone, address, hiredDate } = req.body;

        // validation and register
        if (
            teacherID == "" ||
            name == "" ||
            phone == "" ||
            address == "" ||
            hiredDate == ""
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
        } else if (
            !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(phone)
        ) {
            res.json({
                status: "FAILED",
                message: "Invalid phone entered!",
            });
        } else {
            db.query(
                "UPDATE teacher SET name=?, phone=?, address=?, hiredDate=? WHERE teacherID=?",
                [name, phone, address, hiredDate, teacherID],
                (err, result) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while updating teacher details!",
                            error: err,
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            message: "Teacher successfully updated.",
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

// reset teacher password
router.put("/reset_teacher_password", async (req, res) => {
    try {
        // teacher details
        let { email } = req.body;
        let password = "teacher12345";

        // validation and register
        if (email == "") {
            res.json({
                status: "FAILED",
                message: "No email address available!",
            });
        } else {
            bcrypt
                .hash(password, saltRounds)
                .then((hashedPassword) => {
                    db.query(
                        "UPDATE teacher SET password=? WHERE email=?",
                        [hashedPassword, email],
                        (err, result) => {
                            if (err) {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occured while resetting password!",
                                    error: err,
                                });
                            } else {
                                res.json({
                                    status: "SUCCESS",
                                    message: "Password Reset Successful.",
                                });
                            }
                        }
                    );
                })
                .catch((err) => {
                    res.json({
                        status: "FAILED",
                        message: "An error occuured while hasing password!",
                    });
                });
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// delete teacher
router.delete("/delete_teacher/:teacherID", (req, res) => {
    try {
        let teacherID = req.params.teacherID;
        db.query(
            "DELETE FROM teacher WHERE teacherID = ?",
            teacherID,
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while deleting teacher",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
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

// reset student password
router.put("/reset_student_password", async (req, res) => {
    try {
        // student details
        let { email } = req.body;
        let password = "student12345";

        // validation and register
        if (email == "") {
            res.json({
                status: "FAILED",
                message: "No email address available!",
            });
        } else {
            bcrypt
                .hash(password, saltRounds)
                .then((hashedPassword) => {
                    db.query(
                        "UPDATE student SET password=? WHERE email=?",
                        [hashedPassword, email],
                        (err, result) => {
                            if (err) {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occured while resetting password!",
                                    error: err,
                                });
                            } else {
                                res.json({
                                    status: "SUCCESS",
                                    message: "Password Reset Successful.",
                                });
                            }
                        }
                    );
                })
                .catch((err) => {
                    res.json({
                        status: "FAILED",
                        message: "An error occuured while hasing password!",
                    });
                });
        }
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// delete class
router.delete("/delete_student/:studentID", (req, res) => {
    try {
        let studentID = req.params.studentID;
        db.query(
            `SELECT * FROM student WHERE studentID=?`,
            studentID,
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data of student",
                    });
                } else {
                    if (result.length) {
                        let verified = result[0].verified;
                        if (verified === "false") {
                            db.query(
                                "DELETE FROM student_verification WHERE studentID=?",
                                studentID,
                                (err, result) => {
                                    if (err) {
                                        res.json({
                                            status: "FAILED",
                                            message:
                                                "An error occured while deleting data of student verification.",
                                        });
                                    } else {
                                        db.query(
                                            "DELETE FROM student WHERE studentID = ?",
                                            studentID,
                                            (err, result) => {
                                                if (err) {
                                                    res.json({
                                                        status: "FAILED",
                                                        message:
                                                            "An error occured while deleting student",
                                                    });
                                                } else {
                                                    res.json({
                                                        status: "SUCCESS",
                                                    });
                                                }
                                            }
                                        );
                                    }
                                }
                            );
                        } else if (verified === "true") {
                            db.query(
                                "DELETE FROM student WHERE studentID = ?",
                                studentID,
                                (err, result) => {
                                    if (err) {
                                        res.json({
                                            status: "FAILED",
                                            message:
                                                "An error occured while deleting student",
                                        });
                                    } else {
                                        res.json({
                                            status: "SUCCESS",
                                        });
                                    }
                                }
                            );
                        }
                    }
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// course student group
router.get("/group_details", (req, res) => {
    try {
        db.query(
            "SELECT course.courseID, course.name AS courseName, teacher.name AS teacherName, course.batch, COUNT(student_course.studentID) AS studentNumber, course.createdDate FROM student_course LEFT JOIN course ON student_course.courseID = course.courseID LEFT JOIN student ON student_course.studentID = student.studentID LEFT JOIN teacher ON course.teacherID = teacher.teacherID GROUP BY student_course.courseID ORDER BY course.createdDate DESC",
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
                        groups: result,
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

// course student group - individual course detail
router.post("/individual_course", (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            `SELECT course.courseID, course.name AS courseName, course.batch, COUNT(student_course.studentID) AS studentNumber, course.price, course.createdDate FROM student_course LEFT JOIN course ON student_course.courseID = course.courseID LEFT JOIN student ON student_course.studentID = student.studentID WHERE student_course.courseID = ?`,
            [courseID],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data from database.",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        course: result[0],
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

// course student group - student group detail
router.post("/group_students", (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            "SELECT course.courseID, course.name AS courseName, course.batch, student_course.studentID, student.name AS studentName, student.email, student_course.enrolledDate FROM student_course LEFT JOIN course ON student_course.courseID = course.courseID LEFT JOIN student ON student_course.studentID = student.studentID Group By courseID, studentID Having course.courseID = ? ORDER BY student_course.enrolledDate DESC",
            [courseID],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data from database.",
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

// single student payment detail
router.post("/student_payment", (req, res) => {
    try {
        let studentID = req.body.studentID;
        let courseID = req.body.courseID;
        db.query(
            "SELECT amount, createdDate FROM payment where studentID = ? AND courseID = ?",
            [studentID, courseID],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data from database.",
                    });
                } else {
                    db.query(
                        "SELECT SUM(amount) as totalPayment FROM payment where studentID = ? AND courseID = ?",
                        [studentID, courseID],
                        (err, output) => {
                            if (err) {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occured while extracting data from database.",
                                });
                            } else {
                                res.json({
                                    status: "SUCCESS",
                                    payment: result,
                                    totalAmount: output[0],
                                });
                            }
                        }
                    );
                }
            }
        );
    } catch (err) {
        res.json({ message: err });
    }
});

// update course status
router.put("/course_status", async (req, res) => {
    try {
        let { courseID, status } = req.body;
        db.query(
            "UPDATE course SET status=? WHERE courseID=?",
            [status, courseID],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while updaing verification status!",
                    });
                } else {
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
                }
            }
        );
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// course student group - student group detail
router.post("/delete_student_from_group", (req, res) => {
    try {
        let { courseID, studentID } = req.body;
        db.query(
            "SELECT * FROM payment where studentID = ? and courseID = ?",
            [studentID, courseID],
            (err, output) => {
                if (output.length) {
                    res.json({
                        status: "FAILED",
                        message: "Student has already made payment.",
                    });
                } else {
                    db.query(
                        "DELETE FROM student_course WHERE studentID = ? AND courseID = ?",
                        [studentID, courseID],
                        (err, result) => {
                            if (err) {
                                res.json({
                                    status: "FAILED",
                                    message:
                                        "An error occured while deleting data from database.",
                                });
                            } else {
                                res.json({
                                    status: "SUCCESS",
                                    message:
                                        "Student successfully deleted from database.",
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

// update profile of admin
router.put("/updateProfile", async (req, res) => {
    try {
        let { name, email, phone, address } = req.body;
        if (name == "" || email == "" || phone == "" || address == "") {
            res.json({
                status: "FAILED",
                message: "Please enter valid credentials!",
            });
        } else if (!/^[a-zA-Z ]*$/.test(name)) {
            res.json({
                status: "FAILED",
                message: "Invalid name entered!",
            });
        } else if (
            !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(phone)
        ) {
            res.json({
                status: "FAILED",
                message: "Invalid phone entered!",
            });
        } else {
            db.query(
                `UPDATE admin SET name=?, phone=?, address=? WHERE email=?`,
                [name, phone, address, email],
                (err, output) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while updating profile details",
                        });
                    } else {
                        db.query(
                            `SELECT * FROM admin WHERE email = ?`,
                            [email],
                            (err, result) => {
                                if (err) {
                                    res.json({
                                        status: "FAILED",
                                        message:
                                            "An error occured while checking for user account!",
                                    });
                                } else {
                                    if (result.length) {
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
                                            userType: "admin",
                                        };
                                        res.json({
                                            status: "SUCCESS",
                                            message:
                                                "Profile has been successfully updated.",
                                            data: data,
                                        });
                                    }
                                }
                            }
                        );
                    }
                }
            );
        }
    } catch (err) {
        res.json({ message: err });
    }
});

// Dashboard Data

// Total Students
router.get("/dashboard_total_student", async (req, res) => {
    try {
        db.query(
            `SELECT COUNT(studentID) AS 'totalStudent' FROM student`,
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
                        totalStudent: result[0],
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

// Total Teachers
router.get("/dashboard_total_teacher", async (req, res) => {
    try {
        db.query(
            `SELECT COUNT(teacherID) AS 'totalTeacher' FROM teacher`,
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
                        totalTeacher: result[0],
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

// Total Classes
router.get("/dashboard_total_class", async (req, res) => {
    try {
        db.query(
            `SELECT COUNT(classID) AS 'totalClass' FROM class`,
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
                        totalClass: result[0],
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

// Total Courses
router.get("/dashboard_total_course", async (req, res) => {
    try {
        db.query(
            `SELECT COUNT(DISTINCT name) AS 'totalCourse' FROM course`,
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
                        totalCourse: result[0],
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

// student in course by name for graph
router.get("/dashboard_student_course_graph", async (req, res) => {
    try {
        db.query(
            `SELECT course.name AS courseName, COUNT(student_course.studentID) AS 'Total Students' FROM student_course RIGHT JOIN course ON student_course.courseID = course.courseID GROUP BY course.name ORDER BY COUNT(student_course.studentID) DESC`,
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
                        graph: result,
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

// student enrolled in course per month for graph
router.post("/dashboard_student_enrol_graph", async (req, res) => {
    try {
        let { selectedYear } = req.body;
        let dateThisYear = Date.parse(parseInt(selectedYear));
        let dateNextYear = Date.parse(parseInt(selectedYear) + 1);
        let count = [
            {
                Month: "January",
                Enrols: 0,
            },
            {
                Month: "February",
                Enrols: 0,
            },
            {
                Month: "March",
                Enrols: 0,
            },
            {
                Month: "April",
                Enrols: 0,
            },
            {
                Month: "May",
                Enrols: 0,
            },
            {
                Month: "June",
                Enrols: 0,
            },
            {
                Month: "July",
                Enrols: 0,
            },
            {
                Month: "August",
                Enrols: 0,
            },
            {
                Month: "September",
                Enrols: 0,
            },
            {
                Month: "October",
                Enrols: 0,
            },
            {
                Month: "November",
                Enrols: 0,
            },
            {
                Month: "December",
                Enrols: 0,
            },
        ];
        db.query(`SELECT * FROM student_course`, (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message:
                        "An error occured while extracting data from database",
                });
            } else {
                for (let i = 0; i < result.length; i++) {
                    let d = parseInt(result[i].enrolledDate);
                    if (dateThisYear <= d) {
                        if (d < dateNextYear) {
                            let month = new Date(d).getMonth();
                            count[month].Enrols += 1;
                        }
                    }
                }
                res.json({
                    status: "SUCCESS",
                    graph: count,
                });
            }
        });
    } catch (err) {
        res.json(err);
    }
});

// payments per month for graph
router.post("/dashboard_payment_graph", async (req, res) => {
    try {
        let { selectedYear } = req.body;
        let dateThisYear = Date.parse(parseInt(selectedYear));
        let dateNextYear = Date.parse(parseInt(selectedYear) + 1);
        let count = [
            {
                Month: "January",
                Revenue: 0,
            },
            {
                Month: "February",
                Revenue: 0,
            },
            {
                Month: "March",
                Revenue: 0,
            },
            {
                Month: "April",
                Revenue: 0,
            },
            {
                Month: "May",
                Revenue: 0,
            },
            {
                Month: "June",
                Revenue: 0,
            },
            {
                Month: "July",
                Revenue: 0,
            },
            {
                Month: "August",
                Revenue: 0,
            },
            {
                Month: "September",
                Revenue: 0,
            },
            {
                Month: "October",
                Revenue: 0,
            },
            {
                Month: "November",
                Revenue: 0,
            },
            {
                Month: "December",
                Revenue: 0,
            },
        ];
        db.query(`SELECT * FROM payment`, (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message:
                        "An error occured while extracting data from database",
                });
            } else {
                for (let i = 0; i < result.length; i++) {
                    let d = parseInt(result[i].createdDate);
                    if (dateThisYear <= d) {
                        if (d < dateNextYear) {
                            let month = new Date(d).getMonth();
                            count[month].Revenue += result[i].amount;
                        }
                    }
                }
                res.json({
                    status: "SUCCESS",
                    graph: count,
                });
            }
        });
    } catch (err) {
        res.json(err);
    }
});

// change admin password
router.put("/change_password", async (req, res) => {
    try {
        // admin details
        let { email, oldPassword, newPassword } = req.body;

        // validation and register
        if (email == "") {
            res.json({
                status: "FAILED",
                message: "No email address available!",
            });
        } else {
            db.query(
                "SELECT * FROM admin WHERE email=?", [email],
                (err, output) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message: "An error occured while extracting details from admin table",
                        });
                    } else {
                        if (output.length === 0) {
                            res.json({
                                status: "FAILED",
                                message: "No such email address available",
                            });
                        } else {
                            const databasePassword = output[0].password;
                            bcrypt
                                .compare(oldPassword, databasePassword)
                                .then((value) => {
                                    if (value) {
                                        bcrypt
                                            .hash(newPassword, saltRounds)
                                            .then((hashedPassword) => {
                                                db.query( "UPDATE admin SET password=? WHERE email=?", [hashedPassword, email],
                                                    (err, result) => {
                                                        if (err) {
                                                            res.json({
                                                                status: "FAILED",
                                                                message: "An error occured while changing password!",
                                                                error: err,
                                                            });
                                                        } else {
                                                            db.query( `SELECT * FROM admin WHERE email = ?`, [email],
                                                                (err, result) => {
                                                                    if (err) {
                                                                        res.json(
                                                                            {
                                                                                status: "FAILED",
                                                                                message:"An error occured while checking for user account!",
                                                                            }
                                                                        );
                                                                    } else {
                                                                        if (result.length) {
                                                                            data =
                                                                                {
                                                                                    studentID:
                                                                                        result[0]
                                                                                            .studentID,
                                                                                    name: result[0]
                                                                                        .name,
                                                                                    email: result[0]
                                                                                        .email,
                                                                                    phone: result[0]
                                                                                        .phone,
                                                                                    address:
                                                                                        result[0]
                                                                                            .address,
                                                                                    password:
                                                                                        result[0]
                                                                                            .password,
                                                                                    image: result[0]
                                                                                        .image,
                                                                                    createdDate:
                                                                                        result[0]
                                                                                            .createdDate,
                                                                                    verified:
                                                                                        result[0]
                                                                                            .verified,
                                                                                    userType:
                                                                                        "admin",
                                                                                };
                                                                            res.json(
                                                                                {
                                                                                    status: "SUCCESS",
                                                                                    message: "Password has been successfully updated.",
                                                                                    data: data,
                                                                                }
                                                                            );
                                                                        }
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
                                                    message: "An error occuured while hasing password!",
                                                });
                                            });
                                    } else {
                                        res.json({
                                            status: "FAILED",
                                            message: "Entered current password is wrong!",
                                        });
                                    }
                                })
                                .catch((err) => {
                                    res.json({
                                        status: "FAILED",
                                        message: "An error occuured while comparing password!",
                                    });
                                });
                        }
                    }
                }
            );
        }
    } catch (err) {
        res.json({ message: err });
    }
});

// get all guest message
router.get("/guest_message", async (req, res) => {
    try {
        db.query(
            "SELECT * FROM guest_message ORDER BY messageID DESC",
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
                        messages: result,
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

// delete class
router.delete("/delete_guest_message/:messageID", (req, res) => {
    try {
        let messageID = req.params.messageID;
        db.query(
            "DELETE FROM guest_message WHERE messageID = ?",
            messageID,
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while deleting class",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
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

module.exports = router;
