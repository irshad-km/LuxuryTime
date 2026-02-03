import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userSchema.js";
import dotenv from "dotenv";

dotenv.config();


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        let user = await User.findOne({ email });

        // Existing user
        if (user) {
          if (!user.googleId) {
            user.googleId = profile.id;
            user.isVerified = true;

            await user.save();
          }
          return done(null, user);
        }

        // New user
        user = new User({
          fullname: profile.displayName,
          email,
          googleId: profile.id,
          isVerified: true,
          isBlocked: false,
        });

        await user.save();
        return done(null, user);

      } catch (error) {
        console.log("Google auth error:", error);
        return done(error, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;