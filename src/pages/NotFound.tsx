import { Link } from 'wouter';
import { Home, Search } from 'lucide-react';

export function NotFound() {
  return (
    <div className="panda-not-found">
      <div className="panda-not-found__inner">
        <span className="panda-not-found__code" aria-hidden="true">404</span>
        <h1>Page not found</h1>
        <p>The Panda wandered somewhere else. The link may be old, or the title may have moved.</p>
        <div className="panda-not-found__actions">
          <Link href="/home" className="panda-ux-button panda-ux-button--primary"><Home size={17} aria-hidden="true" />Back to Home</Link>
          <Link href="/search" className="panda-ux-button"><Search size={17} aria-hidden="true" />Search titles</Link>
        </div>
      </div>
    </div>
  );
}
