import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { contactService } from '../services/contactService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = authService.getStoredUser();
    if (!stored) return null;
    let savedPresence = null;
    try {
      savedPresence = localStorage.getItem('nexora_user_presence');
    } catch {}
    return {
      ...stored,
      presenceStatus: savedPresence || stored.presenceStatus || 'available'
    };
  });
  const [loading, setLoading] = useState(true);

  // Restore session from HttpOnly cookie or stored token on mount
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const userData = await authService.getCurrentUser();
        if (isMounted && userData) {
          let savedPresence = null;
          try {
            savedPresence = localStorage.getItem('nexora_user_presence');
          } catch {}
          const merged = {
            ...userData,
            presenceStatus: savedPresence || userData.presenceStatus || 'available'
          };
          setUser(merged);
          try {
            localStorage.setItem('user', JSON.stringify(merged));
          } catch {}
        }
      } catch (error) {
        if (isMounted) {
          // If cookie is invalid or expired, clear local state
          authService.logout();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async ({ identifier, password }) => {
    const result = await authService.login({ identifier, password });
    setUser(result.user);
    return result;
  }, []);

  const register = useCallback(async ({ fullName, username, email, password }) => {
    const result = await authService.register({ fullName, username, email, password });
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    const updated = await authService.updateProfile(profileData);
    setUser(updated);
    return updated;
  }, []);

  const changePassword = useCallback(async (passwords) => {
    return await authService.changePassword(passwords);
  }, []);

  const updatePresenceStatus = useCallback(async (newStatus) => {
    if (!newStatus) return;
    try {
      localStorage.setItem('nexora_user_presence', newStatus);
    } catch {}

    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, presenceStatus: newStatus };
      try {
        localStorage.setItem('user', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await contactService.updatePresence(newStatus);
    } catch {
      // Safe ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        updatePresenceStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
