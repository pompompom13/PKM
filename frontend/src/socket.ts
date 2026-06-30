import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = io(SOCKET_URL);
  return socket;
}
