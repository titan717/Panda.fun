import React, { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Sparkles, Film, Clock, Check, X } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  episode: string;
  time: string;
  image: string;
  link: string;
  unread: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Frieren: Beyond Journey\'s End',
    episode: 'Episode 28 (Finale) now available',
    time: '2 hours ago',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&auto=format&fit=crop&q=80',
    link: '/details/frieren-beyond-journeys-end',
    unread: true
  },
  {
    id: 'notif-2',
    title: 'Jujutsu Kaisen: The Culling Game',
    episode: 'New season simulcast update',
    time: '5 hours ago',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80',
    link: '/details/jujutsu-kaisen-2nd-season',
    unread: true
  },
  {
    id: 'notif-3',
    title: 'One Piece',
    episode: 'Episode 1120 available in SUB & DUB',
    time: '1 day ago',
    image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80',
    link: '/details/one-piece',
    unread: false
  }
];

export function ModernNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-200 hover:text-white transition-all backdrop-blur-md"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0f1015] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for closing */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#111218]/95 border border-[#242533] backdrop-blur-2xl rounded-2xl shadow-2xl p-3 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c1d29] pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#e8d0c0]" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Updates & Episodes</h3>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-[#e8d0c0] hover:underline font-semibold"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="py-2 space-y-1 max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <Link 
                    key={n.id} 
                    href={n.link}
                    onClick={() => {
                      setIsOpen(false);
                      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, unread: false } : item));
                    }}
                  >
                    <div className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${n.unread ? 'bg-[#181726]/80 hover:bg-[#201e33]' : 'hover:bg-white/5'}`}>
                      <img 
                        src={n.image} 
                        alt={n.title}
                        className="w-10 h-12 rounded-lg object-cover bg-black/50 shrink-0" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white truncate">{n.title}</h4>
                          {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#e8d0c0]" />}
                        </div>
                        <p className="text-[11px] text-gray-300 truncate mt-0.5">{n.episode}</p>
                        <span className="text-[10px] text-gray-500">{n.time}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
