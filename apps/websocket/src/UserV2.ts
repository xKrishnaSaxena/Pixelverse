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
  // Explicit sexual terms
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

  // Excretory/body-related
  "crap",
  "poop",
  "piss",
  "pee",
  "butt",
  "fart",
  "turd",
  "shat",

  // Derogatory/insulting terms
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

  // Racial/ethnic slurs
  "nigger",
  "nigga",
  "k*ke",
  "sp*c",
  "ch*nk",
  "g*psy",
  "retard",
  "m*ng",

  // Racial/ethnic slurs (censored examples)
  "n****r",
  "n*gga",
  "k*ke",
  "sp*c",
  "ch*nk",
  "g*psy",
  "r*tard",
  "m*ng",

  // Homophobic/sexist slurs
  "fag",
  "faggot",
  "dyke",
  "queer",
  "tranny",
  "shemale",
  "whore",
  "hoe",

  // Religious profanity
  "hell",
  "damn",
  "godamn",
  "jesuschrist",
  "bloody",

  // Violence/threats
  "kill",
  "murder",
  "stab",
  "die",
  "suicide",
  "rapist",

  // Internet slang/abbreviations
  "wtf",
  "stfu",
  "ffs",
  "omfg",
  "pos",
  "sob",

  // Misspellings/symbol replacements
  "@ss",
  "b!tch",
  "f*ck",
  "d!ck",
  "5hit",
  "a$$",

  // Additional harsh terms
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
          this.send({
            type: "space-joined",
            payload: {
              userId: this.userId,
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

          if (parsedData.payload.isGlobal) {
            // Check for profanity
            const containsProfanity = bannedWords.some((word) =>
              message.toLowerCase().includes(word.toLowerCase())
            );

            // Store the message in the database
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
            // Handle private messages
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
                  userId: this.userId,
                  x: this.x,
                  y: this.y,
                },
              },
              this,
              this.spaceId!
            );
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

  public async kick() {
    this.send({
      type: "kicked",
      payload: {
        reason: "Repeated inappropriate chat messages.",
      },
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
      data: {
        bannedUsers: {
          push: this.userId!,
        },
      },
    });

    RoomManager.getInstance().removeUser(this, this.spaceId!);
    this.ws.close();
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
