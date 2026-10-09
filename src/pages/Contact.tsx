import React, { useState } from 'react';
import { Link } from 'wouter';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { AlertCircle, ArrowLeft, CheckCircle2, LifeBuoy, Send } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

const CATEGORIES = [
  { value: 'playback', label: 'Playback or video issue' },
  { value: 'account', label: 'Account or profile' },
  { value: 'search', label: 'Search or discovery' },
  { value: 'library', label: 'My List or watch history' },
  { value: 'performance', label: 'Slow loading or layout' },
  { value: 'other', label: 'Something else' },
] as const;

const IMPACTS = [
  { value: 'low', label: 'Low — small inconvenience' },
  { value: 'normal', label: 'Normal — feature partly affected' },
  { value: 'high', label: 'High — a major feature is blocked' },
  { value: 'critical', label: 'Critical — I cannot use Panda.fun' },
] as const;

function explainSupportError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code.includes('permission-denied')) {
    return 'The support inbox rejected this request. The Firestore supportTickets rules may not be deployed yet. Please retry later or include this error in a message to the site administrator.';
  }
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
    return 'Panda.fun could not reach the support service. Check your connection, wait a moment, and submit again.';
  }
  if (code.includes('unauthenticated')) {
    return 'Your sign-in session needs refreshing. Log in again and resubmit the report.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'An unexpected support error occurred. Please try again or report the issue through the project support channel.';
}

export function Contact() {
  const { user } = useAuth();
  const [subject, setSubject] = useState(() => new URLSearchParams(window.location.search).get('subject') || '');
  const [category, setCategory] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('category');
    return CATEGORIES.some((item) => item.value === requested) ? requested as typeof CATEGORIES[number]['value'] : 'playback';
  });
  const [impact, setImpact] = useState<typeof IMPACTS[number]['value']>('normal');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticketId, setTicketId] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setTicketId('');

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const cleanEmail = email.trim();
    if (cleanSubject.length < 5 || cleanSubject.length > 120) {
      setError('Use a short, specific title between 5 and 120 characters.');
      return;
    }
    if (cleanMessage.length < 15 || cleanMessage.length > 5000) {
      setError('Describe what happened in 15–5,000 characters. Mention the page, what you clicked, and any error shown.');
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address, or leave the field blank.');
      return;
    }

    setBusy(true);
    try {
      const created = await addDoc(collection(db, 'supportTickets'), {
        subject: cleanSubject,
        message: cleanMessage,
        category,
        impact,
        status: 'open',
        email: cleanEmail.slice(0, 254),
        userId: user?.uid || 'anonymous',
        page: window.location.pathname.slice(0, 300),
        clientTimestamp: Date.now(),
        createdAt: serverTimestamp(),
      });
      setTicketId(created.id);
      setSubject('');
      setMessage('');
    } catch (submitError) {
      setError(explainSupportError(submitError));
      console.error('[Panda.fun] Support ticket submission failed:', submitError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="panda-support-page">
      <header className="panda-support-heading">
        <span className="panda-support-eyebrow"><LifeBuoy size={14} aria-hidden="true" /> Panda support</span>
        <h1>Let’s get this sorted.</h1>
        <p>Tell us what went wrong and what you were trying to do. Your report is sent to the Panda.fun admin inbox, timestamped, and grouped with reports about the same problem when possible.</p>
      </header>

      {ticketId && (
        <div className="panda-support-status is-success" role="status" aria-live="polite">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div><strong>Report received.</strong><br />Reference: <code>{ticketId}</code>. It is now in the admin support queue. Save this reference if you need to follow up.</div>
        </div>
      )}
      {error && (
        <div className="panda-support-status is-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" /><div><strong>We couldn’t send your report.</strong><br />{error}</div>
        </div>
      )}

      <form className="panda-support-form" onSubmit={submit}>
        <div className="panda-support-field panda-support-field--full" style={{ paddingTop: 24 }}>
          <label htmlFor="panda-support-subject">What is the problem?</label>
          <input id="panda-support-subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={5} maxLength={120} placeholder="For example, a title’s trailer stays blank" required />
          <span className="panda-support-help">A clear title helps us merge repeat reports into one important problem.</span>
        </div>

        <div className="panda-support-field">
          <label htmlFor="panda-support-category">Area affected</label>
          <select id="panda-support-category" name="category" value={category} onChange={(event) => setCategory(event.target.value as typeof category)} required>
            {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="panda-support-field">
          <label htmlFor="panda-support-impact">How serious is it?</label>
          <select id="panda-support-impact" name="impact" value={impact} onChange={(event) => setImpact(event.target.value as typeof impact)} required>
            {IMPACTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        <div className="panda-support-field panda-support-field--full">
          <label htmlFor="panda-support-message">What happened?</label>
          <textarea id="panda-support-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={15} maxLength={5000} placeholder="Steps to reproduce, what you expected, what actually happened, and any exact error message…" required />
          <span className="panda-support-help">Please don’t include passwords or payment details. Include a title name or page path if relevant.</span>
        </div>

        <div className="panda-support-field panda-support-field--full">
          <label htmlFor="panda-support-email">Email for follow-up <span style={{ color: '#777', fontWeight: 500 }}>(optional)</span></label>
          <input id="panda-support-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" autoComplete="email" />
          <span className="panda-support-help">{user ? 'Your signed-in account is attached to this report.' : 'You can report an issue without signing in.'}</span>
        </div>

        <div className="panda-support-field panda-support-field--full" style={{ paddingTop: 4 }}>
          <div><button className="panda-support-submit" type="submit" disabled={busy}><Send size={15} aria-hidden="true" />{busy ? 'Sending report…' : 'Send to support'}</button></div>
          <span className="panda-support-help">Priority is reviewed from the impact you choose, report volume, and issue details. Sending a report does not guarantee a response time.</span>
        </div>
      </form>

      <p style={{ marginTop: 26, color: '#888', fontSize: 12, lineHeight: 1.8 }}>
        Need to get back to watching? <Link href="/home" style={{ color: '#f18a7f', fontWeight: 750 }}>Return to Panda.fun</Link>.
      </p>
      <Link href="/home" className="kinoma-simple-page__button" style={{ marginTop: 18 }}><ArrowLeft size={15} /> Back home</Link>
    </main>
  );
}
