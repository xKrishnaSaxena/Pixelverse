const mediasoup = require("mediasoup");

(async () => {
  const worker = await mediasoup.createWorker({
    logLevel: "debug",
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
      },
    ],
  });

  console.log("Mediasoup Router created");
})();
