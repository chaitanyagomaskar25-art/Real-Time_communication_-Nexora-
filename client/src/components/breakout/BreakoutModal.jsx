import React, { useState, useEffect } from 'react';
import {
  SplitSquareVertical,
  Send,
  Users,
  DoorOpen,
  ArrowRight,
  Megaphone,
  CheckCircle2
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { meetingService } from '../../services/meetingService';

const BreakoutModal = ({
  isOpen,
  onClose,
  roomId,
  socket,
  isHost = false,
  isCoHost = false,
  activeSubRoom = null,
  onJoinSubRoom
}) => {
  const [breakouts, setBreakouts] = useState({ isActive: false, rooms: [], allowSwitching: true });
  const [roomCount, setRoomCount] = useState(2);
  const [roomNames, setRoomNames] = useState(['Breakout Room 1', 'Breakout Room 2']);
  const [allowSwitching, setAllowSwitching] = useState(true);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const canManage = isHost || isCoHost;

  // Fetch breakout rooms status
  useEffect(() => {
    if (!isOpen || !roomId) return;

    let isMounted = true;
    const fetchBreakouts = async () => {
      try {
        const res = await meetingService.getBreakoutRooms(roomId);
        const data = res?.data || res || {};
        if (isMounted) {
          setBreakouts(data);
        }
      } catch {
        // Safe ignore
      }
    };

    fetchBreakouts();
    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId]);

  // Adjust room names when roomCount changes
  const handleRoomCountChange = (count) => {
    const num = Math.min(Math.max(2, count), 8);
    setRoomCount(num);
    setRoomNames((prev) => {
      const arr = [];
      for (let i = 0; i < num; i++) {
        arr.push(prev[i] || `Breakout Room ${i + 1}`);
      }
      return arr;
    });
  };

  // Create breakout rooms
  const handleCreate = async () => {
    try {
      if (socket) {
        socket.emit('breakout-create', {
          roomId,
          roomNames,
          allowSwitching
        });
      } else {
        const res = await meetingService.createBreakoutRooms(roomId, {
          roomNames,
          allowSwitching
        });
        setBreakouts(res.data || res);
      }
      setBreakouts((prev) => ({
        ...prev,
        isActive: true,
        rooms: roomNames.map((name, idx) => ({
          id: `${roomId}_bo_${idx + 1}`,
          name,
          participantCount: 0
        }))
      }));
    } catch (err) {
      alert(err.message || 'Failed to create breakout rooms.');
    }
  };

  // Join or switch room
  const handleSwitchRoom = (subRoomId) => {
    if (socket) {
      socket.emit('breakout-join', { roomId, subRoomId });
    }
    if (onJoinSubRoom) onJoinSubRoom(subRoomId);
  };

  // Broadcast message to all breakouts
  const handleBroadcast = (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim() || !socket) return;

    socket.emit('breakout-broadcast', { roomId, message: broadcastMsg.trim() });
    setBroadcastMsg('');
    setBroadcastSuccess(true);
    setTimeout(() => setBroadcastSuccess(false), 2500);
  };

  // Close all breakout rooms
  const handleCloseAll = async () => {
    if (window.confirm('Are you sure you want to close all breakout rooms and return everyone to the main meeting?')) {
      try {
        if (socket) {
          socket.emit('breakout-close-all', { roomId });
        } else {
          await meetingService.closeBreakoutRooms(roomId);
        }
        setBreakouts({ isActive: false, rooms: [] });
        if (onJoinSubRoom) onJoinSubRoom(null);
      } catch (err) {
        alert(err.message || 'Failed to close breakout rooms.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Breakout Rooms"
      size="md"
    >
      <div className="space-y-5 text-xs text-slate-700 dark:text-slate-300">
        {/* Active Breakout Rooms View */}
        {breakouts.isActive ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-semibold">Breakout rooms are currently active.</span>
              </div>

              {canManage && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCloseAll}
                  className="text-xs py-1 px-2.5"
                >
                  Close All Rooms
                </Button>
              )}
            </div>

            {/* List of rooms */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Available Rooms
              </h4>

              {/* Main Room Card */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between transition ${
                  activeSubRoom === null
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900'
                }`}
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Main Meeting Room
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    General conference area
                  </p>
                </div>

                {activeSubRoom !== null ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSwitchRoom(null)}
                    className="text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <span>Return</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                ) : (
                  <Badge variant="primary" size="sm">
                    Current Room
                  </Badge>
                )}
              </div>

              {/* Sub-Rooms */}
              {breakouts.rooms.map((room) => {
                const isCurrent = activeSubRoom === room.id;

                return (
                  <div
                    key={room.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition ${
                      isCurrent
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {room.name}
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{room.participantCount || 0} participant(s)</span>
                      </p>
                    </div>

                    {isCurrent ? (
                      <Badge variant="primary" size="sm">
                        You are here
                      </Badge>
                    ) : (
                      (breakouts.allowSwitching || canManage) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwitchRoom(room.id)}
                          className="text-xs py-1 px-2.5 flex items-center gap-1"
                        >
                          <DoorOpen className="w-3 h-3" />
                          <span>Join</span>
                        </Button>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Broadcast Message to All Rooms (Host Only) */}
            {canManage && (
              <form onSubmit={handleBroadcast} className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Megaphone className="w-3.5 h-3.5 text-amber-500" />
                    <span>Broadcast announcement to all rooms</span>
                  </span>
                  {broadcastSuccess && (
                    <span className="text-[10px] text-emerald-500 font-bold">Sent!</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder="e.g. 5 minutes remaining before we regroup..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <Button type="submit" variant="primary" size="sm" className="text-xs py-1.5 px-3">
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* Create Breakout Rooms View (Host Only) */
          <div className="space-y-4">
            {canManage ? (
              <>
                <p className="text-slate-500 dark:text-slate-400">
                  Split meeting participants into smaller, focused groups for collaborative discussions or workshops.
                </p>

                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Number of Breakout Rooms: <strong>{roomCount}</strong>
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="6"
                    value={roomCount}
                    onChange={(e) => handleRoomCountChange(parseInt(e.target.value, 10))}
                    className="w-full accent-brand-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200">
                    Room Names
                  </label>
                  {roomNames.map((name, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const next = [...roomNames];
                        next[idx] = e.target.value;
                        setRoomNames(next);
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="allowSwitch"
                    checked={allowSwitching}
                    onChange={(e) => setAllowSwitching(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="allowSwitch" className="text-[11px] text-slate-600 dark:text-slate-400">
                    Allow participants to switch between breakout rooms freely
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleCreate}>
                    Create & Start Breakouts
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <SplitSquareVertical className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  No breakout rooms active
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  The host has not created any breakout rooms yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BreakoutModal;
