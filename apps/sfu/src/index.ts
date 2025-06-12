const mediasoup = require("mediasoup");
const ws = require("ws");

(async () => {
  const worker = await mediasoup.createWorker({
    logLevel: "debug",
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });
  const routers = new Map(); // sessionId -> Router
  const producers = new Map(); // sessionId -> Map<userId, producer>
  const wss = new ws.Server({ port: 3002 });

  wss.on("connection", (ws: any) => {
    let sessionId: any, userId: any;

    ws.on("message", async (message: any) => {
      const data = JSON.parse(message);
      switch (data.type) {
        case "join":
          sessionId = data.sessionId;
          userId = data.userId; // Assume client sends userId; adjust as needed
          if (!routers.has(sessionId)) {
            const router = await worker.createRouter({
              mediaCodecs: [
                {
                  kind: "audio",
                  mimeType: "audio/opus",
                  clockRate: 48000,
                  channels: 2,
                },
                { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
              ],
            });
            routers.set(sessionId, router);
            producers.set(sessionId, new Map());
          }
          break;

        case "getRouterRtpCapabilities":
          ws.send(
            JSON.stringify({
              type: "getRouterRtpCapabilities_response",
              payload: routers.get(sessionId).rtpCapabilities,
            })
          );
          break;

        case "createProducerTransport":
          const transport = await routers.get(sessionId).createWebRtcTransport({
            listenIps: [{ ip: "127.0.0.1", announcedIp: null }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
          });
          ws.send(
            JSON.stringify({
              type: "createProducerTransport_response",
              payload: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
              },
            })
          );
          break;

        case "connectProducerTransport":
          // Handle transport connection (implementation needed)
          break;

        case "produce":
          const producer = await transport.produce(data.payload);
          producers.get(sessionId).set(userId, producer);
          wss.clients.forEach((client: any) => {
            if (client !== ws && client.readyState === ws.OPEN) {
              client.send(
                JSON.stringify({
                  type: "newProducer",
                  payload: { producerId: producer.id, userId },
                })
              );
            }
          });
          ws.send(
            JSON.stringify({
              type: "produce_response",
              payload: { id: producer.id },
            })
          );
          break;

        // Add cases for consumer transport and consume
      }
    });
  });

  console.log(
    "Mediasoup Router created and WebSocket server running on port 3002"
  );
})();
