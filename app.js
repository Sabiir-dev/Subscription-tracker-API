import express from "express";
import { PORT } from "./config/env.js";
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import connectToDatabase from "./database/mongodb.js";

// create an express app
const app = express();

// use the routers for different routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);

// define a route for the root path
app.get("/", (req, res) => {
  res.send("Welcome to the Subscription Tracker API");
});

// listen on the specified port
app.listen(PORT, async () => {
  console.log(
    `Subscription Tracker API is running on http://localhost:${PORT}`,
  );

  await connectToDatabase();
});

export default app;
