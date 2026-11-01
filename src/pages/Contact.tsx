import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';

export function Contact() {
  return (
    <div className="kinoma-simple-page">
      <article className="kinoma-simple-page__document">
        <div className="kinoma-simple-page__icon"><MessageCircle size={20} /></div>
        <span className="kinoma-eyebrow">SUPPORT</span>
        <h1>Contact / Support</h1>
        <p>Kinoma support is being prepared alongside the new MovieApi platform. For now, this page keeps the sidebar route valid without creating a fake support address.</p>
        <div className="kinoma-simple-page__notice"><Mail size={16} /> Support contact will be published here when the service is ready.</div>
        <Link href="/home" className="kinoma-simple-page__button"><ArrowLeft size={15} /> Back home</Link>
      </article>
    </div>
  );
}
