import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import sanitizedConfig from "../utils/config";
export const userMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;
  const token = header?.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const decoded = jwt.verify(token, sanitizedConfig.JWT_SECRET) as {
      role: string;
      userId: string;
    };
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};
