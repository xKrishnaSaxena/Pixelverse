import { Request, Response, Router } from "express";
import { UpdateMetadataSchema } from "../../types";
import client from "@repo/db/src/index";
import { userMiddleware } from "../../middleware";
export const userRouter = Router();

userRouter.post(
  "/metadata",
  userMiddleware,
  async (req: Request, res: Response) => {
    const parseData = UpdateMetadataSchema.safeParse(req.body);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    await client.user.update({
      where: { id: req.userId },
      data: { avatarId: parseData.data.avatarId },
    });
    res.json({ message: "Metadata updated" });
  }
);
userRouter.get("/metadata/bulk", async (req: Request, res: Response) => {
  const userIdasString = (req.query.userIds ?? "[]") as string;
  const userIds = userIdasString
    .slice(1, userIdasString?.length - 1)
    .split(",");
  const metadata = await client.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      avatar: true,
      id: true,
    },
  });
  res.json({
    avatars: metadata.map((user) => ({
      avatarId: user.avatar?.imageUrl,
      userId: user.id,
    })),
  });
});
