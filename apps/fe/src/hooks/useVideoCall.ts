import { useEffect, useRef, useState } from "react";
import { Device, types } from "mediasoup-client";

export function useVideoCall(
  ws: WebSocket | null,
  sessionId: string | null,
  sfuUrl: string | null
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const deviceRef = useRef<Device | null>(null);
  const producerTransportRef = useRef<any>(null);
  const consumerTransportRef = useRef<any>(null);
  const sfuWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!ws || !sessionId || !sfuUrl) return;

    const initializeCall = async () => {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      // Connect to SFU WebSocket
      sfuWsRef.current = new WebSocket(sfuUrl);
      sfuWsRef.current.onopen = async () => {
        sfuWsRef.current!.send(JSON.stringify({ type: "join", sessionId }));

        // Initialize Mediasoup device
        deviceRef.current = new Device();
        const routerRtpCapabilities = (await sendRequest(
          "getRouterRtpCapabilities"
        )) as types.RtpCapabilities;

        await deviceRef.current.load({ routerRtpCapabilities });

        // Create producer transport
        const transportParams = (await sendRequest(
          "createProducerTransport"
        )) as types.TransportOptions;
        producerTransportRef.current =
          deviceRef.current.createSendTransport(transportParams);
        producerTransportRef.current.on(
          "connect",
          async ({ dtlsParameters }: any, callback: any) => {
            await sendRequest("connectProducerTransport", { dtlsParameters });
            callback();
          }
        );
        producerTransportRef.current.on(
          "produce",
          async ({ kind, rtpParameters }: any, callback: any) => {
            const { id } = (await sendRequest("produce", {
              kind,
              rtpParameters,
            })) as { id: string };
            callback({ id });
          }
        );

        // Produce audio and video
        stream.getTracks().forEach((track) => {
          producerTransportRef.current.produce({ track });
        });

        // Create consumer transport
        const consumerTransportParams = (await sendRequest(
          "createConsumerTransport"
        )) as types.TransportOptions;
        consumerTransportRef.current = deviceRef.current.createRecvTransport(
          consumerTransportParams
        );
        consumerTransportRef.current.on(
          "connect",
          async ({ dtlsParameters }: any, callback: any) => {
            await sendRequest("connectConsumerTransport", { dtlsParameters });
            callback();
          }
        );

        // Handle SFU messages
        sfuWsRef.current!.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "newProducer":
              const { producerId, userId } = data.payload;
              const consumerParams = await sendRequest("consume", {
                producerId,
              });
              const consumer =
                await consumerTransportRef.current.consume(consumerParams);
              const stream = new MediaStream();
              stream.addTrack(consumer.track);
              setRemoteStreams((prev) => new Map(prev).set(userId, stream));
              break;
          }
        };
      };
    };

    initializeCall();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "leave_call") {
        cleanup();
      }
    };

    function sendRequest(type: string, payload: any = {}) {
      return new Promise((resolve) => {
        sfuWsRef.current!.send(JSON.stringify({ type, payload }));
        sfuWsRef.current!.onmessage = (event) => {
          const response = JSON.parse(event.data);
          if (response.type === `${type}_response`) resolve(response.payload);
        };
      });
    }

    function cleanup() {
      producerTransportRef.current?.close();
      consumerTransportRef.current?.close();
      sfuWsRef.current?.close();
      localStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
      setRemoteStreams(new Map());
    }

    return () => cleanup();
  }, [ws, sessionId, sfuUrl]);

  return { localStream, remoteStreams };
}
