import SimplePeer from 'simple-peer/simplepeer.min.js';
import type { Instance as PeerInstance } from 'simple-peer';
const Peer = (SimplePeer as any).default || SimplePeer;
import { Buffer } from 'buffer';

export interface MeshMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'image' | 'video';
  mediaUrl?: string;
  hopCount?: number;
}

export interface MeshConnection {
  peerId: string;
  peer: PeerInstance;
  status: 'connecting' | 'connected' | 'disconnected';
}

class MeshService {
  private peers: Map<string, MeshConnection> = new Map();
  private onMessageReceived?: (msg: MeshMessage) => void;
  private onPeerStatusChange?: (peerId: string, status: string) => void;
  private processedMessages: Set<string> = new Set();
  private myId: string = '';

  setHandlers(handlers: {
    onMessageReceived: (msg: MeshMessage) => void;
    onPeerStatusChange: (peerId: string, status: string) => void;
  }, myId: string) {
    this.onMessageReceived = handlers.onMessageReceived;
    this.onPeerStatusChange = handlers.onPeerStatusChange;
    this.myId = myId;
  }

  // Create an offer to be sent via QR/Manual Code
  createOffer(myId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('Mesh: Creating offer for', myId);
      const p = new Peer({
        initiator: true,
        trickle: false,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' }
        ] }
      });

      p.on('signal', (data) => {
        const signalStr = JSON.stringify({ myId, signal: data });
        resolve(Buffer.from(signalStr).toString('base64'));
      });

      p.on('connect', () => {
        // We don't have the other person's ID reliably until they send something or we assign a temp one
        // But handleConnect will be called with the ID from the joiners response eventually
      });

      p.on('data', (data) => {
        // We'll need to know which peer this is.
        // For now, let's find the peer that matches this instance
        let peerId = 'unknown';
        this.peers.forEach((conn, pid) => {
          if (conn.peer === p) peerId = pid;
        });
        this.handleData(peerId, data);
      });

      p.on('error', (err: any) => {
        const message = String(err.message || err || '').toLowerCase();
        const isGraceful = message.includes('close called') || message.includes('destroy') || message.includes('user-initiated-abort');
        
        if (isGraceful) {
          console.log('Mesh: Peer closed gracefully during offer creation');
          return;
        }

        console.error('Mesh error:', err);
        if (err.code === 'ERR_ICE_CONNECTION_FAILURE') {
          console.warn('Mesh: ICE connection failed. This usually happens when peers are on different networks or behind strict firewalls.');
        }
        reject(err);
      });

      // Store it as a pending connection
      this.peers.set(`pending_${Date.now()}`, { peerId: 'pending', peer: p, status: 'connecting' });
    });
  }

  // Join using an offer string
  joinMesh(myId: string, offerBase64: string): Promise<{ answer: string; peerId: string }> {
    return new Promise((resolve, reject) => {
      try {
        const offerData = JSON.parse(Buffer.from(offerBase64, 'base64').toString());
        const { myId: offererId, signal: offerSignal } = offerData;

        const p = new Peer({
          initiator: false,
          trickle: false,
          config: { iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.services.mozilla.com' }
          ] }
        });

        p.signal(offerSignal);

        p.on('signal', (data) => {
          const answerStr = JSON.stringify({ myId, signal: data });
          resolve({
            answer: Buffer.from(answerStr).toString('base64'),
            peerId: offererId
          });
        });

        p.on('connect', () => {
          this.handleConnect(offererId, p);
        });

        p.on('data', (data) => {
          this.handleData(offererId, data);
        });

        p.on('error', (err: any) => {
          const message = String(err.message || err || '').toLowerCase();
          const isGraceful = message.includes('close called') || message.includes('destroy') || message.includes('user-initiated-abort');
          const isStateError = message.includes('stable') || message.includes('wrong state') || message.includes('signaling state');

          if (isGraceful) {
            console.log('Mesh: Peer closed gracefully during join');
            return;
          }

          if (isStateError) {
            console.debug('Mesh: Signaling state conflict encountered (ignorable)');
            return;
          }

          console.error('Mesh Peer Error:', err);
          if (err.code === 'ERR_ICE_CONNECTION_FAILURE') {
            console.error('Mesh: ICE connection failed. Check if both peers are on a network that allows WebRTC/P2P.');
          }
          this.onPeerStatusChange?.(offererId, 'disconnected');
          this.peers.delete(offererId);
        });

        p.on('close', () => {
          this.onPeerStatusChange?.(offererId, 'disconnected');
          this.peers.delete(offererId);
        });

        // Store it
        this.peers.set(offererId, { peerId: offererId, peer: p, status: 'connecting' });

      } catch (err) {
        reject(err);
      }
    });
  }

  // Finalize connection with answer
  acceptAnswer(answerBase64: string) {
    try {
      const answerData = JSON.parse(Buffer.from(answerBase64, 'base64').toString());
      const { myId: answererId, signal: answerSignal } = answerData;
      
      this.peers.forEach((conn, key) => {
        if (conn.status === 'connecting' && key.startsWith('pending_')) {
           conn.peer.signal(answerSignal);
           // Move to real ID
           this.peers.delete(key);
           this.peers.set(answererId, { ...conn, peerId: answererId });
           
           // The connect event in createOffer will now have the right ID to update status
           conn.peer.on('connect', () => {
             const c = this.peers.get(answererId);
             if (c) {
               c.status = 'connected';
               this.onPeerStatusChange?.(answererId, 'connected');
             }
           });
        }
      });
    } catch (err) {
      console.error('Failed to accept answer:', err);
    }
  }

  private handleConnect(peerId: string, peer: PeerInstance) {
    this.peers.set(peerId, { peerId, peer, status: 'connected' });
    this.onPeerStatusChange?.(peerId, 'connected');
    console.log(`Mesh: Connected to ${peerId}`);
  }

  private handleData(peerId: string, data: any) {
    try {
      const msg: MeshMessage = JSON.parse(data.toString());
      
      if (this.processedMessages.has(msg.id)) return;
      this.processedMessages.add(msg.id);
      if (this.processedMessages.size > 200) {
        const first = this.processedMessages.values().next().value;
        if (first) this.processedMessages.delete(first);
      }

      if (msg.recipientId === this.myId || msg.recipientId === 'broadcast') {
        this.onMessageReceived?.(msg);
      }

      if (msg.recipientId !== this.myId || msg.recipientId === 'broadcast') {
        const relayMsg = { ...msg, hopCount: (msg.hopCount || 0) + 1 };
        if (relayMsg.hopCount && relayMsg.hopCount < 5) {
          this.relayMessage(relayMsg, peerId);
        }
      }
    } catch (err) {
      console.error('Mesh data parse error:', err);
    }
  }

  private relayMessage(msg: MeshMessage, excludePeerId: string) {
    this.peers.forEach((conn, pid) => {
      if (pid !== excludePeerId && conn.status === 'connected') {
        conn.peer.send(JSON.stringify(msg));
      }
    });
  }

  sendMessage(recipientId: string, msg: MeshMessage) {
    // In a mesh network, we broadcast to all direct neighbors.
    // Neighbors will check if they are the recipient or need to relay further.
    const outMsg = { ...msg, recipientId };
    console.log(`Mesh: Broadcasting message ${msg.id} to all peers for recipient ${recipientId}`);
    
    this.peers.forEach((conn, pid) => {
      if (conn.status === 'connected') {
        try {
          conn.peer.send(JSON.stringify(outMsg));
        } catch (err) {
          console.error(`Failed to send mesh message to peer ${pid}:`, err);
        }
      }
    });
  }

  broadcastMessage(msg: MeshMessage) {
    this.peers.forEach((conn) => {
      if (conn.status === 'connected') {
        conn.peer.send(JSON.stringify(msg));
      }
    });
  }

  getConnectedPeers() {
    return Array.from(this.peers.keys());
  }
  
  disconnectAll() {
    this.peers.forEach(conn => conn.peer.destroy());
    this.peers.clear();
  }
}

export const meshService = new MeshService();
