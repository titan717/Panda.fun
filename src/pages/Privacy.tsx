import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { updateSEO } from '../lib/seo';

const sections = [
  {
    title: '1. About MyPanda',
    body: <>
      <p>MyPanda is an entertainment discovery and streaming-interface platform. The Service may display information about movies, television shows, episodes, artwork, descriptions, ratings, and other entertainment-related information obtained from public or third-party sources.</p>
      <p><strong>MyPanda does not host, upload, store, or distribute copyrighted video files or other media files on its own servers.</strong> Where the Service provides access to video playback, the actual media may be delivered by external third-party services. Your interaction with those services is subject to their own privacy policies and terms.</p>
    </>
  },
  {
    title: '2. Information We Collect',
    body: <>
      <h3>2.1 Account information</h3>
      <p>If you choose to create an account, we may collect your email address, username or display name, authentication information, basic profile information provided by an authentication provider, and account preferences. Passwords, where applicable, are not intended to be stored in plain text.</p>
      <h3>2.2 My List and library information</h3>
      <p>Features such as My List may store title identifiers, artwork references, basic title metadata, and information needed to remember items you have added. Some library information may be stored locally in your browser rather than on our servers.</p>
      <h3>2.3 Watch history and Continue Watching</h3>
      <p>Where available, watch history and viewing-progress features may store title identifiers, season and episode information, playback progress, and basic title information required to display your history.</p>
      <h3>2.4 Technical information</h3>
      <p>Our infrastructure or third-party providers may process IP address, browser and operating-system information, device type, language and regional settings, referring page, requested routes, request times, and basic diagnostic or error information.</p>
    </>
  },
  {
    title: '3. Local Storage, Cookies and Similar Technologies',
    body: <p>MyPanda may use Local Storage, Session Storage, cookies, and similar browser technologies to remember preferences, watchlists, viewing history, playback progress, session information, and application settings. Some information may never leave your device. You can remove locally stored information through your browser settings, although doing so may reset certain MyPanda features.</p>
  },
  {
    title: '4. Analytics',
    body: <p>MyPanda may use analytics technologies, including Google Analytics, to understand how the Service is used. Analytics may process information such as pages viewed, navigation and interaction events, device and browser information, approximate geographic information, referral information, and performance data. Analytics helps us improve usability, reliability, and performance. Analytics providers process information according to their own policies.</p>
  },
  {
    title: '5. Third-Party Services',
    body: <p>MyPanda may rely on external providers for hosting, authentication, content and metadata, analytics, images, video playback, search, security, error monitoring, and other technical services. These providers may independently process information when you interact with their services. We do not control their privacy practices and recommend reviewing their applicable privacy policies.</p>
  },
  {
    title: '6. Third-Party Media and Video Playback',
    body: <>
      <p><strong>MyPanda does not host or store video content made available through external playback services.</strong> When you select a title for playback, your browser may connect directly to an external media provider.</p>
      <p>That provider may therefore receive technical information such as your IP address, browser and device information, requested content, and connection information. This processing is controlled by the third-party provider. MyPanda cannot control or guarantee the privacy, security, availability, or retention practices of external media providers.</p>
    </>
  },
  {
    title: '7. Content and Metadata Sources',
    body: <p>MyPanda may display movie and television titles, descriptions, release dates, genres, ratings, episode information, artwork, posters, backdrops, and other metadata obtained from public databases, APIs, and third-party sources. The availability and accuracy of this information may change without notice, and third-party sources may apply their own privacy policies and terms.</p>
  },
  {
    title: '8. How We Use Information',
    body: <ul>
      <li>Provide, maintain, and improve the Service.</li>
      <li>Create and manage accounts and requested features.</li>
      <li>Remember preferences, My List items, and viewing progress.</li>
      <li>Improve search, discovery, and recommendations.</li>
      <li>Diagnose technical problems and monitor performance.</li>
      <li>Detect and prevent abuse, fraud, and unauthorized access.</li>
      <li>Protect the security and integrity of MyPanda.</li>
      <li>Respond to support and privacy requests.</li>
      <li>Comply with applicable legal obligations.</li>
    </ul>
  },
  {
    title: '9. Data Sharing',
    body: <p>We do not sell, rent, or trade your personal information to third parties for their own direct marketing purposes. We may share or permit access to information with service providers where reasonably necessary to operate MyPanda. We may also disclose information when reasonably necessary to comply with law, respond to valid legal process, protect rights or safety, investigate security incidents, prevent fraud or abuse, or enforce our policies.</p>
  },
  {
    title: '10. Data Retention',
    body: <p>We retain information only for as long as reasonably necessary for the purposes described in this Policy, unless a longer period is required or permitted by law. Account information may be retained while an account is active; locally stored information may remain on your device until you remove it; and technical or analytics information may be retained according to operational and provider requirements. When information is no longer required, it may be deleted, anonymized, or securely disposed of.</p>
  },
  {
    title: '11. Data Security',
    body: <p>We take reasonable measures to protect information processed through MyPanda, which may include HTTPS/TLS, access controls, authentication protections, secure infrastructure practices, monitoring, and security updates. However, no website, database, or internet transmission can be guaranteed to be completely secure. You should also use strong, unique passwords and keep your devices and browsers updated.</p>
  },
  {
    title: "12. Children's Privacy",
    body: <p>MyPanda does not knowingly request unnecessary personal information from children. If you believe a child has provided personal information in circumstances where collection was not appropriate, please contact us so we can review the situation and take appropriate action, subject to applicable law.</p>
  },
  {
    title: '13. Your Privacy Choices',
    body: <ul>
      <li>Choose whether to create an account.</li>
      <li>Remove titles from My List.</li>
      <li>Clear locally stored watch history and preferences.</li>
      <li>Clear cookies or browser storage.</li>
      <li>Choose whether to interact with third-party playback services.</li>
      <li>Request deletion of account information, where applicable.</li>
      <li>Request information about personal data associated with your account.</li>
    </ul>
  },
  {
    title: '14. Data Deletion Requests',
    body: <p>If you have an account and want to request deletion of your account or personal information, contact us through our designated contact method. We may need to verify account ownership before processing a request. Information required or permitted to be retained by law, or maintained independently by third-party providers, may not be immediately removable through MyPanda.</p>
  },
  {
    title: '15. International Data Processing',
    body: <p>Depending on the infrastructure and third-party services used by MyPanda, information may be processed or stored in countries other than the country where you live. Different countries have different data-protection laws. Where applicable, we take reasonable steps to use appropriate safeguards and comply with relevant requirements.</p>
  },
  {
    title: '16. External Links and Services',
    body: <p>MyPanda may contain links, embedded content, or integrations operated by third parties. Once you interact directly with an external service, its own privacy policy and terms may apply. We are not responsible for the privacy practices, content, security, or policies of external websites and services.</p>
  },
  {
    title: '17. Do Not Track',
    body: <p>Some browsers provide a “Do Not Track” setting. Because there is no universally accepted technical standard for responding to every Do Not Track signal, MyPanda may not respond to all such signals in a uniform manner. Where applicable law requires a particular response, we will follow those requirements.</p>
  },
  {
    title: '18. Legal Basis for Processing',
    body: <p>Where applicable law requires a legal basis for processing personal information, the basis may include your consent, performance of a requested service or contract, our legitimate interests in operating and securing MyPanda, or compliance with legal obligations. The applicable basis depends on the type of information and circumstances.</p>
  },
  {
    title: '19. Changes to This Privacy Policy',
    body: <p>We may update this Policy to reflect changes to MyPanda, new features, third-party services, applicable law, security requirements, or our data practices. We will update the “Last updated” date when changes are made and may provide additional notice where appropriate. Continued use of MyPanda after an updated Policy becomes effective constitutes acknowledgment of the updated Policy to the extent permitted by law.</p>
  },
  {
    title: '20. Contact Us',
    body: <p>If you have questions, concerns, or requests relating to this Privacy Policy or your personal information, please contact MyPanda through our designated contact form or privacy contact channel. Please provide enough information for us to understand your request. We may request additional information to verify your identity or protect your account.</p>
  },
  {
    title: '21. Important Third-Party Content Notice',
    body: <>
      <p>MyPanda is an entertainment discovery and streaming interface.</p>
      <p><strong>MyPanda does not host, upload, or store video files, movies, television episodes, or other media files on its own servers.</strong> Titles, descriptions, artwork, metadata, and other information may be obtained from public databases, APIs, and third-party services.</p>
      <p>Where playback is provided through an external service, the media is delivered by that service rather than hosted by MyPanda. Because external services operate independently, they may collect IP addresses, device information, connection information, or other technical data when your browser connects to them.</p>
    </>
  },
  {
    title: '22. Acceptance of This Policy',
    body: <p>By accessing or using MyPanda, you acknowledge that you have had the opportunity to review this Privacy Policy and understand how information may be processed in connection with the Service. If you do not agree with this Policy, you should discontinue use of MyPanda.</p>
  },
];

export function Privacy() {
  useEffect(() => {
    updateSEO({
      title: 'Privacy Policy',
      description: 'Read the MyPanda Privacy Policy.',
      canonicalUrl: window.location.origin + '/privacy-policy',
      type: 'website',
    });
  }, []);

  return (
    <div className="kinoma-terms kinoma-privacy-page">
      <header className="kinoma-terms__header">
        <Link href="/home" aria-label="Back to MyPanda home" className="kinoma-terms__brand">
          <span className="kinoma-privacy-page__brand-mark"><ShieldCheck size={18} /></span>
          <span className="kinoma-privacy-page__brand-name">MYPANDA</span>
        </Link>
        <Link href="/home" className="kinoma-terms__back">
          <ArrowLeft className="h-4 w-4" />
          Back to MyPanda
        </Link>
      </header>

      <main className="kinoma-terms__main">
        <div className="kinoma-terms__intro">
          <div className="kinoma-terms__icon" aria-hidden="true"><ShieldCheck className="h-5 w-5" /></div>
          <p>LEGAL / PRIVACY</p>
          <h1>Privacy Policy</h1>
          <span>Last updated: October 7, 2026 · How MyPanda handles information across the service.</span>
        </div>

        <article className="kinoma-terms__document">
          {sections.map((section, index) => (
            <section key={section.title} className="kinoma-terms__section">
              <div className="kinoma-terms__number">{String(index + 1).padStart(2, '0')}</div>
              <div>
                <h2>{section.title.replace(/^\\d+\\.\\s*/, '')}</h2>
                <div className="kinoma-privacy-page__body">{section.body}</div>
              </div>
            </section>
          ))}
        </article>
      </main>

      <footer className="kinoma-terms__footer">
        <span>MyPanda Privacy Policy</span>
        <Link href="/home">Home</Link>
      </footer>
    </div>
  );
}
