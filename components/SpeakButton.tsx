"use client";

import { useEffect, useState } from "react";
import { Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { speak, cancelSpeech, type TtsProvider } from "./voice-tts";

export default function SpeakButton({
  text,
  lang,
}: {
  text: string;
  lang: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [provider, setProvider] = useState<TtsProvider | null>(null);

  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, []);

  function toggle() {
    if (speaking) {
      cancelSpeech();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(
      text,
      lang,
      () => setSpeaking(false),
      (p) => {
        setProvider(p);
        console.info("TTS provider:", p);
      }
    );
  }

  const providerLabel = provider === "ai-gateway" ? " (OpenAI)" : provider === "google" ? " (Google)" : "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggle}
          aria-label={speaking ? "Hentikan suara" : "Putar suara"}
        >
          {speaking ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{speaking ? "Hentikan" : `Dengarkan${providerLabel}`}</TooltipContent>
    </Tooltip>
  );
}
