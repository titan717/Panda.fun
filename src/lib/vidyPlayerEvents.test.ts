import { describe, expect, it } from 'vitest';
import { VIDY_ORIGIN, parseVidyPlaybackMessage } from './vidyPlayerEvents';

function message(
  data: unknown,
  source: Window,
  origin = VIDY_ORIGIN
) {
  return {
    data,
    source,
    origin,
  } as MessageEvent<unknown>;
}

describe('parseVidyPlaybackMessage', () => {
  it('accepts a valid Vidy timeupdate from the mounted iframe', () => {
    const source = {} as Window;

    expect(parseVidyPlaybackMessage(
      message(JSON.stringify({
        event: 'timeupdate',
        currentTime: 142.25,
        duration: 1532,
      }), source),
      source,
    )).toEqual({
      event: 'timeupdate',
      currentTime: 142.25,
      duration: 1532,
    });
  });

  it('rejects messages from another origin or window', () => {
    const source = {} as Window;

    expect(parseVidyPlaybackMessage(
      message(JSON.stringify({ event: 'play', currentTime: 10, duration: 100 }), source, 'https://attacker.example'),
      source,
    )).toBeNull();

    expect(parseVidyPlaybackMessage(
      message(JSON.stringify({ event: 'play', currentTime: 10, duration: 100 }), {} as Window),
      source,
    )).toBeNull();
  });

  it('ignores malformed or unsupported messages', () => {
    const source = {} as Window;

    expect(parseVidyPlaybackMessage(message('{not-json', source), source)).toBeNull();
    expect(parseVidyPlaybackMessage(
      message(JSON.stringify({ type: 'MEDIA_DATA', data: 'history' }), source),
      source,
    )).toBeNull();
  });

  it('normalizes invalid timing values instead of persisting NaN', () => {
    const source = {} as Window;

    expect(parseVidyPlaybackMessage(
      message(JSON.stringify({ event: 'pause', currentTime: 'bad', duration: -1 }), source),
      source,
    )).toEqual({
      event: 'pause',
      currentTime: 0,
      duration: 0,
    });
  });
});
