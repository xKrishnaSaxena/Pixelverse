import { Request, Response, Router } from "express";
import { userRouter } from "./user";
import { spaceRouter } from "./space";
import { adminRouter } from "./admin";
import { SigninSchema, SignupSchema } from "../../types";
import client from "@repo/db/src/index";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import sanitizedConfig from "../../utils/config";
export const router = Router();

router.post("/signup", async (req: Request, res: Response) => {
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
router.post("/signin", async (req: Request, res: Response) => {
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
      { userId: user.id, role: user.role, username: user.username },
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

router.get("/elements", async (req: Request, res: Response) => {
  const elements = await client.element.findMany();
  res.json({
    elements: elements.map((element: any) => ({
      id: element.id,
      width: element.width,
      height: element.height,
      static: element.static,
      imageUrl: element.imageUrl,
    })),
  });
});
router.get("/avatars", async (req: Request, res: Response) => {
  const avatars = await client.avatar.findMany();
  res.json({
    avatars: avatars.map((avatar: any) => ({
      id: avatar.id,
      name: avatar.name,
      imageUrl: avatar.imageUrl,
    })),
  });
});

router.use("/user", userRouter);
router.use("/space", spaceRouter);
router.use("/admin", adminRouter);
