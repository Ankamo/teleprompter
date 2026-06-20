"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service worker registrado:', reg);
        })
        .catch((err) => {
          console.warn('Fallo al registrar service worker:', err);
        });
    });
  }, []);

  return null;
}
