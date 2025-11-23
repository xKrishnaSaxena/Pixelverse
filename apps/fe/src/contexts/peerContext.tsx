const API_KEY = import.meta.env.VITE_TURN_API_KEY;

class PeerService {
  peer: RTCPeerConnection | null = null;

  constructor() {}
  private async ensurePeerInitialized() {
    if (this.peer) return;

    try {
      const response = await fetch(
        `https://pixelverse.metered.live/api/v1/turn/credentials?apiKey=${API_KEY}`
      );
      const iceServers = await response.json();

      this.peer = new RTCPeerConnection({
        iceServers: iceServers,
      });
    } catch (error) {
      console.error("Failed to fetch ICE servers:", error);
    }
  }

  async getAnswer(offer: any) {
    await this.ensurePeerInitialized();

    if (this.peer) {
      await this.peer.setRemoteDescription(offer);
      const ans = await this.peer.createAnswer();
      await this.peer.setLocalDescription(new RTCSessionDescription(ans));
      return ans;
    }
  }

  async setRemoteDescription(ans: any) {
    await this.ensurePeerInitialized();

    if (this.peer) {
      await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
    }
  }

  async getOffer() {
    await this.ensurePeerInitialized();

    if (this.peer) {
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(new RTCSessionDescription(offer));
      return offer;
    }
  }
}

export default new PeerService();
