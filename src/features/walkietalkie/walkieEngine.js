import { auth } from '../../data/firebase.js';
import {
  addIceCandidate,
  endSession,
  fetchChannel,
  heartbeat,
  observeIceCandidates,
  observeSession,
  observeSessions,
  setLive,
  writeAnswer,
  writeOffer,
} from './walkieRepository.js';

const HEARTBEAT_MS = 15_000;
const STALE_MS = 45_000;

// Web port of WalkieTalkieEngine.kt. Owns the raw WebRTC plumbing for one
// WalkieTalkie session: the local mic MediaStream when transmitting, and
// one RTCPeerConnection per remote peer (the transmitter fans out one
// connection per listener; the receiver has exactly one, to the
// transmitter). Browsers ship RTCPeerConnection + getUserMedia natively —
// no library needed, unlike the Android build which had to work around a
// duplicate-class conflict with Jitsi's bundled WebRTC AAR.
//
// Call stop() on unmount so leaving the page always tears everything down.
export class WalkieTalkieEngine {
  constructor() {
    this.localStream = null;
    this.transmitConnections = new Map(); // receiverUid -> RTCPeerConnection
    this.receiveConnection = null;
    this.unsubscribers = [];
    this.heartbeatTimer = null;
    this.activeCode = null;
    this.activeRole = null; // 'transmit' | 'receive'
    this.remoteAudioEl = null;
    this.onStatusChange = () => {};
    this.status = { kind: 'idle' };
  }

  setRemoteAudioElement(el) {
    this.remoteAudioEl = el;
  }

  _setStatus(status) {
    this.status = status;
    this.onStatusChange(status);
  }

  _uid() {
    return auth?.currentUser?.uid ?? null;
  }

  // ── Transmit ───────────────────────────────────────────────────────────

  async startTransfer(code, iceServers) {
    this.stop();
    this.activeCode = code;
    this.activeRole = 'transmit';
    this._setStatus({ kind: 'connecting' });

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this._setStatus({ kind: 'error', message: 'Microphone permission denied' });
      this.activeCode = null;
      this.activeRole = null;
      return;
    }

    await setLive(code, true);
    this._setStatus({ kind: 'live', listenerCount: 0 });

    this.heartbeatTimer = setInterval(() => heartbeat(code), HEARTBEAT_MS);

    const unsub = observeSessions(code, (changes) => {
      changes.forEach((change) => {
        const receiverUid = change.doc.id;
        if (change.type === 'added' || change.type === 'modified') {
          if (this.transmitConnections.has(receiverUid)) return;
          const data = change.doc.data();
          if (!data?.offer) return;
          this._answerReceiver(code, receiverUid, data.offer, iceServers);
        } else if (change.type === 'removed') {
          this.transmitConnections.get(receiverUid)?.close();
          this.transmitConnections.delete(receiverUid);
          this._setStatus({ kind: 'live', listenerCount: this.transmitConnections.size });
        }
      });
    });
    this.unsubscribers.push(unsub);
  }

  async _answerReceiver(code, receiverUid, offer, iceServers) {
    const pc = new RTCPeerConnection({ iceServers });
    this.transmitConnections.set(receiverUid, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addIceCandidate(code, receiverUid, 'transmitter', event.candidate.toJSON());
      }
    };

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      // Attach our mic to the transceiver Unified Plan already created from
      // the offer's (recvonly) audio m-line — calling addTransceiver() here
      // instead would add a SECOND, unnegotiated m-line: ICE/DTLS still
      // connects fine, but no audio ever flows because the
      // actually-negotiated m-line never gets a track.
      const track = this.localStream.getAudioTracks()[0];
      const transceiver = pc.getTransceivers().find((t) => t.receiver.track?.kind === 'audio');
      if (transceiver && track) {
        transceiver.direction = 'sendonly';
        await transceiver.sender.replaceTrack(track);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await writeAnswer(code, receiverUid, { sdp: answer.sdp, type: answer.type });
      this._setStatus({ kind: 'live', listenerCount: this.transmitConnections.size });

      const unsub = observeIceCandidates(code, receiverUid, 'receiver', (candidates) => {
        candidates.forEach((c) => {
          pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        });
      });
      this.unsubscribers.push(unsub);
    } catch {
      pc.close();
      this.transmitConnections.delete(receiverUid);
    }
  }

  // ── Receive ────────────────────────────────────────────────────────────

  async startReceive(code, iceServers) {
    this.stop();
    const me = this._uid();
    if (!me) {
      this._setStatus({ kind: 'error', message: 'Not signed in' });
      return;
    }
    this.activeCode = code;
    this.activeRole = 'receive';
    this._setStatus({ kind: 'connecting' });

    const channel = await fetchChannel(code);
    const fresh =
      channel?.live === true &&
      channel.updatedAt &&
      channel.updatedAt.toMillis() > Date.now() - STALE_MS;
    if (!channel || !fresh) {
      this._setStatus({ kind: 'error', message: `Not currently transmitting on ${code}` });
      this.activeCode = null;
      this.activeRole = null;
      return;
    }

    const pc = new RTCPeerConnection({ iceServers });
    this.receiveConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addIceCandidate(code, me, 'receiver', event.candidate.toJSON());
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (this.remoteAudioEl && stream) {
        this.remoteAudioEl.srcObject = stream;
        this.remoteAudioEl.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this._setStatus({ kind: 'receiving' });
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this._setStatus({ kind: 'error', message: 'Connection lost' });
      }
    };

    pc.addTransceiver('audio', { direction: 'recvonly' });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await writeOffer(code, me, { sdp: offer.sdp, type: offer.type });

      let answered = false;
      const unsubSession = observeSession(code, me, (session) => {
        const answer = session?.answer;
        if (answer && !answered) {
          answered = true;
          pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp }).catch(() => {});
        }
      });
      this.unsubscribers.push(unsubSession);

      const unsubIce = observeIceCandidates(code, me, 'transmitter', (candidates) => {
        candidates.forEach((c) => {
          pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        });
      });
      this.unsubscribers.push(unsubIce);
    } catch (e) {
      this._setStatus({ kind: 'error', message: e?.message || 'Connection failed' });
    }
  }

  // ── Teardown ───────────────────────────────────────────────────────────

  stop() {
    const code = this.activeCode;
    const role = this.activeRole;
    const me = this._uid();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    this.transmitConnections.forEach((pc) => pc.close());
    this.transmitConnections.clear();
    this.receiveConnection?.close();
    this.receiveConnection = null;

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;

    if (this.remoteAudioEl) this.remoteAudioEl.srcObject = null;

    if (code) {
      if (role === 'transmit') {
        setLive(code, false).catch(() => {});
      } else if (role === 'receive' && me) {
        endSession(code, me).catch(() => {});
      }
    }

    this.activeCode = null;
    this.activeRole = null;
    this._setStatus({ kind: 'idle' });
  }
}
