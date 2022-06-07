const express = require("express");
const router = express.Router();
const db = require("../database/db");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const multer = require("multer");
const fs = require("fs");

// saving profile picture
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/images/");
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${getExt(file.mimetype)}`);
    },
});

const storagefile = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/documents/");
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${getExtFile(file.mimetype)}`);
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

const getExtFile = (mimetype) => {
    switch (mimetype) {
        case "application/pdf":
            return ".pdf";
        default:
            return ".pdf";
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
const uploadfile = multer({ storage: storagefile });

router.post("/assignment_submission", uploadfile.single("file"), (req, res) => {
    try {
        let { assignmentID, dateOfSubmission, studentID } = req.body;
        let path = req.file.destination + req.file.filename;
        db.query(
            "INSERT INTO assignment_submission (assignmentID, studentID, file, dateOfSubmission) VALUES (?,?,?,?)",
            [assignmentID, studentID, path, dateOfSubmission],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while submitting assignment",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        message: "Assignment sucessfully submitted.",
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

router.put("/updateProfilePicture", upload.single("image"), (req, res) => {
    try {
        let path = req.file.destination + req.file.filename;
        let { email } = req.body;
        db.query(
            `SELECT image FROM student WHERE email=?`,
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
                    `UPDATE student SET image=? WHERE email=?`,
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
                                `SELECT * FROM student WHERE email = ?`,
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
                                                userType: "student",
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

// get courses for student
router.post("/courses", async (req, res) => {
    try {
        let studentID = req.body.studentID;
        db.query(
            `SELECT DISTINCT course.courseID, course.name, course.description, course.price, course.duration, course.status FROM course LEFT JOIN student_course ON course.courseID = student_course.courseID WHERE course.status = 'available' AND course.courseID NOT IN (SELECT courseID FROM student_course WHERE studentID = ${studentID}) ORDER BY course.courseID DESC`,
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

// enrollment
router.post("/enrol", (req, res) => {
    try {
        let details = req.body;
        let { studentID, courseID, enrolledDate } = req.body;
        let userID = 0;
        let userType = "admin";
        let title = "New Student Enrolled in a Course.";
        let description = "";
        let type = "Enrol";
        let studentName = "";
        let courseName = "";
        db.query("INSERT INTO student_course SET ?", details, (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message: "An error occured while enrolling into course",
                });
            } else {
                db.query(
                    "SELECT name FROM student WHERE studentID=?",
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
                                        description = `Student ${studentName} has enrolled in course ${courseName}.`;
                                        db.query(
                                            `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                                            [
                                                userID,
                                                userType,
                                                title,
                                                description,
                                                enrolledDate,
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
                                                    res.json({
                                                        status: "SUCCESS",
                                                        message:
                                                            "Sucessfully enrolled.",
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
        });
    } catch (err) {
        res.json({ message: err });
    }
});

// get courses which student is studying
router.post("/my_courses", async (req, res) => {
    try {
        let studentID = req.body.studentID;
        db.query(
            `SELECT student_course.courseID, course.name AS courseName, course.batch, course.duration, course.price, teacher.name AS teacherName, class.name AS className, student_course.enrolledDate FROM student_course LEFT JOIN course ON student_course.courseID = course.courseID LEFT JOIN teacher ON course.teacherID = teacher.teacherID LEFT JOIN class ON course.classID = class.classID WHERE student_course.studentID = ? ORDER BY student_course.enrolledDate DESC`,
            [studentID],
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

// single course
router.post("/my_courses/course", async (req, res) => {
    try {
        let courseID = req.body.courseID;
        db.query(
            `SELECT courseID, name, batch, duration, price FROM course WHERE courseID = ?`,
            [courseID],
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
                        courses: result[0],
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

// get payment of student
router.post("/payments", async (req, res) => {
    try {
        let studentID = req.body.studentID;
        db.query(
            `SELECT payment.paymentID, course.name AS courseName, payment.createdDate, payment.amount, course.batch FROM payment LEFT JOIN course ON payment.courseID = course.courseID WHERE payment.studentID = ${studentID} ORDER BY payment.createdDate DESC`,
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

// get notification
router.post("/notification", (req, res) => {
    try {
        const userID = req.body.userID;
        if (userID) {
            db.query(
                `SELECT * FROM notification WHERE (notification.userType = "student" AND notification.userID = ?) OR (notification.userType = "student" AND notification.userID = 0) OR notification.userType = "all" ORDER BY createdDate DESC`,
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

// update profile of student
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
                `UPDATE student SET name=?, phone=?, address=? WHERE email=?`,
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
                            `SELECT * FROM student WHERE email = ?`,
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
                                            userType: "student",
                                        };
                                        res.json({
                                            status: "SUCCESS",
                                            message:
                                                "Password has been successfully updated.",
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

// student dashboard

// get count of enrollable course
router.get("/dashboard_enrollable_course", async (req, res) => {
    try {
        db.query(
            `SELECT COUNT(DISTINCT name) AS 'totalCourse' FROM course WHERE status = "available"`,
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

// get count of enrolled course
router.post("/dashboard_enrolled_course", async (req, res) => {
    try {
        let { studentID } = req.body;
        if (studentID) {
            db.query(
                `SELECT COUNT(courseID) AS enrolledCourse FROM student_course WHERE studentID = ${studentID}`,
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
                            enrolledCourse: result[0],
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

// get total payment
router.post("/dashboard_total_payment", async (req, res) => {
    try {
        let { studentID } = req.body;
        if (studentID) {
            db.query(
                `SELECT SUM(amount) AS totalPayment FROM payment WHERE studentID = ${studentID}`,
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
                            totalPayment: result[0],
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

// get total submission
router.post("/dashboard_total_submission", async (req, res) => {
    try {
        let { studentID } = req.body;
        if (studentID) {
            db.query(
                `SELECT COUNT(studentID) AS totalSubmission FROM assignment_submission WHERE studentID = ${studentID}`,
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
                            totalSubmission: result[0],
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

// Get Submission Details
router.post("/get_submission", (req, res) => {
    try {
        let { assignmentID } = req.body;
        db.query(
            `SELECT assignment_submission.assignmentSubmissionID, assignment_submission.assignmentID, student.name AS studentName, assignment_submission.dateOfSubmission, assignment_submission.file FROM assignment_submission LEFT JOIN student ON assignment_submission.studentID = student.studentID WHERE assignment_submission.assignmentID = ?`,
            [assignmentID],
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
                        submission: result,
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

// get group message
router.post("/get_group_message", async (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            `SELECT group_message.messageID, group_message.userID, teacher.name AS teacherName, student.name AS studentName, group_message.userType, group_message.courseID, group_message.message, group_message.date FROM group_message LEFT JOIN teacher ON group_message.userID = teacher.teacherID LEFT JOIN student ON userID = student.studentID WHERE group_message.courseID=? ORDER BY group_message.date DESC`,
            [courseID],
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

// send group message
router.post("/send_group_message", (req, res) => {
    try {
        let details = req.body;
        db.query(
            "INSERT INTO group_message SET ?",
            [details],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message: "An error occured while sending message",
                    });
                } else {
                    res.json({
                        status: "SUCCESS",
                        message: "Message sucessfully sent.",
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

// assignment in course
router.post("/get_assignment_list", async (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            `SELECT * FROM assignment WHERE courseID = ? ORDER BY dateOfIssue DESC`,
            [courseID],
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
                        assignments: result,
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

// assignment submission status
router.post("/get_student_submission", async (req, res) => {
    try {
        let { assignmentID, studentID } = req.body;
        db.query(
            `SELECT * FROM assignment_submission WHERE assignmentID = ? AND studentID = ?`,
            [assignmentID, studentID],
            (err, result) => {
                if (err) {
                    res.json({
                        status: "FAILED",
                        message:
                            "An error occured while extracting data from database",
                    });
                } else {
                    if (result.length > 0) {
                        res.json({
                            status: "SUCCESS",
                            submission: "true",
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            submission: "false",
                        });
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

// change student password
router.put("/change_password", async (req, res) => {
    try {
        // student details
        let { email, oldPassword, newPassword } = req.body;

        // validation and register
        if (email == "") {
            res.json({
                status: "FAILED",
                message: "No email address available!",
            });
        } else {
            db.query(
                "SELECT * FROM student WHERE email=?",
                [email],
                (err, output) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while extracting details from student table",
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
                                                db.query(
                                                    "UPDATE student SET password=? WHERE email=?",
                                                    [hashedPassword, email],
                                                    (err, result) => {
                                                        if (err) {
                                                            res.json({
                                                                status: "FAILED",
                                                                message:
                                                                    "An error occured while changing password!",
                                                                error: err,
                                                            });
                                                        } else {
                                                            db.query(
                                                                `SELECT * FROM student WHERE email = ?`,
                                                                [email],
                                                                (
                                                                    err,
                                                                    result
                                                                ) => {
                                                                    if (err) {
                                                                        res.json(
                                                                            {
                                                                                status: "FAILED",
                                                                                message:
                                                                                    "An error occured while checking for user account!",
                                                                            }
                                                                        );
                                                                    } else {
                                                                        if (
                                                                            result.length
                                                                        ) {
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
                                                                                        "student",
                                                                                };
                                                                            res.json(
                                                                                {
                                                                                    status: "SUCCESS",
                                                                                    message:
                                                                                        "Password has been successfully updated.",
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
                                                    message:
                                                        "An error occuured while hasing password!",
                                                });
                                            });
                                    } else {
                                        res.json({
                                            status: "FAILED",
                                            message:
                                                "Entered current password is wrong!",
                                        });
                                    }
                                })
                                .catch((err) => {
                                    res.json({
                                        status: "FAILED",
                                        message:
                                            "An error occuured while comparing password!",
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

// get all course notices
router.post("/notices", async (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            "SELECT * FROM course_notice WHERE courseID=? ORDER BY noticeID DESC",
            [courseID],
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
                        notices: result,
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

// Total milestones
router.post("/total_milestones", async (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            `SELECT COUNT(milestoneID) AS 'totalMilestone' FROM milestone WHERE courseID=?`,
            [courseID],
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
                        milestones: result[0],
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

// Completed milestones
router.post("/completed_milestones", async (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            `SELECT COUNT(milestoneID) AS 'completedMilestone' FROM milestone WHERE courseID=? AND status="Completed"`,
            [courseID],
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
                        milestones: result[0],
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

// get all course notices
router.post("/milestones", async (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            "SELECT * FROM milestone WHERE courseID=? ORDER BY milestoneID",
            [courseID],
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
                        milestones: result,
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
