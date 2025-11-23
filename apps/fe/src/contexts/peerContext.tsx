class PeerService {
  private peer: RTCPeerConnection | null = null;

  constructor() {
    this.createPeer();
  }

  private createPeer() {
    this.peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.stunprotocol.org" },
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
