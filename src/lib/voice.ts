/** Voice search via the Web Speech API where the platform provides it (spec 8.1, 13.1). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const Ctor: RecognitionCtor | undefined = typeof window !== "undefined"
  ? ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)
  : undefined;

export const voiceSupported = Boolean(Ctor);

export function listen(onText: (t: string) => void, onState: (listening: boolean) => void, onError: (msg: string) => void) {
  if (!Ctor) return () => {};
  const r = new Ctor();
  r.lang = navigator.language || "en-IN";
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i]?.[0]?.transcript ?? "";
    onText(text);
  };
  r.onerror = (e) => onError(e.error === "not-allowed" ? "Microphone permission was denied." : "Didn't catch that. Try again.");
  r.onend = () => onState(false);
  onState(true);
  try { r.start(); } catch { onState(false); }
  return () => { try { r.abort(); } catch { /* already stopped */ } };
}
