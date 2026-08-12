import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface InteractiveBackgroundProps {
  isDark?: boolean;
}

export const InteractiveBackground: React.FC<InteractiveBackgroundProps> = ({ isDark = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track cursor coords
    const mouse = { x: -1000, y: -1000, lastX: -1000, lastY: -1000, active: false };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle color configurations based on theme
    const getColors = () => {
      if (isDark) {
        return [
          '139, 92, 246', // violet-500
          '6, 182, 212',  // cyan-500
          '244, 63, 94',  // rose-500
        ];
      } else {
        return [
          '99, 102, 241', // indigo-500
          '13, 148, 136', // teal-600
          '219, 39, 119', // pink-600
        ];
      }
    };

    const colors = getColors();

    const createParticle = (x: number, y: number, isAmbient = false) => {
      const colorRGB = colors[Math.floor(Math.random() * colors.length)];
      const maxLife = isAmbient ? 120 + Math.random() * 120 : 60 + Math.random() * 40;
      
      return {
        x,
        y,
        vx: isAmbient ? (Math.random() - 0.5) * 0.15 : (Math.random() - 0.5) * 0.8,
        vy: isAmbient ? (Math.random() - 0.5) * 0.15 - 0.1 : (Math.random() - 0.5) * 0.8,
        radius: isAmbient ? Math.random() * 1.5 + 0.5 : Math.random() * 1.8 + 0.6,
        color: colorRGB,
        alpha: isAmbient ? Math.random() * 0.1 + 0.05 : 0.25,
        life: maxLife,
        maxLife,
      };
    };

    // Populate ambient particles
    const ambientCount = 35;
    for (let i = 0; i < ambientCount; i++) {
      particles.push(createParticle(Math.random() * width, Math.random() * height, true));
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      
      const dist = Math.hypot(mouse.x - mouse.lastX, mouse.y - mouse.lastY);
      if (dist > 8) {
        particles.push(createParticle(mouse.x, mouse.y));
        if (particles.length > 150) {
          particles.shift();
        }
        mouse.lastX = mouse.x;
        mouse.lastY = mouse.y;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
        const dist = Math.hypot(mouse.x - mouse.lastX, mouse.y - mouse.lastY);
        if (dist > 8) {
          particles.push(createParticle(mouse.x, mouse.y));
          mouse.lastX = mouse.x;
          mouse.lastY = mouse.y;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    // Frame-rate independent physics loops using timestamp delta-times (supports 60Hz, 120Hz, 144Hz, 240Hz, etc.)
    let lastTime = performance.now();
    const animate = (timestamp: number) => {
      // Skip frame if tab is hidden — saves GPU for the scroll compositor
      if (document.hidden) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      const currentTimestamp = timestamp || performance.now();
      const dt = Math.min(50, currentTimestamp - lastTime);
      lastTime = currentTimestamp;
      const timeScale = dt / 16.67;

      ctx.clearRect(0, 0, width, height);
      // 1. Draw connecting lines (very subtle)
      const maxDistance = 75;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const pi = particles[i];
          const pj = particles[j];
          const dist = Math.hypot(pi.x - pj.x, pi.y - pj.y);
          if (dist < maxDistance) {
            const lineAlpha = (1 - dist / maxDistance) * Math.min(pi.alpha, pj.alpha) * 0.15;
            if (lineAlpha > 0.005) {
              ctx.beginPath();
              ctx.moveTo(pi.x, pi.y);
              ctx.lineTo(pj.x, pj.y);
              ctx.strokeStyle = `rgba(${pi.color}, ${lineAlpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      // 2. Draw and update particles
      particles = particles.filter((p) => {
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        p.life -= 1 * timeScale;

        const isAmbient = p.maxLife > 100;
        if (isAmbient) {
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
          p.alpha = (Math.sin(p.life * 0.03) * 0.05) + 0.1;
        } else {
          p.alpha = (p.life / p.maxLife) * 0.25;
        }

        if (p.life <= 0) {
          if (isAmbient) {
            Object.assign(p, createParticle(Math.random() * width, Math.random() * height, true));
            return true;
          }
          return false;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.fill();
        return true;
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(animationId);
    };
  }, [isDark]);

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden bg-[var(--bg-main)] transition-colors duration-500">
      {/* Dynamic blurring background gradient blobs */}
      <div 
        className={`absolute top-[-15%] left-[-15%] w-[65vw] h-[65vw] rounded-full blur-[80px] sm:blur-[120px] pointer-events-none select-none transition-all duration-500 ${
          isDark ? 'bg-violet-600/15' : 'bg-indigo-500/22'
        }`}
        style={{ animation: 'float-blob-slow 22s infinite ease-in-out' }}
      />
      <div 
        className={`absolute bottom-[-15%] right-[-15%] w-[75vw] h-[75vw] rounded-full blur-[90px] sm:blur-[130px] pointer-events-none select-none transition-all duration-500 ${
          isDark ? 'bg-cyan-600/12' : 'bg-sky-400/20'
        }`}
        style={{ animation: 'float-blob-slowest 28s infinite ease-in-out' }}
      />
      <div 
        className={`absolute top-[40%] right-[10%] w-[45vw] h-[45vw] rounded-full blur-[80px] sm:blur-[110px] pointer-events-none select-none transition-all duration-500 ${
          isDark ? 'bg-pink-650/8' : 'bg-pink-400/16'
        }`}
        style={{ animation: 'float-blob-medium 18s infinite ease-in-out' }}
      />

      {/* Interactive canvas trail */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" style={{ willChange: 'transform' }} />
    </div>
  );
};
