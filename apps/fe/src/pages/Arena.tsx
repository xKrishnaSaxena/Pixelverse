import { useCallback, useEffect, useRef, useState } from "react";
import { useAvatar } from "../contexts/AvatarsContext";
import { useAuth } from "../contexts/AuthContext";
import ReactPlayer from "react-player";
import peer from "../contexts/peerContext";

const GRID_SIZE = 50;
const AVATAR_SIZE = 80;
const PATH_WIDTH = 50;
const PARTICLE_COUNT = 100;
const TRAIL_LENGTH = 20;

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
}

export const Arena = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map<string, any>());
  const [spaceId, setSpaceId] = useState(""); // Replace params with spaceId
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);
  const particles = useRef<Particle[]>([]);
  const movementTrails = useRef<
    Map<string, { x: number; y: number; opacity: number }[]>
  >(new Map());
  const [isKicked, setIsKicked] = useState(false);
  const [callStatus, setCallStatus] = useState<
    "idle" | "calling" | "incoming" | "in-call"
  >("idle");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [incomingCallFrom, setIncomingCallFrom] = useState<string | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<any>(null);
  const [userCallStatus, setUserCallStatus] = useState<
    Map<string, string | null>
  >(new Map());

  const { token, isLoading } = useAuth();

  const toggleBlockUser = (userId: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
        if (activeChatUser === userId) {
          setActiveChatUser(null);
        }
      }
      return newSet;
    });
  };

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

  const { avatars, fetchAvatars } = useAvatar();
  const [loadedImages, setLoadedImages] = useState<
    Map<string, HTMLImageElement>
  >(new Map());
  const defaultAvatarRef = useRef<HTMLImageElement | null>(null);

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

  const handleCallUser = useCallback(
    async (recipient: string) => {
      if (callStatus !== "idle" || !wsRef.current) return;
      setCallStatus("calling");
      setRemoteUserId(recipient);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setLocalStream(stream);
      if (peer.peer) {
        for (const track of stream.getTracks()) {
          peer.peer.addTrack(track, stream);
        }
      }
      const offer = await peer.getOffer();
      wsRef.current.send(
        JSON.stringify({
          type: "call-user",
          payload: { targetUserId: recipient, offer },
        })
      );
    },
    [callStatus]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingOffer || !incomingCallFrom || !wsRef.current) return;
    setCallStatus("in-call");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setLocalStream(stream);
    if (peer.peer) {
      for (const track of stream.getTracks()) {
        peer.peer.addTrack(track, stream);
      }
    }
    const answer = await peer.getAnswer(incomingOffer);
    wsRef.current.send(
      JSON.stringify({
        type: "call-accepted",
        payload: { toUserId: incomingCallFrom, answer },
      })
    );
    setIncomingCallFrom(null);
    setIncomingOffer(null);
  }, [incomingOffer, incomingCallFrom]);

  const declineCall = useCallback(() => {
    if (!incomingCallFrom || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "call-declined",
        payload: { toUserId: incomingCallFrom },
      })
    );
    setIncomingCallFrom(null);
    setIncomingOffer(null);
    setCallStatus("idle");
    setRemoteUserId(null);
  }, [incomingCallFrom]);

  const handleCallAccepted = useCallback(
    async ({ answer }: { answer: any }) => {
      if (!peer.peer) return;
      await peer.setRemoteDescription(answer);
      setCallStatus("in-call");
    },
    []
  );

  const handleEndCall = useCallback(() => {
    if (!wsRef.current) return;
    if (callStatus === "calling") {
      wsRef.current.send(
        JSON.stringify({
          type: "call-cancelled",
          payload: { toUserId: remoteUserId },
        })
      );
    } else if (callStatus === "in-call") {
      wsRef.current.send(
        JSON.stringify({
          type: "call-end",
          payload: { toUserId: remoteUserId },
        })
      );
    }
    if (peer.peer) {
      peer.peer.close();
      peer.peer = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setCallStatus("idle");
    setRemoteUserId(null);
  }, [callStatus, localStream, remoteUserId]);

  const handleNegoNeeded = useCallback(async () => {
    if (!wsRef.current || !remoteUserId) return;
    const offer = await peer.getOffer();
    wsRef.current.send(
      JSON.stringify({
        type: "peer:negotiation-needed",
        payload: { offer, toUserId: remoteUserId },
      })
    );
  }, [remoteUserId]);

  const handleNegoNeedIncoming = useCallback(
    async ({ from, offer }: { from: string; offer: any }) => {
      if (!wsRef.current) return;
      const ans = await peer.getAnswer(offer);
      wsRef.current.send(
        JSON.stringify({
          type: "peer:nego:done",
          payload: { toUserId: from, answer: ans },
        })
      );
    },
    []
  );

  const handleNegoNeedFinal = useCallback(
    async ({ answer }: { answer: any }) => {
      await peer.setRemoteDescription(answer);
    },
    []
  );

  useEffect(() => {
    if (!peer.peer) return;
    peer.peer.addEventListener("track", (ev) => {
      setRemoteStream(ev.streams[0]);
    });
    peer.peer.addEventListener("icecandidate", (event) => {
      if (event.candidate && wsRef.current && remoteUserId) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            payload: { candidate: event.candidate, toUserId: remoteUserId },
          })
        );
      }
    });
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      if (!peer.peer) return;
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded, remoteUserId]);

  useEffect(() => {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.current.push({
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        size: Math.random() * 3,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5,
      });
    }
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = "/gAvatarV2.png";
    img.onload = () => {
      defaultAvatarRef.current = img;
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
      Array.from(avatars.entries()).forEach(([_userId, url]) => {
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

  useEffect(() => {
    if (!currentUser.gridX || !currentUser.gridY) return;
    const nearby = Array.from(users.values()).filter((user) => {
      const dx = Math.abs(currentUser.gridX - user.gridX);
      const dy = Math.abs(currentUser.gridY - user.gridY);
      return dx <= 2 && dy <= 2 && user.userId !== currentUser.userId;
    });

    const nearbyUserIds = new Set(nearby.map((u) => u.userId));
    setNearbyUsers(nearbyUserIds);

    if (activeChatUser && !nearbyUserIds.has(activeChatUser)) {
      setActiveChatUser(null);
    }
  }, [currentUser, users, activeChatUser]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const spaceIdFromUrl = urlParams.get("spaceId") || "";
    setSpaceId(spaceIdFromUrl);
  }, []);

  useEffect(() => {
    if (isLoading || !token || !spaceId) return;

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
  }, [isLoading, token, spaceId]);

  const handleWebSocketMessage = useCallback(
    (message: any) => {
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
          const ongoingCalls = message.payload.ongoingCalls || [];
          ongoingCalls.forEach(([user1, user2]: [string, string]) => {
            setUserCallStatus((prev) =>
              new Map(prev).set(user1, user2).set(user2, user1)
            );
          });
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
            setPrivateMessages((prev) => [
              ...prev,
              {
                userId: message.payload.userId,
                message: message.payload.message,
                recipient: currentUser.userId,
              },
            ]);
            if (!activeChatUser || activeChatUser !== message.payload.userId) {
              setActiveChatUser(message.payload.userId);
            }
          }
          break;

        case "chat-warning":
          setGlobalMessages((prev) => [
            ...prev,
            {
              userId: "SYSTEM",
              message: message.payload.message,
              timestamp: Date.now(),
            },
          ]);
          break;

        case "kicked":
          setIsKicked(true);
          setGlobalMessages((prev) => [
            ...prev,
            {
              userId: "SYSTEM",
              message: `You have been kicked: ${message.payload.reason}`,
              timestamp: Date.now(),
            },
          ]);
          break;

        case "user-kicked":
          setGlobalMessages((prev) => [
            ...prev,
            {
              userId: "SYSTEM",
              message: `${message.payload.userId} was kicked: ${message.payload.reason}`,
              timestamp: Date.now(),
            },
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
          setGlobalMessages((prev) => [
            ...prev,
            {
              userId: "SYSTEM",
              message: `${message.payload.userId} has left the space.`,
              timestamp: Date.now(),
            },
          ]);
          if (message.payload.userId === remoteUserId) {
            handleEndCall();
          }
          if (activeChatUser === message.payload.userId) {
            setActiveChatUser(null);
          }
          break;

        case "join-rejected":
          setGlobalMessages((prev) => [
            ...prev,
            {
              userId: "SYSTEM",
              message: `Join rejected: ${message.payload.reason}`,
              timestamp: Date.now(),
            },
          ]);
          break;

        case "video-call-incoming":
          if (callStatus === "idle") {
            setIncomingCallFrom(message.payload.from);
            setIncomingOffer(message.payload.offer);
            setCallStatus("incoming");
            setRemoteUserId(message.payload.from);
          }
          break;

        case "call-accepted":
          handleCallAccepted(message.payload);
          break;

        case "call-declined":
          if (
            callStatus === "calling" &&
            message.payload.from === remoteUserId
          ) {
            setCallStatus("idle");
            setRemoteUserId(null);
          }
          break;

        case "call-cancelled":
          if (
            callStatus === "incoming" &&
            message.payload.from === incomingCallFrom
          ) {
            setIncomingCallFrom(null);
            setIncomingOffer(null);
            setCallStatus("idle");
            setRemoteUserId(null);
          }
          break;

        case "call-started":
          setUserCallStatus((prev) =>
            new Map(prev)
              .set(message.payload.user1, message.payload.user2)
              .set(message.payload.user2, message.payload.user1)
          );
          break;

        case "call-ended":
          setUserCallStatus((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.payload.user1, null);
            newMap.set(message.payload.user2, null);
            return newMap;
          });
          if (
            callStatus === "in-call" &&
            (message.payload.user1 === remoteUserId ||
              message.payload.user2 === remoteUserId)
          ) {
            handleEndCall();
          }
          break;

        case "peer:nego:needed":
          handleNegoNeedIncoming(message.payload);
          break;

        case "peer:nego:final":
          handleNegoNeedFinal(message.payload);
          break;

        case "ice-candidate":
          if (peer.peer) {
            peer.peer.addIceCandidate(message.payload.candidate);
          }
          break;

        case "call-end":
          handleEndCall();
          break;
      }
    },
    [
      currentUser,
      users,
      activeChatUser,
      remoteUserId,
      callStatus,
      incomingCallFrom,
      handleEndCall,
    ]
  );

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

      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      );
      gradient.addColorStop(0, "#0a192f");
      gradient.addColorStop(1, "#172a45");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      particles.current.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (
          particle.x < 0 ||
          particle.x > canvas.width ||
          particle.y < 0 ||
          particle.y > canvas.height
        ) {
          particle.x = Math.random() * canvas.width;
          particle.y = Math.random() * canvas.height;
        }

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = `hsla(210, 60%, 50%, ${0.2 + Math.sin(Date.now() / 1000) * 0.1})`;
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const horizontalPathRows = [5, 10, 15, 20, 25, 30, 35];
      const verticalPathCols = [5, 10, 15, 20, 25, 30, 35];
      const pathGradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      );
      pathGradient.addColorStop(0, "#4a90e2");
      pathGradient.addColorStop(1, "#00c7c0");

      ctx.shadowColor = "rgba(74, 144, 226, 0.4)";
      ctx.shadowBlur = 25;
      ctx.fillStyle = pathGradient;
      horizontalPathRows.forEach((y) => {
        ctx.fillRect(0, y * GRID_SIZE, canvas.width, PATH_WIDTH);
      });
      verticalPathCols.forEach((x) => {
        ctx.fillRect(x * GRID_SIZE, 0, PATH_WIDTH, canvas.height);
      });
      ctx.shadowBlur = 0;

      if (currentUser.gridX !== undefined && currentUser.gridY !== undefined) {
        const avatar = avatars.get(currentUser.userId);
        const image = avatar
          ? loadedImages.get(avatar)
          : defaultAvatarRef.current;
        const pulse = Math.sin(Date.now() / 300) * 5 + 5;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const hologramGradient = ctx.createRadialGradient(
          currentVisualX,
          currentVisualY,
          0,
          currentVisualX,
          currentVisualY,
          AVATAR_SIZE * 2
        );
        hologramGradient.addColorStop(0, "hsla(210, 100%, 50%, 0.3)");
        hologramGradient.addColorStop(1, "hsla(180, 100%, 50%, 0)");
        ctx.fillStyle = hologramGradient;
        ctx.beginPath();
        ctx.arc(
          currentVisualX,
          currentVisualY,
          AVATAR_SIZE + pulse,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(
          currentVisualX,
          currentVisualY,
          AVATAR_SIZE / 2,
          0,
          Math.PI * 2
        );
        ctx.clip();
        if (image) {
          ctx.drawImage(
            image,
            currentVisualX - AVATAR_SIZE / 2,
            currentVisualY - AVATAR_SIZE / 2,
            AVATAR_SIZE,
            AVATAR_SIZE
          );
        }

        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        for (let y = -AVATAR_SIZE / 2; y < AVATAR_SIZE / 2; y += 3) {
          ctx.fillRect(
            currentVisualX - AVATAR_SIZE / 2,
            currentVisualY + y - AVATAR_SIZE / 2,
            AVATAR_SIZE,
            1
          );
        }
        ctx.restore();

        ctx.strokeStyle = `hsla(${(Date.now() / 20) % 360}, 100%, 60%, 0.8)`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `hsla(${(Date.now() / 20) % 360}, 100%, 50%, 0.5)`;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(
          currentVisualX,
          currentVisualY,
          AVATAR_SIZE / 2 + 3,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#fff";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("You", currentVisualX, currentVisualY + 50);
      }

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
        if (usersAnimationRef.current.get(userId)?.isMoving) {
          const trail = movementTrails.current.get(userId) || [];
          trail.push({ x: visual.visualX, y: visual.visualY, opacity: 1 });
          if (trail.length > TRAIL_LENGTH) trail.shift();
          movementTrails.current.set(userId, trail);

          ctx.globalCompositeOperation = "screen";
          trail.forEach((pos, index) => {
            const gradient = ctx.createRadialGradient(
              pos.x,
              pos.y,
              0,
              pos.x,
              pos.y,
              GRID_SIZE
            );
            gradient.addColorStop(0, `rgba(100, 200, 255, ${pos.opacity})`);
            gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(
              pos.x,
              pos.y,
              GRID_SIZE * (1 - index / TRAIL_LENGTH),
              0,
              Math.PI * 2
            );
            ctx.fill();

            pos.opacity -= 0.05;
          });
          ctx.globalCompositeOperation = "source-over";
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(
          visual.visualX,
          visual.visualY,
          AVATAR_SIZE / 2,
          0,
          Math.PI * 2
        );
        ctx.clip();
        if (image) {
          ctx.drawImage(
            image,
            visual.visualX - AVATAR_SIZE / 2,
            visual.visualY - AVATAR_SIZE / 2,
            AVATAR_SIZE,
            AVATAR_SIZE
          );
        }
        ctx.restore();

        const isHovered = hoveredUser === userId;
        if (isHovered) {
          ctx.strokeStyle = "#00ffd5";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#00ffd5";
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(
            visual.visualX,
            visual.visualY,
            AVATAR_SIZE / 2 + 5,
            0,
            Math.PI * 2
          );
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = isHovered ? "#00ffd5" : "#a0e5ff";
        ctx.font = '14px "Poppins", sans-serif';
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 5;
        ctx.fillText(
          userId,
          visual.visualX,
          visual.visualY + AVATAR_SIZE / 2 + 25
        );
        ctx.shadowBlur = 0;
      });

      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const scrollLeft = currentVisualX - container.clientWidth / 2;
        const scrollTop = currentVisualY - container.clientHeight / 2;
        container.scrollLeft = scrollLeft;
        container.scrollTop = scrollTop;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [currentUser, users, loadedImages, avatars, hoveredUser]);

  const handleCanvasHover = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let hovered = null;
    users.forEach((user, userId) => {
      const visualX = user.gridX * GRID_SIZE;
      const visualY = user.gridY * GRID_SIZE;
      const distance = Math.sqrt(
        Math.pow(mouseX - visualX, 2) + Math.pow(mouseY - visualY, 2)
      );
      if (distance < AVATAR_SIZE / 2) {
        hovered = userId;
      }
    });
    setHoveredUser(hovered);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentUser?.gridX || !currentUser?.gridY) return;
    const { gridX, gridY } = currentUser;
    switch (e.key) {
      case "ArrowUp":
        handleMove(gridX, gridY - 1);
        break;
      case "ArrowDown":
        handleMove(gridX, gridY + 1);
        break;
      case "ArrowLeft":
        handleMove(gridX - 1, gridY);
        break;
      case "ArrowRight":
        handleMove(gridX + 1, gridY);
        break;
    }
  };

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

  const activePrivateMessages = privateMessages.filter(
    (msg) =>
      (msg.userId === activeChatUser || msg.recipient === activeChatUser) &&
      !blockedUsers.has(msg.userId)
  );

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4"
      style={{ fontFamily: "'Poppins', sans-serif" }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="w-full h-screen flex flex-col">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Pixel Arena
          </h1>
          <div className="flex justify-center gap-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-3 shadow-lg">
              <p className="text-sm text-blue-400">Space ID</p>
              <p className="font-mono">{spaceId}</p>{" "}
              {/* Update to use spaceId */}
            </div>
            <div className="bg-gray-800 rounded-lg p-3 shadow-lg">
              <p className="text-sm text-purple-400">Connected Players</p>
              <p className="text-xl font-bold text-green-400">
                {users.size + (currentUser.userId ? 1 : 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-4">
          <div className="w-1/4 h-full bg-gray-800 rounded-lg p-4 shadow-lg">
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
            <div>
              <input
                value={globalMessageInput}
                onChange={(e) => setGlobalMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    sendGlobalMessage(globalMessageInput);
                    setGlobalMessageInput("");
                  }
                }}
                className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                disabled={isKicked || blockedUsers.size > 0}
                placeholder={
                  blockedUsers.size > 0
                    ? "You have blocked users - unblock to chat"
                    : "Type a message to everyone..."
                }
              />
            </div>
          </div>

          <div className="flex-1 h-full relative border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl bg-gray-900">
            <div
              ref={scrollContainerRef}
              className="overflow-auto h-full relative scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
              style={{ scrollBehavior: "smooth" }}
              onMouseMove={handleCanvasHover}
            >
              <canvas
                ref={canvasRef}
                width={2000}
                height={2000}
                className="bg-transparent transform transition-transform duration-300 hover:scale-105"
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

              {callStatus === "in-call" && (
                <div className="absolute top-4 left-4 bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col gap-4 z-10">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">You</p>
                      <div className="w-64 h-48 bg-black rounded overflow-hidden">
                        {localStream && (
                          <ReactPlayer
                            playing
                            muted
                            height="100%"
                            width="100%"
                            url={localStream}
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">
                        {remoteUserId}
                      </p>
                      <div className="w-64 h-48 bg-black rounded overflow-hidden">
                        {remoteStream && (
                          <ReactPlayer
                            playing
                            height="100%"
                            width="100%"
                            url={remoteStream}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleEndCall}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    End Call
                  </button>
                </div>
              )}

              {callStatus === "incoming" && incomingCallFrom && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-4 rounded-lg shadow-lg z-20">
                  <p className="text-white mb-4">
                    Incoming call from {incomingCallFrom}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={acceptCall}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={declineCall}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}
            </div>

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
                      {userCallStatus.get(userId) ? (
                        <span className="ml-2 px-3 py-2 text-sm rounded bg-gray-500 text-white">
                          In Call
                        </span>
                      ) : callStatus === "idle" ? (
                        <button
                          onClick={() => handleCallUser(userId)}
                          className="ml-2 px-3 py-2 text-sm rounded bg-green-500 hover:bg-green-600 transition-colors"
                        >
                          Call
                        </button>
                      ) : null}
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
                <div>
                  <input
                    disabled={blockedUsers.has(activeChatUser)}
                    value={privateMessageInput}
                    onChange={(e) => setPrivateMessageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        sendPrivateMessage(activeChatUser, privateMessageInput);
                        setPrivateMessageInput("");
                      }
                    }}
                    className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                    placeholder={`Message ${activeChatUser}...`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
