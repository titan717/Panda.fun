import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ChevronDown, Play, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { KinomaLogo } from '../components/ui/KinomaLogo';
import { updateSEO } from '../lib/seo';

const BACKDROP_URL = 'https://aniwaves.ru/assets/images/bg-index2.jpg';
const REFERENCE_TEXTURE_URL = 'https://cdn.dribbble.com/userupload/14005335/file/original-d6adb157992d0492ed2fc3b2ab46cef9.jpg?resize=1200x1200&vertical=center';

const FAQ = [
  { question: 'What is Panda.fun?', answer: 'Panda.fun is a streaming experience for anime, movies and series, built around fast discovery, beautiful artwork and a simple path from finding a title to pressing play.' },
  { question: 'Do I need an account to browse?', answer: 'No. You can enter Panda.fun and explore the catalog without signing in. An account is used for features such as your personal library and viewing progress.' },
  { question: 'Does Panda.fun support movies and series too?', answer: 'Yes. The interface is designed around content rather than a single format, so anime, movies and series can share the same discovery experience.' },
  { question: 'Can I use Panda.fun on a TV?', answer: 'Yes. Panda.fun uses the same visual language across web and TV, with responsive layouts and controls designed to remain comfortable on large screens.' },
];

function CartoonButton({ children, href }: { children: React.ReactNode; href: string }) {
  return <Link href={href} className="kinoma-cartoon-button"><span className="kinoma-cartoon-button__face">{children}</span><span className="kinoma-cartoon-button__shadow" aria-hidden="true" /></Link>;
}

const WELCOME_IMAGE_URL = 'https://static.crunchyroll.com/cr-acquisition/assets/img/start/hero/india/background-desktop@2x.webp';

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    updateSEO({
      title: 'Anime, Movies & Series Streaming',
      description: 'Discover anime, movies and series on Panda.fun. Browse the catalog, find what to watch, and continue your story across web and TV.',
      image: '/icon.svg',
      type: 'website',
      canonicalUrl: window.location.origin + '/',
      schema: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Panda.fun', url: window.location.origin + '/', description: 'Discover anime, movies and series on Panda.fun through a simple, cinematic streaming experience.', image: window.location.origin + '/icon.svg', potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${window.location.origin}/search?keyword={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
          { '@type': 'Organization', name: 'Panda.fun', url: window.location.origin + '/', logo: window.location.origin + '/icon.svg' },
          { '@type': 'FAQPage', mainEntity: FAQ.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
        ],
      },
    });
  }, []);

  return (
    <div className="kinoma-welcome">
      <div className="kinoma-welcome__backdrop" style={{ backgroundImage: `url("${BACKDROP_URL}")` }} />
      <div className="kinoma-welcome__reference-texture" style={{ backgroundImage: `url("${REFERENCE_TEXTURE_URL}")` }} />
      <div className="kinoma-welcome__grain" aria-hidden="true" />

      <header className="kinoma-welcome__header">
        <Link href="/" aria-label="Panda.fun"><KinomaLogo size="md" variant="full" /></Link>
      </header>

      <main>
        <section className="kinoma-welcome__hero" aria-labelledby="welcome-title">
          <div className="kinoma-welcome__art">
            <motion.div initial={{ opacity: 0, y: 30, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="kinoma-welcome__art-frame">
              <div className="kinoma-welcome__art-glow" /><img src={WELCOME_IMAGE_URL} alt="Panda.fun streaming artwork" fetchPriority="high" decoding="async" referrerPolicy="no-referrer" /><div className="kinoma-welcome__art-vignette" />
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} className="kinoma-welcome__copy">
            <p className="kinoma-welcome__eyebrow"><Sparkles className="h-3.5 w-3.5" />YOUR NEXT STORY STARTS HERE</p>
            <h1 id="welcome-title">Find something<span>worth watching.</span></h1>
            <p className="kinoma-welcome__description">A beautiful home for the stories you love. Discover anime, movies and series without getting in the way of the experience.</p>
            <div className="kinoma-welcome__actions">
              <CartoonButton href="/home"><Play className="h-4 w-4 fill-current" />Go to homepage</CartoonButton>
              <a href="#questions" className="kinoma-welcome__scroll-link">Common questions<ChevronDown className="h-3.5 w-3.5" /></a>
            </div>
          </motion.div>
        </section>

        <section id="questions" className="kinoma-welcome__faq" aria-labelledby="questions-title">
          <div className="kinoma-welcome__faq-heading"><p>BEFORE YOU ENTER</p><h2 id="questions-title">A few quick answers.</h2><span>Scroll through the essentials, then step into Panda.fun.</span></div>
          <div className="kinoma-welcome__faq-list">
            {FAQ.map((item, index) => {
              const isOpen = openFaq === index;
              const faqContent = (
                <>
                  <span className="kinoma-welcome__faq-number">0{index + 1}</span>
                  <span className="kinoma-welcome__faq-content"><strong>{item.question}</strong><span className="kinoma-welcome__faq-answer"><span>{item.answer}</span></span></span>
                  <ChevronDown className="kinoma-welcome__faq-chevron" />
                </>
              );

              return <button key={item.question} type="button" className={`kinoma-welcome__faq-item ${isOpen ? 'is-open' : ''}`} onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen}>
                {faqContent}
              </button>;
            })}
          </div>
          <Link href="/terms" className="kinoma-welcome__terms-link">Read Terms of Service <span aria-hidden="true">→</span></Link>
        </section>

        <section className="kinoma-welcome__final" aria-labelledby="final-title">
          <p>READY?</p><h2 id="final-title">Let's watch something.</h2>
          <CartoonButton href="/home"><Play className="h-4 w-4 fill-current" />Enter Panda.fun</CartoonButton>
        </section>
      </main>

      <footer className="kinoma-welcome__footer">
        <KinomaLogo size="sm" variant="full" /><span>Stories, in motion.</span>
      </footer>
    </div>
  );
}
