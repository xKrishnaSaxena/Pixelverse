import { Router } from "express";
import { userRouter } from "./user";
import { spaceRouter } from "./space";
import { adminRouter } from "./admin";
import { SigninSchema, SignupSchema } from "../../types";
import client from "@repo/db/src/index";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import sanitizedConfig from "../../utils/config";
export const router = Router();

router.post("/signup", async (req, res) => {
  const parseData = SignupSchema.safeParse(req.body);
  if (!parseData.success) {
    res.status(400).json({
      message: "Invalid data",
    });
    return;
  }
  const hashedPassword = await bcrypt.hash(parseData.data.password, 10);
  try {
    const user = await client.user.create({
      data: {
        username: parseData.data.username,
        password: hashedPassword,
        role: parseData.data.type === "admin" ? "Admin" : "User",
      },
    });
    res.json({
      userId: user.id,
    });
  } catch (e) {
    console.log(e);
    res.status(400).json({
      message: "User already exists",
    });
  }
});
router.post("/signin", async (req, res) => {
  const parseData = SigninSchema.safeParse(req.body);
  if (!parseData.success) {
    res.status(403).json({
      message: "Invalid data",
    });
    return;
  }
  try {
    const user = await client.user.findUnique({
      where: {
        username: parseData.data.username,
      },
    });
    if (!user) {
      res.status(400).json({
        message: "User not found",
      });
      return;
    }
    const isCorrectPassword = await bcrypt.compare(
      parseData.data.password,
      user.password
    );
    if (!isCorrectPassword) {
      res.status(400).json({
        message: "Incorrect password",
      });
      return;
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      sanitizedConfig.JWT_SECRET
    );
    res.json({
      token,
    });
  } catch (e) {
    res.status(400).json({
      message: "User not found",
    });
  }
});

router.get("/elements", (req, res) => {});
router.get("/avatars", (req, res) => {});
router.use("/user", userRouter);
router.use("/space", spaceRouter);
router.use("/admin", adminRouter);
