import jwt from "jsonwebtoken";

const generateToken = (user) => {
  const payload = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export default generateToken;
