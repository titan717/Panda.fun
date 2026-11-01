import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Pressable, Reveal } from './primitives';

describe('motion primitives render behavior', () => {
  it('renders Reveal content and preserves its semantic child', () => {
    const markup = renderToStaticMarkup(
      <Reveal className="test-reveal"><span>Featured title</span></Reveal>
    );
    expect(markup).toContain('class="test-reveal"');
    expect(markup).toContain('<span>Featured title</span>');
  });

  it('renders Pressable as a native button with its label and disabled state', () => {
    const markup = renderToStaticMarkup(
      <Pressable disabled className="test-pressable">Play title</Pressable>
    );
    expect(markup).toContain('<button');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Play title');
  });

  it('keeps Pressable enabled when not disabled', () => {
    const markup = renderToStaticMarkup(<Pressable>My List</Pressable>);
    expect(markup).toContain('My List');
    expect(markup).not.toContain('disabled=""');
  });
});
