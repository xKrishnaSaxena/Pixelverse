import { Request, Response, Router } from "express";
import { adminMiddleware } from "../../middleware/admin";
import {
  CreateAvatarSchema,
  CreateElementSchema,
  CreateMapSchema,
  UpdateElementSchema,
} from "../../types";
import client from "@repo/db/src/index";
export const adminRouter = Router();

adminRouter.post(
  "/element",
  adminMiddleware,
  async (req: Request, res: Response) => {
    const parseData = CreateElementSchema.safeParse(req.body);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    const element = await client.element.create({
      data: {
        width: parseData.data.width,
        height: parseData.data.height,
        static: parseData.data.static,
        imageUrl: parseData.data.imageUrl,
      },
    });
    res.json({ message: "Element created", id: element.id });
  }
);
adminRouter.put(
  "/element/:elementId",
  adminMiddleware,
  async (req: Request, res: Response) => {
    const parseData = UpdateElementSchema.safeParse(req.body);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    await client.element.update({
      where: {
        id: req.params.elementId,
      },
      data: {
        imageUrl: parseData.data.imageUrl,
      },
    });
    res.json({ message: "Element updated" });
  }
);
adminRouter.post(
  "/avatar",
  adminMiddleware,
  async (req: Request, res: Response) => {
    const parseData = CreateAvatarSchema.safeParse(req.body);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    const avatar = await client.avatar.create({
      data: {
        name: parseData.data.name,
        imageUrl: parseData.data.imageUrl,
      },
    });
    res.json({ message: "Avatar created", id: avatar.id });
  }
);
adminRouter.post(
  "/map",
  adminMiddleware,
  async (req: Request, res: Response) => {
    const parseData = CreateMapSchema.safeParse(req.body);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    const map = await client.map.create({
      data: {
        name: parseData.data.name,
        thumbnail: parseData.data.thumbnail,
        width: parseInt(parseData.data.dimensions.split("x")[0]),
        height: parseInt(parseData.data.dimensions.split("x")[1]),
        elements: {
          create: parseData.data.defaultElements.map((element) => ({
            elementId: element.elementId,
            x: element.x,
            y: element.y,
          })),
        },
      },
    });
    res.json({ message: "Map created", id: map.id });
  }
);
