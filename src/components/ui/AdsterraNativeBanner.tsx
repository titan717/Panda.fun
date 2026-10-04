import React, { useEffect, useRef, useState } from 'react';

const AD_SCRIPT_SRC = 'https://bancadeltempoidea.org/21/6df6ca997a2cedc834d9e9ff47e0fc7c';
const AD_CONTAINER_ID = 'container-6df6ca997a2cedc834d9e9ff47e0fc7c';

export function AdsterraNativeBanner() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hasAdContent, setHasAdContent] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const container = document.createElement('div');
    container.id = AD_CONTAINER_ID;
    container.className = 'panda-adsterra__unit';

    const script = document.createElement('script');
    script.async = true;
    script.src = AD_SCRIPT_SRC;
    script.setAttribute('data-cfasync', 'false');

    root.appendChild(script);
    root.appendChild(container);

    const observer = new MutationObserver(() => {
      setHasAdContent(container.childNodes.length > 0);
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      script.remove();
      container.remove();
      setHasAdContent(false);
    };
  }, []);

  return (
    <aside
      className={`panda-adsterra${hasAdContent ? ' is-loaded' : ''}`}
      aria-label="Sponsored"
      aria-hidden={!hasAdContent}
    >
      <div className="panda-adsterra__label">SPONSORED</div>
      <div ref={rootRef} className="panda-adsterra__surface" />
    </aside>
  );
}
