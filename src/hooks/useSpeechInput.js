// Ditado pelo microfone com a Web Speech API (SpeechRecognition). Cada trecho
// reconhecido como final vai para `onFinal` (a tela junta ao rascunho, que
// continua editável antes do envio); o trecho ainda provisório fica em
// `interim`. Sem suporte no navegador (ex.: Firefox), `supported` = false e a
// tela fica só com a digitação.

import { useCallback, useEffect, useRef, useState } from "react";

function recognitionClass() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const ERROR_MESSAGES = {
  "not-allowed": "Permita o uso do microfone no navegador para ditar sua fala.",
  "service-not-allowed": "Permita o uso do microfone no navegador para ditar sua fala.",
  "audio-capture": "Nenhum microfone encontrado. Verifique o dispositivo ou digite sua fala.",
  network: "O ditado precisa de conexão com a internet. Você pode digitar sua fala.",
};

export function useSpeechInput({ lang = "pt-BR", onFinal }) {
  const Recognition = recognitionClass();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null); // mensagem pronta para a UI
  const recRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return;
    const rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let pendingText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalRef.current?.(r[0].transcript.trim());
        else pendingText += r[0].transcript;
      }
      setInterim(pendingText);
    };
    // "no-speech" e "aborted" são normais (silêncio, parada manual).
    rec.onerror = (e) => setError(ERROR_MESSAGES[e.error] ?? null);
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
    };
    setError(null);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [Recognition, lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported: Boolean(Recognition), listening, interim, error, start, stop };
}
