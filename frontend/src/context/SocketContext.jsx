import React, { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, STORAGE_KEYS } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait until auth session check completes before connecting
    if (loading) return;

    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const socketInstance = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: token || undefined,
        userId: user?.id || user?._id || undefined,
        userName: user?.fullName || user?.name || undefined
      }
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.off('connect_error');
      socketInstance.disconnect();
    };
  }, [loading, user?.id, user?._id, user?.fullName, user?.name]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

