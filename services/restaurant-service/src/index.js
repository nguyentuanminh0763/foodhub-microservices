// PLUMBING - Express bootstrap. Wires routes + DB. You usually don't change this much.
const express = require("express");
const connectDb = require("./config/db");
const restaurantRoutes = require("./routes/restaurant.routes");

const app = express();
app.use(express.json());

// health check so docker-compose / gateway know the service is alive
app.get("/api/restaurants/health", (req, res) => res.send("restaurant-service OK"));

// mount the routes you will define
app.use("/api/restaurants", restaurantRoutes);

const PORT = process.env.PORT || 3001;
connectDb().then(() => {
  app.listen(PORT, () => console.log(`restaurant-service on :${PORT}`));
});
