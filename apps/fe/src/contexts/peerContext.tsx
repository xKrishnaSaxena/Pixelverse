class PeerService {
  private peer: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];
  private isRemoteDescriptionSet: boolean = false;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  constructor() {
    this.createPeer();
  }

  private createPeer() {
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "stun:stun1.l.google.com:19302",
        },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "ccc312127ec1bfa1e5ca89bf",
          credential: "v+gRS02yJ7JZB0Za",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "ccc312127ec1bfa1e5ca89bf",
          credential: "v+gRS02yJ7JZB0Za",
        },
      ],
    });
    this.peer.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        console.log("Remote stream with tracks:", remoteStream.getTracks());

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(remoteStream);
        }
      }
    };

    this.peer.onconnectionstatechange = () => {
      console.log("Connection state:", this.peer?.connectionState);
      if (this.peer?.connectionState === "failed") {
        console.error("Connection failed, attempting restart...");
        this.peer?.restartIce();
      }
    };

    this.peer.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", this.peer?.iceConnectionState);
    };

    this.peer.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", this.peer?.iceGatheringState);
    };

    this.peer.ontrack = null;
    this.peer.onicecandidate = null;
    this.peer.onnegotiationneeded = null;
  }

  resetPeer() {
    if (this.peer) {
      this.peer.close();
    }
    this.pendingCandidates = [];
    this.isRemoteDescriptionSet = false;

    this.createPeer();
  }

  getPeer() {
    return this.peer;
  }

  async getOffer() {
    if (!this.peer) throw new Error("Peer not initialized");
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    this.isRemoteDescriptionSet = false;
    return offer;
  }

  async getAnswer(offer: RTCSessionDescriptionInit) {
    if (!this.peer) throw new Error("Peer not initialized");
    await this.peer.setRemoteDescription(offer);
    this.isRemoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      try {
        await this.peer.addIceCandidate(candidate);
        console.log("Added buffered ICE candidate (Answer side)");
      } catch (err) {
        console.warn("Failed to add buffered candidate:", err);
      }
    }
    this.pendingCandidates = [];

    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return answer;
  }

  async setRemoteAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peer) return;
    await this.peer.setRemoteDescription(answer);
    this.isRemoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      try {
        await this.peer.addIceCandidate(candidate);
        console.log("Added buffered ICE candidate");
      } catch (err) {
        console.warn("Failed to add buffered candidate:", err);
      }
    }
    this.pendingCandidates = [];
  }
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peer) return;
    if (!this.isRemoteDescriptionSet) {
      console.log("Buffering ICE candidate");
      this.pendingCandidates.push(new RTCIceCandidate(candidate));
      return;
    }

    try {
      await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Added ICE candidate successfully");
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  }
}

export default new PeerService();
