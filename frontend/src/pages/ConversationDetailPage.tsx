import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getConversation, sendMessage, createJournalEntry, Conversation, Message } from '../lib/api';

function tsToTime(ts: { _seconds: number }): string {
  return new Date(ts._seconds * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [entryTitle, setEntryTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    getConversation(id)
      .then(({ conversation: c, messages: m }) => {
        setConversation(c);
        setMessages(m);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !id) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    setError(null);

    // Optimistic user message
    const tempMsg: Message = {
      id: 'temp-' + Date.now(),
      conversationId: id,
      role: 'user',
      content,
      createdAt: { _seconds: Date.now() / 1000 },
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const { userMessage, aiMessage } = await sendMessage(id, content);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempMsg.id),
        userMessage,
        aiMessage,
      ]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !entryTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Build content from messages
      const content = messages
        .map((m) => `${m.role === 'user' ? 'Me' : 'Gemini'}: ${m.content}`)
        .join('\n\n');

      const entry = await createJournalEntry({
        conversationId: id,
        title: entryTitle.trim(),
        content,
        tags: [],
      });
      navigate(`/journal/${entry.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save journal entry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page conversation-page">
      <div className="conv-header">
        <Link to="/conversations" className="back-link">← Conversations</Link>
        <h1 className="conv-title">{conversation?.title ?? 'Conversation'}</h1>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setShowSaveForm(true)}
          disabled={messages.length === 0}
        >
          💾 Save as Journal Entry
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="messages-empty">
            <div className="empty-icon">✨</div>
            <p>Start your reflection. I'm here to listen and help you explore your thoughts.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className="message-bubble">
              <div className="message-content">{msg.content}</div>
              <div className="message-time">{tsToTime(msg.createdAt)}</div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="message message-model">
            <div className="message-bubble message-typing">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-form" onSubmit={handleSend}>
        <textarea
          className="message-input"
          placeholder="Share your thoughts… (Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as unknown as React.FormEvent);
            }
          }}
          maxLength={10000}
          rows={3}
          disabled={sending}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim() || sending}>
          {sending ? '…' : 'Send'}
        </button>
      </form>

      {/* Save Journal Modal */}
      {showSaveForm && (
        <div className="modal-overlay" onClick={() => setShowSaveForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Save as Journal Entry</h2>
            <form onSubmit={handleSaveJournal}>
              <div className="form-group">
                <label className="form-label">Entry Title</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Give this entry a meaningful title…"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  maxLength={200}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowSaveForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !entryTitle.trim()}>
                  {saving ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
