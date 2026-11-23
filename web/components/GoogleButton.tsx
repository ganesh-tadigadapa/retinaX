"use client";
/**
 * "Sign in with Google" — Google Identity Services, loaded straight from Google.
 *
 * Google draws the button and runs the account chooser; we get back an ID token
 * (`credential`) and hand it to `onCredential`. That token means nothing to the browser:
 * the API verifies it and issues our own session (src/auth/google.py).
 *
 * No npm dependency: the GIS script is the official distribution and must come from
 * accounts.google.com anyway.
 */
import { useEffect, useRef, useState } from "react";
import { googleClientId } from "@/lib/auth";

declare global {
  interface Window { google?: any }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error("gis load failed")); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

export default function GoogleButton({ onCredential, text = "continue_with", disabled }: {
  onCredential: (credential: string) => void;
  /** Google's own button wording: "signin_with" | "signup_with" | "continue_with". */
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  // GIS captures the callback once at initialize(). A ref keeps it pointing at the
  // latest closure, so form state typed AFTER the button rendered is not lost.
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = await googleClientId();
      if (cancelled) return;
      if (!clientId) {
        setProblem("Sign in with Google is not configured (GOOGLE_CLIENT_ID).");
        return;
      }
      try {
        await loadGis();
      } catch {
        if (!cancelled) setProblem("Could not load Google sign-in. Check your connection.");
        return;
      }
      if (cancelled || !host.current) return;
      const g = window.google.accounts.id;
      g.initialize({
        client_id: clientId,
        callback: (resp: { credential?: string }) => {
          if (resp?.credential) cb.current(resp.credential);
        },
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      host.current.innerHTML = "";
      g.renderButton(host.current, {
        type: "standard", theme: "outline", size: "large", shape: "pill",
        text, logo_alignment: "left", width: 320,
      });
    })();
    return () => { cancelled = true; };
  }, [text]);

  if (problem) return <div className="err">{problem}</div>;
  return (
    <div
      ref={host}
      className="gbtn"
      style={{ minHeight: 44, display: "flex", justifyContent: "center",
               opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
    />
  );
}
