import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!_socket) {
      _socket = io({
        withCredentials: true,
        autoConnect: true,
      });
    }
    socketRef.current = _socket;
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    _socket?.on(event, handler);
    return () => { _socket?.off(event, handler); };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    _socket?.emit(event, data);
  }, []);

  const disconnect = useCallback(() => {
    if (_socket) {
      _socket.disconnect();
      _socket = null;
    }
  }, []);

  return { socket: socketRef.current, on, emit, disconnect };
}
