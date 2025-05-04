import { useEffect, useRef, useState } from "react";
import { useAvatar } from "../contexts/AvatarsContext";
import { v4 as uuidv4 } from "uuid";

export const Arena = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map<string, any>());
  const [params, setParams] = useState({ token: "", spaceId: "" });
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const spaceMessagesContainerRef = useRef<HTMLDivElement>(null);

  // Updated message types to include id
  const [messages, setMessages] = useState<
    { id: string; userId: string; message: string }[]
  >([]);
  const [spaceMessages, setSpaceMessages] = useState<
    { id: string; userId: string; message: string }[]
  >([]);
  const [messageInput, setMessageInput] = useState("");
  const [spaceMessageInput, setSpaceMessageInput] = useState("");
  const [nearbyUsers, setNearbyUsers] = useState<Set<string>>(new Set());
  const { avatars, fetchAvatars } = useAvatar();
  const [loadedImages, setLoadedImages] = useState<
    Map<string, HTMLImageElement>
  >(new Map());
  const defaultAvatarRef = useRef<HTMLImageElement | null>(null);

  // Track seen message IDs to prevent duplicates
  const seenMessageIds = useRef(new Set<string>());

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
  const MOVE_DURATION = 200;

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
  }, [users, currentUser, fetchAvatars]);

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
    setNearbyUsers(new Set(nearby.map((u) => u.userId)));
  }, [currentUser, users]);

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
        });
        break;

      case "chat-message":
        // Only add if the message ID hasn’t been seen
        if (!seenMessageIds.current.has(message.payload.id)) {
          seenMessageIds.current.add(message.payload.id);
          setMessages((prev) => [
            ...prev,
            {
              id: message.payload.id,
              userId: message.payload.userId,
              message: message.payload.message,
            },
          ]);
        }
        break;

      case "space-chat-message":
        // Only add if the message ID hasn’t been seen
        if (!seenMessageIds.current.has(message.payload.id)) {
          seenMessageIds.current.add(message.payload.id);
          setSpaceMessages((prev) => [
            ...prev,
            {
              id: message.payload.id,
              userId: message.payload.userId,
              message: message.payload.message,
            },
          ]);
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
        currentUserAnimationRef.current = {
          isMoving: true,
          startX: currentUserAnimationRef.current.visualX,
          startY: currentUserAnimationRef.current.visualY,
          targetX: message.payload.x * 50,
          targetY: message.payload.y * 50,
          moveStartTime: currentTime,
          visualX: currentUserAnimationRef.current.visualX,
          visualY: currentUserAnimationRef.current.visualY,
        };
        break;

      case "user-left":
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(message.payload.userId);
          return newUsers;
        });
        usersAnimationRef.current.delete(message.payload.userId);
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
      visualX: currentUserAnimationRef.current.visualX,
      visualY: currentUserAnimationRef.current.visualY,
    };
    wsRef.current.send(
      JSON.stringify({
        type: "move",
        payload: { x: newGridX, y: newGridY, userId: currentUser.userId },
      })
    );
  };

  // Game loop for smooth animation
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
    if (!currentUser) return;
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
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (spaceMessagesContainerRef.current) {
      spaceMessagesContainerRef.current.scrollTop =
        spaceMessagesContainerRef.current.scrollHeight;
    }
  }, [spaceMessages]);

  // Handle space chat submit
  const handleSpaceChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceMessageInput.trim() || !wsRef.current) return;
    const messageId = uuidv4(); // Generate unique ID
    const newMessage = {
      id: messageId,
      userId: currentUser.userId,
      message: spaceMessageInput,
    };
    // Add to local state and mark as seen
    setSpaceMessages((prev) => [...prev, newMessage]);
    seenMessageIds.current.add(messageId);
    wsRef.current.send(
      JSON.stringify({
        type: "space-chat-message",
        payload: { id: messageId, message: spaceMessageInput },
      })
    );
    setSpaceMessageInput("");
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 relative overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Space Chat - Glassmorphism style */}
        <div className="absolute top-4 left-4 bg-white/5 backdrop-blur-lg p-4 rounded-2xl w-80 shadow-2xl border border-white/10">
          <div className="flex items-center mb-4 space-x-2">
            <svg
              className="w-6 h-6 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Space Chat
            </h1>
          </div>
          <div
            ref={spaceMessagesContainerRef}
            className="h-64 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
          >
            {spaceMessages.map((msg) => (
              <div key={msg.id} className="flex mb-2 animate-fadeIn">
                <div className="p-3 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm">
                  <span className="font-semibold text-blue-300">
                    {msg.userId}:{" "}
                  </span>
                  <span className="text-gray-200">{msg.message}</span>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSpaceChatSubmit} className="relative">
            <input
              value={spaceMessageInput}
              onChange={(e) => setSpaceMessageInput(e.target.value)}
              className="w-full bg-gray-700/50 backdrop-blur-sm rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-white/10"
              placeholder="Broadcast to space..."
            />
            <button
              type="submit"
              className="absolute right-2 top-2 p-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
        </div>

        {/* Main Content */}
        <div className="pl-84 pr-84">
          <div className="mb-8 text-center">
            <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient-x">
              Pixel Arena
            </h1>
            <div className="flex justify-center gap-4 mb-4">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-white/10">
                <p className="text-sm text-blue-300 mb-1 flex items-center justify-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Space ID
                </p>
                <p className="font-mono text-lg text-gray-100">
                  {params.spaceId}
                </p>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-white/10">
                <p className="text-sm text-purple-300 mb-1 flex items-center justify-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Connected
                </p>
                <p className="text-2xl font-bold text-green-400">
                  {users.size + (currentUser.userId ? 1 : 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Canvas Container with Glowing Border */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl opacity-20 blur-xl group-hover:opacity-30 transition-opacity" />
            <div className="border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-gray-900/50 backdrop-blur-sm relative">
              <div
                className="overflow-auto h-[70vh] relative scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
                style={{ scrollBehavior: "smooth" }}
              >
                <canvas
                  ref={canvasRef}
                  width={2000}
                  height={2000}
                  className="bg-gray-900/80 backdrop-blur-sm"
                />
                {/* Animated Movement Controls */}
                <div className="absolute bottom-4 right-4 bg-gray-800/50 backdrop-blur-sm p-3 rounded-xl border border-white/10 animate-pulse-slow">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex gap-1">
                      <kbd className="px-3 py-2 bg-gray-700/50 rounded-lg text-sm text-blue-300">
                        ↑
                      </kbd>
                    </div>
                    <div className="flex gap-1">
                      <kbd className="px-3 py-2 bg-gray-700/50 rounded-lg text-sm text-blue-300">
                        ←
                      </kbd>
                      <kbd className="px-3 py-2 bg-gray-700/50 rounded-lg text-sm text-blue-300">
                        ↓
                      </kbd>
                      <kbd className="px-3 py-2 bg-gray-700/50 rounded-lg text-sm text-blue-300">
                        →
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Private Chat - Slide-in Animation */}
        <div
          className={`absolute top-4 right-4 bg-white/5 backdrop-blur-lg p-4 rounded-2xl w-80 shadow-2xl border border-white/10 transition-all duration-300 ease-out ${
            nearbyUsers.size > 0
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="flex items-center mb-4 space-x-2">
            <svg
              className="w-6 h-6 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
              />
            </svg>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Nearby Chat
            </h1>
          </div>
          <div
            ref={messagesContainerRef}
            className="h-64 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex mb-2 animate-slideIn ${msg.userId === currentUser.userId ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[80%] ${
                    msg.userId === currentUser.userId
                      ? "bg-gradient-to-br from-purple-500 to-blue-500"
                      : "bg-gradient-to-br from-gray-800/50 to-gray-700/50"
                  }`}
                >
                  {msg.userId !== currentUser.userId && (
                    <span className="text-xs font-semibold text-purple-300 block mb-1">
                      {msg.userId}
                    </span>
                  )}
                  <span className="text-gray-100">{msg.message}</span>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="w-full bg-gray-700/50 backdrop-blur-sm rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 border border-white/10"
              placeholder="Message nearby players..."
            />
            <button
              type="submit"
              className="absolute right-2 top-2 p-1 text-purple-400 hover:text-purple-300 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
