import { useRouteStore } from "@/stores/routeStore";
import { useEffect, useState, useRef } from "react";

const words = ["Hello.", "你好。", "こんにちは。", "안녕하세요。", "Bonjour."];

function TypewriterText() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const word = words[wordIndex];

    if (!isDeleting) {
      if (displayed.length < word.length) {
        timerRef.current = setTimeout(() => {
          setDisplayed(word.slice(0, displayed.length + 1));
        }, 120);
      } else {
        timerRef.current = setTimeout(() => setIsDeleting(true), 1800);
      }
    } else {
      if (displayed.length > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1));
        }, 60);
      } else {
        setIsDeleting(false);
        setWordIndex((i) => (i + 1) % words.length);
      }
    }

    return () => clearTimeout(timerRef.current);
  }, [displayed, isDeleting, wordIndex]);

  return (
    <span className="inline-block min-w-[200px] text-center">
      {displayed}
      <span className="inline-block w-[2px] h-[1em] bg-foreground/60 ml-0.5 align-middle animate-pulse" />
    </span>
  );
}

export function Oobe() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <div className="h-full flex flex-col items-center justify-center relative">
      {/* 中心动画文字 */}
      <div className="text-5xl font-bold tracking-tight text-foreground">
        <TypewriterText />
      </div>

      {/* 下方按钮 */}
      <div className="absolute bottom-12">
        <button
          onClick={() => navigate("oobe/language")}
          className="w-12 h-12 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] flex items-center justify-center text-foreground/60 hover:text-foreground transition-all duration-200 text-xl"
        >
          →
        </button>
      </div>
    </div>
  );
}
