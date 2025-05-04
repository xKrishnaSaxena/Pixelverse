import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";

import client from "@repo/db/src/index";
import jwt, { JwtPayload } from "jsonwebtoken";
import sanitizedConfig from "./utils/config";

type OutgoingMessage = any;
function getRandomString(length: number) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export class User {
  public id: string;
  public userId?: string;
  private spaceId?: string;
  private x: number;
  private y: number;
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.id = getRandomString(10);
    this.x = 0;
    this.y = 0;
    this.ws = ws;
    this.initHandlers();
  }

  initHandlers() {
    this.ws.on("message", async (data) => {
      const parsedData = JSON.parse(data.toString());
      switch (parsedData.type) {
        case "join":
          const spaceId = parsedData.payload.spaceId;
          const token = parsedData.payload.token;
          const userId = (
            jwt.verify(token, sanitizedConfig.JWT_SECRET) as JwtPayload
          ).username;
          if (!userId) {
            this.ws.close();
            return;
          }

          this.userId = userId;
          const space = await client.space.findFirst({
            where: { id: spaceId },
          });

          if (!space) {
            this.ws.close();
            return;
          }

          this.spaceId = spaceId;
          RoomManager.getInstance().addUser(spaceId, this);
          const existingUsers =
            RoomManager.getInstance().rooms.get(spaceId)?.length || 0;
          this.x = 5 + existingUsers;
          this.y = 5 + existingUsers;
          this.send({
            type: "space-joined",
            payload: {
              userId: this.userId, // Include current user's userId
              spawn: {
                x: this.x,
                y: this.y,
              },
              users:
                RoomManager.getInstance()
                  .rooms.get(spaceId)
                  ?.filter((x) => x.id !== this.id)
                  ?.map((u) => ({ userId: u.userId, x: u.x, y: u.y })) ?? [],
            },
          });

          RoomManager.getInstance().broadcast(
            {
              type: "user-joined",
              payload: {
                userId: this.userId,
                x: this.x,
                y: this.y,
              },
            },
            this,
            this.spaceId!
          );
          break;
        case "chat-message":
          const message = parsedData.payload.message;

          // Check if this is global chat message
          if (parsedData.payload.isGlobal) {
            // Broadcast global message to all users in the space
            RoomManager.getInstance().broadcastToAll(
              {
                type: "chat-message",
                payload: {
                  userId: this.userId!,
                  message: message,
                  isGlobal: true,
                },
              },
              this.spaceId!
            );
          } else {
            // This is a private message
            const recipientId = parsedData.payload.recipient;

            // Find the recipient user
            const recipient = RoomManager.getInstance()
              .rooms.get(this.spaceId!)
              ?.find((u) => u.userId === recipientId);

            if (recipient) {
              recipient.send({
                type: "chat-message",
                payload: {
                  userId: this.userId!,
                  message: message,
                  isGlobal: false,
                },
              });
            }
          }
          break;
        case "move":
          const moveX = parsedData.payload.x;
          const moveY = parsedData.payload.y;
          const xDisplacement = Math.abs(this.x - moveX);
          const yDisplacement = Math.abs(this.y - moveY);
          if (
            (xDisplacement == 1 && yDisplacement == 0) ||
            (xDisplacement == 0 && yDisplacement == 1)
          ) {
            this.x = moveX;
            this.y = moveY;
            RoomManager.getInstance().broadcast(
              {
                type: "movement",
                payload: {
                  userId: this.userId, // Include userId
                  x: this.x,
                  y: this.y,
                },
              },
              this,
              this.spaceId!
            );
            // Also send the movement confirmation to this user
            this.send({
              type: "movement",
              payload: {
                userId: this.userId,
                x: this.x,
                y: this.y,
              },
            });
            return;
          }

          this.send({
            type: "movement-rejected",
            payload: {
              x: this.x,
              y: this.y,
            },
          });
          break;
      }
    });
  }

  destroy() {
    RoomManager.getInstance().broadcast(
      {
        type: "user-left",
        payload: {
          userId: this.userId,
        },
      },
      this,
      this.spaceId!
    );
    RoomManager.getInstance().removeUser(this, this.spaceId!);
  }

  send(payload: OutgoingMessage) {
    this.ws.send(JSON.stringify(payload));
  }
}
