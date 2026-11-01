import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';
import { updateSEO } from '../lib/seo';

export function About() {
  useEffect(() => {
    updateSEO({
      title: 'About',
      description: 'Learn about Panda.fun and its anime streaming experience.',
      type: 'website',
    });
  }, []);

  return (
    <div className="min-h-[70vh] w-full bg-[var(--kinoma-bg)] text-white">
      <section className="mx-auto flex w-full max-w-5xl flex-col px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/60">
            <Sparkles className="h-3.5 w-3.5" />
            About Panda.fun
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Anime discovery, built around your watch.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
            Panda.fun brings anime discovery, watch history, personal lists, airing updates,
            and playback together in one focused streaming experience.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <ShieldCheck className="h-5 w-5 text-white/70" />
            <h2 className="mt-4 text-lg font-bold">Your library, your way</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Keep track of progress, watchlists, favorites, and completed titles from one place.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <Sparkles className="h-5 w-5 text-white/70" />
            <h2 className="mt-4 text-lg font-bold">Made for discovery</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Browse popular, trending, airing, genre-based, and movie catalogs without clutter.
            </p>
          </div>
        </div>

        <Link
          href="/home"
          className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-white/90 kinoma-focus"
        >
          Back to home
          <ChevronRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
