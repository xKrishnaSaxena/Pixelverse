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
    console.log(parseData);
    if (!parseData.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }
    console.log("REACHED HERE");
    await client.user.update({
      where: { id: req.userId },
      data: { avatarId: parseData.data.avatarId },
    });
    res.json({ message: "Metadata updated" });
  }
);
userRouter.get("/metadata/bulk", async (req: Request, res: Response) => {
  const userIdsString = (req.query.userIds ?? "") as string;
  const usernames = userIdsString.split(",").filter(Boolean);
  const metadata = await client.user.findMany({
    where: {
      username: {
        in: usernames,
      },
    },
    select: {
      avatar: true,
      username: true,
    },
  });
  res.json({
    avatars: metadata.map((user: any) => ({
      avatarId: user.avatar?.imageUrl,
      username: user.username,
    })),
  });
});
