import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async (): Promise<void> => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }

  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ug_alumnisphere_db";

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(
      `[MongoDB] Connected to database: ${conn.connection.host}/${conn.connection.name}`
    );
  } catch (error) {
    console.error("[MongoDB] Database connection error:", error);
    // In serverless, do not crash process, allow graceful retry on subsequent requests
  }
};
