import { useEffect, useRef, useState } from "react";
import { useAvatar } from "../contexts/AvatarsContext";

export const Arena = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map<string, any>());
  const [params, setParams] = useState({ token: "", spaceId: "" });
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleBlockUser = (userId: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
        // Close chat if blocking the active user
        if (activeChatUser === userId) {
          setActiveChatUser(null);
        }
      }
      return newSet;
    });
  };

  // Chat references and state
  const privateMessagesContainerRef = useRef<HTMLDivElement>(null);
  const globalMessagesContainerRef = useRef<HTMLDivElement>(null);
  const [privateMessages, setPrivateMessages] = useState<
    { userId: string; message: string; recipient?: string }[]
  >([]);
  const [globalMessages, setGlobalMessages] = useState<
    { userId: string; message: string; timestamp: number }[]
  >([]);
  const [privateMessageInput, setPrivateMessageInput] = useState("");
  const [globalMessageInput, setGlobalMessageInput] = useState("");
  const [nearbyUsers, setNearbyUsers] = useState<Set<string>>(new Set());
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);

  // Avatar handling
  const { avatars, fetchAvatars } = useAvatar();
  const [loadedImages, setLoadedImages] = useState<
    Map<string, HTMLImageElement>
  >(new Map());
  const defaultAvatarRef = useRef<HTMLImageElement | null>(null);

  // Animation refs
  const currentUserAnimationRef = useRef({
    isMoving: false,
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
    moveStartTime: 0,
    visualX: 0,
    visualY: 0,
  });
  const usersAnimationRef = useRef(new Map<string, any>());
  const MOVE_DURATION = 200; // Animation duration in milliseconds

  // Load default avatar
  useEffect(() => {
    const img = new Image();
    img.src = "/gAvatarV2.png";
    img.onload = () => {
      defaultAvatarRef.current = img;
      setLoadedImages((prev) => new Map(prev).set("default", img));
    };
  }, []);

  // Fetch avatars
  useEffect(() => {
    const userIds = Array.from(users.keys());
    if (currentUser?.userId) userIds.push(currentUser.userId);
    fetchAvatars(userIds);
  }, [users, currentUser]);

  // Load avatar images
  useEffect(() => {
    const loadImages = async () => {
      const imageMap = new Map<string, HTMLImageElement>();
      const loadPromises: Promise<void>[] = [];
      Array.from(avatars.entries()).forEach(([userId, url]) => {
        if (!loadedImages.has(url)) {
          const img = new Image();
          img.src = url;
          loadPromises.push(
            new Promise((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
          );
          imageMap.set(url, img);
        }
      });
      await Promise.all(loadPromises);
      setLoadedImages((prev) => new Map([...prev, ...imageMap]));
    };
    loadImages();
  }, [avatars]);

  // Detect nearby users
  useEffect(() => {
    if (!currentUser.gridX || !currentUser.gridY) return;
    const nearby = Array.from(users.values()).filter((user) => {
      const dx = Math.abs(currentUser.gridX - user.gridX);
      const dy = Math.abs(currentUser.gridY - user.gridY);
      return dx <= 2 && dy <= 2 && user.userId !== currentUser.userId;
    });

    const nearbyUserIds = new Set(nearby.map((u) => u.userId));
    setNearbyUsers(nearbyUserIds);

    // If active chat user is no longer nearby, close their chat
    if (activeChatUser && !nearbyUserIds.has(activeChatUser)) {
      setActiveChatUser(null);
    }
  }, [currentUser, users, activeChatUser]);

  // WebSocket setup
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token") || "";
    const spaceId = urlParams.get("spaceId") || "";
    setParams({ token, spaceId });

    wsRef.current = new WebSocket("ws://localhost:3001");
    wsRef.current.onopen = () => {
      wsRef.current!.send(
        JSON.stringify({ type: "join", payload: { spaceId, token } })
      );
    };
    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    return () => wsRef.current?.close();
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    const currentTime = Date.now();
    switch (message.type) {
      case "space-joined":
        const initialGridX = message.payload.spawn.x;
        const initialGridY = message.payload.spawn.y;
        setCurrentUser({
          userId: message.payload.userId,
          gridX: initialGridX,
          gridY: initialGridY,
        });
        currentUserAnimationRef.current = {
          isMoving: false,
          startX: initialGridX * 50,
          startY: initialGridY * 50,
          targetX: initialGridX * 50,
          targetY: initialGridY * 50,
          moveStartTime: 0,
          visualX: initialGridX * 50,
          visualY: initialGridY * 50,
        };
        const userMap = new Map();
        message.payload.users.forEach((user: any) => {
          userMap.set(user.userId, {
            userId: user.userId,
            gridX: user.x,
            gridY: user.y,
          });
          usersAnimationRef.current.set(user.userId, {
            isMoving: false,
            startX: user.x * 50,
            startY: user.y * 50,
            targetX: user.x * 50,
            targetY: user.y * 50,
            moveStartTime: 0,
            visualX: user.x * 50,
            visualY: user.y * 50,
          });
        });
        setUsers(userMap);
        break;

      case "user-joined":
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.set(message.payload.userId, {
            userId: message.payload.userId,
            gridX: message.payload.x,
            gridY: message.payload.y,
          });
          return newUsers;
        });
        usersAnimationRef.current.set(message.payload.userId, {
          isMoving: false,
          startX: message.payload.x * 50,
          startY: message.payload.y * 50,
          targetX: message.payload.x * 50,
          targetY: message.payload.y * 50,
          moveStartTime: 0,
          visualX: message.payload.x * 50,
          visualY: message.payload.y * 50,
        });

        // Add system message to global chat
        setGlobalMessages((prev) => [
          ...prev,
          {
            userId: "SYSTEM",
            message: `${message.payload.userId} has joined the space!`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "chat-message":
        // Check if message is private or global
        if (message.payload.isGlobal) {
          setGlobalMessages((prev) => [
            ...prev,
            {
              userId: message.payload.userId,
              message: message.payload.message,
              timestamp: Date.now(),
            },
          ]);
        } else {
          // This is a private message
          setPrivateMessages((prev) => [
            ...prev,
            {
              userId: message.payload.userId,
              message: message.payload.message,
              recipient: currentUser.userId,
            },
          ]);

          // If we receive a message from someone, make them the active chat
          if (!activeChatUser || activeChatUser !== message.payload.userId) {
            setActiveChatUser(message.payload.userId);
          }
        }
        break;

      case "movement":
        const userId = message.payload.userId;
        const newGridX = message.payload.x;
        const newGridY = message.payload.y;
        if (userId === currentUser.userId) {
          setCurrentUser((prev: any) => ({
            ...prev,
            gridX: newGridX,
            gridY: newGridY,
          }));
        } else {
          setUsers((prev) => {
            const newUsers = new Map(prev);
            const user = newUsers.get(userId);
            if (user) {
              const animation = usersAnimationRef.current.get(userId) || {};
              newUsers.set(userId, {
                ...user,
                gridX: newGridX,
                gridY: newGridY,
              });
              animation.isMoving = true;
              animation.startX = animation.visualX || user.gridX * 50;
              animation.startY = animation.visualY || user.gridY * 50;
              animation.targetX = newGridX * 50;
              animation.targetY = newGridY * 50;
              animation.moveStartTime = currentTime;
              usersAnimationRef.current.set(userId, animation);
            }
            return newUsers;
          });
        }
        break;

      case "movement-rejected":
        setCurrentUser((prev: any) => ({
          ...prev,
          gridX: message.payload.x,
          gridY: message.payload.y,
        }));
        currentUserAnimationRef.current.targetX = message.payload.x * 50;
        currentUserAnimationRef.current.targetY = message.payload.y * 50;
        break;

      case "user-left":
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(message.payload.userId);
          return newUsers;
        });
        usersAnimationRef.current.delete(message.payload.userId);

        // Add system message to global chat
        setGlobalMessages((prev) => [
          ...prev,
          {
            userId: "SYSTEM",
            message: `${message.payload.userId} has left the space.`,
            timestamp: Date.now(),
          },
        ]);

        // Close chat if the user we were chatting with left
        if (activeChatUser === message.payload.userId) {
          setActiveChatUser(null);
        }
        break;
    }
  };

  // Handle movement with animation
  const handleMove = (newGridX: number, newGridY: number) => {
    if (!currentUser || !wsRef.current) return;
    const currentTime = Date.now();
    currentUserAnimationRef.current = {
      isMoving: true,
      startX: currentUserAnimationRef.current.visualX || currentUser.gridX * 50,
      startY: currentUserAnimationRef.current.visualY || currentUser.gridY * 50,
      targetX: newGridX * 50,
      targetY: newGridY * 50,
      moveStartTime: currentTime,
      visualX:
        currentUserAnimationRef.current.visualX || currentUser.gridX * 50,
      visualY:
        currentUserAnimationRef.current.visualY || currentUser.gridY * 50,
    };
    wsRef.current.send(
      JSON.stringify({
        type: "move",
        payload: { x: newGridX, y: newGridY, userId: currentUser.userId },
      })
    );
  };

  // Send private message
  const sendPrivateMessage = (recipient: string, message: string) => {
    if (!message.trim() || !wsRef.current) return;

    const newMessage = {
      userId: currentUser.userId,
      message: message,
      recipient: recipient,
    };

    setPrivateMessages((prev) => [...prev, newMessage]);

    wsRef.current.send(
      JSON.stringify({
        type: "chat-message",
        payload: {
          message: message,
          recipient: recipient,
          isGlobal: false,
        },
      })
    );
  };

  // Send global message
  const sendGlobalMessage = (message: string) => {
    if (!message.trim() || !wsRef.current) return;

    wsRef.current.send(
      JSON.stringify({
        type: "chat-message",
        payload: {
          message: message,
          isGlobal: true,
        },
      })
    );
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const currentTime = Date.now();

      // Calculate current user's visual position
      let currentVisualX = currentUser.gridX * 50;
      let currentVisualY = currentUser.gridY * 50;
      if (currentUserAnimationRef.current.isMoving) {
        const elapsed =
          currentTime - currentUserAnimationRef.current.moveStartTime;
        const progress = Math.min(elapsed / MOVE_DURATION, 1);
        currentVisualX =
          currentUserAnimationRef.current.startX +
          progress *
            (currentUserAnimationRef.current.targetX -
              currentUserAnimationRef.current.startX);
        currentVisualY =
          currentUserAnimationRef.current.startY +
          progress *
            (currentUserAnimationRef.current.targetY -
              currentUserAnimationRef.current.startY);
        currentUserAnimationRef.current.visualX = currentVisualX;
        currentUserAnimationRef.current.visualY = currentVisualY;
        if (progress >= 1) currentUserAnimationRef.current.isMoving = false;
      } else {
        currentUserAnimationRef.current.visualX = currentVisualX;
        currentUserAnimationRef.current.visualY = currentVisualY;
      }

      // Calculate other users' visual positions
      const usersVisual = new Map<
        string,
        { visualX: number; visualY: number }
      >();
      users.forEach((user, userId) => {
        const animation = usersAnimationRef.current.get(userId) || {};
        let visualX = user.gridX * 50;
        let visualY = user.gridY * 50;
        if (animation.isMoving) {
          const elapsed = currentTime - animation.moveStartTime;
          const progress = Math.min(elapsed / MOVE_DURATION, 1);
          visualX =
            animation.startX +
            progress * (animation.targetX - animation.startX);
          visualY =
            animation.startY +
            progress * (animation.targetY - animation.startY);
          animation.visualX = visualX;
          animation.visualY = visualY;
          if (progress >= 1) animation.isMoving = false;
        } else {
          animation.visualX = visualX;
          animation.visualY = visualY;
        }
        usersVisual.set(userId, { visualX, visualY });
      });

      // Draw the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#90EE90";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#A9A9A9";
      const pathWidth = 50;
      const horizontalPathRows = [5, 10, 15, 20, 25, 30, 35];
      const verticalPathCols = [5, 10, 15, 20, 25, 30, 35];
      horizontalPathRows.forEach((y) =>
        ctx.fillRect(0, y * 50, canvas.width, pathWidth)
      );
      verticalPathCols.forEach((x) =>
        ctx.fillRect(x * 50, 0, pathWidth, canvas.height)
      );
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      horizontalPathRows.forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(0, y * 50 + 25);
        ctx.lineTo(canvas.width, y * 50 + 25);
        ctx.stroke();
      });
      verticalPathCols.forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x * 50 + 25, 0);
        ctx.lineTo(x * 50 + 25, canvas.height);
        ctx.stroke();
      });

      // Draw current user
      if (currentUser.gridX !== undefined && currentUser.gridY !== undefined) {
        const avatar = avatars.get(currentUser.userId);
        const image = avatar
          ? loadedImages.get(avatar)
          : defaultAvatarRef.current;
        if (image)
          ctx.drawImage(
            image,
            currentVisualX - 40,
            currentVisualY - 40,
            80,
            80
          );
        ctx.fillStyle = "#fff";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("You", currentVisualX, currentVisualY + 50);
      }

      // Draw other users
      usersVisual.forEach((visual, userId) => {
        const user = users.get(userId);
        if (!user.gridX || !user.gridY) return;
        const avatar = avatars.get(userId);
        const image = avatar
          ? loadedImages.get(avatar)
          : defaultAvatarRef.current;
        if (image)
          ctx.drawImage(
            image,
            visual.visualX - 40,
            visual.visualY - 40,
            80,
            80
          );
        ctx.fillStyle = "#fff";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(userId, visual.visualX, visual.visualY + 50);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [currentUser, users, loadedImages, avatars]);

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentUser?.gridX || !currentUser?.gridY) return;
    const { gridX, gridY } = currentUser;
    switch (e.key) {
      case "ArrowUp":
      case "W":
      case "w":
        handleMove(gridX, gridY - 1);
        break;
      case "ArrowDown":
      case "S":
      case "s":
        handleMove(gridX, gridY + 1);
        break;
      case "ArrowLeft":
      case "A":
      case "a":
        handleMove(gridX - 1, gridY);
        break;
      case "ArrowRight":
      case "D":
      case "d":
        handleMove(gridX + 1, gridY);
        break;
    }
  };

  // Auto-scroll chats
  useEffect(() => {
    if (privateMessagesContainerRef.current) {
      privateMessagesContainerRef.current.scrollTop =
        privateMessagesContainerRef.current.scrollHeight;
    }
  }, [privateMessages, activeChatUser]);

  useEffect(() => {
    if (globalMessagesContainerRef.current) {
      globalMessagesContainerRef.current.scrollTop =
        globalMessagesContainerRef.current.scrollHeight;
    }
  }, [globalMessages]);

  // Filter private messages for the active chat
  const activePrivateMessages = privateMessages.filter(
    (msg) =>
      (msg.userId === activeChatUser || msg.recipient === activeChatUser) &&
      !blockedUsers.has(msg.userId)
  );

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Pixel Arena
          </h1>
          <div className="flex justify-center gap-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-3 shadow-lg">
              <p className="text-sm text-blue-400">Space ID</p>
              <p className="font-mono">{params.spaceId}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 shadow-lg">
              <p className="text-sm text-purple-400">Connected Players</p>
              <p className="text-xl font-bold text-green-400">
                {users.size + (currentUser.userId ? 1 : 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {/* Left side - Global Space Chat */}
          <div className="w-1/4 bg-gray-800 rounded-lg p-4 shadow-lg">
            <h1 className="mb-2 text-xl font-bold text-white">Space Chat</h1>
            <div
              ref={globalMessagesContainerRef}
              className="h-96 overflow-y-auto mb-4 border border-gray-700 rounded p-2"
            >
              {globalMessages
                .filter(
                  (msg) =>
                    !blockedUsers.has(msg.userId) || msg.userId === "SYSTEM"
                )
                .map((msg, i) => (
                  <div key={i} className="mb-2">
                    <div
                      className={`p-2 rounded ${
                        msg.userId === "SYSTEM"
                          ? "bg-gray-700 text-yellow-300"
                          : msg.userId === currentUser.userId
                            ? "bg-blue-600"
                            : "bg-gray-700"
                      }`}
                    >
                      {msg.userId === "SYSTEM" ? (
                        <span className="text-yellow-300">{msg.message}</span>
                      ) : msg.userId === currentUser.userId ? (
                        <>
                          <span className="font-bold text-purple-300">
                            You:{" "}
                          </span>
                          <span className="text-gray-300">{msg.message}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-blue-400">
                            {msg.userId}:{" "}
                          </span>
                          <span className="text-gray-300">{msg.message}</span>
                        </>
                      )}
                    </div>
                    {msg.userId !== "SYSTEM" && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                    {msg.userId !== "SYSTEM" &&
                      blockedUsers.has(msg.userId) && (
                        <div className="text-xs text-gray-500 mt-1">
                          (Blocked user)
                        </div>
                      )}
                  </div>
                ))}
              {globalMessages.length === 0 && (
                <div className="text-gray-500 text-center p-4">
                  No messages yet. Be the first to say hello!
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendGlobalMessage(globalMessageInput);
                setGlobalMessageInput("");
              }}
            >
              <input
                value={globalMessageInput}
                onChange={(e) => setGlobalMessageInput(e.target.value)}
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                disabled={blockedUsers.size > 0}
                placeholder={
                  blockedUsers.size > 0
                    ? "You have blocked users - unblock to chat"
                    : "Type a message to everyone..."
                }
              />
            </form>
          </div>

          {/* Center - Canvas Container */}
          <div className="flex-1 relative border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl bg-gray-900">
            <div
              className="overflow-auto h-[70vh] relative"
              style={{ scrollBehavior: "smooth" }}
            >
              <canvas
                ref={canvasRef}
                width={2000}
                height={2000}
                className="bg-gray-900"
              />
              <div className="absolute bottom-4 right-4 bg-gray-800 p-3 rounded-lg text-sm">
                Use arrow keys to move
                <div className="flex gap-2 mt-2">
                  <kbd className="px-2 py-1 bg-gray-700 rounded">↑</kbd>
                  <kbd className="px-2 py-1 bg-gray-700 rounded">↓</kbd>
                  <kbd className="px-2 py-1 bg-gray-700 rounded">←</kbd>
                  <kbd className="px-2 py-1 bg-gray-700 rounded">→</kbd>
                </div>
              </div>
            </div>

            {/* Nearby Users List */}
            {nearbyUsers.size > 0 && !activeChatUser && (
              <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg w-64 shadow-lg transition-all duration-300">
                <h3 className="text-lg font-semibold mb-2">Nearby Players</h3>
                <div className="space-y-2">
                  {Array.from(nearbyUsers).map((userId) => (
                    <div
                      key={userId}
                      className="flex items-center justify-between group"
                    >
                      <button
                        onClick={() => setActiveChatUser(userId)}
                        className="flex-1 text-left p-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center"
                      >
                        <div className="w-8 h-8 bg-blue-500 rounded-full mr-2 flex items-center justify-center">
                          {userId.charAt(0).toUpperCase()}
                        </div>
                        <span>{userId}</span>
                      </button>
                      <button
                        onClick={() => toggleBlockUser(userId)}
                        className="ml-2 px-3 py-2 text-sm rounded transition-colors"
                        style={{ minWidth: "70px" }}
                      >
                        {blockedUsers.has(userId) ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-red-400 hover:text-red-300"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                              clipRule="evenodd"
                            />
                            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-green-400 hover:text-green-300"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path
                              fillRule="evenodd"
                              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Private Chat Window */}
            {activeChatUser && (
              <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg w-80 shadow-lg transition-all duration-300">
                <div className="flex justify-between items-center mb-2">
                  <h1 className="text-xl font-bold text-white">
                    Chat with {activeChatUser}
                  </h1>
                  <button
                    onClick={() => setActiveChatUser(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div
                  ref={privateMessagesContainerRef}
                  className="h-64 overflow-y-auto mb-4"
                >
                  {activeChatUser && blockedUsers.has(activeChatUser) && (
                    <div className="text-center p-4 text-gray-500">
                      You have blocked this user
                    </div>
                  )}
                  {activePrivateMessages.length > 0 ? (
                    activePrivateMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex mb-2 ${msg.userId === currentUser.userId ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`p-2 rounded ${msg.userId === currentUser.userId ? "bg-blue-600" : "bg-gray-700"}`}
                        >
                          {msg.userId === currentUser.userId ? (
                            <span className="font-bold text-purple-300">
                              You:{" "}
                            </span>
                          ) : (
                            <span className="font-bold text-blue-400">
                              {msg.userId}:{" "}
                            </span>
                          )}
                          <span className="text-gray-300">{msg.message}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-center p-4">
                      Start a conversation with {activeChatUser}!
                    </div>
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendPrivateMessage(activeChatUser, privateMessageInput);
                    setPrivateMessageInput("");
                  }}
                >
                  <input
                    disabled={blockedUsers.has(activeChatUser)}
                    value={privateMessageInput}
                    onChange={(e) => setPrivateMessageInput(e.target.value)}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                    placeholder={`Message ${activeChatUser}...`}
                  />
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
