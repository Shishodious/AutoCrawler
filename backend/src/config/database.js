// require("dotenv").config();
const mongoose = require("mongoose");
// console.log(process.env.MONGO_DB_URI);

const connectCluster = async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_URI);
    console.log("connected succesffully");
  } catch (error) {
    console.error("connection error : ", error.message);
    throw error;
  }
};
module.exports = connectCluster;
