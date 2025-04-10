import { Request, Response, Router } from "express";
import {
  AddElementSchema,
  CreateSpaceSchema,
  DeleteElementSchema,
} from "../../types";
import client from "@repo/db/src/index";
import { userMiddleware } from "../../middleware";
export const spaceRouter = Router();

spaceRouter.post("/", userMiddleware, async (req: Request, res: Response) => {
  const parseData = CreateSpaceSchema.safeParse(req.body);
  if (!parseData.success) {
    res.status(400).json({ message: "Validation error" });
    return;
  }
  if (!parseData.data.mapId) {
    let space = await client.space.create({
      data: {
        name: parseData.data.name,
        width: parseInt(parseData.data.dimensions.split("x")[0]),
        height: parseInt(parseData.data.dimensions.split("x")[1]),
        creatorId: req.userId as string,
      },
    });
    res.json({ message: "Space created", spaceId: space.id });
    return;
  }
  const map = await client.map.findFirst({
    where: {
      id: parseData.data.mapId,
    },
    select: {
      elements: true,
      width: true,
      height: true,
    },
  });
  if (!map) {
    res.status(400).json({ message: "Map not found" });
    return;
  }
  let space = await client.$transaction(async () => {
    const space = await client.space.create({
      data: {
        name: parseData.data.name,
        width: map.width,
        height: map.height,
        creatorId: req.userId as string,
      },
    });
    await client.spaceElement.createMany({
      data: map.elements.map((element) => ({
        spaceId: space.id,
        elementId: element.id,
        x: element.x!,
        y: element.y!,
      })),
    });
    return space;
  });
  res.json({ message: "Space created", spaceId: space.id });
  return;
});

spaceRouter.delete(
  "/:spaceId",
  userMiddleware,
  async (req: Request, res: Response) => {
    const space = await client.space.findUnique({
      where: {
        id: req.params.spaceId,
      },
      select: {
        creatorId: true,
      },
    });
    if (!space) {
      res.status(400).json({ message: "Space not found" });
      return;
    }
    if (space.creatorId !== req.userId) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }
    await client.space.delete({
      where: {
        id: req.params.spaceId,
      },
    });
    res.json({ message: "Space deleted" });
  }
);
spaceRouter.get("/all", userMiddleware, async (req: Request, res: Response) => {
  const spaces = await client.space.findMany({
    where: {
      creatorId: req.userId,
    },
  });
  res.json({
    spaces: spaces.map((space) => ({
      id: space.id,
      name: space.name,
      dimensions: `${space.width}x${space.height}`,
      thumbnail: space.thumbnail,
    })),
  });
});
spaceRouter.post(
  "/element",
  userMiddleware,
  async (req: Request, res: Response) => {
    const parseData = AddElementSchema.safeParse(req.body);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    const space = await client.space.findUnique({
      where: {
        id: req.body.spaceId,
        creatorId: req.userId as string,
      },
      select: {
        width: true,
        height: true,
      },
    });
    if (
      req.body.x < 0 ||
      req.body.y < 0 ||
      req.body.x > space?.width! ||
      req.body.y > space?.height!
    ) {
      res.status(400).json({ message: "Point is outside of the boundary" });
      return;
    }
    if (!space) {
      res.status(400).json({ message: "Space not found" });
      return;
    }
    await client.spaceElement.create({
      data: {
        spaceId: req.body.spaceId,
        elementId: parseData.data.elementId,
        x: parseData.data.x,
        y: parseData.data.y,
      },
    });
    res.json({ message: "Element added" });
  }
);
spaceRouter.delete(
  "/element",
  userMiddleware,
  async (req: Request, res: Response) => {
    const parseData = DeleteElementSchema.safeParse(req.body);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    let element = await client.spaceElement.findFirst({
      where: {
        id: parseData.data.id,
      },
      include: {
        space: true,
      },
    });
    if (!element?.space.creatorId || element.space.creatorId !== req.userId) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }

    await client.spaceElement.delete({
      where: {
        id: parseData.data.id,
      },
    });
    res.json({ message: "Element deleted" });
  }
);
spaceRouter.get(
  "/:spaceId",
  userMiddleware,
  async (req: Request, res: Response) => {
    const space = await client.space.findUnique({
      where: {
        id: req.params.spaceId,
      },
      include: {
        elements: {
          include: {
            element: true,
          },
        },
      },
    });
    if (!space) {
      res.status(400).json({ message: "Space not found" });
      return;
    }
    res.json({
      dimensions: `${space.width}x${space.height}`,
      name: space.name,
      thumbnail: space.thumbnail,
      elements: space.elements.map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        element: {
          id: e.element.id,
          width: e.element.width,
          height: e.element.height,
          static: e.element.static,
          imageUrl: e.element.imageUrl,
        },
      })),
    });
  }
);
