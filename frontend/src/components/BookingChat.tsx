'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { ApiError, api, when } from '@/lib/api';
import type { ChatMessage } from '@/lib/types';

interface BookingChatProps {
  bookingId: string;
  currentUserId: string;
  otherPartyName: string;
}

export function BookingChat({ bookingId, currentUserId, otherPartyName }: BookingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const loadMessages = useCallback(async (isInitial = false) => {
    try {
      const res = await api<ChatMessage[]>(`/bookings/${bookingId}/messages?limit=50`);
      setMessages((prev) => {
        if (prev.length !== res.data.length || (prev.length > 0 && prev[prev.length - 1].id !== res.data[res.data.length - 1]?.id)) {
          setTimeout(scrollToBottom, 50);
          return res.data;
        }
        return prev;
      });
      if (isInitial) setTimeout(scrollToBottom, 50);
    } catch (e) {
      if (isInitial) setError(e instanceof ApiError ? e.friendly : 'Could not load messages.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [bookingId, scrollToBottom]);

  useEffect(() => {
    loadMessages(true);
    const interval = setInterval(() => loadMessages(false), 3000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    setError('');
    try {
      const res = await api<ChatMessage>(`/bookings/${bookingId}/messages`, {
        method: 'POST',
        body: { content },
      });
      setText('');
      setMessages((prev) => [...prev, res.data]);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      setError(e instanceof ApiError ? e.friendly : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="flex flex-col h-[520px]">
      <div className="flex items-center justify-between pb-3 border-b border-sand-200">
        <div>
          <h2 className="text-xl font-medium text-clay-900">Direct Chat</h2>
          <p className="text-xs text-clay-600">Live communication with {otherPartyName}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-sage-600 font-medium">
          <span className="h-2 w-2 rounded-full bg-sage-600 animate-pulse" />
          Active
        </div>
      </div>

      <Alert>{error}</Alert>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-clay-600">
            Loading chat messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-clay-600 space-y-1">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs">Coordinate timing, tools, or directions directly here.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[11px] text-clay-600 px-1 mb-0.5">
                  {isMe ? 'You' : m.sender.fullName}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm ${
                    isMe
                      ? 'bg-clay-600 text-sand-50 rounded-tr-sm'
                      : 'bg-sand-200/90 text-clay-950 border border-sand-300 rounded-tl-sm'
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-[10px] text-clay-500 mt-0.5 px-1">{when(m.createdAt)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSend} className="pt-3 border-t border-sand-200 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${otherPartyName}...`}
          maxLength={2000}
          disabled={sending}
          className="flex-1 rounded-xl border border-sand-300 bg-sand-50 px-3.5 py-2.5 text-sm text-ink placeholder:text-sand-500 focus:outline-none focus:ring-1 focus:ring-clay-600 shadow-[inset_0_1px_2px_rgba(110,64,51,.08)]"
        />
        <Button type="submit" disabled={sending || !text.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </Button>
      </form>
    </Card>
  );
}

