import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createConversation } from '../lib/api';

export function NewConversationPage() {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const conv = await createConversation(title.trim());
      navigate(`/conversations/${conv.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      setLoading(false);
    }
  };

  return (
    <div className="page page-centered">
      <div className="form-card">
        <h1 className="page-title">New Conversation</h1>
        <p className="page-subtitle">Start a reflective AI journal session</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Conversation Title</label>
            <input
              id="title"
              className="form-input"
              type="text"
              placeholder="e.g. Reflecting on this week's challenges…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading || !title.trim()}>
            {loading ? 'Creating…' : 'Start Conversation'}
          </button>
        </form>
      </div>
    </div>
  );
}
