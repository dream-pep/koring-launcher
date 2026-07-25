import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  requestDeviceCode,
  pollForToken,
  type KoringUser,
} from "@/api/koring-auth";
import { useKoringAuthStore } from "@/stores/koringAuthStore";
import { Loader2, CheckCircle2, Copy, ExternalLink } from "lucide-react";

type Step = "loading" | "scan" | "polling" | "success" | "error";

interface KoringLoginProps {
  onLoginSuccess?: (user: KoringUser) => void;
}

export function KoringLogin({ onLoginSuccess }: KoringLoginProps) {
  const [step, setStep] = useState<Step>("loading");
  const [userCode, setUserCode] = useState("");
  const [verifyUri, setVerifyUri] = useState("");
  const [verifyUriComplete, setVerifyUriComplete] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setUser = useKoringAuthStore((s) => s.setUser);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Auto-start on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await requestDeviceCode();
        if (cancelled) return;
        setUserCode(res.user_code);
        setVerifyUri(res.verification_uri);
        setVerifyUriComplete(res.verification_uri_complete);
        setStep("scan");
        startPolling(res.device_code, res.expires_in, cancelled);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "请求设备码失败");
          setStep("error");
        }
      }
    })();
    return () => { cancelled = true; cleanup(); };
  }, []);

  const startPolling = (deviceCode: string, expires: number, cancelled: boolean) => {
    setStep("polling");
    const startTime = Date.now();
    pollRef.current = setInterval(async () => {
      if (cancelled) { cleanup(); return; }
      if (Date.now() - startTime > expires * 1000) {
        cleanup();
        setError("二维码已过期，请重新获取");
        setStep("error");
        return;
      }
      try {
        const result = await pollForToken(deviceCode);
        if (cancelled) return;
        cleanup();
        setUser(result.user);
        setStep("success");
        onLoginSuccess?.(result.user);
      } catch (e: any) {
        if (e.message !== "authorization_pending" && e.message !== "slow_down") {
          if (!cancelled) {
            cleanup();
            setError(e.message || "验证失败");
            setStep("error");
          }
        }
      }
    }, 5000);
  };

  const retry = async () => {
    setStep("loading");
    setError("");
    try {
      const res = await requestDeviceCode();
      setUserCode(res.user_code);
      setVerifyUri(res.verification_uri);
      setVerifyUriComplete(res.verification_uri_complete);
      setStep("scan");
      startPolling(res.device_code, res.expires_in, false);
    } catch (e: any) {
      setError(e.message || "请求设备码失败");
      setStep("error");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openVerify = () => {
    window.electronAPI?.openExternal(verifyUri);
  };

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
        <span className="text-sm text-muted-foreground">正在获取设备码...</span>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={retry}
          className="px-4 py-1.5 rounded-md text-[13px] font-medium bg-foreground/[0.06] hover:bg-foreground/[0.12] text-foreground/60 hover:text-foreground transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR Code */}
      <div className="p-3 bg-white rounded-xl">
        <QRCodeSVG value={verifyUriComplete} size={160} level="M" />
      </div>

      {/* 提示文字 */}
      <p className="text-sm text-muted-foreground text-center leading-relaxed">
        请使用任意二维码扫描器打开
        <br />
        或访问以下链接并输入验证码
      </p>

      {/* 验证链接 */}
      <button
        onClick={openVerify}
        className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
      >
        {verifyUri}
        <ExternalLink className="w-3 h-3" />
      </button>

      {/* 用户码 */}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground">
          {userCode}
        </span>
        <button
          onClick={copyCode}
          className="p-1.5 rounded-md hover:bg-foreground/[0.06] transition-colors"
          title="复制验证码"
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-foreground/40" />
          )}
        </button>
      </div>

      {/* 轮询状态 */}
      {step === "polling" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          等待验证中...
        </div>
      )}

      {step === "success" && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          登录成功
        </div>
      )}
    </div>
  );
}
