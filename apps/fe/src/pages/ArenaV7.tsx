import { useEffect, useRef, useState } from "react";
import { useAvatar } from "../contexts/AvatarsContext";

export const Arena = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map<string, any>());
  const [params, setParams] = useState({ token: "", spaceId: "" });
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<
    { userId: string; message: string }[]
  >([]);
  const [messageInput, setMessageInput] = useState("");
  const [nearbyUsers, setNearbyUsers] = useState<Set<string>>(new Set());
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
        setMessages((prev) => [
          ...prev,
          { userId: message.payload.userId, message: message.payload.message },
        ]);
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
        break;
    }
  };

  // Handle movement with animation
  const handleMove = (newGridX: number, newGridY: number) => {
    if (!currentUser || !wsRef.current) return;
    const currentTime = Date.now();
    currentUserAnimationRef.current = {
      isMoving: true,
      //@ts-ignore
      startX: currentUserAnimationRef.current.visualX || currentUser.gridX * 50,
      //@ts-ignore
      startY: currentUserAnimationRef.current.visualY || currentUser.gridY * 50,
      targetX: newGridX * 50,
      targetY: newGridY * 50,
      moveStartTime: currentTime,
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
        //@ts-ignore
        currentUserAnimationRef.current.visualX = currentVisualX;
        //@ts-ignore
        currentUserAnimationRef.current.visualY = currentVisualY;
        if (progress >= 1) currentUserAnimationRef.current.isMoving = false;
      } else {
        //@ts-ignore
        currentUserAnimationRef.current.visualX = currentVisualX;
        //@ts-ignore
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

      // Draw background
      ctx.fillStyle = "#90EE90";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw paths
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

      // Draw center lines
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

  // Auto-scroll chat
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

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

        {/* Chat Window */}
        <div
          className={`absolute top-4 right-4 bg-gray-800 p-4 rounded-lg w-80 shadow-lg transition-all duration-300 ${
            nearbyUsers.size > 0
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <h1 className="mb-2 text-xl font-bold text-white">
            Chat with {currentUser.userId}
          </h1>
          <div ref={messagesContainerRef} className="h-64 overflow-y-auto mb-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex mb-2 ${msg.userId === currentUser.userId ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-2 rounded ${msg.userId === currentUser.userId ? "bg-blue-600" : "bg-gray-700"}`}
                >
                  {msg.userId === currentUser.userId ? (
                    <span className="font-bold text-purple-300">You: </span>
                  ) : (
                    <span className="font-bold text-blue-400">
                      {msg.userId}:{" "}
                    </span>
                  )}
                  <span className="text-gray-300">{msg.message}</span>
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!messageInput.trim() || !wsRef.current) return;
              const newMessage = {
                userId: currentUser.userId,
                message: messageInput,
              };
              setMessages((prev) => [...prev, newMessage]);
              wsRef.current.send(
                JSON.stringify({
                  type: "chat-message",
                  payload: { message: messageInput },
                })
              );
              setMessageInput("");
            }}
          >
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-white"
              placeholder="Type a message..."
            />
          </form>
        </div>

        {/* Canvas Container */}
        <div className="relative border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl bg-gray-900">
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
        </div>
      </div>
    </div>
  );
};
