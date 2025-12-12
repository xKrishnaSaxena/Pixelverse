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

const bannedWords = [
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "ass",
  "asshole",
  "bitch",
  "cock",
  "cocksucker",
  "dick",
  "dildo",
  "pussy",
  "whore",
  "slut",
  "blowjob",
  "jerkoff",
  "crap",
  "poop",
  "piss",
  "pee",
  "butt",
  "fart",
  "turd",
  "shat",
  "idiot",
  "moron",
  "retard",
  "douche",
  "scum",
  "trash",
  "loser",
  "bastard",
  "wanker",
  "twat",
  "spastic",
  "nob",
  "git",
  "slag",
  "cunt",
  "nigger",
  "nigga",
  "k*ke",
  "sp*c",
  "ch*nk",
  "g*psy",
  "m*ng",
  "n****r",
  "n*gga",
  "fag",
  "faggot",
  "dyke",
  "queer",
  "tranny",
  "shemale",
  "hoe",
  "damn",
  "godamn",
  "jesuschrist",
  "bloody",
  "kill",
  "murder",
  "stab",
  "die",
  "suicide",
  "rapist",
  "wtf",
  "stfu",
  "ffs",
  "omfg",
  "pos",
  "sob",
  "@ss",
  "b!tch",
  "f*ck",
  "d!ck",
  "5hit",
  "a$$",
  "incest",
  "pedo",
  "nazi",
  "terrorist",
  "scumbag",
  "meth",
  "cocaine",
  "porn",
  "prostitute",
];

export class User {
  public id: string;
  public userId?: string;
  private spaceId?: string;
  private x: number;
  private y: number;
  private ws: WebSocket;
  private violationCount: number = 0;

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
          if (space.bannedUsers.includes(userId)) {
            this.ws.send(
              JSON.stringify({
                type: "join-rejected",
                payload: { reason: "You are banned from this space." },
              })
            );
            this.ws.close();
            return;
          }

          this.spaceId = spaceId;
          RoomManager.getInstance().addUser(spaceId, this);
          const existingUsers =
            RoomManager.getInstance().rooms.get(spaceId)?.length || 0;
          this.x = 5 + existingUsers;
          this.y = 5 + existingUsers;

          const roomCalls =
            RoomManager.getInstance().ongoingCalls.get(spaceId) || new Map();
          this.send({
            type: "space-joined",
            payload: {
              userId: this.userId,
              spawn: { x: this.x, y: this.y },
              users:
                RoomManager.getInstance()
                  .rooms.get(spaceId)
                  ?.filter((x) => x.id !== this.id)
                  ?.map((u) => ({ userId: u.userId, x: u.x, y: u.y })) ?? [],
              ongoingCalls: Array.from(roomCalls.entries()),
            },
          });

          RoomManager.getInstance().broadcast(
            {
              type: "user-joined",
              payload: { userId: this.userId, x: this.x, y: this.y },
            },
            this,
            this.spaceId!
          );
          break;

        case "chat-message":
          const message = parsedData.payload.message;
          if (parsedData.payload.isGlobal) {
            const containsProfanity = bannedWords.some((word) =>
              message.toLowerCase().includes(word.toLowerCase())
            );

            await client.chatMessage.create({
              data: {
                spaceId: this.spaceId!,
                userId: this.userId!,
                message: message,
              },
            });

            if (containsProfanity) {
              this.violationCount++;
              if (this.violationCount >= 3) {
                this.kick();
              } else {
                this.send({
                  type: "chat-warning",
                  payload: {
                    message: `Warning: Inappropriate content detected. Violation ${this.violationCount}/3`,
                  },
                });
              }
              return;
            }

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
            const recipientId = parsedData.payload.recipient;
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
          const moveX = parseInt(parsedData.payload.x);
          const moveY = parseInt(parsedData.payload.y);
          const xDisplacement = Math.abs(this.x - moveX);
          const yDisplacement = Math.abs(this.y - moveY);
          if (
            (xDisplacement == 1 && yDisplacement == 0) ||
            (xDisplacement == 0 && yDisplacement == 1)
          ) {
            this.x = moveX;
            this.y = moveY;

            this.send({
              type: "movement",
              payload: { userId: this.userId, x: this.x, y: this.y },
            });

            RoomManager.getInstance().broadcast(
              {
                type: "movement",
                payload: { userId: this.userId, x: this.x, y: this.y },
              },
              this,
              this.spaceId!
            );
            break;
          }

          this.send({
            type: "movement-rejected",
            payload: { x: this.x, y: this.y },
          });
          break;

        case "call-started":
          const p1 = parsedData.payload.user1;
          const p2 = parsedData.payload.user2;
          RoomManager.getInstance().startCall(this.spaceId!, p1, p2);
          break;
        case "call-ended":
          const u1 = parsedData.payload.user1;
          const u2 = parsedData.payload.user2;
          RoomManager.getInstance().endCall(this.spaceId!, u1, u2);
          break;
      }
    });
  }

  public async kick() {
    this.send({
      type: "kicked",
      payload: { reason: "Repeated inappropriate chat messages." },
    });

    RoomManager.getInstance().broadcast(
      {
        type: "user-kicked",
        payload: {
          userId: this.userId,
          reason: "Repeated inappropriate chat messages.",
        },
      },
      this,
      this.spaceId!
    );

    await client.space.update({
      where: { id: this.spaceId! },
      data: { bannedUsers: { push: this.userId! } },
    });

    RoomManager.getInstance().removeUser(this, this.spaceId!);
    this.ws.close();
  }

  destroy() {
    const roomCalls = RoomManager.getInstance().ongoingCalls.get(this.spaceId!);
    if (roomCalls && roomCalls.has(this.userId!)) {
      const otherUserId = roomCalls.get(this.userId!)!;
      const otherUser = RoomManager.getInstance()
        .rooms.get(this.spaceId!)
        ?.find((u) => u.userId === otherUserId);
      if (otherUser) {
        otherUser.send({
          type: "call-end",
          payload: { from: this.userId! },
        });
      }
      RoomManager.getInstance().endCall(
        this.spaceId!,
        this.userId!,
        otherUserId
      );
    }
    RoomManager.getInstance().broadcast(
      {
        type: "user-left",
        payload: { userId: this.userId },
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
