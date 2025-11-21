class PeerService {
  peer: RTCPeerConnection | null = null;

  constructor() {}

  private ensurePeer() {
    if (!this.peer || this.peer.connectionState === "closed") {
      this.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
      });
    }
    return this.peer;
  }

  async getAnswer(offer: any) {
    const peer = this.ensurePeer();
    await peer.setRemoteDescription(offer);
    const ans = await peer.createAnswer();
    await peer.setLocalDescription(new RTCSessionDescription(ans));
    return ans;
  }

  async setRemoteDescription(ans: any) {
    const peer = this.ensurePeer(); // Use helper
    await peer.setRemoteDescription(new RTCSessionDescription(ans));
  }

  async getOffer() {
    const peer = this.ensurePeer(); // Use helper
    const offer = await peer.createOffer();
    await peer.setLocalDescription(new RTCSessionDescription(offer));
    return offer;
  }
}

export default new PeerService();
