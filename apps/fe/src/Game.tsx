import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "./contexts/AuthContext";

const Arena = () => {
  const canvasRef = useRef<any>(null);
  const wsRef = useRef<any>(null);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map());
  const [params, setParams] = useState({ token: "", spaceId: "" });
  const containerRef = useRef<HTMLDivElement>(null);
  // Initialize WebSocket connection and handle URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const { token } = useAuth() || "";
    const spaceId = urlParams.get("spaceId") || "";
    //@ts-ignore
    setParams({ token, spaceId });

    // Initialize WebSocket
    wsRef.current = new WebSocket("ws://localhost:3001"); // Replace with your WS_URL

    wsRef.current.onopen = () => {
      // Join the space once connected
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
        // Initialize current user position and other users
        console.log("set");
        console.log({
          x: message.payload.spawn.x,
          y: message.payload.spawn.y,
          userId: message.payload.userId,
        });
        setCurrentUser({
          x: message.payload.spawn.x,
          y: message.payload.spawn.y,
          userId: message.payload.userId,
        });

        // Initialize other users from the payload
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
        // Reset current user position if movement was rejected
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

  // Handle user movement
  const handleMove = (newX: any, newY: any) => {
    if (!currentUser) return;

    // Send movement request
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

  // Draw the arena
  useEffect(() => {
    console.log("render");
    const canvas = canvasRef.current;
    if (!canvas) return;
    console.log("below render");

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#eee";
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

    console.log("before curerntusert");
    console.log(currentUser);
    // Draw current user
    if (currentUser && currentUser.x) {
      console.log("drawing myself");
      console.log(currentUser);
      ctx.beginPath();
      ctx.fillStyle = "#FF6B6B";
      ctx.arc(currentUser.x * 50, currentUser.y * 50, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("You", currentUser.x * 50, currentUser.y * 50 + 40);
    }

    // Draw other users
    users.forEach((user) => {
      if (!user.x) {
        return;
      }
      console.log("drawing other user");
      console.log(user);
      ctx.beginPath();
      ctx.fillStyle = "#4ECDC4";
      ctx.arc(user.x * 50, user.y * 50, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`User ${user.userId}`, user.x * 50, user.y * 50 + 40);
    });
  }, [currentUser, users]);

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
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  return (
    // <div className="p-4" onKeyDown={handleKeyDown} tabIndex={0}>
    //   <h1 className="text-2xl font-bold mb-4">Arena</h1>
    //   <div className="mb-4">
    //     <p className="text-sm text-gray-600">Token: {params.token}</p>
    //     <p className="text-sm text-gray-600">Space ID: {params.spaceId}</p>
    //     <p className="text-sm text-gray-600">
    //       Connected Users: {users.size + (currentUser ? 1 : 0)}
    //     </p>
    //   </div>
    //   <div className="border rounded-lg overflow-hidden">
    //     <canvas
    //       ref={canvasRef}
    //       width={2000}
    //       height={2000}
    //       className="bg-white"
    //     />
    //   </div>
    //   <p className="mt-2 text-sm text-gray-500">
    //     Use arrow keys to move your avatar
    //   </p>
    // </div>
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
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

export default Arena;
