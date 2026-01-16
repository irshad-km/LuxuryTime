import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";

dotenv.config();


const adminSession = session({
  name: "LuxuryTime.admin.sid",

  secret: process.env.SESSION_SECRET,

  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "adminSessions", 
  }),

  cookie: {
    httpOnly: true, 
    secure: false, 
    maxAge: 1000 * 60 * 60 * 24, 
  },
});

export default adminSession;