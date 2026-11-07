'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, tokens, when } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AppNotification } from '@/lib/types';

export function NotificationsMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    if (!user || !tokens.get()) return;
    try {
      const res = await api<{ unreadCount: number }>('/notifications/unread-count');
      if (res?.data?.unreadCount !== undefined) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUnreadCount(0);
      }
    }
  }, [user]);

  const fetchList = useCallback(async () => {
    if (!user || !tokens.get()) return;
    setLoading(true);
    try {
      const res = await api<AppNotification[]>('/notifications?limit=20');
      if (res?.data) {
        setNotifications(res.data);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user, fetchUnread]);

  useEffect(() => {
    if (open && user) {
      fetchList();
    }
  }, [open, user, fetchList]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  async function handleNotificationClick(item: AppNotification) {
    if (!item.isRead) {
      try {
        await api(`/notifications/${item.id}/read`, { method: 'POST' });
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    setOpen(false);

    if (item.entityType === 'BOOKING' && item.entityId) {
      router.push(`/bookings/${item.entityId}`);
    } else if (item.entityType === 'PROBLEM' && item.entityId) {
      // Deep-link: NEW_QUOTE lands on the quotes section so it's immediately visible
      const anchor = item.type === 'NEW_QUOTE' ? '#quotes' : '';
      router.push(`/problems/${item.entityId}${anchor}`);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-clay-800 hover:bg-sand-200 transition-colors"
        aria-label="Notifications"
        title="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rust-700 px-1 text-[10px] font-bold text-sand-50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-sand-300 bg-sand-50 p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-3 border-b border-sand-200">
            <h3 className="font-semibold text-clay-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-clay-600 hover:text-clay-800 underline transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto divide-y divide-sand-200/60">
            {loading && notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-clay-600">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-xs text-clay-600">No notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-xl transition-colors cursor-pointer text-left ${
                    item.isRead ? 'hover:bg-sand-100/70 opacity-75' : 'bg-sand-100/90 hover:bg-sand-200/70 font-medium'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${item.isRead ? 'text-clay-800' : 'text-clay-900 font-semibold'}`}>{item.title}</p>
                    {!item.isRead && <span className="h-2 w-2 rounded-full bg-clay-600 shrink-0 mt-1" />}
                  </div>
                  <p className="mt-1 text-xs text-clay-700 line-clamp-2">{item.message}</p>
                  <p className="mt-1.5 text-[11px] text-clay-500">{when(item.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

