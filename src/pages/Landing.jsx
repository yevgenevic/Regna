import React from 'react';
import { useNavigate } from 'react-router-dom';
import VideoBackground from '../components/VideoBackground';
import './Landing.css';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <>
            <div className="halftone-overlay" />
            <VideoBackground />

            <main className="landing-main fade-in-up">
                <header className="landing-header">
                    <h1 className="logo text-display animate-glitch">RAGNA</h1>
                    <nav className="nav-links text-mono">
                        <a onClick={() => navigate('/archives')} className="nav-link" style={{ cursor: 'pointer' }}>ARCHIVES</a>
                        <span className="separator">|</span>
                        <a onClick={() => navigate('/manifesto')} className="nav-link" style={{ cursor: 'pointer' }}>MANIFESTO</a>
                    </nav>
                </header>

                <section className="landing-hero">
                    <div className="hero-content">
                        <h1 className="landing-title text-display">
                            <span className="stroke-text">INK</span> YOUR <br />
                            VISION <span className="red-dot">.</span>
                        </h1>
                        <p className="landing-subtitle text-mono">
                            The next-generation Manga drafting AI. Turn your text prompts into cinematic, monochrome storyboards in seconds.
                        </p>

                        <div className="cta-group">
                            <button
                                onClick={() => navigate('/forge')}
                                className="btn-primary text-display"
                            >
                                ENTER THE FORGE
                            </button>
                            <a href="#demo" className="btn-secondary text-mono">
                                [ READ_MANUAL ]
                            </a>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="decorative-panel panel-1 animate-glitch" style={{ backgroundImage: "url('/examples/manga_example_1_1772907221967.png')" }}>
                            <div className="panel-inner"></div>
                        </div>
                        <div className="decorative-panel panel-2" style={{ backgroundImage: "url('/examples/manga_example_2_1772907237806.png')" }}>
                            <div className="panel-inner"></div>
                        </div>
                        <div className="decorative-panel panel-3 animate-glitch" style={{ animationDelay: '0.5s', backgroundImage: "url('/examples/manga_example_3_1772907255039.png')" }}>
                            <div className="panel-inner"></div>
                        </div>
                    </div>
                </section>

                <section id="about" className="landing-features">
                    <div className="feature-card">
                        <h3 className="text-display">BRUTALIST <br /> AESTHETICS</h3>
                        <p className="text-mono">High-contrast, mono-ink generations optimized for impact. No fluff, just pure manga energy.</p>
                    </div>
                    <div className="feature-card">
                        <h3 className="text-display">DYNAMIC <br /> COMPOSITIONS</h3>
                        <p className="text-mono">AI-driven panel layouts that naturally guide the reader's eye across the page action.</p>
                    </div>
                    <div className="feature-card">
                        <h3 className="text-display">RAPID <br /> ITERATION</h3>
                        <p className="text-mono">Concept to storyboard in 4 seconds. Keep your creative momentum flowing without interruption.</p>
                    </div>
                </section>

                <footer className="landing-footer text-mono">
                    <p>© 2026 RAGNA PROTOCOL // SYSTEM ONLINE</p>
                    <div className="status-bars">
                        <div className="bar filled"></div>
                        <div className="bar filled"></div>
                        <div className="bar filled"></div>
                        <div className="bar empty"></div>
                    </div>
                </footer>
            </main>
        </>
    );
}
