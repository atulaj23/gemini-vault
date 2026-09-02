import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listConversations, Conversation } from '../lib/api';

function tsToDate(ts: { _seconds: number }): string {
  return new Date(ts._seconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversations</h1>
          <p className="page-subtitle">Your AI journal conversations</p>
        </div>
        <Link to="/conversations/new" className="btn btn-primary">+ New Conversation</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {conversations.length === 0 ? (
        <div className="empty-page">
          <div className="empty-icon">💬</div>
          <h2>No conversations yet</h2>
          <p>Start a reflective conversation with your AI journal assistant.</p>
          <Link to="/conversations/new" className="btn btn-primary">Start a Conversation</Link>
        </div>
      ) : (
        <div className="conversations-grid">
          {conversations.map((c) => (
            <Link key={c.id} to={`/conversations/${c.id}`} className="conversation-card">
              <div className="conv-title">{c.title}</div>
              <div className="conv-meta">
                <span>{c.messageCount} messages</span>
                <span>{tsToDate(c.updatedAt)}</span>
              </div>
              <div className={`conv-status ${c.status}`}>{c.status}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
