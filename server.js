import express from "express";
import path from "path";
import session from "express-session";
import morgan from "morgan";
import passport from "./config/passport.js";
import noCache from "./middlewares/no-cache.js";
import dotenv from "dotenv";
import MongoStore from "connect-mongo";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import userRouter from "./routes/userRouter.js";
import adminRouter from "./routes/adminRouter.js";
import adminSession from "./middlewares/adminsession.js";

dotenv.config();

const app = express();


connectDB();


app.use(morgan("dev"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(
  session({
    name: "LuxuryTime.user.sid", 
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, 
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),
    cookie: {
      secure: false, 
      httpOnly: true, 
      maxAge: 72 * 60 * 60 * 1000, 
    },
  })
);


app.use("/admin", adminSession);

app.use(passport.initialize());
app.use(passport.session());

app.use(noCache);


app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.admin = req.session.admin || null;
  next();
});

//  VIEW ENGINE 
 
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

//ROUTES
app.use("/", userRouter);
app.use("/admin", adminRouter); 


app.use((req, res) => {
  res.status(404).render("user/404");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});

export default app;