import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private url: string;

  constructor() {
    this.url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
  }

  public connect(token: string): Socket {
    if (!this.socket) {
      this.socket = io(this.url, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    }
    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = new SocketClient();
