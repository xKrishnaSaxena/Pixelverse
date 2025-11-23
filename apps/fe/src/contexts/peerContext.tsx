class PeerService {
  private peer: RTCPeerConnection | null = null;

  constructor() {
    this.createPeer();
  }

  private createPeer() {
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "ccc312127ec1bfa1e5ca89bf",
          credential: "v+gRS02yJ7JZB0Za",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "ccc312127ec1bfa1e5ca89bf",
          credential: "v+gRS02yJ7JZB0Za",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "ccc312127ec1bfa1e5ca89bf",
          credential: "v+gRS02yJ7JZB0Za",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "ccc312127ec1bfa1e5ca89bf",
          credential: "v+gRS02yJ7JZB0Za",
        },
      ],
    });

    this.peer.ontrack = null;
    this.peer.onicecandidate = null;
    this.peer.onnegotiationneeded = null;
  }

  resetPeer() {
    if (this.peer) {
      this.peer.close();
    }
    this.createPeer();
  }

  getPeer() {
    return this.peer;
  }

  async getOffer() {
    if (!this.peer) throw new Error("Peer not initialized");
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    return offer;
  }

  async getAnswer(offer: RTCSessionDescriptionInit) {
    if (!this.peer) throw new Error("Peer not initialized");
    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return answer;
  }

  async setRemoteAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peer) return;
    await this.peer.setRemoteDescription(answer);
  }
}

export default new PeerService();
