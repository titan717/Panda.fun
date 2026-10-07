import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, FileText } from 'lucide-react';
import { KinomaLogo } from '../components/ui/KinomaLogo';
import { updateSEO } from '../lib/seo';

const SECTIONS = [
  ['About MyPanda', 'MyPanda is an entertainment discovery and streaming-interface platform. The Service may provide movie and television information, artwork, descriptions, ratings, episode information, search and discovery features, watchlists, viewing history, personalization, and access to third-party playback services. MyPanda does not host, upload, or store copyrighted video files on its own servers.'],
  ['Acceptance of These Terms', 'By accessing or using MyPanda, including its website, web application, features, and related services (collectively, the “Service”), you agree to these Terms of Service (“Terms”). If you do not agree, you must not use the Service. If you use MyPanda on behalf of another person or organization, you represent that you have authority to accept these Terms on their behalf.'],
  ['Eligibility', 'You may use MyPanda only if you are legally permitted to do so under the laws applicable to you. Certain features may have additional age, account, geographic, or eligibility requirements. You are responsible for ensuring that your use of the Service is lawful in your location.'],
  ['Accounts and Security', 'Some features may require an account. You agree to provide reasonably accurate information and keep it current. You are responsible for activity performed through your account and for protecting your credentials. Do not knowingly allow unauthorized access. If you believe your account has been compromised, take reasonable steps to secure it and contact MyPanda through the available support channel.'],
  ['My List, Watch History, and Personalization', 'MyPanda may provide My List, watch history, Continue Watching, search history, preferences, and personalized recommendations. These features may use browser storage or information associated with your account. Clearing browser storage, signing out, or deleting an account may affect this information. Recommendations are provided for convenience and are not guaranteed to accurately reflect your interests.'],
  ['Third-Party Content and Services', 'MyPanda may display or connect to content, metadata, artwork, links, APIs, databases, hosting infrastructure, analytics tools, authentication services, and playback services operated by third parties. Third-party services are independent from MyPanda and may have their own terms, privacy policies, availability, restrictions, and content rules.'],
  ['Third-Party Media and Playback', 'MyPanda does not host, upload, or store video files, movies, television episodes, or other third-party media files on its own servers. Where playback is available, media may be delivered directly by an external provider. Your browser may connect directly to that provider, which may independently process technical information such as your IP address, browser, device, connection information, and requested content. MyPanda does not control third-party playback providers or guarantee their content, availability, privacy practices, security, or policies.'],
  ['Content Availability and Accuracy', 'Titles, descriptions, artwork, ratings, release information, episode data, and other metadata may come from third-party sources and may contain errors or become unavailable. MyPanda does not guarantee that any particular title, episode, image, description, rating, stream, or feature will be available at any particular time or location. Availability may vary because of licensing, geography, third-party decisions, network conditions, or technical limitations.'],
  ['Acceptable Use', 'You agree to use MyPanda only for lawful purposes and without interfering with the Service or the rights of others. You must not attempt unauthorized access; bypass security or access controls; probe or test infrastructure without authorization; introduce malicious code; overload or disrupt the Service; scrape or automate access in a manner that materially harms the Service; impersonate another person or service; distribute malware, phishing content, spam, or harmful material; or use MyPanda to facilitate unlawful activity.'],
  ['Intellectual Property', 'The MyPanda name, branding, interface design, original graphics, software, documentation, and other MyPanda-created materials are protected by applicable intellectual-property laws. Except as expressly permitted by these Terms or applicable law, you may not copy, modify, reproduce, distribute, sell, license, publicly display, reverse engineer, or create derivative works from MyPanda proprietary materials. Third-party names, logos, artwork, metadata, and other materials remain the property of their respective owners.'],
  ['User-Provided Information', 'If MyPanda permits you to submit profile information, feedback, reports, or other material, you remain responsible for what you submit. Do not submit unlawful, infringing, defamatory, fraudulent, malicious, or otherwise harmful material, or information you do not have the right to provide. Feedback and suggestions may be used by MyPanda to operate, maintain, and improve the Service without an obligation to compensate you, unless applicable law requires otherwise.'],
  ['Service Changes and Availability', 'MyPanda may add, modify, suspend, restrict, or discontinue features or portions of the Service at any time. We may impose reasonable limits where necessary for security, reliability, capacity, or operational reasons. The Service may be unavailable because of maintenance, updates, outages, network problems, infrastructure failures, or third-party interruptions. We do not guarantee uninterrupted or error-free operation.'],
  ['Beta and Experimental Features', 'MyPanda may offer beta, preview, experimental, or unfinished features. Such features may change, contain errors, have limited availability, or be removed without notice. Unless expressly stated otherwise, they are provided on an as-available basis and should not be relied upon for critical purposes.'],
  ['Privacy', 'Your use of MyPanda is also subject to the MyPanda Privacy Policy, which explains how information may be collected, used, stored, and shared. Third-party services may independently process information when you interact with them.'],
  ['Security', 'We take reasonable measures to protect the Service and information processed through it. However, no internet service, application, account, or transmission can be guaranteed completely secure. You must not defeat or circumvent security measures. Security concerns should be reported through the available contact channel rather than exploited.'],
  ['External Links and Services', 'MyPanda may contain links or integrations leading to third-party websites and services. We do not control those services and are not responsible for their content, security, availability, policies, or practices. Your interaction with them is at your discretion and may be governed by their separate terms and privacy policies.'],
  ['Disclaimers', 'To the maximum extent permitted by applicable law, MyPanda and the Service are provided on an “as is” and “as available” basis, without warranties except where a warranty cannot lawfully be excluded. We do not warrant that the Service will be uninterrupted, timely, secure, accurate, complete, reliable, compatible with every device or browser, or free from errors or harmful components. We make no guarantee regarding third-party content, metadata, external services, or playback availability.'],
  ['Limitation of Liability', 'To the maximum extent permitted by applicable law, MyPanda and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or similar damages arising from your use of, or inability to use, the Service. This may include loss of data, profits, goodwill, service interruption, device damage, or losses arising from third-party services, content, links, or playback. Nothing in these Terms limits liability that cannot lawfully be limited.'],
  ['Indemnification', 'To the extent permitted by applicable law, you agree to defend, indemnify, and hold harmless MyPanda and its operators from claims, liabilities, damages, losses, and reasonable expenses arising from your unlawful use of the Service, violation of these Terms, or infringement of another person’s rights. This does not apply where such an obligation would be prohibited by applicable law.'],
  ['Suspension and Termination', 'You may stop using MyPanda at any time. MyPanda may suspend or terminate access to the Service or particular features when reasonably necessary to protect the Service, users, third parties, or our legal rights; address abuse or security issues; or respond to a material violation of these Terms. Provisions that by their nature should survive termination will survive.'],
  ['Geographic and Legal Restrictions', 'Certain content or services may be unavailable in particular countries, regions, or territories. You are responsible for complying with the laws applicable where you access MyPanda. MyPanda does not represent that every feature or item of content is lawful or available in every jurisdiction.'],
  ['Copyright and Intellectual-Property Concerns', 'If you believe material accessible through MyPanda infringes your copyright or other intellectual-property rights, please provide a sufficiently detailed report through the available contact channel. Identify the relevant material and explain the basis for your claim. Where appropriate, MyPanda may restrict or remove links or references within its control. Material controlled by an independent third party may need to be addressed directly with that provider.'],
  ['Children', 'MyPanda is not intended to knowingly collect personal information from children in violation of applicable privacy laws. Parents and legal guardians are responsible for supervising minors’ use of internet services and determining whether content available through MyPanda is appropriate for them.'],
  ['Changes to These Terms', 'We may update these Terms to reflect changes to MyPanda, new features, legal requirements, security considerations, or operational practices. When material changes are made, we may update the “Last updated” date and, where appropriate, provide additional notice. Continued use after updated Terms become effective constitutes acceptance to the extent permitted by applicable law.'],
  ['Governing Law', 'These Terms are intended to be interpreted in accordance with the laws applicable to the relationship between you and MyPanda, subject to mandatory consumer-protection and other legal requirements that apply to you. Nothing here is intended to remove rights or protections that cannot lawfully be waived.'],
  ['Severability and No Waiver', 'If any provision is invalid, unlawful, or unenforceable, it will be enforced to the maximum extent permitted by law and the remaining provisions will continue in effect. If MyPanda does not immediately enforce a provision, that does not waive the right to enforce it later.'],
  ['Entire Agreement', 'These Terms, together with the MyPanda Privacy Policy and any additional terms expressly presented for specific features, constitute the agreement governing your use of the Service, except where applicable law requires otherwise. Feature-specific terms control only for that feature to the extent of a conflict.'],
  ['Contact', 'If you have questions about these Terms, want to report a legal or intellectual-property concern, or need to contact MyPanda about the Service, please use the contact method made available through MyPanda. Do not include unnecessary sensitive personal information in a general support or legal request.'],
  ['Final Notice', 'MyPanda is an entertainment discovery and streaming interface. Third-party content, metadata, links, and playback services may operate independently from MyPanda. By using MyPanda, you acknowledge these limitations and agree to use the Service responsibly, lawfully, and in accordance with these Terms.']
] as const;

export function Terms() {
  useEffect(() => {
    updateSEO({
      title: 'Terms of Service',
      description: 'Read the MyPanda Terms of Service and usage guidelines.',
      canonicalUrl: window.location.origin + '/terms',
      type: 'website',
      image: '/icon.svg',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'MyPanda Terms of Service',
        url: window.location.origin + '/terms',
        description: 'MyPanda Terms of Service and usage guidelines.'
      }
    });
  }, []);

  return (
    <div className="kinoma-terms">
      <header className="kinoma-terms__header">
        <Link href="/home" aria-label="Back to MyPanda home" className="kinoma-terms__brand">
          <KinomaLogo size="md" variant="full" />
        </Link>
        <Link href="/home" className="kinoma-terms__back">
          <ArrowLeft className="h-4 w-4" />
          Back to MyPanda
        </Link>
      </header>
      <main className="kinoma-terms__main">
        <div className="kinoma-terms__intro">
          <div className="kinoma-terms__icon" aria-hidden="true"><FileText className="h-5 w-5" /></div>
          <p>LEGAL</p>
          <h1>Terms of Service</h1>
          <span>Last updated: October 7, 2026 · The rules for using MyPanda.</span>
        </div>
        <article className="kinoma-terms__document">
          {SECTIONS.map(([title, body], index) => (
            <section key={title} className="kinoma-terms__section">
              <div className="kinoma-terms__number">{String(index + 1).padStart(2, '0')}</div>
              <div><h2>{title}</h2><p>{body}</p></div>
            </section>
          ))}
        </article>
      </main>
      <footer className="kinoma-terms__footer">
        <KinomaLogo size="sm" variant="full" />
        <span>MyPanda Terms of Service</span>
        <Link href="/home">Home</Link>
      </footer>
    </div>
  );
}
