import "dotenv/config";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import { ROLES, USER_STATUS } from "./constants.js";

const seedAdmin = async () => {
  await connectDB();

  const email = process.env.ADMIN_EMAIL || "admin@hittofit.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@123";
  const name = process.env.ADMIN_NAME || "Platform Admin";

  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`Admin already exists: ${email}`);
    process.exit(0);
  }

  await User.create({
    name,
    email,
    password,
    role: ROLES.ADMIN,
    status: USER_STATUS.ACTIVE,
  });

  console.log(`Admin user created: ${email}`);
  process.exit(0);
};

seedAdmin().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
