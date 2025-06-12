import { WebSocketServer } from "ws";
import { User } from "./UserV2";
import { RoomManager } from "./RoomManager";

const wss = new WebSocketServer({ port: 3001 });

// Maps to manage call sessions
const callSessions = new Map<string, Set<string>>(); // sessionId -> Set of userIds
const userSessions = new Map<string, string>(); // userId -> sessionId
let sessionCounter = 0;

wss.on("connection", function connection(ws) {
  console.log("user connected");
  let user = new User(ws);
  ws.on("error", console.error);

  ws.on("close", () => {
    user?.destroy();
    // Clean up call session on disconnect
    const userId = user.userId;
    if (userId && userSessions.has(userId)) {
      const sessionId = userSessions.get(userId)!;
      const participants = callSessions.get(sessionId);
      if (participants) {
        participants.delete(userId);
        if (participants.size === 0) {
          callSessions.delete(sessionId);
        } else {
          participants.forEach((uid) => {
            const u = RoomManager.getInstance()
              .rooms.get(user.spaceId!)
              ?.find((u) => u.userId === uid);
            u?.send({ type: "leave_call", payload: { userId } });
          });
        }
        userSessions.delete(userId);
      }
    }
  });
});

// Proximity detection function
function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function manageCallSessions() {
  const rooms = RoomManager.getInstance().rooms;
  rooms.forEach((users, spaceId) => {
    const userArray = users.filter((u) => u.userId && u.spaceId === spaceId);
    // Reset sessions for recalculation
    const currentSessions = new Map<string, Set<string>>();

    // Check proximity for all pairs
    for (let i = 0; i < userArray.length; i++) {
      for (let j = i + 1; j < userArray.length; j++) {
        const u1 = userArray[i];
        const u2 = userArray[j];
        const distance = calculateDistance(u1.x, u1.y, u2.x, u2.y);
        if (distance <= 2) {
          // Proximity threshold: 2 grid units
          const sessionId1 = u1.getCallSessionId();
          const sessionId2 = u2.getCallSessionId();
          let sessionId: string;

          if (!sessionId1 && !sessionId2) {
            sessionId = `session_${sessionCounter++}`;
            currentSessions.set(sessionId, new Set([u1.userId!, u2.userId!]));
            u1.setCallSessionId(sessionId);
            u2.setCallSessionId(sessionId);
            u1.send({
              type: "start_call",
              payload: { sessionId, sfuUrl: "ws://localhost:3002" },
            });
            u2.send({
              type: "start_call",
              payload: { sessionId, sfuUrl: "ws://localhost:3002" },
            });
          } else if (sessionId1 && !sessionId2) {
            sessionId = sessionId1;
            currentSessions.get(sessionId)?.add(u2.userId!);
            u2.setCallSessionId(sessionId);
            u2.send({
              type: "join_call",
              payload: { sessionId, sfuUrl: "ws://localhost:3002" },
            });
          } else if (!sessionId1 && sessionId2) {
            sessionId = sessionId2;
            currentSessions.get(sessionId)?.add(u1.userId!);
            u1.setCallSessionId(sessionId);
            u1.send({
              type: "join_call",
              payload: { sessionId, sfuUrl: "ws://localhost:3002" },
            });
          } else if (sessionId1 !== sessionId2) {
            // Merge sessions
            sessionId = sessionId1 as string;
            const participants2 = currentSessions.get(sessionId2 as string);
            if (participants2) {
              participants2.forEach((uid) => {
                currentSessions.get(sessionId)?.add(uid);
                const u = users.find((u) => u.userId === uid);
                u?.setCallSessionId(sessionId);
                u?.send({
                  type: "join_call",
                  payload: { sessionId, sfuUrl: "ws://localhost:3002" },
                });
              });
              currentSessions.delete(sessionId2 as string);
            }
          }
        }
      }
    }

    // Update global sessions and remove isolated users
    callSessions.forEach((participants, sessionId) => {
      participants.forEach((uid) => {
        const u = users.find((u) => u.userId === uid);
        if (u && !currentSessions.has(sessionId)) {
          u.setCallSessionId(undefined);
          u.send({ type: "leave_call", payload: { sessionId } });
        }
      });
    });
    callSessions.clear();
    currentSessions.forEach((participants, sessionId) => {
      callSessions.set(sessionId, participants);
    });
  });
}

// Run proximity check every second
setInterval(manageCallSessions, 1000);
