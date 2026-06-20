"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DownloadIcon, BellIcon, SmartphoneIcon, XIcon, CheckCircleIcon, Loader2Icon } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function PwaInstallBanner({ password, username }: { password: string; username?: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [installed, setInstalled] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(ios);

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      promptRef.current = promptEvent;
      setInstallPrompt(promptEvent);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
        setSwRegistration(reg);
        if ("PushManager" in window) {
          setPushSupported(true);
          reg.pushManager.getSubscription().then((sub) => {
            if (sub) setPushSubscribed(true);
          });
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = promptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setInstallPrompt(null);
      promptRef.current = null;
    }
  }, []);

  const handleSubscribePush = useCallback(async () => {
    if (!swRegistration || !VAPID_PUBLIC_KEY || subscribing) return;
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSubscribing(false);
        return;
      }

      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          password,
          subscription: subscription.toJSON(),
          userLabel: username || "admin",
        }),
      });

      if (res.ok) {
        setPushSubscribed(true);
      }
    } catch {
      // Subscription failed silently
    } finally {
      setSubscribing(false);
    }
  }, [swRegistration, password, username, subscribing]);

  const showInstallButton = installPrompt && !isStandalone && !installed;
  const showIosInstall = isIos && !isStandalone && !installed;
  const showPushButton = pushSupported && !pushSubscribed && VAPID_PUBLIC_KEY;

  if (!showInstallButton && !showIosInstall && !showPushButton && !pushSubscribed) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Android install */}
        {showInstallButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleInstall}
            className="gap-1 text-xs text-brand-green"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Install App</span>
          </Button>
        )}

        {/* iOS install */}
        {showIosInstall && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowIosModal(true)}
            className="gap-1 text-xs text-brand-green"
          >
            <SmartphoneIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Install App</span>
          </Button>
        )}

        {/* Push subscribe */}
        {showPushButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSubscribePush}
            disabled={subscribing}
            className="gap-1 text-xs"
          >
            {subscribing ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellIcon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Notifications</span>
          </Button>
        )}

        {/* Push subscribed indicator */}
        {pushSubscribed && (
          <span className="hidden items-center gap-1 text-[10px] text-green-600 sm:flex" title="Push notifications enabled">
            <CheckCircleIcon className="h-3 w-3" />
          </span>
        )}

      </div>

      {/* iOS instructions modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50" onClick={() => setShowIosModal(false)}>
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-brand-mist bg-white dark:bg-card p-5 shadow-2xl dark:shadow-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green/10">
                  <SmartphoneIcon className="h-4 w-4 text-brand-green" />
                </div>
                <h4 className="font-display text-base font-bold text-brand-green-dark">Install Goko App</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="rounded-lg p-1.5 text-brand-green-dark/40 hover:bg-brand-sand"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 space-y-4 text-sm text-brand-green-dark/80">
              <p className="font-medium">To install on your iPhone / iPad:</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-white">1</span>
                  <p>Tap the <strong>Share</strong> button <span className="inline-block rounded bg-brand-sand px-1.5 py-0.5 text-xs font-medium">⬆</span> at the bottom of Safari</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-white">2</span>
                  <p>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-white">3</span>
                  <p>Tap <strong>&quot;Add&quot;</strong> in the top right</p>
                </div>
              </div>
              <p className="rounded-lg bg-brand-sand/60 px-3 py-2 text-xs text-brand-green-dark/50">
                The app will appear on your home screen and open in full-screen mode. Push notifications require iOS 16.4+.
              </p>
            </div>
            <div className="mt-5">
              <Button type="button" onClick={() => setShowIosModal(false)} className="w-full">
                Got it
              </Button>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}
