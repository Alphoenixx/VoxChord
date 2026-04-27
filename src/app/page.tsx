"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    // Listen for messages from the iframe to navigate
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'NAVIGATE_TO_SESSION') {
        router.push('/session');
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  return (
    <iframe
      src="/landing.html"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'block',
        zIndex: 9999,
      }}
      allow="microphone"
      title="VoxChord Landing"
    />
  );
}
