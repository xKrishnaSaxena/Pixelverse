import type { User } from "./UserV2";
type OutgoingMessage = any;

export class RoomManager {
  rooms: Map<string, User[]> = new Map();
  ongoingCalls: Map<string, Map<string, string>> = new Map(); // spaceId -> (userId -> userId)
  static instance: RoomManager;

  private constructor() {
    this.rooms = new Map();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new RoomManager();
    }
    return this.instance;
  }

  public removeUser(user: User, spaceId: string) {
    if (!this.rooms.has(spaceId)) {
      return;
    }
    this.rooms.set(
      spaceId,
      this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? []
    );
  }

  public broadcastToAll(message: OutgoingMessage, roomId: string) {
    if (!this.rooms.has(roomId)) {
      return;
    }
    this.rooms.get(roomId)?.forEach((u) => {
      u.send(message);
    });
  }

  public addUser(spaceId: string, user: User) {
    if (!this.rooms.has(spaceId)) {
      this.rooms.set(spaceId, [user]);
      return;
    }
    this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
  }

  public broadcast(message: OutgoingMessage, user: User, roomId: string) {
    if (!this.rooms.has(roomId)) {
      return;
    }
    this.rooms.get(roomId)?.forEach((u) => {
      if (u.id !== user.id) {
        u.send(message);
      }
    });
  }

  public startCall(spaceId: string, user1: string, user2: string) {
    let roomCalls = this.ongoingCalls.get(spaceId);
    if (!roomCalls) {
      roomCalls = new Map();
      this.ongoingCalls.set(spaceId, roomCalls);
    }
    roomCalls.set(user1, user2);
    roomCalls.set(user2, user1);
    this.broadcastToAll(
      {
        type: "call-started",
        payload: { user1, user2 },
      },
      spaceId
    );
  }

  public endCall(spaceId: string, user1: string, user2: string) {
    const roomCalls = this.ongoingCalls.get(spaceId);
    if (roomCalls) {
      roomCalls.delete(user1);
      roomCalls.delete(user2);
      this.broadcastToAll(
        {
          type: "call-ended",
          payload: { user1, user2 },
        },
        spaceId
      );
    }
  }
}
