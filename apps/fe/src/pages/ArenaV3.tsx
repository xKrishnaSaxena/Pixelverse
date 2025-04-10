import { useEffect, useRef, useState } from "react";
import { useAvatar } from "../contexts/AvatarsContext";

export const Arena = () => {
  const canvasRef = useRef<any>(null);
  const wsRef = useRef<any>(null);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map());
  const [params, setParams] = useState({ token: "", spaceId: "" });
  const containerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<
    { userId: string; message: string }[]
  >([]);
  const [messageInput, setMessageInput] = useState("");
  const [nearbyUsers, setNearbyUsers] = useState<Set<string>>(new Set());
  console.log(nearbyUsers);
  const { avatars, fetchAvatars } = useAvatar();
  const [loadedImages, setLoadedImages] = useState<
    Map<string, HTMLImageElement>
  >(new Map());
  const defaultAvatarRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = "/gAvatarV2.png";
    img.onload = () => {
      defaultAvatarRef.current = img;
      // Add default to loaded images
      setLoadedImages((prev) => new Map(prev).set("default", img));
    };
  }, []);

  useEffect(() => {
    const userIds = Array.from(users.keys());
    if (currentUser?.userId) userIds.push(currentUser.userId);
    fetchAvatars(userIds);
  }, [users, currentUser]);
  useEffect(() => {
    const loadImages = async () => {
      const imageMap = new Map<string, HTMLImageElement>();
      const loadPromises: Promise<void>[] = [];

      Array.from(avatars.entries()).forEach(([userId, url]) => {
        if (!loadedImages.has(url)) {
          const img = new Image();
          img.src = url;
          const promise = new Promise<void>((resolve) => {
            img.onload = () => resolve();
          });
          loadPromises.push(promise);
          imageMap.set(url, img);
        }
      });

      await Promise.all(loadPromises);
      setLoadedImages((prev) => new Map([...prev, ...imageMap]));
    };

    loadImages();
  }, [avatars]);
  useEffect(() => {
    if (!currentUser) return;

    const nearby = Array.from(users.values()).filter((user) => {
      const dx = Math.abs(currentUser.x - user.x);
      const dy = Math.abs(currentUser.y - user.y);
      return dx <= 2 && dy <= 2 && user.userId !== currentUser.userId;
    });

    setNearbyUsers(new Set(nearby.map((u) => u.userId)));
  }, [currentUser, users]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token") || "";
    const spaceId = urlParams.get("spaceId") || "";
    setParams({ token, spaceId });

    wsRef.current = new WebSocket("ws://localhost:3001");

    wsRef.current.onopen = () => {
      wsRef.current.send(
        JSON.stringify({
          type: "join",
          payload: {
            spaceId,
            token,
          },
        })
      );
    };

    wsRef.current.onmessage = (event: any) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case "space-joined":
        setCurrentUser({
          x: message.payload.spawn.x,
          y: message.payload.spawn.y,
          userId: message.payload.userId,
        });

        const userMap = new Map();
        message.payload.users.forEach((user: any) => {
          userMap.set(user.userId, user);
        });
        setUsers(userMap);
        break;

      case "user-joined":
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.set(message.payload.userId, {
            x: message.payload.x,
            y: message.payload.y,
            userId: message.payload.userId,
          });
          return newUsers;
        });
        break;

      case "chat-message":
        setMessages((prev) => [
          ...prev,
          {
            userId: message.payload.userId,
            message: message.payload.message,
          },
        ]);
        break;

      case "movement":
        setUsers((prev) => {
          const newUsers = new Map(prev);
          const user = newUsers.get(message.payload.userId);
          if (user) {
            user.x = message.payload.x;
            user.y = message.payload.y;
            newUsers.set(message.payload.userId, user);
          }
          return newUsers;
        });
        break;

      case "movement-rejected":
        setCurrentUser((prev: any) => ({
          ...prev,
          x: message.payload.x,
          y: message.payload.y,
        }));
        break;

      case "user-left":
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(message.payload.userId);
          return newUsers;
        });
        break;
    }
  };

  const handleMove = (newX: any, newY: any) => {
    if (!currentUser) return;

    wsRef.current.send(
      JSON.stringify({
        type: "move",
        payload: {
          x: newX,
          y: newY,
          userId: currentUser.userId,
        },
      })
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !defaultAvatarRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#2D3748";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    if (currentUser?.x !== undefined && currentUser?.y !== undefined) {
      const avatar = avatars.get(currentUser.userId);
      const image = avatar
        ? loadedImages.get(avatar)
        : defaultAvatarRef.current;
      ctx.drawImage(
        image,
        currentUser.x * 50 - 40,
        currentUser.y * 50 - 40,
        80,
        80
      );

      ctx.fillStyle = "#fff";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("You", currentUser.x * 50, currentUser.y * 50 + 50);
    }

    users.forEach((user) => {
      if (!user.x || !user.y) return;
      const avatar = avatars.get(user.userId);
      const image = avatar
        ? loadedImages.get(avatar)
        : defaultAvatarRef.current;
      ctx.drawImage(image, user.x * 50 - 40, user.y * 50 - 40, 80, 80);

      ctx.fillStyle = "#fff";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(user.userId, user.x * 50, user.y * 50 + 50);
    });
  }, [currentUser, users, loadedImages]);

  const handleKeyDown = (e: any) => {
    if (!currentUser) return;

    const { x, y } = currentUser;
    switch (e.key) {
      case "ArrowUp":
        handleMove(x, y - 1);
        break;
      case "ArrowDown":
        handleMove(x, y + 1);
        break;
      case "ArrowLeft":
        handleMove(x - 1, y);
        break;
      case "ArrowRight":
        handleMove(x + 1, y);
        break;
    }
  };

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
                {users.size + (currentUser ? 1 : 0)}
              </p>
            </div>
          </div>
        </div>
        {nearbyUsers.size > 0 && (
          <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg w-80">
            <div className="h-64 overflow-y-auto mb-4">
              {messages.map((msg, i) => (
                <div key={i} className="mb-2">
                  <span className="font-bold text-blue-400">{msg.userId}:</span>
                  <span className="ml-2 text-gray-300">{msg.message}</span>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!messageInput.trim()) return;

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
        )}

        {/* Canvas Container */}
        <div className="relative border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl bg-gray-900">
          {/* Add this inside the canvas container div */}

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
