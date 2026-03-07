import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Manifesto.css';

const MANIFESTO_SECTIONS = [
    {
        id: 'void',
        title: 'THE VOID',
        text: 'Blank pages are obsolete. We do not fear the void; we compute it.',
        keywords: ['void', 'compute'],
    },
    {
        id: 'ink',
        title: 'THE INK',
        text: 'Pure contrast. No colors to hide behind. Just black, white, and the raw logic of the narrative. Every stroke is decisive. Every shadow is intentional. The halftone grid is our canvas — each dot a pixel in the language of ink.',
        keywords: ['contrast', 'halftone', 'ink'],
    },
    {
        id: 'forge',
        title: 'THE FORGE',
        text: 'The machine does not replace the mangaka. It becomes the pen. You provide the soul, RAGNA provides the execution. Whether it is a brutal tournament of gods or the quiet isolation of a cyberpunk samurai, the algorithm bends to your will.',
        keywords: ['Forge', 'mangaka', 'algorithm'],
    },
    {
        id: 'protocol',
        title: 'THE PROTOCOL',
        text: 'We do not compromise. The pipeline is absolute: prompt enters, panels emerge. Text and image interleave in strict sequence — narration, dialogue, visual, sfx. Every beat calculated. Every frame rendered from the monochrome void.',
        keywords: ['protocol', 'monochrome', 'absolute'],
    },
    {
        id: 'execution',
        title: 'THE EXECUTION',
        text: 'System online. All subsystems nominal. The forge awaits your command. Speak your vision into the void and watch it crystallize into panels of ink and shadow.',
        keywords: ['execution', 'crystallize'],
        isFinal: true,
    },
];

export default function Manifesto() {
    const navigate = useNavigate();
    const sectionsRef = useRef([]);

    useEffect(() => {
        // Intersection Observer for scroll-triggered reveal
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        // Start typing animation
                        const textEl = entry.target.querySelector('.manifesto-text');
                        if (textEl && !textEl.dataset.typed) {
                            textEl.dataset.typed = 'true';
                            typeText(textEl);
                        }
                    }
                });
            },
            { threshold: 0.3, rootMargin: '-50px' }
        );

        sectionsRef.current.forEach(el => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    function typeText(element) {
        const fullText = element.getAttribute('data-text');
        element.textContent = '';
        element.style.opacity = '1';
        let i = 0;
        const speed = 20;

        function type() {
            if (i < fullText.length) {
                element.textContent += fullText.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    function renderHighlightedTitle(title, keywords) {
        return title.split(' ').map((word, i) => {
            const isKeyword = keywords.some(k =>
                word.toLowerCase().includes(k.toLowerCase())
            );
            return (
                <span key={i}>
                    {isKeyword ? (
                        <span className="keyword animate-glitch">{word}</span>
                    ) : (
                        word
                    )}
                    {' '}
                </span>
            );
        });
    }

    return (
        <>
            <div className="halftone-overlay" />

            <main className="manifesto-main">
                <header className="manifesto-header fade-in-up">
                    <h1 className="logo text-display animate-glitch" onClick={() => navigate('/')}>RAGNA</h1>
                    <nav className="nav-links text-mono">
                        <a onClick={() => navigate('/')} className="nav-link">HOME</a>
                        <span className="separator">|</span>
                        <a onClick={() => navigate('/forge')} className="nav-link">FORGE</a>
                        <span className="separator">|</span>
                        <a onClick={() => navigate('/archives')} className="nav-link">ARCHIVES</a>
                    </nav>
                </header>

                <div className="manifesto-intro fade-in-up">
                    <h2 className="manifesto-super-title text-display">
                        MANIFESTO<span className="red-dot">.</span>
                    </h2>
                    <p className="manifesto-subtitle text-mono">
                        // THE RULES OF THE FORGE — READ. UNDERSTAND. OBEY.
                    </p>
                    <div className="divider-line" />
                </div>

                <div className="manifesto-sections">
                    {MANIFESTO_SECTIONS.map((section, index) => (
                        <section
                            key={section.id}
                            ref={el => sectionsRef.current[index] = el}
                            className={`manifesto-section ${section.isFinal ? 'final-section' : ''}`}
                        >
                            <div className="section-number text-mono">
                                {String(index + 1).padStart(2, '0')}
                            </div>

                            <h2 className="section-title text-display">
                                {renderHighlightedTitle(section.title, section.keywords)}
                            </h2>

                            <p
                                className="manifesto-text text-mono"
                                data-text={section.text}
                                style={{ opacity: 0 }}
                            >
                                {section.text}
                            </p>

                            {section.isFinal && (
                                <div className="manifesto-cta">
                                    <button
                                        onClick={() => navigate('/forge')}
                                        className="cta-btn text-display"
                                    >
                                        INITIALIZE PROTOCOL
                                    </button>
                                    <div className="cta-status text-mono">
                                        <span className="status-dot" />
                                        SYSTEM_ONLINE — AWAITING_COMMAND
                                    </div>
                                </div>
                            )}

                            {!section.isFinal && <div className="section-divider" />}
                        </section>
                    ))}
                </div>

                <footer className="manifesto-footer text-mono">
                    <p>© 2026 RAGNA PROTOCOL // ALL SYSTEMS NOMINAL</p>
                    <div className="status-bars">
                        <div className="bar filled" />
                        <div className="bar filled" />
                        <div className="bar filled" />
                        <div className="bar filled" />
                    </div>
                </footer>
            </main>
        </>
    );
}
