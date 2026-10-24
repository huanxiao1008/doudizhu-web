import { io } from 'socket.io-client';

// 開發時前端跑在 5173，後端跑在 3001；正式部署時前後端同源，用空字串即可自動連到同一網域
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (
  import.meta.env.DEV ? `http://${window.location.hostname}:3001` : undefined
);

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
