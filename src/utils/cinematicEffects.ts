import gsap from "gsap";

/**
 * Cinematic effect utilities for award-winning web experiences
 */

export function animateNumberCounter(
  element: HTMLElement,
  start: number,
  end: number,
  duration: number = 2,
  options?: any
) {
  const obj = { value: start };
  gsap.to(obj, {
    value: end,
    duration,
    onUpdate: () => {
      if (element) {
        element.textContent = Math.round(obj.value).toLocaleString();
      }
    },
    ...options,
  });
}

export function createParticleBurst(
  x: number,
  y: number,
  particleCount: number = 12,
  color: string = "#8B5CF6"
) {
  const particles: HTMLElement[] = [];

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.style.position = "fixed";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.width = "4px";
    particle.style.height = "4px";
    particle.style.borderRadius = "50%";
    particle.style.backgroundColor = color;
    particle.style.boxShadow = `0 0 8px ${color}`;
    particle.style.pointerEvents = "none";
    particle.style.zIndex = "50";
    document.body.appendChild(particle);
    particles.push(particle);

    const angle = (i / particleCount) * Math.PI * 2;
    const velocity = 4 + Math.random() * 3;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;

    gsap.to(particle, {
      x: vx * 100,
      y: vy * 100,
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => {
        document.body.removeChild(particle);
      },
    });
  }
}

export function createMouseTrailGlow(element: HTMLElement) {
  let lastX = 0;
  let lastY = 0;

  element.addEventListener("mousemove", (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update glow position
    const distance = Math.hypot(x - lastX, y - lastY);
    if (distance > 10) {
      lastX = x;
      lastY = y;

      const glow = document.createElement("div");
      glow.style.position = "absolute";
      glow.style.left = `${x}px`;
      glow.style.top = `${y}px`;
      glow.style.width = "40px";
      glow.style.height = "40px";
      glow.style.background = "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)";
      glow.style.borderRadius = "50%";
      glow.style.transform = "translate(-50%, -50%)";
      glow.style.pointerEvents = "none";
      element.appendChild(glow);

      gsap.to(glow, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
          glow.remove();
        },
      });
    }
  });
}

export function createLetterRevealAnimation(elements: NodeListOf<Element>) {
  elements.forEach((el) => {
    const text = el.textContent || "";
    const letters = text.split("");

    el.textContent = "";
    el.innerHTML = letters
      .map((letter) => `<span style="display: inline-block; opacity: 0;">${letter}</span>`)
      .join("");

    const letterSpans = el.querySelectorAll("span");
    gsap.to(letterSpans, {
      opacity: 1,
      duration: 0.05,
      stagger: 0.03,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
      },
    });
  });
}

export function createScrollBounceAnimation(element: HTMLElement) {
  gsap.to(element, {
    y: 0,
    scrollTrigger: {
      trigger: element,
      start: "top center",
      end: "bottom center",
      scrub: 0.6,
      onUpdate: (self) => {
        // Bounce effect on scroll
        const bounce = Math.sin(self.progress * Math.PI) * 8;
        element.style.transform = `translateY(${bounce}px)`;
      },
    },
  });
}

export function createGlitchEffect(element: HTMLElement) {
  const originalText = element.textContent;

  const triggerGlitch = () => {
    const chars = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
    let iterations = 0;

    const glitchInterval = setInterval(() => {
      if (iterations > 10) {
        element.textContent = originalText;
        clearInterval(glitchInterval);
        return;
      }

      element.textContent = (originalText || "").split("").map(() => chars[Math.floor(Math.random() * chars.length)]).join("");
      iterations++;
    }, 50);
  };

  element.addEventListener("mouseenter", triggerGlitch);
}

export function createOrbitAnimation(element: HTMLElement, radius: number = 100, duration: number = 6) {
  gsap.to(element, {
    rotation: 360,
    duration,
    repeat: -1,
    ease: "none",
  });

  // Also apply orbital motion using transform
  element.style.transformOrigin = `center`;
  gsap.set(element, {
    "--orbit-radius": `${radius}px`,
  } as any);
}
