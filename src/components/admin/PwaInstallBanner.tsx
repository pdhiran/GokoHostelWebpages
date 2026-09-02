"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DownloadIcon, BellIcon, SmartphoneIcon, XIcon, CheckCircleIcon, Loader2Icon, SendIcon, BellOffIcon } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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
  const [vapidPublicKey, setVapidPublicKey] = useState("");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [pushError, setPushError] = useState("");
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [installed, setInstalled] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    fetch("/api/push", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setVapidPublicKey(data.publicKey || ""))
      .catch(() => setPushError("Could not load notification configuration"));
  }, []);

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
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(async (reg) => {
        reg.update().catch(() => {});
        setSwRegistration(reg);
        if (reg.pushManager) {
          let sub = await reg.pushManager.getSubscription();
          if (!sub && Notification.permission === "granted" && vapidPublicKey) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
          }
          if (sub) {
            fetch("/api/push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "subscribe", password, username,
                subscription: sub.toJSON(), userLabel: username || "admin",
              }),
            }).then(async (res) => {
              if (res.ok) {
                setPushSubscribed(true);
              } else {
                setPushSubscribed(false);
                setPushError((await res.json()).error || "Notification subscription needs attention");
              }
            }).catch(() => setPushError("Notification subscription needs attention"));
          }
        }
      }).catch(() => setPushError("Notifications are unavailable in this browser"));
    } else {
      setPushError("Notifications are unavailable in this browser");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
    };
  }, [password, username, vapidPublicKey]);

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
    if (!vapidPublicKey || subscribing) return;
    setSubscribing(true);
    setPushError("");
    try {
      if (!("serviceWorker" in navigator) || typeof Notification === "undefined") {
        throw new Error("Push notifications are not supported by this browser");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("Notifications are blocked in browser settings");
        return;
      }

      const registration = swRegistration || await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      setSwRegistration(registration);
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          password,
          username,
          subscription: subscription.toJSON(),
          userLabel: username || "admin",
        }),
      });

      if (res.ok) {
        setPushSubscribed(true);
      } else {
        setPushError((await res.json()).error || "Could not enable notifications");
      }
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Could not enable notifications");
    } finally {
      setSubscribing(false);
    }
  }, [swRegistration, vapidPublicKey, password, username, subscribing]);

  const handleTestPush = useCallback(async () => {
    setPushError("");
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", password, username }),
    });
    const data = await res.json();
    if (!res.ok || data.delivery?.delivered === 0) setPushError(data.error || "No subscribed device accepted the test");
  }, [password, username]);

  const handleUnsubscribePush = useCallback(async () => {
    if (!swRegistration) return;
    const subscription = await swRegistration.pushManager.getSubscription();
    if (!subscription) return setPushSubscribed(false);
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", password, username, endpoint: subscription.endpoint }),
    });
    if (!res.ok) return setPushError((await res.json()).error || "Could not disable notifications");
    await subscription.unsubscribe();
    setPushSubscribed(false);
  }, [swRegistration, password, username]);

  const showInstallButton = installPrompt && !isStandalone && !installed;
  const showIosInstall = isIos && !isStandalone && !installed;
  const showPushButton = !pushSubscribed;
  const pushUnavailable = !vapidPublicKey;

  return (
    <>
      <div className="flex items-center gap-1.5" title={pushError || undefined}>
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
            disabled={subscribing || pushUnavailable}
            className="gap-1 text-xs"
            title={pushError || (pushUnavailable ? "Notifications are not configured" : "Enable booking, food order, and check-in notifications")}
          >
            {subscribing ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellIcon className="h-3.5 w-3.5" />
            )}
            <span>{pushUnavailable ? "Notifications not configured" : "Enable notifications"}</span>
          </Button>
        )}

        {/* Push subscribed indicator */}
        {pushSubscribed && (
          <span className="flex items-center gap-1 text-[10px] text-green-600" title="Push notifications enabled">
            <CheckCircleIcon className="h-3 w-3" />
            <span>Notifications on</span>
          </span>
        )}

        {pushSubscribed && (
          <>
            <Button type="button" variant="ghost" size="icon" onClick={handleTestPush} className="h-7 w-7" title="Send test notification">
              <SendIcon className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={handleUnsubscribePush} className="h-7 w-7" title="Disable notifications">
              <BellOffIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {pushError && <span className="text-[10px] text-red-600">{pushError}</span>}

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
