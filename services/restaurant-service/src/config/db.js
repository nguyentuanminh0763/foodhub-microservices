// PLUMBING - connects to MongoDB. Reads MONGO_URI from env (see .env.example).
const mongoose = require("mongoose");

module.exports = async function connectDb() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log("restaurant-service connected to MongoDB");
};
