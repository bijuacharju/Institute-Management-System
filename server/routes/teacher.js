const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const saltRounds = 10;
const db = require("../database/db");
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
            `SELECT image FROM teacher WHERE email=?`,
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
                    `UPDATE teacher SET image=? WHERE email=?`,
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
                                `SELECT * FROM teacher WHERE email = ?`,
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
                                                userType: "teacher",
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
        );
    } catch (err) {
        res.json({ message: err });
    }
});

router.post("/teacher_student_assignment", (req, res) => {
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
                        submissions: result,
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

// get all courses
router.get("/courses", async (req, res) => {
    try {
        db.query(
            `SELECT * FROM course ORDER BY course.courseID DESC`,
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

// get courses which student is studying
router.post("/my_courses", async (req, res) => {
    try {
        let teacherID = req.body.teacherID;
        db.query(
            `SELECT course.courseID, course.name AS courseName, course.batch, course.duration, course.createdDate, class.name AS className FROM course LEFT JOIN class ON course.classID = class.classID WHERE teacherID = ? ORDER BY courseID DESC`,
            [teacherID],
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
            `SELECT courseID, name, batch, duration FROM course WHERE courseID = ?`,
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

// students in course
router.post("/student", async (req, res) => {
    try {
        let { courseID } = req.body;
        db.query(
            `SELECT student.studentID, student.name, student.email, student_course.enrolledDate FROM student LEFT JOIN student_course ON student.studentID = student_course.studentID WHERE student_course.courseID = ? ORDER BY student_course.enrolledDate`,
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

// get notification
router.post("/notification", (req, res) => {
    try {
        const userID = req.body.userID;
        if (userID) {
            db.query(
                `SELECT * FROM notification WHERE (notification.userType = "teacher" AND notification.userID = ?) OR notification.userType = "all" ORDER BY createdDate DESC`,
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

// update profile of teacher
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
                `UPDATE teacher SET name=?, phone=?, address=? WHERE email=?`,
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
                            `SELECT * FROM teacher WHERE email = ?`,
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
                                            userType: "teacher",
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
router.get("/dashboard_all_course", async (req, res) => {
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

// get count of teacher course
router.post("/dashboard_my_course", async (req, res) => {
    try {
        let { teacherID } = req.body;
        if (teacherID) {
            db.query(
                `SELECT COUNT(name) AS myCourse FROM course WHERE teacherID = ${teacherID}`,
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
                            myCourse: result[0],
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

// get count of issued assignment
router.post("/dashboard_issued_assignment", async (req, res) => {
    try {
        let { teacherID } = req.body;
        if (teacherID) {
            db.query(
                `SELECT COUNT(assignment.courseID) AS issuedAssignment FROM assignment LEFT JOIN course ON assignment.courseID = course.courseID WHERE course.teacherID = ${teacherID}`,
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
                            issuedAssignment: result[0],
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

// get count of issued assignment
router.post("/dashboard_my_student", async (req, res) => {
    try {
        let { teacherID } = req.body;
        if (teacherID) {
            db.query(
                `SELECT COUNT(DISTINCT student_course.studentID) AS myStudent FROM student_course LEFT JOIN course ON student_course.courseID = course.courseID where course.teacherID = ${teacherID}`,
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
                            myStudent: result[0],
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

// get assignment detail for table
router.post("/dashboard_assignment_table", async (req, res) => {
    try {
        let { teacherID } = req.body;
        if (teacherID) {
            db.query(
                `SELECT course.courseID AS id, course.name as courseName, course.batch, COUNT(assignment.courseID) AS totalAssignment FROM teacher LEFT JOIN course ON teacher.teacherID = course.teacherID LEFT JOIN assignment ON course.courseID = assignment.courseID WHERE teacher.teacherID = ${teacherID} GROUP BY course.courseID ORDER BY course.courseID DESC`,
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
                            assignmentTable: result,
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

// assignment in course
router.post("/assignments", async (req, res) => {
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

// add assignment
router.post("/add_assignment", (req, res) => {
    try {
        let details = req.body;
        let { dateOfIssue, courseID } = req.body;
        let userID = 0;
        let title = "New Assignment";
        let userType = "student";
        let type = "Assignment";
        db.query("INSERT INTO assignment SET ?", [details], (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message: "An error occured while issuing assignment",
                });
            } else {
                db.query(
                    "SELECT * FROM course WHERE courseID = ?",
                    [courseID],
                    (err, output) => {
                        let courseName = output[0].name;
                        let description = `A new assignment has been issued on course ${courseName}`;
                        db.query(
                            `INSERT INTO notification (userID, userType, title, description, createdDate, type) VALUES (?,?,?,?,?,?)`,
                            [
                                userID,
                                userType,
                                title,
                                description,
                                dateOfIssue,
                                type,
                            ],
                            (err, result) => {
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
                                            "Assignment sucessfully issued.",
                                    });
                                }
                            }
                        );
                    }
                );
            }
        });
    } catch (err) {
        res.json({ message: err });
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

// change teacher password
router.put("/change_password", async (req, res) => {
    try {
        // teacher details
        let { email, oldPassword, newPassword } = req.body;

        // validation and register
        if (email == "") {
            res.json({
                status: "FAILED",
                message: "No email address available!",
            });
        } else {
            db.query(
                "SELECT * FROM teacher WHERE email=?",
                [email],
                (err, output) => {
                    if (err) {
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while extracting details from teacher table",
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
                                                    "UPDATE teacher SET password=? WHERE email=?",
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
                                                                `SELECT * FROM teacher WHERE email = ?`,
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
                                                                                        "teacher",
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

// add notice
router.post("/add_notice", (req, res) => {
    try {
        let details = req.body;
        db.query("INSERT INTO course_notice SET ?", details, (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message: "An error occured while saving notice.",
                });
            } else {
                res.json({
                    status: "SUCCESS",
                    message: "Notice sucessfully added.",
                });
            }
        });
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// add notice
router.post("/add_milestone", (req, res) => {
    try {
        let details = req.body;
        db.query("INSERT INTO milestone SET ?", details, (err, result) => {
            if (err) {
                res.json({
                    status: "FAILED",
                    message: "An error occured while saving milestone.",
                });
            } else {
                res.json({
                    status: "SUCCESS",
                    message: "Milestone sucessfully added.",
                });
            }
        });
    } catch (err) {
        res.json({
            message: err,
        });
    }
});

// update  milestone status
router.put("/change_status", async (req, res) => {
    try {
        let { milestoneID, status } = req.body;
        let completeStatus = "Completed";
        let incompleteStatus = "Not Completed";
        if (status === "Not Completed") {
            db.query(
                "UPDATE milestone SET status=? WHERE milestoneID=?",
                [completeStatus, milestoneID],
                (err, result) => {
                    if (err) {
                        res.send(err);
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while updating milestone status!",
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            message: "Milestone status successfully updated",
                        });
                    }
                }
            );
        } else {
            db.query(
                "UPDATE milestone SET status=? WHERE milestoneID=?",
                [incompleteStatus, milestoneID],
                (err, result) => {
                    if (err) {
                        res.send(err);
                        res.json({
                            status: "FAILED",
                            message:
                                "An error occured while updating milestone status!",
                        });
                    } else {
                        res.json({
                            status: "SUCCESS",
                            message: "Milestone status successfully updated",
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

module.exports = router;
