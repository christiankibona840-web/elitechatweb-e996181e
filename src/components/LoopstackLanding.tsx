import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';

const ASSET_BASE = 'https://api.getlayers.ai/storage/v1/object/public/public/assets/loopstack-f8c64439bf';

const CSS = `
.loopstack-root { background-color:#000; min-height:100vh; overflow:hidden; position:relative; }
.loopstack-root #top-gradient { position:fixed; top:-30vh; left:0; width:100vw; height:auto; display:block; z-index:0; pointer-events:none; }
.loopstack-root .hero-content { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; text-align:center; padding-top:6vh; width:95%; max-width:1100px; margin:0 auto; }
.loopstack-root .hero-title { font-family:'Playfair Display', Georgia, serif; font-size:2.8rem; font-weight:400; color:#fff; line-height:1.15; margin-bottom:2.2rem; letter-spacing:-0.015em; text-shadow:0 4px 30px rgba(0,0,0,0.5); }
.loopstack-root .hero-btn { font-family:'Outfit', sans-serif; font-size:1.1rem; font-weight:500; letter-spacing:0.02em; color:#fff; background-color:#000; border:1px solid rgba(255,255,255,0.18); padding:1.3rem 2.5rem; border-radius:9999px; display:inline-flex; align-items:center; gap:0.9rem; cursor:pointer; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow:0 4px 25px rgba(0,0,0,0.4); outline:none; }
.loopstack-root .hero-btn:hover { background-color:#fff; color:#000; border-color:#fff; transform:translateY(-2px); box-shadow:0 6px 30px rgba(0,0,0,0.3); }
.loopstack-root .hero-btn:active { transform:translateY(0); }
.loopstack-root .blinking-dot { width:10px; height:10px; background-color:#39FF14; border-radius:50%; position:relative; display:inline-block; animation:pulse-glow 2s infinite ease-in-out; }
.loopstack-root .blinking-dot::after { content:''; position:absolute; top:-5px; left:-5px; right:-5px; bottom:-5px; background-color:rgba(57,255,20,0.45); border-radius:50%; animation:wave-expand 2s infinite ease-in-out; }
@keyframes pulse-glow { 0%,100% { opacity:0.5; transform:scale(0.85); box-shadow:0 0 4px rgba(57,255,20,0.3);} 50% { opacity:1; transform:scale(1.1); box-shadow:0 0 12px rgba(57,255,20,0.9);} }
@keyframes wave-expand { 0% { transform:scale(0.6); opacity:0.9;} 100% { transform:scale(2.3); opacity:0;} }
.loopstack-root .footer-container { position:fixed; top:50vh; left:20px; right:20px; width:calc(100vw - 40px); transform:translateY(-50%); z-index:3; display:flex; flex-direction:column; }
.loopstack-root .footer-top { display:flex; justify-content:space-between; align-items:flex-end; width:100%; padding:0 5px; }
.loopstack-root .footer-title { font-family:'General Sans', -apple-system, sans-serif; font-size:1.4rem; font-weight:400; color:#fff; letter-spacing:-0.015em; margin:0; }
.loopstack-root .footer-title.quote { text-transform:none; }
.loopstack-root .footer-divider { border:none; height:1px; background-color:rgba(255,255,255,0.2); margin:1.6rem 0; width:100%; }
.loopstack-root .footer-bottom { display:flex; justify-content:space-between; align-items:center; width:100%; padding:0 5px; }
.loopstack-root .footer-socials { display:flex; gap:1.25rem; align-items:center; flex:1; }
.loopstack-root .social-icon { color:rgba(255,255,255,0.55); transition:all 0.3s cubic-bezier(0.16,1,0.3,1); display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
.loopstack-root .social-icon:hover { color:#fff; transform:translateY(-2px); }
.loopstack-root .footer-links { display:flex; gap:2.8rem; justify-content:center; align-items:center; flex:2; }
.loopstack-root .footer-link { font-family:'Outfit', sans-serif; font-size:0.95rem; font-weight:400; color:#fff; text-decoration:none; letter-spacing:0.03em; transition:opacity 0.3s ease, transform 0.3s ease; cursor:pointer; background:none; border:none; }
.loopstack-root .footer-link:hover { opacity:0.75; transform:translateY(-1px); }
.loopstack-root .footer-copyright { font-family:'Outfit', sans-serif; font-size:0.95rem; font-weight:400; color:rgba(255,255,255,0.45); text-align:right; flex:1; letter-spacing:0.02em; }
.loopstack-root .footer-logo-wrap { position:fixed; bottom:20px; left:0; right:0; width:100%; padding:0 20px; box-sizing:border-box; display:flex; justify-content:center; align-items:center; z-index:3; margin:0; }
.loopstack-root .footer-logo-text { font-family:'General Sans', -apple-system, sans-serif; font-size:21.9vw; font-weight:400; color:#fff; letter-spacing:-0.03em; margin-right:-0.03em; transform:translateX(-20px); line-height:0.8; margin-top:0; margin-bottom:0; margin-left:0; text-align:center; width:100%; pointer-events:none; opacity:0.95; text-shadow:none; white-space:nowrap; }
.loopstack-root .video-container { position:fixed; bottom:0; left:0; width:100vw; height:90vh; overflow:hidden; z-index:-1; }
.loopstack-root #bg-video { width:100%; height:110%; object-fit:cover; display:block; transform:translateY(0%); }
.loopstack-root .glass-cursor-card { position:fixed; top:0; left:0; z-index:99999; pointer-events:none; padding:0.75rem 1.5rem; background:rgba(255,255,255,0.08); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.18); border-radius:9999px; box-shadow:inset 0 1px 0 0 rgba(255,255,255,0.15); transform:translate(-50%,-50%) scale(0); opacity:0; will-change:transform,opacity; transition:opacity 0.4s cubic-bezier(0.16,1,0.3,1), background 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s cubic-bezier(0.16,1,0.3,1); }
.loopstack-root .glass-cursor-card.active { opacity:1; }
.loopstack-root .cursor-card-text { font-family:'General Sans', -apple-system, sans-serif; font-size:0.85rem; font-weight:500; letter-spacing:0.06em; color:#39FF14; text-transform:uppercase; white-space:nowrap; text-shadow:0 0 8px rgba(57,255,20,0.45); }
.loopstack-root .cursor-card-text .text-white-c { color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.25); }
.loopstack-root .cursor-ring-outline { position:fixed; top:0; left:0; width:48px; height:48px; border:1.5px solid rgba(255,255,255,0.45); border-radius:50%; z-index:99998; pointer-events:none; transform:translate(-50%,-50%) scale(0); opacity:0; will-change:transform,opacity; transition:opacity 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s ease; }
.loopstack-root .cursor-ring-outline.active { opacity:1; }
.loopstack-root .cursor-ring-outline.expanded { border-color:rgba(255,255,255,0.15); }
.loopstack-root .hero-title .word-wrapper { display:inline-block; overflow:hidden; vertical-align:bottom; padding-bottom:0.15em; margin-bottom:-0.15em; }
.loopstack-root .hero-title .word-inner { display:inline-block; opacity:0; transform:translateY(105%); filter:blur(20px); animation:word-reveal-mask 1.3s cubic-bezier(0.05,0.9,0.1,1) forwards; }
@keyframes word-reveal-mask { 0% { opacity:0; transform:translateY(105%); filter:blur(20px);} 30% { opacity:1;} 100% { opacity:1; transform:translateY(0); filter:blur(0);} }
.loopstack-root .footer-logo-text .letter-wrapper { display:inline-block; overflow:hidden; vertical-align:bottom; line-height:0.8; }
.loopstack-root .footer-logo-text .letter-inner { display:inline-block; opacity:0; transform:translateX(-105%); filter:blur(20px); animation:letter-reveal-mask 1.2s cubic-bezier(0.05,0.9,0.1,1) forwards; }
@keyframes letter-reveal-mask { 0% { opacity:0; transform:translateX(-105%); filter:blur(20px);} 25% { opacity:1;} 100% { opacity:0.95; transform:translateX(0); filter:blur(0);} }
@media (max-width: 700px) {
  .loopstack-root .hero-title { font-size:1.8rem; }
  .loopstack-root .footer-links { display:none; }
  .loopstack-root .footer-title { font-size:1rem; }
  .loopstack-root .footer-copyright { font-size:0.8rem; }
}
`;

const LoopstackLanding = () => {
  const navigate = useNavigate();
  const logoRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Split reveals
  useEffect(() => {
    const logoText = logoRef.current;
    if (logoText && !logoText.querySelector('.letter-wrapper')) {
      const text = (logoText.textContent || '').trim();
      logoText.innerHTML = '';
      [...text].forEach((char, index) => {
        const wrapper = document.createElement('span');
        wrapper.className = 'letter-wrapper';
        const inner = document.createElement('span');
        inner.textContent = char === ' ' ? '\u00A0' : char;
        inner.className = 'letter-inner';
        inner.style.animationDelay = `${index * 0.09}s`;
        wrapper.appendChild(inner);
        logoText.appendChild(wrapper);
      });
    }

    const heroTitle = titleRef.current;
    if (heroTitle && !heroTitle.querySelector('.word-wrapper')) {
      const parts = heroTitle.innerHTML.split(/(\s+|<br\s*\/?>)/i);
      heroTitle.innerHTML = '';
      let wordIndex = 0;
      parts.forEach(part => {
        if (!part) return;
        if (part.trim() === '') {
          heroTitle.appendChild(document.createTextNode(' '));
        } else if (part.toLowerCase().startsWith('<br')) {
          heroTitle.appendChild(document.createElement('br'));
        } else {
          const wrapper = document.createElement('span');
          wrapper.className = 'word-wrapper';
          const inner = document.createElement('span');
          inner.className = 'word-inner';
          inner.textContent = part;
          inner.style.animationDelay = `${wordIndex * 0.1}s`;
          wrapper.appendChild(inner);
          heroTitle.appendChild(wrapper);
          wordIndex++;
        }
      });
    }
  }, []);

  // Custom cursor physics
  useEffect(() => {
    const glassCard = cardRef.current;
    const cursorRing = ringRef.current;
    const heroBtn = btnRef.current;
    if (!glassCard || !cursorRing) return;

    let mouseX = 0, mouseY = 0, cardX = 0, cardY = 0, ringX = 0, ringY = 0;
    let scale = 0, targetScale = 0, isFirstMove = true, isHoveringBtn = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX; mouseY = e.clientY;
      if (isFirstMove) {
        cardX = mouseX; cardY = mouseY; ringX = mouseX; ringY = mouseY;
        isFirstMove = false;
        glassCard.classList.add('active');
        cursorRing.classList.add('active');
      }
      if (!isHoveringBtn) targetScale = 1;
    };
    const onLeave = () => { targetScale = 0; };
    const onEnter = () => { if (!isHoveringBtn) targetScale = 1; };
    const onBtnEnter = () => { isHoveringBtn = true; targetScale = 0; cursorRing.classList.add('expanded'); };
    const onBtnLeave = () => { isHoveringBtn = false; targetScale = 1; cursorRing.classList.remove('expanded'); };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    heroBtn?.addEventListener('mouseenter', onBtnEnter);
    heroBtn?.addEventListener('mouseleave', onBtnLeave);

    const updatePhysics = () => {
      cardX += (mouseX - cardX) * 0.08;
      cardY += (mouseY - cardY) * 0.08;
      ringX = mouseX; ringY = mouseY;
      scale += (targetScale - scale) * 0.15;
      const currentRingScale = cursorRing.classList.contains('expanded') ? 1.6 * scale : scale;
      glassCard.style.transform = `translate3d(${cardX}px, ${cardY}px, 0) translate(-50%, -50%) scale(${scale})`;
      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${currentRingScale})`;
      raf = requestAnimationFrame(updatePhysics);
    };
    updatePhysics();

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      heroBtn?.removeEventListener('mouseenter', onBtnEnter);
      heroBtn?.removeEventListener('mouseleave', onBtnLeave);
    };
  }, []);

  const enter = () => navigate({ to: '/app' });

  return (
    <div className="loopstack-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <img id="top-gradient" src={`${ASSET_BASE}/black_gradient.svg`} alt="" />

      <div className="hero-content">
        <h1 className="hero-title" ref={titleRef}>
          Apply Now to be part <br /> of the closed beta
        </h1>
        <button className="hero-btn" ref={btnRef} onClick={enter}>
          Book a demo
          <span className="blinking-dot" />
        </button>
      </div>

      <footer className="footer-container">
        <div className="footer-top">
          <h2 className="footer-title">Stay in Touch</h2>
          <h2 className="footer-title quote">Think. Build. Repeat.</h2>
        </div>

        <hr className="footer-divider" />

        <div className="footer-bottom">
          <div className="footer-socials">
            <a href="#" className="social-icon" aria-label="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
            <a href="#" className="social-icon" aria-label="X">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="#" className="social-icon" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
            </a>
          </div>

          <nav className="footer-links">
            <button className="footer-link" onClick={enter}>About</button>
            <button className="footer-link" onClick={enter}>Features</button>
            <button className="footer-link" onClick={enter}>Pricing</button>
            <button className="footer-link" onClick={enter}>Contact</button>
          </nav>

          <div className="footer-copyright">© 2026 Loopstack</div>
        </div>
      </footer>

      <div className="footer-logo-wrap">
        <h2 className="footer-logo-text" ref={logoRef}>Loopstack</h2>
      </div>

      <div className="video-container">
        <video id="bg-video" autoPlay muted loop playsInline>
          <source src={`${ASSET_BASE}/flower.mp4`} type="video/mp4" />
        </video>
      </div>

      <div className="cursor-ring-outline" ref={ringRef} />
      <div className="glass-cursor-card" ref={cardRef}>
        <span className="cursor-card-text"><span className="text-white-c">Say</span> Hello!</span>
      </div>
    </div>
  );
};

export default LoopstackLanding;
