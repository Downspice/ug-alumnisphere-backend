import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ug_alumnisphere_db";

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(
      `[MongoDB] Connected to database: ${conn.connection.host}/${conn.connection.name}`
    );
  } catch (error) {
    console.error("[MongoDB] Database connection error:", error);
    // Don't kill process immediately in dev mode if mongo isn't active yet, but log clearly
  }
};
