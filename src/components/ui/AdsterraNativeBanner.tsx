import React, { useEffect, useRef } from 'react';

const AD_SCRIPT_SRC = 'https://bancadeltempoidea.org/21/6df6ca997a2cedc834d9e9ff47e0fc7c';
const AD_CONTAINER_ID = 'container-6df6ca997a2cedc834d9e9ff47e0fc7c';

export function AdsterraNativeBanner() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || loadedRef.current) return;

    loadedRef.current = true;
    const container = document.createElement('div');
    container.id = AD_CONTAINER_ID;
    container.className = 'panda-adsterra__unit';
    root.appendChild(container);

    const script = document.createElement('script');
    script.async = true;
    script.src = AD_SCRIPT_SRC;
    script.setAttribute('data-cfasync', 'false');
    root.insertBefore(script, container);

    return () => {
      script.remove();
      container.remove();
      loadedRef.current = false;
    };
  }, []);

  return (
    <aside className="panda-adsterra" aria-label="Sponsored">
      <div className="panda-adsterra__label">SPONSORED</div>
      <div ref={rootRef} className="panda-adsterra__surface" />
    </aside>
  );
}
